# C2027: use of undefined type 'FSceneView' in AesTerrainPayload.cpp

> **Score**: 10/10 | **Job**: twe-ue5.5-installed | **Date**: 2026-04-09
> **Builds**: #401–#420 (FAILURE) → #421 (SUCCESS)
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Message
```
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\AesEarth\Private\AesTerrain\AesTerrainPayload\AesTerrainPayload.cpp(567): error C2027: use of undefined type 'FSceneView'
```

## Root Cause
The file `AesTerrainPayload.cpp` uses `FSceneView` (accessing its members) but only had a forward declaration visible — the full type definition from `SceneView.h` was not included. This was introduced when feature branch `embankment-prefab-guesser` was merged (commit `781ea29`) which added terrain payload code that references `FSceneView`. The missing `#include` caused every subsequent build to fail for 20 consecutive builds until the explicit include was added.

## Fix
- **Commit**: `c05026b` by luwei (luwei01@51aes.com)
- **Message**: "修复jenkens install管线编译不过的问题" (Fix Jenkins install pipeline compilation issue)
- **What changed**: Added `#include "SceneView.h"` to `AesTerrainPayload.cpp`

```diff
 #include "AesTerrain/AesTerrainCollision/AesTerrainCollisionBudgetSubsystem.h"
 #include "Core/AesMarkerStorage_GPU_Range.h"
 #include "Engine/World.h"
 #include "Marker/AesCollisionMarker.h"
 #include "Marker/AesRasterDataMarker.h"
+#include "SceneView.h"
```

## How to Reproduce / Detect
- Use `FSceneView` members (not just a pointer/reference) in a `.cpp` file without `#include "SceneView.h"`
- The error appears in "installed" (non-monolithic) builds where implicit transitive includes from `Engine.h` are not available
- The error specifically triggers as `error C2027` when attempting to use members of a forward-declared type

## Epic Official Guidance
- **Query**: "UE5.5 C++ compilation error C2027: use of undefined type 'FSceneView' in AesTerrainPayload.cpp line 567. The code uses FSceneView but does not include SceneView.h. What causes C2027 in UE5 and how to fix missing FSceneView definition?"
- **Answer**: Error C2027 occurs because the compiler has seen only a forward declaration of `FSceneView`, not its full definition. UE headers like `SceneViewExtension.h` may forward-declare `class FSceneView;` but do not provide the full definition. The fix is to add `#include "SceneView.h"` at the top of the .cpp file. UE5 enforces IWYU (Include What You Use) — explicitly add `SceneView.h` wherever you access member fields/methods. Do not include monolithic `Engine.h` headers. If accessing renderer-specific code, ensure your `.Build.cs` includes the "Renderer" module dependency.
- **References**:
  - [NNE - Neural Post Processing](https://dev.epicgames.com/community/learning/courses/e7w/unreal-engine-neural-network-engine-nne/7dr8/unreal-engine-nne-neural-post-processing)
  - [Using SceneViewExtension to Extend the Rendering System](https://dev.epicgames.com/community/learning/knowledge-base/0ql6/unreal-engine-using-sceneviewextension-to-extend-the-rendering-system)

## Prevention
- When merging feature branches that add rendering code, verify all `.cpp` files include `SceneView.h` if they use `FSceneView` members
- Run a local "installed" (non-monolithic) build before pushing — transitive includes work differently in monolithic vs installed builds
- Follow UE5 IWYU conventions: every `.cpp` file must explicitly include headers for every type it accesses, not rely on transitive includes
