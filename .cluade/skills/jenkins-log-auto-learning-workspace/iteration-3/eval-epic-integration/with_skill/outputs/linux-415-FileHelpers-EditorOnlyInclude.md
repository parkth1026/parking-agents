# Fatal Error: FileHelpers.h not found in Linux shipping build

> **Score**: 10/10 | **Job**: linux | **Date**: 2026-03-04
> **Builds**: #415 (FAILURE) → #416 (SUCCESS)
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Message
```
D:\ws_twe_ue5.5_linux_ci\Project\Plugins\G\AesWorld\Source\EarthPrefab\Private\Prefab\EarthRoadModelerLanePrefab.cpp(3,10): fatal error: 'FileHelpers.h' file not found
```

## Root Cause
`FileHelpers.h` is an editor-only header from the `UnrealEd` module. It was included unconditionally at the top of `EarthRoadModelerLanePrefab.cpp`. On Windows editor builds this works because `UnrealEd` is available, but Linux shipping/game builds do not include editor modules, so the header cannot be found.

The code that used `FileHelpers.h` (specifically `FEditorFileUtils::PromptForCheckoutAndSave`) is editor-only functionality that should never execute in shipping builds.

## Fix
- **Commit**: `65a1cc37857de512382ba3a2a55b7fc2a49368fb` by luwei
- **Message**: "linux管线编译不过的问题" (Fix Linux pipeline compilation issues)
- **What changed**:

**EarthRoadModelerLanePrefab.cpp** — Wrapped editor-only include and functions:
```diff
 #include "Prefab/EarthRoadModelerLanePrefab.h"
-#include "FileHelpers.h"
 #include "Fragment/EarthRoadFragment.h"
 ...
+#if WITH_EDITOR
+#include "FileHelpers.h"
+#endif
```

**EarthRoadModelerLanePrefab.cpp** — Wrapped editor-only function bodies:
```diff
+#if WITH_EDITOR
 void UEarthRoadModelerLanePrefabAlgorithm::BuildByTemplate(...)
 {
     ...
     FEditorFileUtils::PromptForCheckoutAndSave(PackagesToSave, true, false);
     ...
 }
+#endif
```

**EarthRoadModelerLanePrefab.h** — Wrapped editor-only function declarations:
```diff
+#if WITH_EDITOR
 UFUNCTION(BlueprintCallable, ...)
 static void BuildByTemplate(...);
 static UEarthPrefabAsset* ExportPrefabAsset(...);
+#endif
```

## How to Reproduce / Detect
- Build for Linux Shipping target (or any non-editor target)
- Any `#include` of editor-only headers (FileHelpers.h, EditorAssetLibrary.h, etc.) without `#if WITH_EDITOR` guards will fail
- Windows editor builds mask this because they always have editor modules available

## Epic Official Guidance
- **Query**: "UE5.5 Linux shipping build error: fatal error: 'FileHelpers.h' file not found. FileHelpers.h is an editor-only header. What is the correct way to handle editor-only includes?"
- **Answer**: Epic states that editor headers like `FileHelpers.h` (from `UnrealEd`) must always be wrapped with `#if WITH_EDITOR` guards. Function bodies using editor APIs should also be guarded. In `.Build.cs`, editor module dependencies should be conditional: `if (Target.bBuildEditor) { PrivateDependencyModuleNames.Add("UnrealEd"); }`. For substantial editor-only logic, Epic recommends splitting into a dedicated editor module.
- **References**:
  - [Editor Modules](https://dev.epicgames.com/documentation/unreal-engine/setting-up-editor-modules-for-customizing-the-editor-in-unreal-engine)
  - [Modules - Overview and Structure](https://dev.epicgames.com/community/learning/knowledge-base/GDD9/unreal-engine-modules-overview-and-structure)

## Prevention
- Always wrap editor-only headers (`FileHelpers.h`, `EditorAssetLibrary.h`, `LevelEditor.h`) with `#if WITH_EDITOR`
- Use `Target.bBuildEditor` in `.Build.cs` for conditional module dependencies
- Consider separating editor-only functionality into dedicated editor modules
- Run Linux shipping builds (non-editor) in CI to catch editor leaks early