---
schema: raw-knowledge/2
base_url: http://10.66.12.40
job: aes6-ue-runtime-ci
job_code: aes6
job_path: job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci
fail_builds: 1007-1008
fix_build: 1010
error_code: C1083
score: 10
result: failure:score=10:C1083:fix=#1010
primary_fix_commit: 2eab6d4f7
recorded_at: 2026-08-18T12:04:50
---

# C1083: 运行时构建目标无条件包含编辑器专属头 PropertyEditorModule.h

## Error Message

```
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Source\AesEarth\Private\AesEarthModule.cpp(7): fatal error C1083: Cannot open include file: 'PropertyEditorModule.h': No such file or directory
```

（#1007 与 #1008 同一错误原样复现；编译目标是 `Project: Env_0` / `UGA-Win64-Development`，即不含编辑器模块的运行时目标。C1083 是 fatal，MSVC 在第一个打不开的 include 处即中止，模块内其余翻译单元全部连带失败。）

## Root Cause

`PropertyEditor` 是引擎的**编辑器专属模块**（`Engine/Source/Editor/PropertyEditor/`，Build.cs `Type: Editor`）。非编辑器目标（Game/Program，本例 UGA-Win64-Development）下 UBT 不把编辑器模块加入 include 搜索路径，`PropertyEditorModule.h` 物理上不在编译范围内。

culprit 提交 `2695ba1b7`（PengBo，2024-06-30 22:53:32，"尝试修复CachedObjects在切换关卡时可能无效的问题"）在 `AesEarthModule.cpp` 顶部**无条件**新增了这条 include（IDE 自动补全把新 include 按字母序插在了 `#if WITH_EDITOR` 块之外），而该文件原本已有现成的 `#if WITH_EDITOR` 块收纳编辑器头。开发者本地用 Editor 目标编译通过；CI 的运行时目标随即找不到该头 → C1083。

时间线：22:53 提交 culprit → #1007（22:56）失败 → #1008（23:11）失败 → #1009 NOT_BUILT → 23:12 修复提交 → 23:16 附带清理提交 → #1010 成功。

## Fix

- **Commit**: 2eab6d4f7 by PengBo
- **Message**: "修复Include缺失Width_Editor的报错"（Width_Editor 为 WITH_EDITOR 的笔误）
- **What changed**: 把 include 从无条件区（原第 7 行，正是报错行）移入文件已有的 `#if WITH_EDITOR` 块：

```diff
 #include "AesEntityModule.h"
-#include "PropertyEditorModule.h"
 #include "AesBuilding/AesBuildingPayload/AesBuildingLayer.h"
@@ -21,6 +20,7 @@
 #if WITH_EDITOR
 #include "AesBuilding/AesBuildingCommands.h"
 #include "Framework/MultiBox/MultiBoxBuilder.h"
+#include "PropertyEditorModule.h"
 #endif
```

引入侧 culprit `2695ba1b7` 的 diff 供对照：

```diff
 #include "AesEntityModule.h"
+#include "PropertyEditorModule.h"
 #include "AesBuilding/AesBuildingPayload/AesBuildingLayer.h"
```

同窗口附带提交 `7fe057a32`（"删除#pragma optimize"，改 AesCachedSoftObjectPath.h）与本错误无关，属顺带清理。

**归因强度：强**——fail→fix 窗口内 12 个仓库 pin 唯一变化是 AesWorld（19d06f1a → 7fe057a3），修复提交直改出错文件 AesEarthModule.cpp 本身，#1010 错误消失。

验证：#1010 控制台日志 0 条 `error C\d+`/`fatal error`，BUILD SUCCESSFUL。

## How to Reproduce / Detect

- grep 日志签名：`Cannot open include file: 'PropertyEditorModule.h'`，或泛化 `fatal error C1083: Cannot open include file: '<Editor模块头>'`
- 出错行号（第 7 行）即无条件 include 的位置；同目标其它编辑器头（UnrealEd、Kismet 等）同理
- 在运行时模块的 .cpp/.h 顶部出现 `#include "XXXModule.h"`（XXX 为 Editor 类型引擎模块）即可预警
- git 侧：`git log -S'#include "PropertyEditorModule.h"' -- <file>` 定位引入提交

## Epic Official Guidance

- **Query**: "UE5.1 C++ compilation error: fatal error C1083 in AesEarthModule.cpp line 7: Cannot open include file 'PropertyEditorModule.h': No such file or directory. The include was unconditional at the top of a game module cpp, but the CI builds a runtime target (UGA-Win64-Development, program/game target without editor). The fix moved the include inside #if WITH_EDITOR. What causes this error and how to handle PropertyEditor module headers in non-editor builds?"
- **Answer**: `PropertyEditor` 是 Editor-only 模块。Editor 目标包含全部运行时+编辑器模块；Game/Program 目标只含运行时模块，UBT 会把编辑器模块从 include 路径和链接库中剥离。修复三要点：① include 与使用该头类型的**逻辑**都要包进 `#if WITH_EDITOR`（只包 include 不包逻辑会继续报未定义标识符）；② Build.cs 里编辑器依赖应条件化：`if (Target.bBuildEditor) { PrivateDependencyModuleNames.AddRange(new[]{ "PropertyEditor", "UnrealEd" }); }`，否则非编辑器目标在链接/装配阶段仍会失败；③ 长期最佳实践是拆分独立的 Editor 模块（.uproject 注册 `"Type": "Editor"`），运行时模块彻底不引用编辑器头——CI 更稳、迭代更快、编辑器数据不泄漏进运行时内存。另注意 `WITH_EDITORONLY_DATA` 属性的访问守卫。
- **References**:
  - Editor Modules — https://dev.epicgames.com/documentation/unreal-engine/setting-up-editor-modules-for-customizing-the-editor-in-unreal-engine
  - Creating a Gameplay Module — https://dev.epicgames.com/documentation/unreal-engine/how-to-make-a-gameplay-module-in-unreal-engine

## Prevention

- 运行时模块中引用编辑器头（PropertyEditorModule.h、UnrealEd、LevelEditor 等）时，include 与使用逻辑一并放进 `#if WITH_EDITOR`；IDE 自动插入的 include 注意落点是否在守卫块内
- Build.cs 中编辑器依赖用 `Target.bBuildEditor` 条件添加，而非无条件列入
- 长期方案：按 Epic 建议拆分 Editor 模块，运行时模块零编辑器引用，CI 运行时目标天然免疫此类 C1083

## Warning Trend

| Build | Warnings |
|-------|----------|
| #1007 (fail) | 0 |
| #1008 (fail) | 0 |
| #1010 (fix)  | 0 |

趋势：持平（fail 构建因 C1083 早停未产生编译警告，fix 构建 0 警告，无恶化）。
