# UHT-CategorySpecifier: Missing Category in UPROPERTY for Engine Module

> **Score**: 10/10 | **Job**: twe-ue5.5-installed | **Date**: 2026-04-09
> **Builds**: #441 (FAILURE) → #443 (SUCCESS)
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Message
```
D:\Epic\UE_5.5_51\Engine\Plugins\MarketPlace\AesWorld\Source\EarthModeler\Private\InteractiveTool\Tools\EarthAddRoadTool.h(22): Error: An explicit Category specifier is required for any property exposed to the editor or Blueprints in an Engine module.
```
```
UnrealBuildTool failed. ExitCode=6
```

## Root Cause
In UE5.2+ (including UE5.5), UnrealHeaderTool (UHT) enforces that any `UPROPERTY` exposed to the editor or Blueprints in an Engine/plugin module must include an explicit `Category` specifier. The property `bShowSnapshotPath` was declared as `UPROPERTY(VisibleDefaultsOnly)` without a `Category`, which is allowed in game modules but rejected in plugin/engine modules.

This was introduced by commit `575110e8` ("fix(EarthModeler): sync component FeatureID in AddRoadTool snapshot restore") which added the new `bShowSnapshotPath` property without the required Category.

## Fix
- **Commit**: `2418a20b` by luwei (luwei01@51aes.com)
- **Message**: "修复jenkes管线报错的问题" (Fix Jenkins pipeline error)
- **What changed**: Added `Category = Road` to the UPROPERTY specifier, and also fixed an operator precedence issue with parentheses:

```diff
// EarthAddRoadTool.h
-	UPROPERTY(VisibleDefaultsOnly)
+	UPROPERTY(VisibleDefaultsOnly, Category = Road)
 	bool bShowSnapshotPath = false;

// EarthRoadModelerPrefab.cpp (bonus fix — operator precedence)
-	LaneInfo.bBuildEnd = LaneInfo.Direction == EEarthPlaceDirection::Forward && StopLineModelerAsset.bBuildEnd || LaneInfo.Direction == EEarthPlaceDirection::Backward && StopLineModelerAsset.bBuildStart;
+	LaneInfo.bBuildEnd = (LaneInfo.Direction == EEarthPlaceDirection::Forward && StopLineModelerAsset.bBuildEnd) || (LaneInfo.Direction == EEarthPlaceDirection::Backward && StopLineModelerAsset.bBuildStart);
```

## How to Reproduce / Detect
- Add a `UPROPERTY(EditAnywhere)` or `UPROPERTY(VisibleDefaultsOnly)` in a plugin/engine module without specifying `Category`
- The error only surfaces when UHT runs (build step before compilation), with `ExitCode=6`
- Game modules do not enforce this rule, so it may compile fine in a game project but fail when the code is built as an engine plugin

## Epic Official Guidance
- **Query**: "UE5.5 UnrealHeaderTool error: 'An explicit Category specifier is required for any property exposed to the editor or Blueprints in an Engine module' for UPROPERTY(VisibleDefaultsOnly) without Category."
- **Answer**: Starting with UE5.2, any property exposed to the editor or Blueprints within an Engine module must have an explicit `Category` specified. This prevents clutter in the Details panel. The fix is to add `Category = "YourCategory"` to the UPROPERTY macro. For game modules this is optional, but for engine, plugin, and editor modules it is mandatory.
- **References**:
  - [UPROPERTY: Exposing Variables](https://dev.epicgames.com/community/learning/courses/KJ/unreal-engine-converting-blueprint-to-c/4yE/unreal-engine-uproperty-exposing-variables)
  - [Sparse Class Data](https://dev.epicgames.com/documentation/unreal-engine/sparse-class-data-in-unreal-engine)

## Prevention
- Always include `Category = "SomeName"` in every `UPROPERTY` macro for plugin/engine modules — even for `VisibleDefaultsOnly` or `BlueprintReadOnly` properties
- Add a CI check or code review rule: any new `UPROPERTY` in a plugin module without `Category` should be flagged
- Be aware that UHT errors produce `ExitCode=6` and occur before C++ compilation — they will not show up as `error C*` patterns
