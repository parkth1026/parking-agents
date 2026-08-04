## Diagnosis: C1083 in AesTerrainPayload_IdealCut.cpp

**Build**: aes6-ue-runtime-ci #3913 (FAILURE)
**Triggered by**: GitLab push by piaotonghu
**Duration**: 78 seconds
**Date**: 2026-03-31

**Primary Error**: `fatal error C1083: Cannot open include file: 'TextureRenderTargetResource.h': No such file or directory`
**File**: `Plugins/G/AesWorld/Source/AesEarth/Private/AesTerrain/AesTerrainPayload/AesTerrainPayload_IdealCut.cpp` line 24
**Error Count**: 1 (single fatal error, build aborted immediately)
**Error Classification**: C/C++ compilation error -- UE5 header/API related

**Root Cause**: The standalone header file `TextureRenderTargetResource.h` no longer exists in UE5.5. The class `FTextureRenderTargetResource` was consolidated into `TextureResource.h` (located at `Engine/Source/Runtime/Engine/Public/TextureResource.h`). The code at line 24 has `#include "TextureRenderTargetResource.h"` which worked in older UE versions but fails in UE5.5.

**Confidence**: High

### Evidence

- **Knowledge Base (wiki)**: Direct match found in `concepts/c1083 missing header.md`. Documents this exact case (TextureRenderTargetResource.h) and lists it as case ID 001 for build #3913->#3912.
- **Knowledge Base (raw)**: Exact match found in `details/001-TextureRenderTargetResource-C1083.md`. Scored 8/10 with detailed analysis confirming the header path change in UE5.5.
- **Epic Guidance**: Epic's official UE assistant confirmed that in UE5.5, rendering headers were reorganized under stricter IWYU conventions. Epic recommends changing the include path to `#include "Engine/TextureRenderTargetResource.h"` -- however, our engine source analysis shows this file does not exist either. The class is actually defined in `TextureResource.h`.
- **Source Context**: Line 24 of `AesTerrainPayload_IdealCut.cpp` has `#include "TextureRenderTargetResource.h"`. The code uses `FTextureRenderTargetResource` indirectly via `GetRenderTargetResource()->TextureRHI` calls (lines 718-729) to access render target texture RHI resources for water rendering.
- **Engine Source Analysis**: Searched `D:\Epic\UE_5.5_51\Engine\Source` for `TextureRenderTargetResource.h` -- file does not exist. The class `FTextureRenderTargetResource` is defined in `Engine/Source/Runtime/Engine/Public/TextureResource.h` at line 358.
- **Build History**: Build #3914 (SUCCESS) used AesWorld commit `4bacb05` (message: "fix installed build") compared to #3913's `656aef2`. The fix was committed between these two builds.

### Recommended Fix

Replace line 24 in `AesTerrainPayload_IdealCut.cpp`:

```cpp
// Before (line 24):
#include "TextureRenderTargetResource.h"

// After:
#include "TextureResource.h"
```

Alternatively, since the code already includes `#include "Engine/TextureRenderTarget2D.h"` (line 19) which may transitively pull in what's needed, it's possible the include can simply be removed. However, the safest fix is to replace it with `TextureResource.h` which is where `FTextureRenderTargetResource` is now defined.

Additionally, ensure `AesEarth.Build.cs` has the `Engine` and `RenderCore` module dependencies (which it likely already does given the other includes compile fine).

### Build Command (from log)

```
D:\Epic\UE_5.5_51/Engine/Build/BatchFiles/RunUAT.bat BuildTarget
    -project="D:/ws_twe_ue5.5_ci/Project/TWE.uproject"
    -Target=Editor
    -Platform=Win64
    -Configuration=Development
    -NoTools
```

UBT invocation:
```
UnrealBuildTool.dll TWEEditor Win64 Development -Project="D:\ws_twe_ue5.5_ci\Project\TWE.uproject"
```

### References

- Epic official: [UE 5.5.x Most Common Rendering Issues](https://dev.epicgames.com/community/learning/knowledge-base/j2yV/unreal-engine-ue-5-5-x-most-common-rendering-issues)
- Epic official: [Creating a New Global Shader as a Plugin](https://dev.epicgames.com/documentation/unreal-engine/creating-a-new-global-shader-as-a-plugin-in-unreal-engine)
- Knowledge base: `wiki/concepts/c1083 missing header.md`
- Knowledge base: `raw/ue5-jenkins/details/001-TextureRenderTargetResource-C1083.md`
- Knowledge base: `wiki/concepts/ue5.5 api changes.md`
- Jenkins failure: http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3913/console
- Jenkins success (fixed): http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3914/console

### Status

This issue has already been fixed. Build #3914 compiled successfully with AesWorld commit `4bacb05` (replacing `656aef2` from #3913). The fix was committed by the team under the message "fix installed build". No further action is required.
