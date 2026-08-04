# Diagnosis Transcript: autoci #3908

> **Task**: Diagnose build failure at http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3908/
> **Skill**: ue-error-solver
> **Date**: 2026-04-11

---

## Phase 1: Download and Parse Build Log

### 1.1 Input Parsing

- **URL**: `http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3908/`
- **Parsed**: baseUrl=`http://10.66.12.40`, jobPath=`wdp-ue/job/Earth/job/aes6-ue-runtime-ci`, buildNumber=`3908`
- **Matched job config**: name=`autoci`, gitRepo=`aes6-ue-runtime`

### 1.2 Download Console Log

- Downloaded via `curl.exe -s "{baseUrl}/job/{jobPath}/3908/consoleText" --globoff --max-time 120`
- Saved to: `C:\Users\Administrator\.openclaw-autoclaw\workspace\knowledge-bases\temp\ue-error-solver\autoci-3908.log`
- Log size: 1114 lines

### 1.3 Check Build Result

- API call: `curl.exe -s "{baseUrl}/job/{jobPath}/3908/api/json?tree=result,timestamp,duration" --globoff`
- Result: `FAILURE`, duration: 84559ms, timestamp: 1774867916577

### 1.4 Error Extraction

Searched log for error patterns. Found the following error lines:

**Line 1058**: `Module.EarthPrefab.7.cpp.obj : error LNK2019: unresolved external symbol "public: void __cdecl FEarthMaterialParametersBakerFragment::BakeMaterialParameters(void)"`

**Line 1059**: `Module.EarthPrefab.7.cpp.obj : error LNK2019: unresolved external symbol "public: void __cdecl FEarthMaterialParametersBakerFragment::CreateStaticTexture(class UObject *)"`

**Line 1060**: `D:\ws_twe_ue5.5_ci\...\UnrealEditor-EarthPrefab.dll : fatal error LNK1120: 2 unresolved externals`

**Line 1064**: `Took 16.55s to run dotnet.exe, ExitCode=6`
**Line 1065**: `UnrealBuildTool failed.`
**Line 1068**: `BUILD FAILED`

### 1.5 Error Classification

- **Type**: Linker error (LNK2019 + LNK1120)
- **Primary errors**: 2 LNK2019 (unresolved external symbols)
- **Secondary error**: 1 LNK1120 (fatal linker error, consequence of LNK2019s)
- **Module**: EarthPrefab (AesWorld plugin)
- **Symbols missing**:
  1. `FEarthMaterialParametersBakerFragment::BakeMaterialParameters()`
  2. `FEarthMaterialParametersBakerFragment::CreateStaticTexture(UObject*)`
- Both referenced from `UEarthOutputFunctionLibrary`

### 1.6 Build Command Extraction

```
D:\Epic\UE_5.5_51\Engine\Binaries\ThirdParty\DotNet\8.0.300\win-x64\dotnet.exe
  "D:\Epic\UE_5.5_51\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.dll"
  TWEEditor Win64 Development
  -Project="D:\ws_twe_ue5.5_ci\Project\TWE.uproject"
```

### 1.7 Key Build Context

- Build used adaptive non-unity build: `"Using 'git status' to determine working set for adaptive non-unity build"`
- Makefile was regenerated: `"Creating makefile for TWEEditor (.uproject file is newer)"`
- Only 4 build actions (1 compile + 3 link steps)
- Only `Module.EarthPrefab.7.cpp` was compiled
- Triggered by GitLab push by piaotonghu
- Key commit: AesWorld `8680bdb` - "fix: installed build缺少UObject/Package.h导致UPackage到UObject隐式转换失败"

### 1.8 Plugin Versions at Build Time

| Plugin | Commit | Message |
|--------|--------|---------|
| AesArtAsset | 132a639 | api v2.2.0 |
| ArtCommon | a15b4bf | UTF-8 |
| EarthArtAsset | df36e08 | version.json 6.4.0 |
| WdpCamera | 8932bd1 | Merge branch 'feature/camera_refactor_wxy' into dev |
| **AesWorld** | **8680bdb** | **fix: installed build缺少UObject/Package.h导致UPackage到UObject隐式转换失败** |
| AesRuntime | fafed1e | 禁止将Level写入搭配CustomDepthStencilValue中 |

---

## Phase 2: Multi-Source Diagnosis

### 2.1 Source Code Context

**Files involved:**

1. `D:\Git\AesWorld\Source\EarthPrefab\Public\Output\EarthRenderTarget2DFragment.h`
   - Declares `FEarthMaterialParametersBakerFragment` struct with `BakeMaterialParameters()` and `CreateStaticTexture(UObject*)` methods

2. `D:\Git\AesWorld\Source\EarthPrefab\Private\Output\EarthRenderTarget2DFragment.cpp`
   - Contains implementations of both functions
   - At commit `8680bdb`: Missing `#include "Materials/Material.h"` (needed for `UMaterial` type used in `GetUltimateParentMaterial()` and `BakeMaterialParameters()`)
   - Includes present: `MaterialInstance.h`, `MaterialLayersFunctions.h`, `UObject/Package.h` - but NOT `Material.h`

3. `D:\Git\AesWorld\Source\EarthPrefab\Public\Output\EarthOutputFunctionLibrary.h`
   - Declares `UEarthOutputFunctionLibrary` with static methods that delegate to `FEarthMaterialParametersBakerFragment`

4. `D:\Git\AesWorld\Source\EarthPrefab\Private\Output\EarthOutputFunctionLibrary.cpp`
   - Implements the wrapper calls: `BakeMaterialParameters()` and `CreateStaticTexture()`

**Git history analysis:**

```
767c64d2d fix installed build                    <-- Added #include "Materials/Material.h" (the fix)
8680bdbca fix: installed build缺少UObject/Package.h  <-- Build #3908 used this commit
5e9971c5c 默认开启 Enable Lod ldeal Cut visiblitity
```

Commit `8680bdb` diff shows ONLY comment encoding changes (garbled UTF-8 to proper Chinese) and BOM removal. No functional code change.

Commit `767c64d` diff shows the actual fix:
```diff
+#include "Materials/Material.h"
```

### 2.2 Knowledge Base Search

**Found exact matches:**

1. `wiki/concepts/lnk2019 link error.md` - General LNK2019 documentation, references this EarthPrefab case specifically
2. `wiki/entities/earthprefab.md` - Entity page documenting the LNK2019 for build #3908
3. `raw/ue5-jenkins/details/002-lnk2019-fearthmaterialparametersbakerfragment.md` - Detailed analysis of this exact error, including build pair #3908/#3906 comparison
4. `raw/ue5-jenkins/scratch/004-LNK2019-EarthMaterialParametersBaker.md` - Additional scratch notes

The knowledge base already had this error documented with medium confidence.

### 2.3 Epic UE Assistant Query

**Query sent**: Asked about LNK2019 in adaptive non-unity build due to missing Material.h include, and recommended approach for IWYU violations.

**Key response points**:
- Confirmed this is a classic IWYU violation
- Unity builds mask missing includes by combining multiple .cpp files into one translation unit
- Adaptive/non-unity builds compile each .cpp separately, exposing the issue
- Recommended fix: Always directly `#include` what you use
- Recommended prevention: Enable `bEnforceIWYU = true` in Target.cs
- Referenced official docs:
  - [Include What You Use (IWYU)](https://dev.epicgames.com/documentation/unreal-engine/include-what-you-use-iwyu-for-unreal-engine-programming)
  - [Build Tool Target Reference](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-build-tool-target-reference)

### 2.4 Web Search

Not needed - knowledge base and Epic assistant provided definitive answers.

---

## Phase 3: Diagnosis Presentation

Written to `outputs/diagnosis.md` with structured format including:
- Error summary with full error text
- Root cause analysis (missing include + adaptive build exposure)
- Trigger chain explanation (encoding fix -> makefile regen -> unity reassignment -> IWYU violation exposed)
- Evidence from all sources (knowledge base, Epic, source code, git history)
- Fix confirmation (already applied in commit 767c64d)
- Prevention recommendations (IWYU enforcement, periodic non-unity builds)
- References (Epic docs, MSDN, knowledge base files)

---

## Phase 4: Fix Code

**Skipped** - User only asked for diagnosis ("看看什么问题"), not for a fix.

## Phase 5: Commit

**Skipped** - No fix applied.

## Phase 6: Knowledge Accumulation

**Skipped** - No verified fix was applied by this session. The knowledge base already contains documentation for this error from previous analysis.

---

## Summary

| Item | Detail |
|------|--------|
| Error Type | LNK2019 / LNK1120 (Linker) |
| Root Cause | Missing `#include "Materials/Material.h"` in EarthRenderTarget2DFragment.cpp |
| Trigger | Commit `8680bdb` encoding fix exposed latent IWYU violation via adaptive non-unity build |
| Fix Status | Already fixed in commit `767c64d` (added the missing include) |
| Confidence | High |
| Knowledge Base | Exact match found (pre-existing documentation) |
| Epic Guidance | Confirmed IWYU violation, recommended `bEnforceIWYU = true` |
