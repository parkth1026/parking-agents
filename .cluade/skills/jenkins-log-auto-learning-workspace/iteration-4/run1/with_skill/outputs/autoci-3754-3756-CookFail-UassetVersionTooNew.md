# Cook Failure: .uasset Package Version Too New for Target Engine

> **Score**: 9/10 | **Job**: autoci | **Date**: 2026-04-09
> **Builds**: #3754, #3755, #3756 (FAILURE) → #3757 (SUCCESS)
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 1/2 = 9/10

## Error Message
```
LogAssetRegistry: Error: Package D:/ws_twe_ue5.1_ci/Project/Plugins/G/AesWorld/Content/Materials/M_WaterTemplate.uasset is too new.
Engine Version: 1008  Package Version: 1013
Cook failed.
AutomationTool exiting with ExitCode=25 (Error_UnknownCookFailure)
```

## Root Cause
The file `M_WaterTemplate.uasset` in the `AesWorld` plugin was saved (or opened and auto-upgraded) with a newer Unreal Engine version than the one used by the CI pipeline. The `autoci` job uses **UE 5.1** (Engine Version 1008), but the asset was saved with **UE 5.4 or higher** (Package Version 1013). Unreal Engine's cook process cannot process an asset saved with a newer format because it doesn't know how to deserialize fields that don't exist in the older version.

The cause was commit `de6a7eb 添加水导出fbx的逻辑` ("Add water export fbx logic") — the developer added a water export feature and saved the material template `M_WaterTemplate.uasset` in their local UE5.5 editor, not the UE5.1 version used by the CI pipeline.

## Fix
- **Commit**: `c25585af...` by AesWorld dev
- **Message**: "把水导出成fbx的材质模板转换成5.1引擎的版本" (Convert water export fbx material template to UE5.1 engine version)
- **What changed**: The `M_WaterTemplate.uasset` material was re-saved using the UE5.1 editor, downgrading the package version from 1013 to the UE5.1-compatible format (≤1008). The new water export fbx functionality was preserved, only the asset save format was corrected.

Note: No C++ source diff is available — this was a binary asset resave, not a code change.

## How to Reproduce / Detect
- Open a `.uasset` file in a UE5.5 editor when the project targets UE5.1
- Save the asset (UE auto-upgrades the package version on save)
- Push the asset — the CI cook job will fail with "Package X is too new. Engine Version: A  Package Version: B"
- Detecting: search `LogAssetRegistry: Error: Package` in console output

## Epic Official Guidance
- **Query**: "UE5 cook error: LogAssetRegistry Error: Package M_WaterTemplate.uasset is too new. Engine Version: 1008 Package Version: 1013."
- **Answer**: This error occurs because of Unreal Engine's forward-compatibility limitation — assets saved in a newer version cannot be cooked by an older version. Package Version 1008 corresponds to UE 5.3 (or close to 5.1 range) and Package Version 1013 corresponds to UE 5.4+. Common causes: incorrect engine path in RunUAT call, accidental asset migration from a newer project, or unintended project upgrade where an asset was opened and auto-saved by the newer editor. Fix: ensure all assets in the repository were saved with the engine version matching the CI build machine. Re-open the asset with the correct engine version and save it.
- **References**:
  - [Versioning of Assets and Packages in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/versioning-of-assets-and-packages-in-unreal-engine)

## Prevention
- Set up a git hook or pre-commit check that detects `.uasset` files saved with a newer engine version than the CI target
- Document the CI engine version in the repository (e.g., in a `README` or `ENGINE_VERSION` file) so developers know which editor to use
- When creating new assets for features, always use the engine version that matches CI — never use a local "personal" engine installation that may be on a newer version
- If cross-version work is needed, save assets in the older engine before committing
