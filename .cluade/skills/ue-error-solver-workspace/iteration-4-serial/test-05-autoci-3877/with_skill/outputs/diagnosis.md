## Diagnosis: Cook Failure -- WBP_DomManager.uasset Package Version Too New

**Build**: [aes6-ue-runtime-ci #3877](http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3877/) (FAILURE)
**Primary Error**: `LogAssetRegistry: Error: Package WBP_DomManager.uasset is too new. Engine Version: 1008  Package Version: 1013`
**Error Type**: Cook/Package error (not a C++ compilation error)
**Root Cause**: The widget blueprint `WBP_DomManager.uasset` in `AesWorld/Content/UI/BottomToolBar/DomManager/` was saved with a newer Unreal Engine version (Package Version 1013, corresponding to UE 5.4+) but the CI pipeline uses UE 5.1 (Engine Version 1008). UE's cook process cannot deserialize assets saved with a newer format because it lacks knowledge of fields added in later versions.
**Confidence**: High

### Error Details

```
LogAssetRegistry: Error: Package D:/ws_twe_ue5.1_ci/Project/Plugins/G/AesWorld/Content/UI/BottomToolBar/DomManager/WBP_DomManager.uasset is too new. Engine Version: 1008  Package Version: 1013
LogCook: Warning: Unable to find package for cooking /AesWorld/UI/BottomToolBar/DomManager/WBP_DomManager.
LoadErrors: Warning: Package '/AesWorld/UI/BottomToolBar/DomManager/WBP_DomManager' contains a newer version than the current process supports. PackageVersion 1,013, MaxExpected 1,008
Took 70.50903530000001s to run UnrealEditor-Cmd.exe, ExitCode=1
ERROR: Cook failed.
AutomationTool exiting with ExitCode=25 (Error_UnknownCookFailure)
BUILD FAILED
```

Cascading effects:
- `WBP_BottomToolBar.uasset` failed to load because it depends on `WBP_DomManager` (`VerifyImport: Failed to load package for import object`)
- Numerous other warnings about assets saved with empty engine version (pre-existing, not directly related to the failure)

### Evidence

- **Knowledge base**: Strong match found (score 9/10). Entry `autoci-3754-3756-CookFail-UassetVersionTooNew.md` documents the exact same error pattern (Engine Version 1008 vs Package Version 1013) from builds #3754-3756, with verified fix in #3757. A second entry `024-asset-version-mismatch.md` (score 9/10) also describes this exact build #3877. A scratch entry `autoci-3877-CookFail-UassetVersionTooNew-WBP_DomManager.md` (score 7/10) confirms build #3878 was the fix, with commit `4d1b93a` ("modify assets to 5.1 version").
- **Epic guidance**: Skipped -- knowledge base match score 9/10 with verified fix from multiple past occurrences. Previous Epic query result (cached in KB): "This error occurs because of Unreal Engine's forward-compatibility limitation -- assets saved in a newer version cannot be cooked by an older version. Fix: ensure all assets in the repository were saved with the engine version matching the CI build machine."
- **Source context**: Not applicable -- this is a binary asset version mismatch, not a C++ code error. No source code changes needed.
- **Web search**: Skipped -- sufficient evidence from knowledge base (score 9/10).

### Recommended Fix

1. **Re-save the asset with the correct engine version** (Primary fix):
   - Open `WBP_DomManager.uasset` using the UE 5.1 editor (the same version used by CI)
   - Save the asset (UE will automatically downgrade the package version to 1008)
   - Commit and push the re-saved asset

2. **Verify**: The fix was already applied in build #3878 via commit `4d1b93a` ("modify assets to 5.1 version").

### Prevention

- Ensure all team members use the same UE version as CI (UE 5.1) when saving assets
- Set up a pre-commit hook to detect `.uasset` files with package versions newer than the CI target
- When working with multiple engine versions, always re-save assets in the target engine version before committing

### References

- Knowledge base: `autoci-3754-3756-CookFail-UassetVersionTooNew.md` (score 9/10, verified)
- Knowledge base: `024-asset-version-mismatch.md` (score 9/10, detailed analysis)
- Knowledge base: `autoci-3877-CookFail-UassetVersionTooNew-WBP_DomManager.md` (scratch, score 7/10)
- Epic docs: [Versioning of Assets and Packages in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/versioning-of-assets-and-packages-in-unreal-engine)
- Fix build: [aes6-ue-runtime-ci #3878](http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3878/)
