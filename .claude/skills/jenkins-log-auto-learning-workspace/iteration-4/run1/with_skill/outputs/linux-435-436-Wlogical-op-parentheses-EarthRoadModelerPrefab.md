# -Wlogical-op-parentheses: '&&' within '||' Without Parentheses

> **Score**: 10/10 | **Job**: linux | **Date**: 2026-04-09
> **Builds**: #435, #436 (FAILURE) → #439 (SUCCESS) [#437, #438 = OOM infra]
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Message
```
D:\ws_twe_ue5.5_linux_ci\Project\Plugins\G\AesWorld\Source\EarthPrefab\Private\Prefab\EarthRoadModelerPrefab.cpp(223,78):
  error: '&&' within '||' [-Werror,-Wlogical-op-parentheses]
D:\ws_twe_ue5.5_linux_ci\Project\Plugins\G\AesWorld\Source\EarthPrefab\Private\Prefab\EarthRoadModelerPrefab.cpp(223,168):
  error: '&&' within '||' [-Werror,-Wlogical-op-parentheses]
ExitCode=6
ERROR: Package project failed.
```

## Root Cause
In `EarthRoadModelerPrefab.cpp` line 223, a boolean expression mixed `&&` and `||` without parentheses:
```cpp
// Before (triggers -Wlogical-op-parentheses):
LaneInfo.bBuildEnd = LaneInfo.Direction == EEarthPlaceDirection::Forward && StopLineModelerAsset.bBuildEnd
                   || LaneInfo.Direction == EEarthPlaceDirection::Backward && StopLineModelerAsset.bBuildStart;
```
Clang treats `&&` binding tighter than `||` but warns when the intent might be ambiguous. The Linux build uses `-Werror` which promotes this warning to a hard error, causing the build to fail. The Windows MSVC build does not emit this warning, masking the issue.

## Fix
- **Commit**: `2418a20b11f810fbecdc79b70ec8e3cd1334acb7` by luwei (AesWorld)
- **Message**: "修复jenkes管线报错的问题" (Fix Jenkins pipeline compilation error)
- **What changed**:

**Source/EarthPrefab/Private/Prefab/EarthRoadModelerPrefab.cpp** — Add explicit parentheses:
```diff
-LaneInfo.bBuildEnd = LaneInfo.Direction == EEarthPlaceDirection::Forward && StopLineModelerAsset.bBuildEnd || LaneInfo.Direction == EEarthPlaceDirection::Backward && StopLineModelerAsset.bBuildStart;
+LaneInfo.bBuildEnd = (LaneInfo.Direction == EEarthPlaceDirection::Forward && StopLineModelerAsset.bBuildEnd) || (LaneInfo.Direction == EEarthPlaceDirection::Backward && StopLineModelerAsset.bBuildStart);
```

**Source/EarthModeler/Private/InteractiveTool/Tools/EarthAddRoadTool.h** — Fix UPROPERTY metadata:
```diff
-UPROPERTY(VisibleDefaultsOnly)
+UPROPERTY(VisibleDefaultsOnly, Category = Road)
 bool bShowSnapshotPath = false;
```

## How to Reproduce / Detect
- Write a boolean expression mixing `&&` and `||` without explicit parentheses, e.g. `A && B || C && D`
- Build for Linux — Clang will emit `-Wlogical-op-parentheses` which is treated as an error due to `-Werror`
- Detecting: grep for `-Wlogical-op-parentheses` in console output

## Epic Official Guidance
Epic query unavailable — analysis based on project context only.

This is a standard Clang/GCC warning. UE5's Linux build configuration enables `-Werror`, converting all warnings to errors. The warning `-Wlogical-op-parentheses` fires when `&&` and `||` are mixed without parentheses to disambiguate precedence. This is purely a code style/portability issue, not a logic bug in this case.

## Prevention
- Always add explicit parentheses when mixing `&&` and `||` in the same expression
- Run `clang++ -Wlogical-op-parentheses` locally (or use a CI pre-check) before pushing new code with complex boolean expressions
- Enable Clang-Tidy with `readability-avoid-const-params-in-decls` and logic checks in your local IDE to catch this before push
- Note: Windows MSVC does not emit this warning, so code that builds clean on Windows may fail on Linux — test Linux build before merging
