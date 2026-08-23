---
schema: raw-knowledge/2
base_url: http://10.66.12.40
job: aes6-ue-runtime-ci
job_code: aes6
job_path: job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci
fail_builds: 2125
fix_build: 2126
error_code: C1083
score: 9
result: failure:score=9:C1083:fix=#2126:see=//nas.51vr.local/x.public/UE5/ue-llm-wiki/raw/details/aes6-1453-C2039-crossplugin-api-lag.md
primary_fix_commit: fd0e50ce
recorded_at: 2026-08-20T13:13:00
---

# C1083: 编辑器专用头 FileHelpers.h 裸 include 加在 WITH_EDITOR 守卫外，游戏打包目标编译失败

## Error Message

```text
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Source\Editor\AesEditorMode\Private\AesEditorMode.cpp(53): fatal error C1083: Cannot open include file: 'FileHelpers.h': No such file or directory
```

出现在 #2125 的第二阶段（`BuildCookRun` 打包构建）。cl.exe 返回码 2 → `xgConsole.exe ExitCode=1` → `BUILD FAILED`。第一阶段 `BuildTarget -Target=Editor`（ExitCode=0）在本构建已通过。

## Root Cause

本 CI 任务每个构建分两阶段：先 `BuildTarget -Target=Editor -Platform=Win64 -Configuration=Development`（编辑器目标），通过后再 `BuildCookRun ... -clientconfig=Development -nocompileeditor -build`（游戏/打包目标，WITH_EDITOR=0）。

culprit `bb7bbc96f`（"一键导入导出 调整"，luwei 2024-10-28 17:26）把 `#include "FileHelpers.h"`（裸文件名，无模块前缀）加到 `AesEditorMode.cpp` 第 53 行——位于文件头部 `#if WITH_EDITOR ... #endif` 块**之外**。该头属于引擎编辑器-only 模块 UnrealEd（`Engine/Source/Editor/UnrealEd/Public/FileHelpers.h`）：

- **编辑器目标**：AesEditorMode.Build.cs 按目标条件把 `UnrealEd` 加入依赖，UnrealEd 的 Public 目录进入 include 搜索路径，裸文件名可解析 → 编译通过（#2124 日志 [195/239] AesEditorMode.cpp 0:56.68 编译成功可为证）。
- **游戏目标**：UBT 剥离编辑器-only 模块，UnrealEd 的 include 路径随之消失，裸 include 无法解析 → C1083。AesEditorMode 模块同时进入游戏目标模块图（打包阶段确实重编译了该 .cpp），所以 include 必须自己带守卫。

**为什么 #2124 没有暴露此错误**：#2124 在第一阶段就因跨仓库 C2039 失败（见 Group Context），从未到达打包阶段；且编辑器目标下该 include 本来就能解析。错误自 #2124 的树（AesWorld pin 相同）起就已潜伏，#2125 修掉 C2039 后才第一次被执行到——两阶段流水线会用第一阶段的失败掩盖第二阶段的潜伏错误，归因时不能因"上一构建没报"就排除。

## Fix

- **Commit**: `fd0e50ce9318a5eeb654cb2b928feb1ff31aa463` by luwei，2024-10-28 18:36 +0800（AesWorld dev 分支）
- **Message**: "编译不过的问题"（消息只点名症状，改了什么读不出来——Commit 维度第 3 分因此不授）
- **What changed**: 把 include 从第 53 行移入文件头部 `#if WITH_EDITOR` 块内（与 ContentBrowserModule.h 等编辑器头并列）。游戏目标（WITH_EDITOR=0）整段跳过，编辑器目标照常解析：

```diff
@@ -18,6 +18,7 @@
 #include "ContentBrowserModule.h"
 #include "IContentBrowserSingleton.h"
 #include "Subsystems/EditorAssetSubsystem.h"
+#include "FileHelpers.h"
 #endif
 
@@ -50,7 +51,6 @@
 #include "AesMessageSubsystem.h"
 #include "AesSchemeSceneData.h"
 #include "EarthZipArchiveLib.h"
-#include "FileHelpers.h"
 #include "JsonObjectConverter.h"
```

归因强度：**强验证**——#2125→#2126 之间 7 个仓库检出哈希对比中唯一变化是 AesWorld `bb7bbc96` → `fd0e50ce9`（区间内单提交），diff 直击报错文件的报错行，#2126 两阶段全绿（日志仅 5 条 `warning LNK4204` 链接器警告）。

同 culprit 提交还改了 `AesEditorMode.Build.cs`（编辑器条件依赖块新增 `EditorScriptingUtilities`、`ContentBrowserData`），引入 #2126 日志中的 UBT 警告：`Plugin 'AesWorld' does not list plugin 'EditorScriptingUtilities' as a dependency, but module 'AesEditorMode' depends on 'EditorScriptingUtilities'`（uplugin 描述符未同步声明插件级依赖）。

## How to Reproduce / Detect

- 日志 grep 签名：`fatal error C1083: Cannot open include file: 'FileHelpers.h'`；泛化指纹：裸文件名 include 的头只存在于编辑器模块（UnrealEd 等）的 Public 目录。
- 结构指纹：同一份代码编辑器目标编译过、打包（BuildCookRun / 游戏目标）阶段才 C1083 → 编辑器-only 头未加 WITH_EDITOR 守卫。
- 排查法：先看 CI 的阶段结构（本任务 Editor BuildTarget + BuildCookRun 两段），确认报错发生在哪一段；上一构建"编辑器阶段编译通过"不能作为 include 无问题的证据。

## Epic Official Guidance

- **Query**: "UE5.1 editor plugin module: #include \"FileHelpers.h\" (bare filename) outside the WITH_EDITOR guard compiles fine in the Editor target but fails C1083 in the BuildCookRun game target. Moving it inside #if WITH_EDITOR fixed it. Why does the bare include resolve in editor builds but not game builds, and what is the recommended practice?"
- **Answer**（要点）: `FileHelpers.h` 属 UnrealEd 模块，编辑器-only。编辑器目标把 UnrealEd 纳入依赖图、其 `Source/Editor/UnrealEd/Public/` 进入编译器 include 搜索路径（/I），裸文件名可解析；游戏目标 UBT 剥离所有编辑器-only 模块，该路径从编译参数中消失 → C1083。推荐做法：① 插件拆 Runtime/Editor 双模块（.uplugin 中编辑器模块 Type=Editor，打包时整个模块不参与编译，根治）；② 混编模块的 Build.cs 用 `if (Target.bBuildEditor)` 条件加编辑器依赖（本模块 Build.cs 已是此形态）；③ include 与使用处都包 `#if WITH_EDITOR ... #else`（运行时回退/日志）。陷阱提示：编辑器构建接近"全连通"环境，会掩盖缺失守卫，打包的严格环境才暴露泄漏。
- **References**:
  - Editor Modules — https://dev.epicgames.com/documentation/unreal-engine/setting-up-editor-modules-for-customizing-the-editor-in-unreal-engine
  - Modules - Overview and Structure — https://dev.epicgames.com/community/learning/knowledge-base/GDD9/unreal-engine-modules-overview-and-structure

## Prevention

- 编辑器-only 头（UnrealEd/Public 下的 FileHelpers.h 等）的 include 与使用**同时**加 `#if WITH_EDITOR`；裸文件名 include 只对本模块内部头或确定的 Runtime 模块头安全。
- 涉改插件代码推送前，至少跑一次非编辑器配置（打包目标或运行时 CI）编译——编辑器目标通过不代表打包能过（cf. `aes6-1221-1223-C2039-unguarded-editoronly-changeset-api` 同族教训）。
- 新增编辑器模块依赖时同步更新 .uplugin 的插件级依赖声明，避免 UBT "module depends on X but plugin does not list it" 警告累积。

## Warning Trend

| Build | Warnings |
|-------|----------|
| #2124 (fail) | 0 |
| #2125 (fail) | 0 |
| #2126 (fix)  | 0 |

趋势：持平（0 → 0，差值 0）。三个构建日志均无 `warning C\d+` 命中：#2124 编辑器阶段即中断于 C2039，#2125 打包阶段 14 个增量动作即断。#2126 的 5 条 `warning LNK4204`（tbbmalloc.pdb）为预存链接器警告，另有 1 条 UBT 警告（uplugin 未声明 EditorScriptingUtilities 依赖，culprit 的 Build.cs 改动引入），均不计入编译警告口径。

## Group Context

构建对 fail=[2124,2125] → fix=#2126 含同一 culprit 引出的两种失败模式，仅记于此，不另立 C2039 文件：

| 构建号 | 日志签名（原句） | 归因强度 | 说明 |
|--------|------------------|----------|------|
| #2124 | `EarthBuilderUserSubsystem.cpp(261/262/263/497/498/499/504): error C2039: 'SetChangesetFolderPath': is not a member of 'UAesTerrainComponent'`（SetChangesetBackupFolderPath / SetModelLibFolderPath / GetChangesetFolderPath 同型，共 7 处；ExitCode=6） | 引 → 复发 | 同一 culprit `bb7bbc96f` 从 `AesTerrainComponent.h` 删除 5 个 UFUNCTION 与 3 个字段，跨仓库消费者 51EarthBuilder 滞后适配；修于 51EarthBuilder `23c3d4b`→`cedfc5d`（消息 "actor参数位置调整"）窗口。与 `aes6-1453-C2039-crossplugin-api-lag` 同因、方向相反的变体（1453 是调用方先落新 API，本轮是提供方先删旧 API），已在该文件 `## Recurrences` 落账，本对结论串 `:see=` 即指向它 |

culprit `bb7bbc96f` 在 `AesTerrainComponent.h` 的删除 diff（`git show bb7bbc96f -- Source/AesEarth/Public/AesTerrain/AesTerrainComponent.h`，本对 C2039 的引入侧证据）：

```diff
-	UFUNCTION(Category = Terrain, BlueprintCallable)
-	FString GetChangesetFolderPath() const { return ChangesetFolderPath.IsEmpty()? FString() : ChangesetFolderPath + TEXT("/Changeset"); }
-	UFUNCTION(Category = Terrain, BlueprintCallable)
-	void SetChangesetFolderPath(const FString& InChangesetFolderPath) { ChangesetFolderPath = InChangesetFolderPath; }
-	UFUNCTION(Category = Terrain, BlueprintCallable)
-	FString GetChangesetBackupFolderPath() const { return ChangesetBackupFolderPath.IsEmpty() ? FString() : ChangesetBackupFolderPath + TEXT("-") + FDateTime::Now().ToString() + TEXT("/Changeset"); }
-	UFUNCTION(Category = Terrain, BlueprintCallable)
-	void SetChangesetBackupFolderPath(const FString& InChangesetBackupFolderPath) { ChangesetBackupFolderPath = InChangesetBackupFolderPath; }
-	UFUNCTION(Category = Terrain, BlueprintCallable)
-	FString GetModelLibFolderPath() const { return ModelLibFolderPath.IsEmpty() ? FString() : ModelLibFolderPath + TEXT("/ModelLib"); }
-	UFUNCTION(Category = Terrain, BlueprintCallable)
-	void SetModelLibFolderPath(const FString& InModelLibFolderPath) { ModelLibFolderPath = InModelLibFolderPath; }
```

同提交还删除了对应的 3 个 private 字段（`ChangesetFolderPath` / `ChangesetBackupFolderPath` / `ModelLibFolderPath`）。51EarthBuilder 仓库不在本机 gitRepos（D:/Git）中，消费侧适配 diff 不可得——归因依据为：#2124→#2125 间 7 个仓库唯一变化即 51EarthBuilder `23c3d4b 更新翻译` → `cedfc5d actor参数位置调整`（Jenkins 控制台 `OldCommit:`/`Before:` 行），且 #2125 编辑器阶段该错误消失。
