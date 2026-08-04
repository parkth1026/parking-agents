# Diagnosis: C1083 in EarthRenderTarget2DFragment.cpp

**Build**: [aes6-ue-runtime-ci #3899](http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3899/)
**Result**: FAILURE (Package Project stage)
**Duration**: 87 seconds
**Triggered by**: GitLab push by PengBo

---

## Primary Error

```
D:\ws_twe_ue5.5_ci\Project\Plugins\G\AesWorld\Source\EarthPrefab\Private\Output\EarthRenderTarget2DFragment.cpp(11):
fatal error C1083: Cannot open include file: 'Factories/Texture2dFactoryNew.h': No such file or directory
```

**Error Code**: C1083 (MSVC fatal error -- missing include file)
**Error File**: `EarthRenderTarget2DFragment.cpp`, line 11
**Missing Header**: `Factories/Texture2dFactoryNew.h`
**Build Phase**: Package (BuildCookRun, non-editor runtime target Win64 Development)
**Build Command**: `RunUAT.bat BuildCookRun -project="D:/ws_twe_ue5.5_ci/Project/TWE.uproject" -targetplatform=Win64 -clientconfig=Development`

**Important note**: The Editor build (Build Project stage) SUCCEEDED. Only the Package build (non-editor runtime target) failed. This is the hallmark of an editor-only header leaking into runtime code.

---

## Root Cause

**Confidence**: High

The header `Factories/Texture2dFactoryNew.h` belongs to the `UnrealEd` module, which is only available in Editor builds. In the source file `EarthRenderTarget2DFragment.cpp`, this header was included **outside** the `#if WITH_EDITOR` preprocessor guard.

Looking at the source code at the time of the build (commit `899869f` "添加缺失的WITH_EDITOR"), line 6 shows:

```cpp
#if WITH_EDITOR
#include "AssetToolsModule.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Factories/Texture2dFactoryNew.h"   // <-- Line 6, inside guard -- BUT this is the FIXED state
#endif
```

However, at the time of build #3899, the actual code had `Factories/Texture2dFactoryNew.h` on line 11, **outside** the `#if WITH_EDITOR` block. The commit `899869f` was a partial fix that moved `AssetToolsModule.h` inside the guard (fixing build #3898's error) but left `Factories/Texture2dFactoryNew.h` and `AssetRegistry/AssetRegistryModule.h` outside.

The **triggering commit** was `28dc0dc` ("feat: 为底板水域材质实现材质参数烘焙系统") which added the `CreateStaticTexture()` function using editor-only APIs (`UTexture2DFactoryNew`, `FAssetToolsModule`, `FAssetRegistryModule`). The includes for these APIs were placed in the general include section instead of inside `#if WITH_EDITOR`.

The `aes6-ue-runtime-ci` job builds a non-editor runtime target via `BuildCookRun`. In non-editor builds, the `UnrealEd` module's headers are not in the include search paths, so the compiler cannot find `Factories/Texture2dFactoryNew.h` and reports C1083.

### Error chain across builds

| Build | AesWorld Commit | Error | Status |
|-------|----------------|-------|--------|
| #3897 | b838ea5 | None | SUCCESS |
| #3898 | 28dc0dc (feat: material baking) | C1083: AssetToolsModule.h | FAILURE |
| #3899 | 899869f (partial fix) | C1083: Texture2dFactoryNew.h | FAILURE |
| #3900 | 7d4fa8c (full fix) | None | SUCCESS |

---

## Evidence

### Knowledge Base

**Exact match found**: `autoci-3898-3899-C1083-EditorOnlyIncludeWithoutGuard.md` (Score: 10/10)
- Documents this exact error pair (builds #3898 and #3899)
- Confirms the root cause: editor-only headers outside `#if WITH_EDITOR` guard
- Documents the fix: commit `7d4fa8c0` by PengBo moved all editor-only headers into the guard

**Concept match**: `c1083 missing header.md`
- Lists this exact case (ID 021: Texture2dFactoryNew.h in AesWorld #3899)

**Historical match**: `021-texture2dfactorynew-header-missing.md`
- Detailed analysis of this exact build failure

### Epic Official Guidance

**Query**: "UE5.5 C++ compilation fatal error C1083: Cannot open include file 'Factories/Texture2dFactoryNew.h'..."

**Key points from Epic's response**:
1. Editor-only headers MUST be wrapped in `#if WITH_EDITOR` guards
2. Both the `#include` and the code using editor classes must be guarded
3. In Build.cs, `UnrealEd` dependency should be conditional: `if (Target.bBuildEditor) { PrivateDependencyModuleNames.Add("UnrealEd"); }`
4. `WITH_EDITOR` is automatically defined by UBT for editor targets only

**References**:
- [Include What You Use (IWYU)](https://dev.epicgames.com/documentation/unreal-engine/include-what-you-use-iwyu-for-unreal-engine-programming)
- [Module Properties](https://dev.epicgames.com/documentation/unreal-engine/module-properties-in-unreal-engine)

### Source Code Context

File: `D:\Git\AesWorld\Source\EarthPrefab\Private\Output\EarthRenderTarget2DFragment.cpp`

The current state of the file (after fix) correctly has all editor-only headers inside the guard:
```cpp
#if WITH_EDITOR
#include "AssetToolsModule.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Factories/Texture2dFactoryNew.h"
#endif
```

The `CreateStaticTexture()` function (lines 399-440) that uses `UTexture2DFactoryNew` is also properly wrapped in `#if WITH_EDITOR`.

Recent git history shows the fix progression:
- `28dc0dc` -- feat: material baking system (introduced the bug)
- `899869f` -- "添加缺失的WITH_EDITOR" (partial fix, fixed AssetToolsModule.h but not the others)
- `7d4fa8c` -- "添加缺失的WITH_EDITOR" (complete fix, all headers moved into guard)

---

## Recommended Fix

The fix was already applied in commit `7d4fa8c0` (build #3900 succeeded). The fix moves all three editor-only includes into the `#if WITH_EDITOR` block:

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

---

## Prevention

1. **Any include from `AssetTools`, `UnrealEd`, `Blutility`, or `Factories` must be inside `#if WITH_EDITOR`** -- these modules are editor-only
2. **When adding editor API usage to runtime plugins**, always check: is the module listed as editor-only? If yes, guard both the include and the code
3. **Test locally with a non-editor build** before pushing commits that add new `#include` directives from editor modules
4. **The autoci non-editor build is the canary** -- it catches these issues immediately

---

## References

- [Epic: Include What You Use (IWYU)](https://dev.epicgames.com/documentation/unreal-engine/include-what-you-use-iwyu-for-unreal-engine-programming)
- [Epic: Module Properties](https://dev.epicgames.com/documentation/unreal-engine/module-properties-in-unreal-engine)
- Knowledge Base: `autoci-3898-3899-C1083-EditorOnlyIncludeWithoutGuard.md`
- Knowledge Base: `c1083 missing header.md`
- Fix Commit: `7d4fa8c0` by PengBo
