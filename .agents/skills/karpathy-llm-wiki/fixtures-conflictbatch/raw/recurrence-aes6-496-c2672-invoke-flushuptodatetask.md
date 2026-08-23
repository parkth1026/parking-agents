---
schema: raw-knowledge/2
base_url: http://10.66.12.40
job: aes6-ue-runtime-ci
job_code: aes6
job_path: job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci
fail_builds: 496
fix_build: 497
error_code: C2672
score: 9
result: failure:score=9:C2672:fix=#497:see=//nas.51vr.local/x.public/UE5/ue-llm-wiki/wiki/details/aes6-496-c2672-invoke-flushuptodatetask.md
primary_fix_commit: 6c5885a4c
recorded_at: 2026-08-17T06:05:12
---

# C2672: TMap::Find 双重指针未解引用直传 Invoke 致模板特化失败

> **Recurrence 说明**：wikiDir 已有同一构建对 #496 的知识文件（只读，未修改）：
> `//nas.51vr.local/x.public/UE5/ue-llm-wiki/wiki/details/aes6-496-c2672-invoke-flushuptodatetask.md`
> 该文件与本文件为同错误码 C2672 + 同根因（Invoke 模板实参不匹配）。本文件为 v2 recurrence 记录，
> 补齐三重身份锚、pin 比对、真实 diff、Epic 官方指导与 Warning Trend；跟踪账本结论串以 `:see=` 指向上述 wiki 原始文件。

## Error Message

```
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Source\AesMarkerSystem\Private\Core\AesMarkerCache.hpp(390): error C2672: 'Invoke': no matching overloaded function found
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Source\AesMarkerSystem\Private\Core\AesMarkerCache.hpp(390): error C2893: Failed to specialize function template 'unknown-type Invoke(FuncType &&,ArgTypes &&...)'
C:\Epic\UE_5.1\Engine\Source\Runtime\Core\Public\Templates\Invoke.h(44): note: see declaration of 'Invoke'
        FuncType=CallableType &
        ArgTypes={TAesMarkerCache<FAesMarkerInfo>::FMarker *const *&}
```

同一错误在 27 个编译单元重复（模板链 `TAesMarkerProducer` → `TAesScopedMarker::GetUpToDateCompletionEvent` → `FlushUpToDateTask` → `ForEachMarker<lambda_1>` 被逐一实例化），最终 `ExitCode=6`，BUILD FAILED。

## Root Cause

**什么坏了**：`TAesMarkerCache::ForEachMarker(int, const TArray&, CallableType)` 内部用 `UsedMarkers.Find(InternalMarkerId)` 取 marker——`TMap::Find` 返回的是**指向值的指针**（值本身是 `FMarker*`，所以得到 `FMarker* const*`，即双重指针）——随后把该双重指针**未解引用**直接传给 `Invoke(Callable, pMarker)`，而所有调用方 lambda 的签名是 `(FMarker* Marker)`（单指针）。

**为什么坏了**：UE5.1 `Templates/Invoke.h` 的 `Invoke` 是完美转发模板，`FMarker* const*&` 无法绑定到期望 `FMarker*` 的调用算子（二级指针到一级指针无隐式转换），模板实参推导失败 → C2672 + C2893。

**引入侧（culprit）**：`6ea1ec5b1`（2024-05-10，"修复创建的建筑没出来的问题"，AesWorld 仓库）整体引入 `ForEachMarker` 机制时写下了这行错误调用；同提交内另外两个单参重载传的 `Pair.Value` / `Marker` 本身就是 `FMarker*`，只有走 `Find()` 的三参重载漏了解引用。

**为什么拖到 #496 才炸**：模板成员函数只有被实例化才编译——任何实例化 `TAesMarkerProducer<FAesMarkerInfo>` 链的 27 个翻译单元全部命中。

## Fix

修复构建 #497 相对 #496 的 pin 比对：五个仓库中**唯一**变化是 AesWorld `6ea1ec5b` → `6c5885a4`（恰好一个提交）；错误文件 `AesMarkerCache.hpp` 正位于 AesWorld 仓库——归因链强。

- **Commit**: `6c5885a4c` by xiongxing（2024-05-11）
- **Message**: "# 1.修复编译错误。"
- **What changed**: 错误行单字符级修复——解引用后传入；同提交还在 `AesVectorDataLayer.cpp` 的 Undo/Redo 中补调 `FlushUpToDateTask__Internal`（功能性伴随变更，与本编译错误无关）。

真实 diff（`git show 6c5885a4c`，AesWorld 仓库）：

```diff
--- a/Source/AesMarkerSystem/Private/Core/AesMarkerCache.hpp
+++ b/Source/AesMarkerSystem/Private/Core/AesMarkerCache.hpp
@@ -387,7 +387,7 @@ void TAesMarkerCache<InMarkerIdType>::ForEachMarker(int InProducerId, const TArr

 		if (pMarker)
 		{
-			Invoke(Callable, pMarker);
+			Invoke(Callable, *pMarker);
 		}
 	}
 }
```

修复后 `*pMarker` 为 `FMarker* const&`，lambda 的 `(FMarker* Marker)` 按值收下，模板实例化成功。

## How to Reproduce / Detect

- 日志 grep 关键词：`error C2672: 'Invoke'`、`Failed to specialize function template`、`AesMarkerCache.hpp(390)`
- 特征签名：`ArgTypes={...FMarker *const *&}` ——实参类型以 `*&` 结尾且比 lambda 形参多一层 `*`，即为"双重指针未解引用"型 Invoke 失败
- 复现：在 AesWorld 仓库 checkout `6ea1ec5b1`，任何触发 `TAesMarkerProducer<FAesMarkerInfo>` 实例化的模块编译都会命中

## Epic Official Guidance

- **Query**: "UE5.1 C++ compilation error: error C2672 'Invoke': no matching overloaded function found, and error C2893 Failed to specialize function template 'Invoke(FuncType &&,ArgTypes &&...)' declared in Templates/Invoke.h(44), in AesMarkerCache.hpp line 390. Template arguments: FuncType=CallableType &, ArgTypes={FMarker *const *&}. The code passed a 'FMarker* const*' obtained from TMap::Find() into Invoke while the lambda callable expects a single 'FMarker*' parameter. What causes this and how to fix it?"
- **Answer**（要点）：`TMap<KeyType, ValueType>::Find(Key)` 返回指向值的指针 `ValueType*`；当 map 的值本身是指针（如 `TMap<FGuid, FMarker*>`）时，`Find()` 返回双重指针 `FMarker**`。把 `Find()` 结果直接传给经由 `Invoke` 转发的可调用对象，会把 `FMarker**` 塞给只要 `FMarker*` 的形参，二级指针到一级指针没有隐式转换，模板特化即告失败。修复=解引用后再传（`*FoundPtr`），且解引用前必须先判 `Find()` 返回非空；备选方案是用 `FindRef`（直接返回值拷贝，缺键得 nullptr）。Epic 的比喻："You gave me a box containing a pointer, but the function wants the pointer inside the box. Use `*` to open the box." 若 map 值为 `TObjectPtr<FMarker>`，`Find()` 返回 `TObjectPtr<FMarker>*`，解引用后还需 `.Get()`。
- **References**:
  - TMap — https://dev.epicgames.com/documentation/unreal-engine/map-containers-in-unreal-engine
  - Unreal Engine 5 Migration Guide — https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-migration-guide

## Prevention

- `TMap<..., T*>::Find()` 的结果是 `T**`：凡是把 `Find()` 结果喂给泛型转发（`Invoke`/`Algo::*`/`TUniqueFunction`）的代码，review 时盯住解引用这一步；形参类型与实参层数不匹配是这类 C2672/C2893 的固定来源。
- 优先考虑 `FindRef`（缺键返回空值），把"找到没"与"取值"合并成一次判空，少一层指针。
- 新增模板化的容器遍历helper（如 `ForEachMarker`）后，本地至少编译一个会实例化该链的模块再推送——模板代码"没被用到就不编译"，CI 才是第一次实例化点。

## Warning Trend

| Build | Warnings |
|-------|----------|
| #496 (fail) | 1 |
| #497 (fix)  | 1 |

趋势：持平（±0）。修复为单行解引用，未引入新警告。

## Recurrences

| Date | Builds | Trigger | Notes |
|------|--------|---------|-------|
| 2026-08-17 | #496 → #497 | 跟踪账本无 #496 条目（此前未落账），scan-pairs 重新入队 | wiki 原始文件误记修复对为 #495/2d30a21，本轮以日志 pin 比对证实实为 #497/6c5885a4；wiki 文件只读未改，勘误记录于此 |
