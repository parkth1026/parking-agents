---
schema: raw-knowledge/2
base_url: http://10.66.12.40
job: aes6-ue-runtime-ci
job_code: aes6
job_path: job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci
fail_builds: 1221-1223
fix_build: 1224
error_code: C2039
score: 9
result: failure:score=9:C2039:fix=#1224
primary_fix_commit: 982f850d
recorded_at: 2026-08-19T02:06:35
---

# C2039: 编辑器专用 Changeset API 未加 WITH_EDITOR 守卫，运行时目标连续编译失败

## Error Message

第一波（#1221、#1222，AesWorld pin 604493ee）：

```
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Source\AesEarth\Private\AesTerrain\AesTerrainComponent.cpp(198): error C2039: 'GetDisplayNameText': is not a member of 'FProperty'
C:\Epic\UE_5.1\Engine\Source\Runtime\CoreUObject\Public\UObject\CoreNet.h(37): note: see declaration of 'FProperty'
```

第二波（#1223，AesWorld pin be14a169，第一波已消失）：

```
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Source\AesEarth\Private\AesEarth.cpp(365): error C2039: 'MergeChangeset': is not a member of 'UAesTerrainComponent'
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Source\AesEarth\Private\AesTerrain\AesTerrainPayload\AesTerrainPayload.h(19): note: see declaration of 'UAesTerrainComponent'
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Source\AesEarth\Private\AesEarth.cpp(371): error C2039: 'ConvertGLBToChangeset': is not a member of 'UAesTerrainComponent'
```

后续链路：cl.exe 返回码 2 → xgConsole ExitCode=1 → `BUILD FAILED` → `AutomationTool exiting with ExitCode=1 (Error_Unknown)`。

## Root Cause

`UAesTerrainComponent::MergeChangeset()` / `ConvertGLBToChangeset()` 是编辑器专用的地形数据生产工具函数（遍历 `UUserDefinedStruct` 行、把 GLB 模型转换成 changeset），但整个函数块从头到尾没有被 `#if WITH_EDITOR` 包住。本 CI 是运行时目标（`For UGA-Win64-Development`，非编辑器构建，WITH_EDITOR=0）：

1. **第一波**：`ConvertGLBToChangeset` 函数体内第 198 行调用 `Prop->GetDisplayNameText()`。该 API 依赖 `WITH_EDITORONLY_DATA` 下的元数据，在非编辑器目标中根本不存在于 `FProperty` 上 → C2039。
2. **第一波的修复引出第二波**：be14a169 给组件侧两个函数加了 `#if WITH_EDITOR`，但调用方 `AAesEarth::MergeChangeset()` / `ConvertGLBToChangeset()`（AesEarth.cpp:365/371）没有同步加守卫——守卫展开后成员在非编辑器目标中消失，调用点立即变成 C2039。

两波是同一个根因的两次暴露：编辑器专用 API（组件实现 + 外层调用者）都没有为非编辑器目标做条件编译，修复分了两个提交才把链路补齐。

## Fix

两个连续提交（作者 luwei，AesWorld dev 分支），均经本地 `git show` 验证：

- **Commit**: `be14a169484131e0eaf2c03450082fa51caf59a8` by luwei, 2024-07-19 10:40（修第一波）
- **Message**: "编译不过的问题"（消息只点名症状，变更内容以下方 diff 为准）
- **What changed**: 给 `AesTerrainComponent.h` 中 `MergeChangeset`/`ConvertGLBToChangeset` 声明与 `.cpp` 中实现整体加 `#if WITH_EDITOR ... #endif`：

```diff
--- a/Source/AesEarth/Private/AesTerrain/AesTerrainComponent.cpp
+#if WITH_EDITOR
 void UAesTerrainComponent::MergeChangeset() const
 {
@@ -251,6 +251,7 @@
 	WorldChangesetSubsystem->SaveToFolder(SavedData, ChangesetFolderPath);
 	WorldChangesetSubsystem->ClearChangesets();
 }
+#endif

--- a/Source/AesEarth/Public/AesTerrain/AesTerrainComponent.h
 	AESEARTH_API TSharedPtr<IAesMarkerSystemInterface> GetMarkerSystem() const { return MarkerSystem; }
+#if WITH_EDITOR
 	void MergeChangeset() const;
 	void ConvertGLBToChangeset(const FString& DataTableFilePath, const FString& GlbModelFolderPath);
+#endif
```

- **Commit**: `982f850d8682ce702fc2ce08056b78c258e5676d` by luwei, 2024-07-19 10:58（修第二波，主修复提交）
- **Message**: "编译不过的问题"（同上）
- **What changed**: 给调用方 `AAesEarth::MergeChangeset()`/`ConvertGLBToChangeset()` 的声明（AesEarth.h）与实现（AesEarth.cpp）同样加 `#if WITH_EDITOR ... #endif`，并顺带清理 4 个未使用 include：

```diff
--- a/Source/AesEarth/Public/AesEarth.h
+#if WITH_EDITOR
 	void MergeChangeset();
-
 	void ConvertGLBToChangeset(const FString& DataTableFilePath, const FString& GlbModelFolderPath);
+#endif

--- a/Source/AesEarth/Private/AesEarth.cpp
+#if WITH_EDITOR
 void AAesEarth::MergeChangeset()
 {
 	if (TerrainComponent)
@@ -370,5 +368,6 @@
 	if (TerrainComponent)
 		TerrainComponent->ConvertGLBToChangeset(DataTableFilePath, GlbModelFolderPath);
 }
+#endif
```

归因强度：强——pin 对比（1223→1224 间仅 AesWorld 变更，be14a169→982f850d，区间内唯一提交）+ 提交直接触及报错文件 AesEarth.cpp/.h + #1224 错误消失。

## How to Reproduce / Detect

- 在非编辑器目标（运行时/打包 CI）编译含编辑器专用反射 API 的代码即可复现。
- 日志 grep 关键词：`is not a member of 'FProperty'`、`'MergeChangeset': is not a member of`、`'ConvertGLBToChangeset': is not a member of`、`UObject/CoreNet.h(37): note: see declaration of 'FProperty'`（CoreNet.h 作为 FProperty 声明点是编辑器 API 误用的典型指纹）。
- 代码侧检查：对调用 `GetDisplayNameText`、`GetMetaData` 等 API 的翻译单元，确认是否处于 `#if WITH_EDITOR` 块内。

## Epic Official Guidance

- **Query**: "UE5.1 C++ compilation error C2039 in a runtime (non-editor) build target: 'GetDisplayNameText': is not a member of 'FProperty', at a line calling Prop->GetDisplayNameText().ToString() while iterating UUserDefinedStruct properties via PropertyLink. Why is FProperty::GetDisplayNameText unavailable in non-editor builds, and what is the recommended way to get a property display name in code that must compile in runtime targets?"
- **Answer**（要点）: `FProperty::GetDisplayNameText()` 是编辑器专用函数——Display Name 与 Tooltips、Categories 等元数据同属 Editor-Only Data，打包/运行时构建中被剥离（底层 `UField::GetMetaData` 包在 `#if WITH_EDITORONLY_DATA` 内），因此非编辑器目标中该函数不存在，直接 C2039。推荐做法：(1) 运行时安全的替代是 `Prop->GetName()`（注意 UUserDefinedStruct 属性名可能带 GUID 后缀，可自行清洗或建 `TMap<FName,FText>` 映射）；(2) 确需显示名则 `#if WITH_EDITOR` 守卫 + `#else` 回退 `GetName()`；(3) 遍历属性建议用 `TFieldIterator<FProperty>` 替代 `PropertyLink` 链。
- **References**:
  - Guide: Investigating Blueprint data loss issues in Unreal Engine — https://dev.epicgames.com/community/learning/knowledge-base/oEn6/guide-investigating-blueprint-data-loss-issues-in-unreal-engine
  - Working with Data in Unreal Engine; Data tables, Data Assets, UPROPERTY specifiers and more! — https://dev.epicgames.com/community/learning/tutorials/Gp9j/working-with-data-in-unreal-engine-data-tables-data-assets-uproperty-specifiers-and-more

## Prevention

- 编辑器专用工具函数（构造/转换生产数据、依赖元数据 API）在**声明与所有调用点**同时加 `#if WITH_EDITOR`；改一处要沿调用链检查另一处——本例组件侧守卫了、调用方漏了，多烧了一轮 CI。
- 提交前在非编辑器配置（如 `Win64 Development` 运行时目标或直接跑运行时 CI）本地编译一遍涉改模块，可拦截此类错误。
- 对 `GetDisplayNameText`/`GetMetaData` 等 EditorOnly API，优先用运行时安全的 `GetName()` 表达同样的键匹配逻辑。

## Warning Trend

| Build | Warnings |
|-------|----------|
| #1221 (fail) | 2 |
| #1222 (fail) | 0 |
| #1223 (fail) | 0 |
| #1224 (fix)  | 0 |
趋势：改善（2 → 0），修复提交未引入新警告。

## Group Context

连续失败组 #1221–1223 含同一根因的两个子模式，分属两个提交修复：

| 构建号 | 日志签名（原句） | 归因强度 | 修复提交 |
|--------|------------------|----------|----------|
| #1221, #1222 | `AesTerrainComponent.cpp(198): error C2039: 'GetDisplayNameText': is not a member of 'FProperty'` | 强（be14a169 diff 直接包裹该行所在函数块；#1223 起该错误消失） | be14a1694 |
| #1223 | `AesEarth.cpp(365): error C2039: 'MergeChangeset': is not a member of 'UAesTerrainComponent'`（同文件 371 行 `ConvertGLBToChangeset` 同型） | 强（982f850d 为 1223→1224 区间唯一提交，直接改 AesEarth.cpp/.h；#1224 错误消失） | 982f850d8 |

## Recurrences

| Date | Builds | Trigger | Notes |
|------|--------|---------|-------|
| 2026-08-19 | #1751, #1754, #1755, #1756 → #1757 | culprit 60f2d57ed（luwei 2024-09-23，"【官方资产库】需要支持生成资产库资产的配置功能"）把 ConvertGLBToChangeset 与 Prop->GetDisplayNameText() 调用复制进新类 AEarthAssistantActor（EarthAssistantActor.cpp +219 行），未带 #if WITH_EDITOR 守卫 | 同因。新变体教训：修复三连提交 70237c4→35c6277→8456084，前两次分别用 `#ifdef WITH_EDITORONLY_DATA`、`#ifdef WITH_EDITOR` 均无效——这两个宏在所有目标中恒有定义（值为 0/1），`#ifdef` 检查存在性恒真；最终 `#if WITH_EDITOR` 按值排除才生效（#1757）。签名 `EarthAssistantActor.cpp(73/74): error C2039: 'GetDisplayNameText': is not a member of 'FProperty'`。评分 9。同组并行子模式 UTexture2D::Source/CompressionNoAlpha（#1751/#1754，修于 #1755）见 aes6-1556-1558 的 Recurrences |
