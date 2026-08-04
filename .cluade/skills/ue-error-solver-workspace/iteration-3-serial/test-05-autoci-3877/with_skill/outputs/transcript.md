# Transcript: ue-error-solver diagnosis for autoci #3877

**Date**: 2026-04-11
**Build URL**: http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3877/
**Skill**: ue-error-solver

---

## Phase 1: Download and Parse Build Log

### 1.1 Input Parsing

- **URL**: `http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3877/`
- **Job path**: `wdp-ue/job/Earth/job/aes6-ue-runtime-ci`
- **Build number**: 3877
- **Matched job config**: `autoci` (gitRepo: `aes6-ue-runtime`)

### 1.2 Download Console Log

```
curl.exe -s "http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3877/consoleText" --globoff --max-time 120
```

- Saved to: `C:\Users\Administrator\.openclaw-autoclaw\workspace\knowledge-bases\temp\ue-error-solver\autoci-3877.log`
- Log size: 21,954 lines, ~5MB

### 1.3 Check Build Result

```
curl.exe -s "http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3877/api/json?tree=result,timestamp,duration" --globoff
```

- Result: **FAILURE**
- Duration: 849,932 ms (~14 minutes)

### 1.4 Error Extraction

Scanned full log for patterns: `error`, `fatal error`, `LNK\d+`, `FAILED`, `ExitCode`, `error:`

Found 70 matching lines. After classification:

**Primary Error (1 count)**:
```
LogAssetRegistry: Error: Package D:/ws_twe_ue5.1_ci/Project/Plugins/G/AesWorld/Content/UI/BottomToolBar/DomManager/WBP_DomManager.uasset is too new. Engine Version: 1008  Package Version: 1013
```

**Consequent Errors**:
```
ERROR: Cook failed.
AutomationTool exiting with ExitCode=25 (Error_UnknownCookFailure)
BUILD FAILED
ERROR: Package project failed.
```

**Non-error matches (false positives filtered out)**:
- `Total Copied Skipped Mismatch FAILED Extras` — Robocopy summary headers (FAILED=0), not errors
- `ExitCode=0` — Success exit codes, not errors
- `Rebuild All: 1 succeeded, 0 failed` — Compilation success, not errors

**Warnings (142 total, not blocking)**:
- Multiple "Failed to load" / "Can't find file" for missing assets
- "Asset has been saved with empty engine version" for several AesArtAsset files
- Missing script packages: AnimatedTexture, USDClasses, DatasmithGLTFTranslator
- Material compilation failures for PCD3D_SM6

### 1.5 Error Classification

- **Type**: Cook/Package Error — Asset Version Mismatch
- **Primary error**: 1 distinct error (WBP_DomManager version mismatch)
- **Cascading**: Cook failed -> BuildCookRun failed -> BUILD FAILED -> Package project failed
- **Decision tree path**: Cook/Package error -> Knowledge Base + Epic + Source Context

### 1.6 Build Command Extraction

```
D:\Epic\UE_5.1_51/Engine/Build/BatchFiles/RunUAT.bat BuildCookRun
  -project="D:/ws_twe_ue5.1_ci/Project/TWE.uproject"
  -archivedirectory=D:/ws_twe_ue5.1_ci/Package/Windows/ci-1.0.1054/Data/TWERuntime
  -targetplatform=Win64
  -clientconfig=Development -nocompileeditor -nop4 -pak -cook -stage -archive -package -compressed -prereqs -build -utf8output
```

Cook command:
```
D:\Epic\UE_5.1_51\Engine\Binaries\Win64\UnrealEditor-Cmd.exe D:\ws_twe_ue5.1_ci\Project\TWE.uproject -run=Cook -TargetPlatform=Windows -unversioned -fileopenlog
```

---

## Phase 2: Multi-Source Diagnosis

### 2.1 Source Code Context

The error is in a `.uasset` binary file (Widget Blueprint), not C++ source code. No source code reading is applicable.

**Git repo check**: `D:\Git\aes6-ue-runtime` not found. However, `D:\Git\AesWorld` exists and contains the plugin.

**Git history for WBP_DomManager.uasset**:
```
4d1b93a4b 资产修改改成5.1版本                     (2026-01-19 16:19, FIX)
01913bc87 运行时编辑器中切换卫星图图源...           (2026-01-19 15:28, BROKE)
ccf43522f 添加切换DOM显示模式的面板                (Original creation)
```

Confirmed: commit `01913bc87` introduced the version-upgraded asset. Fix commit `4d1b93a4b` was applied ~50 minutes later.

### 2.2 Knowledge Base Search

**Search queries**:
1. Pattern: `package.*too new|PackageVersion|Engine Version.*Package Version|cook.*fail`
2. Pattern: `WBP_DomManager|DomManager`

**Results found**:

1. **`autoci-3754-3756-CookFail-UassetVersionTooNew.md`** (Score 9/10)
   - Same root cause pattern from earlier builds (#3754-3756)
   - Same plugin (AesWorld), same version mismatch (1008 vs 1013)
   - Different asset: `M_WaterTemplate.uasset` instead of `WBP_DomManager.uasset`
   - Fix: Re-save with UE 5.1 editor

2. **`autoci-3877-CookFail-UassetVersionTooNew-WBP_DomManager.md`** (Score 7/10, scratch)
   - Exact match for this build (#3877)
   - Documents fix commit `4d1b93a` and next successful build #3878
   - Recurring pattern notation

3. **`024-asset-version-mismatch.md`** (raw/ue5-jenkins)
   - General knowledge about UE asset version mismatch cook failures
   - Detailed Chinese-language documentation of this exact build
   - Includes prevention measures and verification methods

### 2.3 Epic UE Assistant Query

**Question sent**:
```
UE5.1 cook error: LogAssetRegistry Error: Package WBP_DomManager.uasset is too new. Engine Version: 1008 Package Version: 1013. The cook process fails with ExitCode=25 (Error_UnknownCookFailure). What causes this and how to fix it?
```

**Key points from Epic's response**:
- Engine Version 1008 = UE 5.1, Package Version 1013 = UE 5.2+
- Assets are backward-compatible but NOT forward-compatible
- Cook commandlet cannot deserialize newer data structures
- Recommended fix: Revert asset via source control or re-save with correct engine version
- Prevention: Ensure all team members use same engine build, validate assets on check-in

**References provided by Epic**:
- [Versioning of Assets and Packages](https://dev.epicgames.com/documentation/unreal-engine/versioning-of-assets-and-packages-in-unreal-engine)
- [UE5 Migration Guide](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-migration-guide)

### 2.4 Web Search

Skipped — knowledge base and Epic assistant provided definitive diagnosis. This is a well-documented, recurring pattern.

---

## Phase 3: Diagnosis Presented

Wrote structured diagnosis to:
`D:\Claude_skills\.claude\skills\ue-error-solver-workspace\iteration-3-serial\test-05-autoci-3877\with_skill\outputs\diagnosis.md`

---

## Phase 4-6: Not Applicable

- **Phase 4 (Fix)**: User did not request a fix, only diagnosis.
- **Phase 5 (Commit)**: Not applicable (no fix applied).
- **Phase 6 (Knowledge Accumulation)**: Not applicable (no verified fix from this session; knowledge base already contains entries for this exact error).

---

## Summary

| Item | Value |
|------|-------|
| Error Type | Cook/Package — Asset Version Mismatch |
| Error Count | 1 error, 142 warnings |
| Primary Error | WBP_DomManager.uasset Package Version 1013 > Engine Version 1008 |
| Root Cause | Developer saved asset in UE 5.2+ editor, CI uses UE 5.1 |
| KB Match | 3 entries (strong match, including exact build) |
| Epic Query | Successful, confirmed diagnosis |
| Web Search | Skipped (not needed) |
| Confidence | High |
| Fix Status | Already applied in commit 4d1b93a (next build #3878 succeeded) |
