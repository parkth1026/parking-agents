# Diagnosis: C1083 in AesTerrainPayload_IdealCut.cpp

**Build**: autoci #3913 (aes6-ue-runtime-ci)
**Result**: FAILURE
**Date**: 2026-03-31
**Duration**: 78 seconds
**Triggered by**: GitLab push by piaotonghu

---

## Primary Error

```
D:\ws_twe_ue5.5_ci\Project\Plugins\G\AesWorld\Source\AesEarth\Private\AesTerrain\AesTerrainPayload\AesTerrainPayload_IdealCut.cpp(24): fatal error C1083: Cannot open include file: 'TextureRenderTargetResource.h': No such file or directory
```

**Error Count**: 1 fatal error
**Error Type**: C/C++ compilation error (missing header)
**Module**: AesEarth (AesWorld plugin)
**Build Stage**: UBT compilation phase (`[1/4] Compile [x64] Module.AesEarth.4.cpp`)

## Root Cause

**Confidence**: High

The file `AesTerrainPayload_IdealCut.cpp` at line 24 includes `TextureRenderTargetResource.h`, which **no longer exists in UE5.5**. This is confirmed by:

1. **Engine source verification**: The file `TextureRenderTargetResource.h` does not exist anywhere under `D:\Epic\UE_5.5_51\Engine\Source\Runtime\`. It was decomposed as part of UE5.5's IWYU (Include What You Use) refactoring.

2. **Epic official guidance**: Epic confirms that in UE5.5, the monolithic `TextureRenderTargetResource.h` was decomposed into more granular headers. The direct replacement is `TextureResource.h` (located at `Engine\Source\Runtime\Engine\Public\TextureResource.h`).

3. Additionally, `RenderUtils.h` (line 23) is also a deprecated header that should be replaced with `RHIStaticStates.h`.

The commit `656aef2` ("fix installed build") that was included in this build's AesWorld plugin did not address this particular include path issue.

### Plugin Change Context

AesWorld was updated from `767c64d` to `656aef2` in this build. The commit message "fix installed build" suggests it was trying to fix build issues but missed this specific header include.

## Evidence

### Knowledge Base (match found -- verified fix, 10/10 score)

The knowledge base at `raw\jenkins-log-auto-learning\details\autoci-3913-C1083-TextureRenderTargetResource.md` contains the exact verified fix for this error. Build #3914 succeeded with the following change:

**Commit**: `4bacb05ff3f25b4505446a71a6a6b4801e26cdeb` by piaotonghu ("fix installed build")

```diff
 #include "Engine/TextureRenderTarget2D.h"
 #include "Engine/World.h"
 #include "Marker/AesCollisionMarker.h"
 #include "Marker/AesRasterDataMarker.h"
-#include "RenderUtils.h"
-#include "TextureRenderTargetResource.h"
+#include "RHIStaticStates.h"
+#include "TextureResource.h"
+#if ENGINE_MAJOR_VERSION>=5 && ENGINE_MINOR_VERSION >= 2
+#include "GlobalRenderResources.h"
+#endif
```

### Epic Official Guidance

Epic's assistant confirms:

> In Unreal Engine 5.5, as part of ongoing refactoring to improve **Include What You Use (IWYU)** and reduce header bloat, the monolithic `TextureRenderTargetResource.h` has been decomposed into more granular headers.

Replacement headers:
- **Primary**: `#include "TextureResource.h"` -- for most standard 2D render target operations
- **2D Render Targets**: `#include "Engine/TextureRenderTarget2D.h"`
- **Cube Render Targets**: `#include "Engine/TextureRenderTargetCube.h"`
- **Volume/Array Render Targets**: `#include "Engine/TextureRenderTargetVolume.h"`

For low-level RHI work, ensure these module dependencies in `.Build.cs`:
```csharp
PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "Renderer", "RHI", "RenderCore" });
```

**References**:
- [UE 5.5.x Most Common Rendering Issues](https://dev.epicgames.com/community/learning/knowledge-base/j2yV/unreal-engine-ue-5-5-x-most-common-rendering-issues)
- [Unreal Engine 5 Migration Guide](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-migration-guide)

### Source Code Context

Current file at `D:\Git\AesWorld\Source\AesEarth\Private\AesTerrain\AesTerrainPayload\AesTerrainPayload_IdealCut.cpp` still has the deprecated includes at lines 23-24:
```cpp
#include "RenderUtils.h"          // line 23 - deprecated
#include "TextureRenderTargetResource.h"  // line 24 - does not exist in UE5.5
```

### Engine Verification

- `TextureRenderTargetResource.h` -- **NOT FOUND** in UE5.5 engine source
- `TextureResource.h` -- found at `D:\Epic\UE_5.5_51\Engine\Source\Runtime\Engine\Public\TextureResource.h`
- `GlobalRenderResources.h` -- found at `D:\Epic\UE_5.5_51\Engine\Source\Runtime\RenderCore\Public\GlobalRenderResources.h`

### Related Knowledge Base Entry

A similar issue (`C2061/C2065` with `FTextureRenderTargetResource`) was previously fixed in installed build #293-#301 for `EarthExtractTexturePrefab.h` by adding `#include "TextureResource.h"`. This confirms the pattern of `TextureResource.h` being the standard replacement.

## Recommended Fix

Replace the two deprecated includes in `AesTerrainPayload_IdealCut.cpp` lines 23-24:

```diff
-#include "RenderUtils.h"
-#include "TextureRenderTargetResource.h"
+#include "RHIStaticStates.h"
+#include "TextureResource.h"
+#if ENGINE_MAJOR_VERSION>=5 && ENGINE_MINOR_VERSION >= 2
+#include "GlobalRenderResources.h"
+#endif
```

This fix was already verified in build #3914 (SUCCESS).

## Status

This error has already been fixed in the next build (#3914) by commit `4bacb05` from piaotonghu. No action is needed unless you are seeing this error recur in a different build.

## References

- **Jenkins build**: http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3913/console
- **Fix build**: http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3914/console
- **Epic docs**: [UE 5.5.x Most Common Rendering Issues](https://dev.epicgames.com/community/learning/knowledge-base/j2yV/unreal-engine-ue-5-5-x-most-common-rendering-issues)
- **Epic docs**: [UE5 Migration Guide](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-migration-guide)
- **Knowledge base**: `wiki\concepts\c1083 missing header.md`
- **Knowledge base**: `raw\jenkins-log-auto-learning\details\autoci-3913-C1083-TextureRenderTargetResource.md`
