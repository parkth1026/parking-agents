## Diagnosis: C1083 in EarthRenderTarget2DFragment.cpp

**Primary Error**: `fatal error C1083: Cannot open include file: 'AssetToolsModule.h': No such file or directory`
**File**: `EarthPrefab/Private/Output/EarthRenderTarget2DFragment.cpp` line 3
**Build Stage**: Package Project (TWE Win64 Development, non-editor target)
**Root Cause**: Editor-only header `AssetToolsModule.h` included without `#if WITH_EDITOR` guard in a runtime module
**Confidence**: High

### Error Summary

Build #3898 (autoci / aes6-ue-runtime-ci) failed during the "Package Project" stage. The Editor build stage succeeded (1/1 passed), but when UBT compiled the game target `TWE Win64 Development`, it encountered a fatal C1083 error because `AssetToolsModule.h` is only available in Editor include paths.

The error was introduced by commit `28dc0dc` ("feat: implement material parameters baking system for water surface materials") by PengBo at 19:58. This commit added `#include "AssetToolsModule.h"` outside the `#if WITH_EDITOR` preprocessor guard.

### Evidence

- **Knowledge base**: STRONG MATCH (10/10 score). Entry `autoci-3898-3899-C1083-EditorOnlyIncludeWithoutGuard.md` documents this exact build failure with verified fix. Entry `025-assettoolsmodule-c1083.md` also covers this specific error pattern.
- **Epic guidance**: Skipped -- knowledge base match score 10/10 with verified fix is sufficient.
- **Source context**: The `.cpp` file at line 3-4 had `#include "AssetToolsModule.h"` outside `#if WITH_EDITOR`. The `EarthPrefab.Build.cs` correctly guards the `AssetTools` module dependency with `if (Target.bBuildEditor == true)`, but the corresponding `#include` was not wrapped in the matching `#if WITH_EDITOR` preprocessor guard.
- **Git history**: Commit `899869f` (20:09, same day) by PengBo titled "Add missing WITH_EDITOR" added the `#if WITH_EDITOR` / `#endif` guard around the editor-only includes. Build #3900 confirmed SUCCESS after the fix.
- **Web search**: Skipped -- sufficient evidence from knowledge base and source context.

### Recommended Fix

Wrap all editor-only includes inside `#if WITH_EDITOR` / `#endif`:

```diff
 #include "Output/EarthRenderTarget2DFragment.h"

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

This fix was already applied in commit `7d4fa8c0` by PengBo and verified by build #3900 (SUCCESS).

### References

- Knowledge base: `raw/jenkins-log-auto-learning/details/autoci-3898-3899-C1083-EditorOnlyIncludeWithoutGuard.md` (score 10/10)
- Knowledge base: `wiki/concepts/c1083 missing header.md`
- Knowledge base: `raw/ue5-jenkins/details/025-assettoolsmodule-c1083.md` (score 10/10)
- Epic docs: https://dev.epicgames.com/documentation/unreal-engine/setting-up-editor-modules-for-customizing-the-editor-in-unreal-engine
- Epic docs: https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-modules
- Fix commit: `7d4fa8c0` ("Add missing WITH_EDITOR")
- Verified by: Build #3900 (SUCCESS)
