# Diagnosis: Cook Failure — WBP_DomManager.uasset Package Version Too New

**Build**: [aes6-ue-runtime-ci #3877](http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3877/)
**Result**: FAILURE (ExitCode=25, Error_UnknownCookFailure)
**Duration**: ~850 seconds (~14 minutes)

---

## Primary Error

```
LogAssetRegistry: Error: Package D:/ws_twe_ue5.1_ci/Project/Plugins/G/AesWorld/Content/UI/BottomToolBar/DomManager/WBP_DomManager.uasset is too new. Engine Version: 1008  Package Version: 1013
```

**Additional context from log:**
```
LogCook: Warning: Unable to find package for cooking /AesWorld/UI/BottomToolBar/DomManager/WBP_DomManager.
LoadErrors: Warning: Package '/AesWorld/UI/BottomToolBar/DomManager/WBP_DomManager' contains a newer version than the current process supports. PackageVersion 1,013, MaxExpected 1,008 : LicenseePackageVersion 0, MaxExpected 0.
Failure - 1 error(s), 142 warning(s)
ERROR: Cook failed.
AutomationTool exiting with ExitCode=25 (Error_UnknownCookFailure)
BUILD FAILED
```

**Error Classification**: Cook/Package Error — Asset Version Mismatch

---

## Root Cause

**Confidence**: High

The Widget Blueprint `WBP_DomManager.uasset` (in the AesWorld plugin, under `Content/UI/BottomToolBar/DomManager/`) was saved with a newer engine version (Package Version 1013, corresponding to UE 5.2+) than the CI pipeline's engine (Engine Version 1008, UE 5.1).

Unreal Engine assets are backward-compatible (older assets work in newer engines) but NOT forward-compatible (newer assets cannot load in older engines). When the cook commandlet (UnrealEditor-Cmd.exe) encountered this asset, it could not deserialize the newer format and rejected it, causing the entire cook process to fail.

**Triggering commit**: `01913bc8` — A large commit to AesWorld that modified DomManager-related editor/runtime functionality. The developer who committed this change likely had a UE 5.2+ (or 5.5) editor open and saved `WBP_DomManager.uasset`, which auto-upgraded the asset's package version to 1013.

**Previous build (#3876)** succeeded because it used an earlier AesWorld commit (`38f5ff16`) that did not contain the version-upgraded asset.

---

## Evidence

### Knowledge Base: STRONG MATCH

Three knowledge base entries directly match this error:

1. **`autoci-3877-CookFail-UassetVersionTooNew-WBP_DomManager.md`** (scratch) — Documents this exact build failure. Confirms fix commit `4d1b93a` ("资产修改改成5.1版本") by the AesWorld team, which re-saved the asset in UE 5.1 format.

2. **`autoci-3754-3756-CookFail-UassetVersionTooNew.md`** (score 9/10) — Identical root cause pattern from a previous occurrence (builds #3754-3756), where `M_WaterTemplate.uasset` in AesWorld was also saved with Package Version 1013 in a UE 5.5 editor. Fix was the same: re-save with UE 5.1 editor.

3. **`024-asset-version-mismatch.md`** — General knowledge entry about UE asset version mismatch cook failures.

### Epic Official Guidance

Epic's assistant confirms:
- Engine Version 1008 = UE 5.1; Package Version 1013 = UE 5.2+
- Assets are NOT forward-compatible — newer assets cannot load in older engines
- The cook commandlet cannot serialize asset data structures from newer formats
- **Recommended fix**: Revert the asset via source control to a version saved in UE 5.1, or re-open and re-save it with the correct engine version

**Official References**:
- [Versioning of Assets and Packages in UE](https://dev.epicgames.com/documentation/unreal-engine/versioning-of-assets-and-packages-in-unreal-engine)
- [UE5 Migration Guide](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-migration-guide)

### Source Context (Git History)

Git log for `WBP_DomManager.uasset` in `D:\Git\AesWorld`:
```
4d1b93a4b 资产修改改成5.1版本                    <-- FIX (2026-01-19 16:19)
01913bc87 运行时编辑器中切换卫星图图源...          <-- BROKE IT (2026-01-19 15:28)
ccf43522f 添加切换DOM显示模式的面板               <-- Original creation
```

The fix was committed ~50 minutes after the breaking change, confirming the team already identified and resolved this issue.

### Web Search: Not needed

The knowledge base and Epic guidance provided definitive diagnosis. No web search was necessary.

---

## Recommended Fix

The fix has already been applied in commit `4d1b93a` ("资产修改改成5.1版本"):

1. Open `WBP_DomManager.uasset` using the UE 5.1 editor (the same version as the CI pipeline)
2. Save the asset — this downgrades the Package Version from 1013 to <=1008
3. Commit the re-saved asset

The next build (#3878) should succeed (and per the knowledge base, it did).

---

## Additional Warnings (non-blocking)

The log also contains 142 warnings, including:
- Multiple "Failed to load" / "Can't find file" warnings for missing asset references (DaaSRepository textures, SkyCreator weather curves, etc.)
- "Asset has been saved with empty engine version" warnings for several AesArtAsset material functions/textures
- Missing script package warnings for `AnimatedTexture`, `USDClasses`, `DatasmithGLTFTranslator`

These warnings did NOT cause the build failure but indicate missing plugin dependencies and orphaned asset references that should be cleaned up separately.

---

## References

- **Epic docs**: [Versioning of Assets and Packages](https://dev.epicgames.com/documentation/unreal-engine/versioning-of-assets-and-packages-in-unreal-engine)
- **Knowledge base**: `autoci-3754-3756-CookFail-UassetVersionTooNew.md`, `024-asset-version-mismatch.md`
- **Build log**: http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3877/console
- **Fix commit**: `4d1b93a` in AesWorld repo
