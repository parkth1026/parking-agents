# CookFail: UassetVersionTooNew — WBP_DomManager (Recurring Pattern)

> **Score**: 7/10 | **Job**: autoci | **Date**: 2026-01-30
> **Builds**: #3877 (FAILURE) → #3878 (SUCCESS)
> **Scoring**: Info 2/3 + Diff 2/2 + Commit 2/3 + Reuse 1/2 = 7/10

## Error Message

```
LogAssetRegistry: Error: Package D:/ws_twe_ue5.1_ci/Project/Plugins/G/AesWorld/Content/UI/BottomToolBar/DomManager/WBP_DomManager.uasset is too new. Engine Version: 1008  Package Version: 1013
Took 70.50903530000001s to run UnrealEditor-Cmd.exe, ExitCode=1
ERROR: Cook failed.
AutomationTool exiting with ExitCode=25 (Error_UnknownCookFailure)
```

## Root Cause

A .uasset file (`WBP_DomManager.uasset`) was saved with a newer engine version (Package Version 1013) than the CI cook target engine (Engine Version 1008). This is the same recurring pattern seen in builds #3754-3756 and #3763. The DomManager widget blueprint was saved on a machine running a newer UE version.

## Fix

- **Commit**: `4d1b93a` by AesWorld team
- **Message**: "资产修改改成5.1版本" (Modify assets to 5.1 version)
- **What changed**: The UAsset was re-saved using the target engine version (5.1/1008), downgrading its package version to match the CI cook engine.

## Prevention

- Re-save .uasset files in the correct engine version before committing
- See detailed analysis in: `autoci-3754-3756-CookFail-UassetVersionTooNew.md` (same root cause)
