---
schema: raw-knowledge/2
base_url: http://10.66.12.40
job: aes6-ue-runtime-ci
job_code: aes6
job_path: job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci
fail_builds: 1257-1258
fix_build: 1259
error_code: C1083
score: 10
result: failure:score=10:C1083:fix=#1259
primary_fix_commit: ef7f60f
recorded_at: 2026-08-19T04:06:05
---

# C1083: 运行时模块新功能引入 ObjectTools.h/ThumbnailTools 编辑器 API，非编辑器目标编译失败

## Error Message

（#1257，"Build Editor" 阶段 Incredibuild 编译 `UGA-Win64-Development` 非编辑器目标，编译 `AesModelRegistrySource.cpp` 时失败）

```
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Source\AesRenderResource\Private\ModelRegistry\AesModelRegistrySource.cpp(8): fatal error C1083: Cannot open include file: 'ObjectTools.h': No such file or directory
Error executing C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Tools\MSVC\14.29.30133\bin\HostX64\x64\cl.exe (tool returned code: 2)
BUILD FAILED: Command failed (Result:1): xgConsole.exe ... UAT_XGE.xml
AutomationTool exiting with ExitCode=1 (Error_Unknown)
```

C1083 是 fatal，MSVC 在第一个打不开的 include 处即中止，模块内其余翻译单元（AesModelRegistryTypes.cpp、AesModelRegistrySubsystem.cpp 等）全部连带失败。

## Root Cause

引入侧（culprit）：AesWorld 提交 `d23487366f8`（ZhuXiaoan，2024-07-23 17:48，"增加地标缩略图"）为运行时模块 `AesRenderResource` 新增静态网格缩略图功能：在 `AesModelRegistrySource.cpp` 顶部无条件添加 `#include "ObjectTools.h"`，并新增 `UAesModelRegistrySource::RenderThumbnail()` 调用 `ThumbnailTools::RenderThumbnail` 渲染缩略图。

`ObjectTools.h` 与 `ThumbnailTools` 属于 **UnrealEd 编辑器专属模块**。非编辑器目标（UGA-Win64-Development，打包客户端）下 UBT 不把 UnrealEd 加入 include 搜索路径，`ObjectTools.h` 物理上不在编译范围内 → C1083。开发者本地 Editor 目标编译通过，CI 的运行时目标随即报错。

一句话：编辑器专属 API（ThumbnailTools）被新功能代码直接写进运行时模块，编辑器目标掩盖了问题，打包目标一编译即炸。

## Fix

修复历经两次提交（完整演化链，两个提交均有本地 `git show` 真实 diff）：

**第一次尝试（失败，产生 #1258 新错误）**：`c42969c2d5`（18:31，"尝试修复打包问题"）在 `AesRenderResource.Build.cs` 依赖列表无条件加入 `"UnrealEd"`。头文件路径问题解决了，但 UnrealEd 是编辑器模块，非编辑器目标禁止实例化 → UBT 模块图阶段失败（#1258，ExitCode=6，详见 Group Context）。

**最终修复（成功）**：`ef7f60f470`（18:50，"移除UEditor相关代码"）撤销依赖并禁用编辑器代码：

```diff
--- a/Source/AesRenderResource/AesRenderResource.Build.cs
+++ b/Source/AesRenderResource/AesRenderResource.Build.cs
@@ -44,7 +44,6 @@ public class AesRenderResource : ModuleRules
                 "Json", 
                 "AesStreamingSystem",
                 "HTTP",
-                "UnrealEd",
 			}
```

```diff
--- a/Source/AesRenderResource/Private/ModelRegistry/AesModelRegistrySource.cpp
+++ b/Source/AesRenderResource/Private/ModelRegistry/AesModelRegistrySource.cpp
@@ -5,7 +5,7 @@
 #include "AesRawStreamingManager.h"
 #include "glTFRuntimeParser.h"
-#include "ObjectTools.h"
+//#include "ObjectTools.h"
@@ -251,14 +251,14 @@ bool UAesModelRegistrySource::RenderThumbnail(...
 	FObjectThumbnail NewThumbnail;
-	ThumbnailTools::RenderThumbnail(
-		StaticMesh,
-		Width,
-		Height,
-		ThumbnailTools::EThumbnailTextureFlushMode::NeverFlush,
-		NULL,
-		&NewThumbnail
-	);
+	//ThumbnailTools::RenderThumbnail(
+	//	StaticMesh,
+	//	Width,
+	//	Height,
+	//	ThumbnailTools::EThumbnailTextureFlushMode::NeverFlush,
+	//	NULL,
+	//	&NewThumbnail
+	//);
```

culprit `d23487366f8` 引入侧关键行（git show 摘录）：

```diff
+#include "ObjectTools.h"
+							RenderThumbnail(/*CachedItem.Guid, */CachedItem.StaticMesh, 128, 128, CachedItem.Thumbnail);
+	FObjectThumbnail NewThumbnail;
+	ThumbnailTools::RenderThumbnail(
```

注意：最终修复是**注释掉缩略图渲染功能**（`FObjectThumbnail NewThumbnail` 不再填充，后续 `UncompressedData.Num() > 0` 恒 false）——功能在运行时目标被禁用而非迁移，属止血式修复；正确的长期方案见 Epic 指导（拆 Editor 模块或 SceneCapture 运行时替代）。

- **Commit**: ef7f60f470 by ZhuXiaoan（失败尝试 c42969c2d5 同作者）
- **Message**: "移除UEditor相关代码"
- **What changed**: Build.cs 移除 "UnrealEd" 依赖 + AesModelRegistrySource.cpp 注释 ObjectTools.h include 与 ThumbnailTools::RenderThumbnail 调用

验证：#1259 控制台日志 0 条 `error C\d+` / `fatal error` / `Unable to instantiate`，BUILD SUCCESSFUL。

## How to Reproduce / Detect

- grep 日志签名：`Cannot open include file: 'ObjectTools.h'`，或泛化 `fatal error C1083: Cannot open include file: '<Editor模块头>'`
- 出错行号（第 8 行）即无条件 include 位置；编译目标是 `UGA-Win64-Development` / `Project: Env_0`（非编辑器）
- 在运行时模块 .cpp 顶部出现 `#include "ObjectTools.h"`、`ThumbnailTools::` 调用即可预警
- git 侧：`git log -S'#include "ObjectTools.h"' -- <file>` 定位引入提交
- 关联模式：若有人接着往 Build.cs 加 "UnrealEd"，会转为 `Unable to instantiate UnrealEd module for non-editor targets`（见 aes6-835）

## Epic Official Guidance

- **Query**: "UE5.1 C++ compilation error: fatal error C1083 in AesModelRegistrySource.cpp line 8: Cannot open include file 'ObjectTools.h': No such file or directory. The plugin runtime module AesRenderResource (Runtime type module) compiles fine for editor target but fails when CI builds a non-editor game target UGA Win64 Development via BuildCookRun. The code added #include ObjectTools.h and a ThumbnailTools::RenderThumbnail call for a landmark thumbnail feature. Trying to fix by adding UnrealEd to Build.cs dependencies instead failed with: Unable to instantiate module 'UnrealEd': Unable to instantiate UnrealEd module for non-editor targets. What causes this and how to correctly use ObjectTools/ThumbnailTools from a runtime module?"
- **Answer**（要点）：UnrealEd（含 ObjectTools、ThumbnailTools）是 editor-only 模块，Game/Client/Server/Shipping 目标会被剥离；UBT 的 "Unable to instantiate" 是防止编辑器代码进包的安全检查。修复三路径：
  1. **编译修复**：include 与调用逻辑包进 `#if WITH_EDITOR`，Build.cs 用 `if (Target.bBuildEditor) { PrivateDependencyModuleNames.Add("UnrealEd"); }` 条件添加——编辑器专用功能选这条；
  2. **架构修复（最佳实践）**：拆分 Editor 模块（.uplugin 注册 `"Type": "Editor"`），ThumbnailTools 逻辑全部移过去；
  3. **运行时替代**：打包后需要动态缩略图时不能用 ThumbnailTools，改用 `USceneCaptureComponent2D` 渲染到 `UTextureRenderTarget2D`，或编辑器期预渲染存 `UTexture2D` 资产。
- **References**:
  - Editor Modules — https://dev.epicgames.com/documentation/unreal-engine/setting-up-editor-modules-for-customizing-the-editor-in-unreal-engine
  - Creating a Gameplay Module — https://dev.epicgames.com/documentation/unreal-engine/how-to-make-a-gameplay-module-in-unreal-engine

## Prevention

- 运行时模块写新功能前先确认所用 API 所属模块：ObjectTools/ThumbnailTools 属 UnrealEd（编辑器专属），`USceneCaptureComponent2D` 才是运行时正解
- 若确需编辑器 API：`#if WITH_EDITOR` 包裹代码 + `Target.bBuildEditor` 条件依赖，切勿往 Build.cs 无条件加 "UnrealEd"（那只会把 C1083 换成模块图失败，见 #1258）
- CI 非编辑器目标（本任务 UGA-Win64-Development）是此类问题的唯一暴露点，本地 Editor 编译通过不代表打包能过

## Warning Trend

| Build | Warnings |
|-------|----------|
| #1257 (fail) | 0 |
| #1258 (fail) | 0 |
| #1259 (fix)  | 0 |

趋势：持平（三个构建 `warning C\d+`/`warning CS\d+` 计数均为 0；fail 构建在编译早期即中止未产生警告，fix 构建零警告，无恶化）。

## Group Context

连续失败组 #1257~#1258 的次生模式（主错误之外）：

- **#1258 `UnrealEdNonEditor`**（UBT 模块图阶段，ExitCode=6）：`Unable to instantiate module 'UnrealEd': Unable to instantiate UnrealEd module for non-editor targets. (referenced via Target -> AesMarkerSystem.Build.cs -> AesRenderResource.Build.cs)`。归因强度：**引**——与既有知识 `raw/details/aes6-835-UnrealEdNonEditor-runtime-module-editor-dep.md` 同签名同链（该文 Recurrences 节已追加本轮记录）。变体差异：#835 是 MeshMergeUtilities 传递依赖引爆，本轮是修复尝试 c42969c 直接依赖 "UnrealEd" 引爆。

## Recurrences

| Date | Builds | Trigger | Notes |
|------|--------|---------|-------|
| 2026-08-21 | #2644 → #2645 | `EarthPrefabAssetFunctionLibrary.cpp:338` 无守卫使用 `ThumbnailTools::DefaultThumbnailSize`（C2653/C2065/C2131：'ThumbnailTools': is not a class or namespace name） | 同因复发：运行时模块新功能直接调用 ThumbnailTools 编辑器 API。变体修法：834dc4dcc 以 `#if WITH_EDITOR` 守卫 + `#else` 硬编码 `256` 回退（走本文 Epic 指导的路径 1，而非 #1257 的注释禁用）；该 `#else` 分支引入全角分号 `；` 又致 #2645 C3688。完整链见 `raw/details/aes6-2644-2648-C2672-uworld-incomplete-overload.md` |
