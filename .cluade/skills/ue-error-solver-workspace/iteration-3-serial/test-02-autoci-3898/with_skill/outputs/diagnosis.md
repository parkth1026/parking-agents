## Diagnosis: C1083 in EarthRenderTarget2DFragment.cpp

**Build**: autoci #3898 (aes6-ue-runtime-ci)
**Result**: FAILURE
**Triggered by**: GitLab push by PengBo
**Date**: 2026-03-27

**Primary Error**:
```
D:\ws_twe_ue5.5_ci\Project\Plugins\G\AesWorld\Source\EarthPrefab\Private\Output\EarthRenderTarget2DFragment.cpp(3): fatal error C1083: Cannot open include file: 'AssetToolsModule.h': No such file or directory
```

**Root Cause**: Editor-only header included without `#if WITH_EDITOR` guard in runtime build
**Confidence**: High

### Error Summary

The build has exactly 1 distinct compilation error. The first compilation step (TWEEditor Win64 Development) succeeded, but the second step (TWE Win64 Development - runtime/cook target via BuildCookRun) failed with C1083.

Commit `28dc0dc` ("feat: 为底板水域材质实现材质参数烘焙系统") by PengBo added new code to `EarthRenderTarget2DFragment.cpp` that includes editor-only headers (`AssetToolsModule.h`, `AssetRegistry/AssetRegistryModule.h`, `Factories/Texture2dFactoryNew.h`). At the time of build #3898, at least `AssetToolsModule.h` was placed outside the `#if WITH_EDITOR` preprocessor guard, causing it to be compiled in the runtime target where editor modules are not available.

### Evidence

**Knowledge base**: Strong match found. This exact error was previously documented:
- `wiki/concepts/c1083 missing header.md` - General C1083 guidance, lists this exact case (ID 025)
- `raw/jenkins-log-auto-learning/details/autoci-3898-3899-C1083-EditorOnlyIncludeWithoutGuard.md` - Detailed verified knowledge entry (score 10/10) documenting builds #3898 and #3899 failing, with fix in build #3900
- `raw/ue5-jenkins/details/025-assettoolsmodule-c1083.md` - Specific knowledge entry for AssetToolsModule.h C1083

**Source context**: The current source code in the git repo (`D:\Git\AesWorld\Source\EarthPrefab\Private\Output\EarthRenderTarget2DFragment.cpp`) already has the fix applied. Lines 3-7 show:
```cpp
#if WITH_EDITOR
#include "AssetToolsModule.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Factories/Texture2dFactoryNew.h"
#endif
```
The fix commit is `7d4fa8c0c` ("添加缺失的WITH_EDITOR") by PengBo.

**Git history** confirms the sequence:
1. `28dc0dcb9` - "feat: 为底板水域材质实现材质参数烘焙系统" (introduced the bug)
2. `899869f21` - "添加缺失的WITH_EDITOR" (first fix attempt)
3. `7d4fa8c0c` - "添加缺失的WITH_EDITOR" (complete fix)

**Epic guidance**: Epic confirms that `AssetToolsModule.h`, `Factories/Texture2dFactoryNew.h`, and `AssetRegistry/AssetRegistryModule.h` are editor-only modules completely absent from runtime/packaged builds. The recommended approach is:
1. Wrap all editor-only includes and code in `#if WITH_EDITOR ... #endif` blocks
2. Add editor module dependencies conditionally in Build.cs: `if (Target.bBuildEditor) { PrivateDependencyModuleNames.Add("AssetTools"); }`
3. For larger plugins, consider splitting into separate Runtime and Editor modules

**Web search**: Not needed - knowledge base and Epic guidance fully cover this error.

### Recommended Fix

The fix has already been applied in the repo. The correct approach was:

```diff
// EarthRenderTarget2DFragment.cpp
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

Additionally, the `CreateStaticTexture()` function at line 399 that uses these editor APIs is already correctly wrapped in `#if WITH_EDITOR ... #endif`.

### References

- Epic - Editor Modules: https://dev.epicgames.com/documentation/unreal-engine/setting-up-editor-modules-for-customizing-the-editor-in-unreal-engine
- Epic - Create New Assets in C++: https://dev.epicgames.com/community/learning/knowledge-base/wzdm/unreal-engine-how-to-create-new-assets-in-c
- Knowledge base: `wiki/concepts/c1083 missing header.md`
- Knowledge base: `raw/jenkins-log-auto-learning/details/autoci-3898-3899-C1083-EditorOnlyIncludeWithoutGuard.md`

### Prevention

- Any `#include` from `AssetTools`, `UnrealEd`, `Blutility`, or `Factories` modules must always be inside `#if WITH_EDITOR`
- If a plugin module type is `"Runtime"`, treat ALL editor APIs as requiring `WITH_EDITOR` guards
- Before merging commits that add new `#include` lines, verify whether the header belongs to an Editor-only module
- Add editor module dependencies conditionally in Build.cs using `Target.bBuildEditor`
