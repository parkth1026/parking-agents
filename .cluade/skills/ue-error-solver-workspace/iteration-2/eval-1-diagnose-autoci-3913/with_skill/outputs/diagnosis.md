# Diagnosis: C1083 in AesTerrainPayload_IdealCut.cpp

**Primary Error**: `fatal error C1083: Cannot open include file: 'TextureRenderTargetResource.h': No such file or directory`
**Root Cause**: The header `TextureRenderTargetResource.h` was removed/relocated in UE5.5 as part of Epic's IWYU (Include What You Use) header reorganization. The same applies to `RenderUtils.h` on line 23. Both headers existed in earlier UE versions but were split into more granular, module-specific headers in UE5.2+. The file `AesTerrainPayload_IdealCut.cpp` still references the old paths.
**Confidence**: High

## Error Details

- **Build**: [aes6-ue-runtime-ci #3913](http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3913/console)
- **Build Result**: FAILURE (duration: 78s)
- **Triggered by**: GitLab push by piaotonghu
- **Error file**: `Plugins/G/AesWorld/Source/AesEarth/Private/AesTerrain/AesTerrainPayload/AesTerrainPayload_IdealCut.cpp` line 24
- **Plugin**: AesWorld (commit `656aef2` "fix installed build")
- **Build target**: TWEEditor Win64 Development

## Evidence

- **Knowledge base**: **Strong match** (Score 10/10). This exact error in build #3913 was already documented with a verified fix. The fix was applied in commit `4bacb05` and confirmed by build #3914 succeeding. The wiki also catalogs `TextureRenderTargetResource.h` as a known UE5.5 header path change (case ID 001 in the C1083 concept page).
- **Epic guidance**: Epic confirms that `TextureRenderTargetResource.h` was reorganized under IWYU standards. `FTextureRenderTargetResource` is now accessible via `TextureResource.h` and `Engine/TextureRenderTarget2D.h`. `RenderUtils.h` should be replaced with `RenderGraphUtils.h` or `RHIStaticStates.h`.
- **Source context**: Line 24 of the file has `#include "TextureRenderTargetResource.h"` and line 23 has `#include "RenderUtils.h"` — both are deprecated headers. The code already includes `Engine/TextureRenderTarget2D.h` on line 19, which partially covers the needed declarations.
- **Git history**: The file has two recent "fix installed build" commits (`656aef2`, `767c64d`), indicating ongoing header migration work that had not yet addressed this particular include.

## Recommended Fix

Replace the two deprecated includes with UE5.5-compatible headers:

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

This is the **verified fix** from the knowledge base — commit `4bacb05` applied exactly this change and build #3914 succeeded.

## Already Fixed?

Yes. According to the knowledge base, this was **already fixed** in the next build:
- **Fix commit**: `4bacb05ff3f25b4505446a71a6a6b4801e26cdeb` by piaotonghu
- **Fix message**: "fix installed build"
- **Verified by**: Build #3914 (SUCCESS)

No action is needed. The fix has already been committed and verified.

## References

- [Epic: Creating a New Global Shader as a Plugin](https://dev.epicgames.com/documentation/unreal-engine/creating-a-new-global-shader-as-a-plugin-in-unreal-engine)
- [Epic: UE 5.4.x Most Common Rendering Issues](https://dev.epicgames.com/community/learning/knowledge-base/yjp8/unreal-engine-ue-5-4-x-most-common-rendering-issues)
- Knowledge base: `wiki/concepts/c1083 missing header.md`
- Knowledge base: `raw/jenkins-log-auto-learning/details/autoci-3913-C1083-TextureRenderTargetResource.md` (Score 10/10, verified fix)
