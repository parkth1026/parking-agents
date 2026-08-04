# C2027: use of undefined type 'ULevel' — Missing Engine/Level.h Include

> **Score**: 10/10 | **Job**: installed (twe-ue5.5-installed) | **Date**: 2026-04-10
> **Builds**: #377 (FAILURE) → #380 (SUCCESS) — also covers #378, #379
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Message

```
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\Editor\AesEditorMode\Private\Actions\Terrain\AesTerrainEditorAction_Ramp.cpp(548): error C2027: use of undefined type 'ULevel'
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\Editor\AesEditorMode\Private\Actions\Terrain\AesTerrainEditorAction_Ramp.cpp(548): error C2530: 'Actor': references must be initialized
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\Editor\AesEditorMode\Private\Actions\Terrain\AesTerrainEditorAction_Ramp.cpp(548): error C3531: 'Actor': a symbol whose type contains 'auto' must have an initializer
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\Editor\AesEditorMode\Private\Actions\Terrain\AesTerrainEditorAction_Ramp.cpp(548): error C2143: syntax error: missing ';' before ':'
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\Editor\AesEditorMode\Private\Actions\Terrain\AesTerrainEditorAction_Ramp.cpp(552): error C2440: 'return': cannot convert from 'int' to 'UAesTerrainComponent *'
```

## Root Cause

`AesTerrainEditorAction_Ramp.cpp` line 548 uses a range-based for loop over `Level->Actors` (the actor array of a `ULevel`). The code iterates with `for (auto& Actor : Level->Actors)`. Since UE5.5 follows IWYU (Include What You Use), `ULevel` is only forward-declared through transitive includes — the full definition from `Engine/Level.h` is not included directly. Without the full definition, the compiler cannot access the `Actors` member array, causing C2027. This makes the range-based for loop fail entirely (C2530, C3531, C2143) and cascades into type inference failures for subsequent variables.

The failing AesWorld commit was `5c5323e` ("feat(terrain): 添加多边形地形平整工具并优化平整模式") which introduced the new terrain polygon flatten tool code that iterates over `Level->Actors` without adding the required include.

## Fix

- **Commit**: `51c148619d391432a5a95e7dc18dc422dfba875c` (cherry-picked into `c2ced65`) by luwei (luwei01@51aes.com)
- **Message**: "管线编译不过的问题"
- **What changed**:

```diff
--- a/Source/Editor/AesEditorMode/Private/Actions/Terrain/AesTerrainEditorAction_Ramp.cpp
+++ b/Source/Editor/AesEditorMode/Private/Actions/Terrain/AesTerrainEditorAction_Ramp.cpp
@@ -19,10 +19,11 @@
 #include "Operations/Raster/AesElevationDataOperation_Circle.h"
 #include "Raster/AesEditingRasterData_HeightField.h"
 #include "Transaction/AesRasterEditingTransaction.h"
 #include "Utils/AesGameplayStatics.h"
 #include "Materials/MaterialParameterCollection.h"
+#include "Engine/Level.h"
```

One line added: `#include "Engine/Level.h"` at the top of the cpp file.

## How to Reproduce / Detect

- Any `.cpp` file that accesses `ULevel*` members (e.g., `Level->Actors`, `Level->GetWorld()`, `Level->bIsVisible`) without `#include "Engine/Level.h"` will hit C2027.
- Common pattern: code that iterates over actors in a level using `Level->Actors`.
- Build #378 also showed a second unrelated error in `AesWdpChangesetTest.cpp` (C7568 TCondensedJsonPrintPolicy) from the same AesWorld commit batch — that was fixed separately.

## Epic Official Guidance

- **Query**: "UE5.5 C++ compilation error C2027: use of undefined type 'ULevel' in AesTerrainEditorAction_Ramp.cpp line 548, causing cascade errors C2530, C3531, C2143. The range-based for loop iterates over Level->Actors."
- **Answer**:
  > The compilation error C2027 occurs because the compiler has seen a forward declaration of `ULevel` (likely from `Engine/World.h` or a similar header), but it does not have the full class definition required to access its member variables, such as the `Actors` array.
  >
  > Because the compiler cannot determine the type or size of `Actors`, it fails to deduce the type for the range-based for loop, leading to C3531 (symbol with 'auto' must have an initializer) and C2530 (reference must be initialized) cascade errors.
  >
  > **The Fix**: Add `#include "Engine/Level.h"` to the `.cpp` file. UE5.5 follows IWYU standards — headers no longer automatically include large monolithic files like `Engine.h`.
  >
  > In UE5.5, when iterating over `Level->Actors`, be aware that actors marked for elimination may still reside in the array until the next GC pass — always null-check:
  > ```cpp
  > #include "Engine/Level.h"
  > for (AActor* Actor : Level->Actors)
  > {
  >     if (Actor) { /* your logic */ }
  > }
  > ```
- **References**:
  - [Level Streaming Deep Dive](https://dev.epicgames.com/community/learning/knowledge-base/qB5K/unreal-engine-level-streaming-deep-dive)
  - [Gameplay Classes in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/gameplay-classes-in-unreal-engine)

## Prevention

- When writing any code that accesses `ULevel` member variables or methods, explicitly add `#include "Engine/Level.h"` in the `.cpp` file — do not rely on transitive includes.
- The IWYU discipline in UE5.5 means `Engine/World.h` only forward-declares `ULevel`; accessing its fields requires the full definition.
- When a new tool or action class introduces iteration over level actors (`Level->Actors`), the code reviewer should verify `Engine/Level.h` is directly included.
