## Diagnosis: C1083 in EarthRenderTarget2DFragment.cpp

**Build**: aes6-ue-runtime-ci #3899 (FAILURE)
**Primary Error**: `fatal error C1083: Cannot open include file: 'Factories/Texture2dFactoryNew.h': No such file or directory`
**Error File**: `AesWorld/Source/EarthPrefab/Private/Output/EarthRenderTarget2DFragment.cpp`, line 11
**Root Cause**: Editor-only header `Factories/Texture2dFactoryNew.h` was included outside the `#if WITH_EDITOR` guard, causing the non-editor runtime build to fail because the header is only available in editor include paths.
**Confidence**: High

### Context

The build has two stages:
1. **Editor build** (`BuildTarget -Target=Editor`): SUCCEEDED (ExitCode=0)
2. **Runtime/Package build** (`BuildCookRun -targetplatform=Win64 -clientconfig=Development`): FAILED with C1083

This is the classic pattern for editor-only headers leaking into runtime builds. The Editor build succeeds because `UnrealEd` module headers (including `Factories/Texture2dFactoryNew.h`) are on the include path. The runtime build fails because those headers are not available for non-editor targets.

The triggering commit was `28dc0dc` ("feat: 为底板水域材质实现材质参数烘焙系统") which added new editor-only includes (`AssetRegistry/AssetRegistryModule.h` and `Factories/Texture2dFactoryNew.h`) below the existing `#if WITH_EDITOR` block, in the unconditional include section. A partial fix in commit `899869f` ("添加缺失的WITH_EDITOR") was checked out by this build but did not fully resolve the include ordering -- the `Texture2dFactoryNew.h` was still outside the guard at line 11.

### Evidence

- **Knowledge base**: Strong match found (score 10/10, verified). File `autoci-3898-3899-C1083-EditorOnlyIncludeWithoutGuard.md` documents this exact error across builds #3898 and #3899, with the confirmed fix in commit `7d4fa8c0`.
- **Epic guidance**: Skipped -- knowledge base match score 10/10 with verified fix is sufficient. No additional latency needed.
- **Source context**: Current source code in `D:\Git\AesWorld` confirms the fix has been applied -- all three editor-only headers (`AssetToolsModule.h`, `AssetRegistry/AssetRegistryModule.h`, `Factories/Texture2dFactoryNew.h`) are now inside the `#if WITH_EDITOR` block (lines 3-7).
- **Web search**: Skipped -- sufficient evidence from knowledge base and source code.

### Recommended Fix

Move `Factories/Texture2dFactoryNew.h` (and `AssetRegistry/AssetRegistryModule.h`) inside the `#if WITH_EDITOR` guard:

```diff
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

This fix was already applied in commit `7d4fa8c0` by PengBo and verified by subsequent successful build #3900.

### References

- Knowledge base: `raw/jenkins-log-auto-learning/details/autoci-3898-3899-C1083-EditorOnlyIncludeWithoutGuard.md` (score 10/10)
- Knowledge base: `raw/ue5-jenkins/details/021-texture2dfactorynew-header-missing.md` (score 10/10)
- Knowledge base concept: `wiki/concepts/c1083 missing header.md`
- Epic docs: https://dev.epicgames.com/documentation/unreal-engine/setting-up-editor-modules-for-customizing-the-editor-in-unreal-engine
- Fix commit: `7d4fa8c0` ("添加缺失的WITH_EDITOR")
