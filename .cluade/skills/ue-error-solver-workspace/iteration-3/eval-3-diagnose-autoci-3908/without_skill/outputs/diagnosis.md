# Jenkins Build #3908 Failure Diagnosis

## Build Information
- **Job**: wdp-ue/Earth/aes6-ue-runtime-ci #3908
- **Triggered by**: GitLab push by piaotonghu
- **Build time**: 2026-03-30 18:52 (84 seconds)
- **Result**: FAILURE
- **Previous build (#3906)**: SUCCESS
- **Build stage that failed**: Build Project

## Error Summary

The build failed with **2 linker errors (LNK2019)** and **1 fatal linker error (LNK1120)** during compilation of the `EarthPrefab` module in the `AesWorld` plugin.

### Error Details

**Error 1 - LNK2019: Unresolved external symbol**
```
Module.EarthPrefab.7.cpp.obj : error LNK2019: unresolved external symbol
"public: void __cdecl FEarthMaterialParametersBakerFragment::BakeMaterialParameters(void)"
(?BakeMaterialParameters@FEarthMaterialParametersBakerFragment@@QEAAXXZ)
referenced in function
"public: static void __cdecl UEarthOutputFunctionLibrary::BakeMaterialParameters(struct FEarthMaterialParametersBakerFragment &)"
```

**Error 2 - LNK2019: Unresolved external symbol**
```
Module.EarthPrefab.7.cpp.obj : error LNK2019: unresolved external symbol
"public: void __cdecl FEarthMaterialParametersBakerFragment::CreateStaticTexture(class UObject *)"
(?CreateStaticTexture@FEarthMaterialParametersBakerFragment@@QEAAXPEAVUObject@@@Z)
referenced in function
"public: static void __cdecl UEarthOutputFunctionLibrary::CreateStaticTexture(class UObject *,struct FEarthMaterialParametersBakerFragment &)"
```

**Error 3 - LNK1120: Fatal linker error**
```
D:\ws_twe_ue5.5_ci\Project\Plugins\G\AesWorld\Binaries\Win64\UnrealEditor-EarthPrefab.dll : fatal error LNK1120: 2 unresolved externals
```

## Root Cause Analysis

The `EarthPrefab` module (part of the `AesWorld` plugin) has **unresolved linker symbols** for two methods of the `FEarthMaterialParametersBakerFragment` struct:

1. `FEarthMaterialParametersBakerFragment::BakeMaterialParameters(void)`
2. `FEarthMaterialParametersBakerFragment::CreateStaticTexture(UObject*)`

These methods are **declared in a header file** (so the compiler can see them) but their **implementations (.cpp) are either missing, not compiled, or in a different module that is not linked**.

The calling code is in `UEarthOutputFunctionLibrary` which calls these two methods. The linker can find the caller's object file but cannot find the compiled object file containing the actual function bodies.

### Suspect Commit

The `AesWorld` plugin was updated from commit `3149a0e` (previous) to `8680bdb` in this build:
- **Commit**: `8680bdb` - "fix: installed build缺少UObject/Package.h导致UPackage到UObject隐式转换失败"

This commit was intended to fix a missing `#include "UObject/Package.h"` issue for installed builds, which relates to `UPackage` to `UObject` implicit conversion. However, it appears that the changes in this commit (or a closely related change) may have:
- Moved the implementation of `BakeMaterialParameters()` and `CreateStaticTexture()` to a different module without updating module dependencies
- Changed the export macros or API specifiers causing the symbols not to be exported
- Modified the module's `.Build.cs` file in a way that excluded source files containing these implementations

## Recommended Fix

1. **Check if the implementations exist**: Verify that `FEarthMaterialParametersBakerFragment::BakeMaterialParameters()` and `FEarthMaterialParametersBakerFragment::CreateStaticTexture()` have `.cpp` implementations in the `EarthPrefab` module (or whatever module declares them).

2. **Check module dependencies**: If these functions are defined in a different module than `EarthPrefab`, ensure the `EarthPrefab.Build.cs` file includes that module in its `PublicDependencyModuleNames` or `PrivateDependencyModuleNames`.

3. **Check API export macros**: Ensure the struct `FEarthMaterialParametersBakerFragment` and its methods are properly exported with the correct `EARTHPREFAB_API` or equivalent macro if they are in a different DLL module.

4. **Check for missing source files**: Verify that all `.cpp` files in the `EarthPrefab` module are being compiled (not excluded by `Build.cs` filters or `.ubtplugin` configuration).

## Affected Plugin Versions in This Build

| Plugin | Commit | Message |
|--------|--------|---------|
| **AesWorld** (failed) | `8680bdb` | fix: installed build缺少UObject/Package.h导致UPackage到UObject隐式转换失败 |
| AesArtAsset | `132a639` | api v2.2.0 |
| ArtCommon | `a15b4bf` | UTF-8 |
| EarthArtAsset | `df36e08` | version.json 6.4.0 |
| WdpCamera | `8932bd1` | Merge branch 'feature/camera_refactor_wxy' into dev |
| AesRuntime | `fafed1e` | 禁止将Level写入搭配CustomDepthStencilValue中 |
| SkyCreatorPlugin | `500e3f9` | 更新WDP中建海创专属01天气预设_雾效 |
| WdpEnvironment | `a740f6c` | add wdp custom Weather Description |
