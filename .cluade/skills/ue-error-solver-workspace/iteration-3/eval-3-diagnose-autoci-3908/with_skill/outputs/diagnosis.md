# Diagnosis: LNK2019 / LNK1120 in EarthPrefab Module

> **Build**: aes6-ue-runtime-ci [#3908](http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3908/)
> **Date**: 2026-03-30
> **Result**: FAILURE (ExitCode=6, duration 84s)
> **Triggered by**: GitLab push by piaotonghu

---

## Error Summary

**3 linked errors** (2 LNK2019 + 1 LNK1120), all from the same root cause:

```
Module.EarthPrefab.7.cpp.obj : error LNK2019: unresolved external symbol
  "public: void __cdecl FEarthMaterialParametersBakerFragment::BakeMaterialParameters(void)"
  referenced in function "public: static void __cdecl UEarthOutputFunctionLibrary::BakeMaterialParameters(...)"

Module.EarthPrefab.7.cpp.obj : error LNK2019: unresolved external symbol
  "public: void __cdecl FEarthMaterialParametersBakerFragment::CreateStaticTexture(class UObject *)"
  referenced in function "public: static void __cdecl UEarthOutputFunctionLibrary::CreateStaticTexture(...)"

D:\ws_twe_ue5.5_ci\...\UnrealEditor-EarthPrefab.dll : fatal error LNK1120: 2 unresolved externals
```

**Classification**: Linker error / Missing include (IWYU violation)

---

## Diagnosis: Missing `#include "Materials/Material.h"` in EarthRenderTarget2DFragment.cpp

**Primary Error**: LNK2019 - unresolved external symbols for `FEarthMaterialParametersBakerFragment::BakeMaterialParameters()` and `FEarthMaterialParametersBakerFragment::CreateStaticTexture(UObject*)`

**Root Cause**: The file `EarthRenderTarget2DFragment.cpp` was missing `#include "Materials/Material.h"`. This header provides the definition of `UMaterial`, which is used extensively in the `BakeMaterialParameters()` and helper function `GetUltimateParentMaterial()`. Without this include, the file fails to compile in non-unity/adaptive build mode, producing no valid object file. The linker then cannot find the symbol definitions, resulting in LNK2019.

**Confidence**: High

### Why It Worked Before (and Why It Broke Now)

1. **Unity build masking**: Under UE5's default unity build, multiple `.cpp` files are compiled together in a single translation unit. If another `.cpp` in the same unity file included `Materials/Material.h`, it would "accidentally" satisfy the dependency for `EarthRenderTarget2DFragment.cpp`. This is a classic IWYU (Include What You Use) violation.

2. **Adaptive non-unity build exposed the problem**: The build log shows: `"Using 'git status' to determine working set for adaptive non-unity build"`. UBT only compiled `Module.EarthPrefab.7.cpp` (which contains `EarthOutputFunctionLibrary.cpp`) as a separate translation unit. The file `EarthRenderTarget2DFragment.cpp`, compiled in a different translation unit, failed silently due to the missing include, producing no valid `.obj` for the linker.

3. **The trigger**: Commit `8680bdb` ("fix: installed build缺少UObject/Package.h导致UPackage到UObject隐式转换失败") modified `EarthRenderTarget2DFragment.cpp` to fix Chinese comment encoding (garbled UTF-8 to proper UTF-8) and removed the BOM marker. While no functional code changed, the file was touched, causing UBT to regenerate the makefile ("Creating makefile for TWEEditor (.uproject file is newer)") and reassign unity file groupings.

### Evidence

- **Knowledge base**: Exact match found. This error was previously documented in:
  - `wiki/concepts/lnk2019 link error.md` - references EarthPrefab case
  - `wiki/entities/earthprefab.md` - documents this specific build #3908 failure
  - `raw/ue5-jenkins/details/002-lnk2019-fearthmaterialparametersbakerfragment.md` - detailed analysis
  
- **Epic official guidance**: Epic confirms this is a classic IWYU violation. Recommends:
  - Always directly `#include` what you use
  - Enable `bEnforceIWYU = true` in Target.cs to prevent future occurrences
  - Regularly do non-unity/clean builds to catch hidden dependency issues

- **Source code context**:
  - `EarthRenderTarget2DFragment.cpp` (at commit `8680bdb`) includes `Materials/MaterialInstance.h` and `Materials/MaterialLayersFunctions.h` but NOT `Materials/Material.h`
  - The file uses `UMaterial` directly in `GetUltimateParentMaterial()` (line 112-130) and `BakeMaterialParameters()` (lines 157, 170, etc.)
  - `EarthOutputFunctionLibrary.cpp` calls `BakeMaterialParameters()` and `CreateStaticTexture()` on `FEarthMaterialParametersBakerFragment`, creating the unresolved reference

- **Git history**: The subsequent commit `767c64d` ("fix installed build") added the missing include:
  ```diff
  +#include "Materials/Material.h"
  ```
  This confirms the diagnosis.

### Recommended Fix

Add the missing include to `EarthRenderTarget2DFragment.cpp`:

```cpp
#include "Materials/Material.h"    // <-- Add this line
#include "Materials/MaterialInstance.h"
#include "Materials/MaterialLayersFunctions.h"
```

**Status**: This fix has already been applied in commit `767c64d2d` by piaotonghu.

### Prevention

1. **Enable IWYU enforcement**: Set `bEnforceIWYU = true` in the project's `.Target.cs` files to catch missing includes at compile time
2. **Periodic non-unity builds**: Run CI with `bUseUnityBuild = false` periodically to flush out hidden include dependencies
3. **Code review**: When touching file encoding or formatting (BOM removal, comment re-encoding), be aware that it can trigger makefile regeneration and expose latent IWYU violations

### References

- [Epic: Include What You Use (IWYU)](https://dev.epicgames.com/documentation/unreal-engine/include-what-you-use-iwyu-for-unreal-engine-programming)
- [Epic: Build Tool Target Reference](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-build-tool-target-reference)
- [MSDN: LNK2019 Linker Error](https://learn.microsoft.com/en-us/cpp/error-messages/tool-errors/linker-tools-error-lnk2019)
- Knowledge base: `wiki/concepts/lnk2019 link error.md`
- Knowledge base: `raw/ue5-jenkins/details/002-lnk2019-fearthmaterialparametersbakerfragment.md`
