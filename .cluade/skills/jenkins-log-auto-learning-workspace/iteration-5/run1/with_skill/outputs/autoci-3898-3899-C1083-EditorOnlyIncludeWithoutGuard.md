# C1083: Editor-Only Headers Outside WITH_EDITOR Guard

> **Score**: 10/10 | **Job**: autoci | **Date**: 2026-03-27
> **Builds**: #3898, #3899 (FAILURE) → #3900 (SUCCESS)
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Messages

```
D:\ws_twe_ue5.5_ci\Project\Plugins\G\AesWorld\Source\EarthPrefab\Private\Output\EarthRenderTarget2DFragment.cpp(3): fatal error C1083: Cannot open include file: 'AssetToolsModule.h': No such file or directory
```
And in build #3899:
```
D:\ws_twe_ue5.5_ci\Project\Plugins\G\AesWorld\Source\EarthPrefab\Private\Output\EarthRenderTarget2DFragment.cpp(11): fatal error C1083: Cannot open include file: 'Factories/Texture2dFactoryNew.h': No such file or directory
```

## Root Cause

Commit `28dc0dc` ("feat: 为底板水域材质实现材质参数烘焙系统") added two editor-only headers — `AssetRegistry/AssetRegistryModule.h` and `Factories/Texture2dFactoryNew.h` — outside the `#if WITH_EDITOR` guard in `EarthRenderTarget2DFragment.cpp`. While `AssetToolsModule.h` was already inside the guard, these new headers were placed below it in the "always-include" section.

The autoci job builds for non-editor targets (runtime/cook). Editor-only headers like `AssetToolsModule.h` (from the `AssetTools` module) and `Factories/Texture2dFactoryNew.h` (from `UnrealEd`) are not in the include path for non-editor builds. The compiler reports C1083 ("Cannot open include file") because those header files simply don't exist in the include search paths for runtime builds.

## Fix

- **Commit**: `7d4fa8c0` by PengBo
- **Message**: "添加缺失的WITH_EDITOR" (Add missing WITH_EDITOR)
- **What changed**:

```diff
// EarthRenderTarget2DFragment.cpp
 #if WITH_EDITOR
 #include "AssetToolsModule.h"
+#include "AssetRegistry/AssetRegistryModule.h"
+#include "Factories/Texture2dFactoryNew.h"
 #endif
 #include "EarthLogHelper.h"
 #include "RHIResources.h"
 #include "TextureResource.h"
-#include "AssetRegistry/AssetRegistryModule.h"
 #include "Engine/TextureRenderTarget2D.h"
-#include "Factories/Texture2dFactoryNew.h"
 #include "Kismet/KismetRenderingLibrary.h"
```

The two editor-only headers were moved from the unconditional include section into the `#if WITH_EDITOR` block.

## How to Reproduce / Detect

- A developer adds new functionality using editor APIs (`AssetTools`, `AssetRegistry`, `Factories`) to a plugin that has `"Type": "Runtime"` in its `.uplugin`
- The includes compile fine in Editor builds but fail on CI with C1083 in non-editor/cook/runtime builds
- The autoci job (`aes6-ue-runtime-ci`) runs a non-editor build, so it catches these immediately

## Epic Official Guidance

- **Query**: "UE5.5 C++ compilation fatal error C1083: Cannot open include file 'AssetToolsModule.h' outside WITH_EDITOR guard. Editor-only headers in plugin .cpp built for runtime targets."
- **Answer**: Epic confirms C1083 occurs when editor-only headers are included in files built for all target types. Headers from `AssetTools`, `UnrealEd`, and `Factories` are only present in editor include paths. The fix is to wrap all such includes and the code that uses them inside `#if WITH_EDITOR ... #endif`. Also ensure that editor-only modules (`AssetTools`, `AssetRegistry`, `UnrealEd`) are added to Build.cs dependencies conditionally: `if (Target.bBuildEditor) { PrivateDependencyModuleNames.Add("AssetTools"); }`.
- **References**:
  - Editor Modules: https://dev.epicgames.com/documentation/unreal-engine/setting-up-editor-modules-for-customizing-the-editor-in-unreal-engine
  - Unreal Engine Modules: https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-modules

## Prevention

- Any include from `AssetTools`, `UnrealEd`, `Blutility`, or `Factories` must be inside `#if WITH_EDITOR`
- If your plugin module type is `"Runtime"`, treat ALL editor APIs as suspicious until wrapped in `WITH_EDITOR`
- Before merging commits that add new `#include` lines, check: is this header from an Editor module? If yes, wrap it
- The autoci non-editor build is the canary — if it passes but editor build fails, the reverse is also possible: a new header might be editor-only

## Recurrences
| Date | Builds | Trigger | Notes |
|------|--------|---------|-------|
| 2026-04-09 | installed #423 → #424 | `FileHelpers.h` included without `#if WITH_EDITOR` in `EarthRoadModelerLanePrefab.cpp` | Same root cause, different file. Fix commit `65a1cc3` by luwei wrapped `#include "FileHelpers.h"` and editor-only functions in `#if WITH_EDITOR` guards. |
