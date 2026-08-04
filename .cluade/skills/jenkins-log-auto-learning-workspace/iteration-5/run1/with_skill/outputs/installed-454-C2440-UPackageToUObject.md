# C2440: Cannot convert from 'UPackage *' to 'UObject *' in installed build

> **Score**: 10/10 | **Job**: installed (twe-ue5.5-installed) | **Date**: 2026-03-31
> **Builds**: #454 (FAILURE) → #457 (SUCCESS)
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Message
```
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\EarthPrefab\Private\Output\EarthRenderTarget2DFragment.cpp(323): error C2440: 'initializing': cannot convert from 'UPackage *' to 'UObject *'
```
This error appeared twice (two separate Rebuild All passes), causing the build to fail with ExitCode=6.

## Root Cause
In UE5.5 installed builds, `UPackage` is forward-declared as an incomplete type in many engine headers. Without the explicit `#include "UObject/Package.h"`, the compiler cannot see the inheritance relationship `UPackage : public UObject`, so implicit conversion from `UPackage*` to `UObject*` fails with C2440.

This works fine in Editor builds because the Editor build configuration pulls in the full `UObject/Package.h` header transitively through other includes, but the installed (Game) build uses a more minimal include set.

## Fix
- **Commit**: `aca01f1ae16050c33afa497df0dbab27c100ca41` by parking (piaotonghu)
- **Message**: "fix: installed build缺少UObject/Package.h导致UPackage到UObject隐式转换失败"
- **What changed**:

In `Source/EarthPrefab/Private/Output/EarthRenderTarget2DFragment.cpp`, added the missing include:

```diff
 #include "Materials/MaterialInstance.h"
 #include "Materials/MaterialLayersFunctions.h"
+#include "UObject/Package.h"
 
 void FEarthRenderTarget2DFragment::CreateRenderTarget2D()
```

Additionally, the commit fixed UTF-8 BOM encoding and re-encoded Chinese comments from garbled mojibake back to proper UTF-8.

## How to Reproduce / Detect
- Build the EarthPrefab module in an installed (Game) build configuration
- Any code that passes a `UPackage*` where `UObject*` is expected will fail with C2440 if `UObject/Package.h` is not explicitly included
- Search for `GetOutermost()` or `CreatePackage()` calls in files that don't include `UObject/Package.h`

## Prevention
- Always explicitly `#include "UObject/Package.h"` in files that use `UPackage` or call functions returning `UPackage*` -- do not rely on transitive includes from Editor builds
- Test plugin compilation in both Editor and installed (Game) build configurations before merging
- Add a CI check that builds the installed target for every PR touching plugin C++ source files

## Recurrences
| Date | Builds | Trigger | Notes |
|------|--------|---------|-------|
| 2026-04-09 | #452, #453 → #457 | Same `EarthRenderTarget2DFragment.cpp(323)` UPackage->UObject conversion | Earlier failures in the same streak, same root cause as #454. All resolved by same fix commit `aca01f1`. |
