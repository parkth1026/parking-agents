# linux-ci #466 Build Diagnosis Report

> **Job**: twe-ue5.5-linux-ci | **Build**: #466 | **Result**: FAILURE
> **Date**: 2026-04-08 | **Duration**: ~23 min
> **Jenkins URL**: http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-linux-ci/466/

---

## Phase 0: Configuration

| Config Key | Raw Value | Resolved Path |
|---|---|---|
| tmpDir | `./tmp/ue-error-solver` | `D:\Claude_skills\tmp\ue-error-solver` |
| wikiDir | `~/memory/jenkins-learnings` | `C:\Users\Administrator\memory\jenkins-learnings` |
| rawDir | `./wiki-raw/jenkins-learnings` | `D:\Claude_skills\wiki-raw\jenkins-learnings` |
| gitRepos | `D:/Git` | `D:\Git` |

All directories verified to exist.

---

## Phase 1: Log Download and Error Extraction

### 1.1 Log Download

Console log downloaded from Jenkins API (`consoleText` endpoint). File size: ~132 KB.

Log saved to: `D:\Claude_skills\tmp\ue-error-solver\linux-ci-466.log`

### 1.2 Build Result

Jenkins API reports: **FAILURE** (duration: 1,413,591 ms / ~23.6 min)

### 1.3 Error Extraction

**1 compilation error found.** The error occurs during the Linux Shipping build (not the Win64 Development editor build, which succeeded).

#### Complete Error Block

```
[13/474] Compile Module.AesLodSystem.cpp (0:03.25 at +0:15)
In file included from D:\ws_twe_ue5.5_linux_ci\Project\Plugins\G\AesWorld\Intermediate\Build\Linux\x64\UnrealGame\Shipping\AesLodSystem\Module.AesLodSystem.cpp:1:
In file included from D:\ws_twe_ue5.5_linux_ci\Project\Intermediate\Build\Linux\x64\TWE\Shipping\Engine\SharedPCH.Engine.Project.ValApi.Cpp20.h:3:
In file included from D:\Epic\UE_5.5_51\Engine\Source\Runtime\Engine\Public\EngineSharedPCH.h:5:
In file included from D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Serialization\StructuredArchiveAdapters.h:10:
In file included from D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniqueObj.h:6:
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniquePtr.h(66,3): error: deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior [-Werror,-Wdelete-incomplete]
   66 |                 delete Ptr;
      |                 ^      ~~~
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniquePtr.h(272,3): note: in instantiation of member function 'TDefaultDelete<FAesTracePayloadScope>::operator()' requested here
  272 |                 GetDeleter()(Ptr);
      |                 ^
D:\ws_twe_ue5.5_linux_ci\Project\Plugins\G\AesWorld\Source\AesLodSystem\Private\AesLodSystemLayeredQuadRequest.h(14,14): note: in instantiation of member function 'TUniquePtr<FAesTracePayloadScope>::~TUniquePtr' requested here
   14 |         FORCEINLINE FAesLodSystemLayeredQuadRequest(FAesLodSystemLayeredQuad& InLayeredQuad, double InPriority)
      |                     ^
D:\ws_twe_ue5.5_linux_ci\Project\Plugins\G\AesWorld\Source\AesLodSystem\Private\AesLodSystemLayeredQuadRequest.h(9,8): note: forward declaration of 'FAesTracePayloadScope'
    9 | struct FAesTracePayloadScope;
      |        ^
1 error generated.

Error executing C:\UnrealToolchains\v23_clang-18.1.0-rockylinux8\x86_64-unknown-linux-gnu\bin\clang++.exe (tool returned code: 1)
```

#### Build Summary from Log

```
    Rebuild All: 0 succeeded, 1 failed, 0 skipped
UnrealBuildTool failed.
BUILD FAILED
ERROR: Package project failed.
```

### 1.4 Error Classification

- **Error Type**: C/C++ Clang compilation error
- **Error Code**: `-Werror,-Wdelete-incomplete`
- **Primary Error File**: `UniquePtr.h(66,3)` (UE5 engine header)
- **Root Cause File**: `AesLodSystemLayeredQuadRequest.h` (project code in AesWorld plugin)
- **Affected Module**: AesLodSystem
- **Platform**: Linux (cross-compiled with Clang 18.1.0)
- **Configuration**: Shipping (the Win64 Development editor build succeeded; this error is Shipping-only)
- **Cascading errors**: None (1 error generated, clean single-error case)

### 1.5 Build Command

The build was executed by UnrealBuildTool for target `TWE` (Linux, Shipping) via the twe-ue5.5-linux-ci Jenkins pipeline. The toolchain is Clang 18.1.0 cross-compiler (`v23_clang-18.1.0-rockylinux8`).

### 1.6 Key Observation: Win64 Editor Build Passed

The Win64 Development editor build (`[440/519] Compile [x64] Module.AesLodSystem.cpp`) succeeded without this error. The Linux Shipping build (`[13/474] Compile Module.AesLodSystem.cpp`) failed. This indicates the error is triggered specifically under the Clang cross-compiler's stricter warnings or different include ordering in Shipping configuration.

---

## Phase 2: Multi-Source Diagnosis

### 2.1 Source Code Context

**File**: `D:\Git\AesWorld\Source\AesLodSystem\Private\AesLodSystemLayeredQuadRequest.h`

The current version of this file (in the git repo) no longer contains `FAesTracePayloadScope` or `TUniquePtr<FAesTracePayloadScope>`. The forward declaration `struct FAesTracePayloadScope;` at line 9 and the `TUniquePtr<FAesTracePayloadScope>` member have been removed.

A search for `FAesTracePayloadScope` across the entire `D:\Git` directory returns **zero results** -- the type has been completely removed from the codebase.

**Recent git history** for `AesLodSystemLayeredQuadRequest.h`:
```
c4276473d Optimize LOD scheduling; tile splitting no longer depends on parent tile data completion
817226498 Optimize stuttering during building/road asset loading and object registration
9d7b96579 Change lodactor from CineCameraActor to regular Actor
870743d1f Fix LOD scheduling priority bug
aa1004699 Optimize EarthReady completion criteria
...
```

**Triggering commit** (from Jenkins build notification):
```
AesWorld: 8894ec3 Split AesWorldInsights into AesWorldProfiling(Runtime) and AesWorldInsights(Program)
```

This commit refactored the AesWorldInsights module, splitting it into two modules. During this split, `FAesTracePayloadScope` was likely moved or removed, but `AesLodSystemLayeredQuadRequest.h` still had a forward declaration and `TUniquePtr<FAesTracePayloadScope>` member referencing it. The incomplete type caused `TUniquePtr`'s destructor to attempt `delete` on a pointer to an incomplete type.

### 2.2 Knowledge Base Search

- **Wiki KB** (`~/memory/jenkins-learnings/details/`): No match for `delete-incomplete`, `FAesTracePayloadScope`, or `AesLodSystem`.
- **Wiki KB** (`~/memory/jenkins-learnings/patterns/`): No match.
- **Raw KB** (`./wiki-raw/jenkins-learnings/`): **Match found** -- `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`
  - Score: **9/10** -- Exact build match with verified root cause analysis and concrete fix description.
  - The file documents the same error, same build #466, same root cause (forward declaration of `FAesTracePayloadScope` used with `TUniquePtr` leading to incomplete type deletion).

### 2.3 Epic UE Assistant Query

**Skipped** -- Knowledge base match score 9/10 with verified fix from raw KB. The raw KB entry for this exact build provides a definitive analysis with concrete fix steps. Querying Epic would add latency without meaningful new information.

### 2.4 Web Search

**Skipped** -- Sufficient evidence from source code context (2.1) and knowledge base (2.2). The error is a well-known C++ pattern (incomplete type with unique_ptr), not a novel or undocumented issue.

---

## Phase 3: Diagnosis

### Diagnosis: -Wdelete-incomplete in AesLodSystemLayeredQuadRequest.h

**Primary Error**: `deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior [-Werror,-Wdelete-incomplete]`

**Root Cause**: The header file `AesLodSystemLayeredQuadRequest.h` used `TUniquePtr<FAesTracePayloadScope>` as a member variable while only having a forward declaration (`struct FAesTracePayloadScope;`) of the type. When the compiler instantiates the destructor of `TUniquePtr<FAesTracePayloadScope>` (triggered by the inline constructor of `FAesLodSystemLayeredQuadRequest`), it calls `delete` on a pointer to an incomplete type. This is undefined behavior in C++ and Clang's `-Wdelete-incomplete` flag (promoted to error via `-Werror`) catches it.

The triggering commit was `8894ec3` ("Split AesWorldInsights into AesWorldProfiling(Runtime) and AesWorldInsights(Program)"), which moved or removed `FAesTracePayloadScope` from its original location, breaking the forward declaration dependency in `AesLodSystemLayeredQuadRequest.h`.

**Confidence**: **High**

### Evidence

| Source | Finding |
|---|---|
| **Knowledge Base** | Raw KB match: `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` (score 9/10, exact build match with verified analysis) |
| **Epic Guidance** | Skipped -- KB match score 9/10 sufficient |
| **Source Context** | Current code no longer contains `FAesTracePayloadScope` anywhere in `D:\Git`. The file `AesLodSystemLayeredQuadRequest.h` has been updated to remove the dependency. Fix already applied. |
| **Web Search** | Skipped -- sufficient evidence from earlier sources |

### Recommended Fix

The fix has two possible approaches (and from the source code, the fix has already been applied):

**Option A: Include the full definition**
If `FAesTracePayloadScope` is still needed, add the proper `#include` for the header defining the complete type instead of the forward declaration:
```cpp
// Replace:
struct FAesTracePayloadScope;

// With:
#include "AesTracePayloadScope.h"  // or wherever the full definition lives
```

**Option B: Remove the dependency entirely**
If `FAesTracePayloadScope` was removed as part of the refactor, remove the forward declaration and the `TUniquePtr<FAesTracePayloadScope>` member from the header. This is what was actually done -- the current codebase has no trace of `FAesTracePayloadScope`.

**Option C: Move the destructor to the .cpp file**
If you want to keep the forward declaration in the header (for compilation speed), define the destructor in a `.cpp` file where the full type is available:
```cpp
// In .h: declare destructor but don't define it inline
~FAesLodSystemLayeredQuadRequest();

// In .cpp: define it where FAesTracePayloadScope is fully defined
#include "AesTracePayloadScope.h"
FAesLodSystemLayeredQuadRequest::~FAesLodSystemLayeredQuadRequest() { ... }
```

### Why This Only Failed on Linux Shipping (Not Win64 Editor)

The Win64 Development editor build uses MSVC, which is more lenient with this pattern (it may not warn about deleting incomplete types by default). The Linux cross-compile uses Clang 18.1.0 with `-Werror`, which strictly enforces `-Wdelete-incomplete`. Additionally, include ordering and PCH contents may differ between configurations, affecting when the incomplete type issue is triggered.

### References

- **Raw KB**: `D:\Claude_skills\wiki-raw\jenkins-learnings\linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`
- **Source File**: `D:\Git\AesWorld\Source\AesLodSystem\Private\AesLodSystemLayeredQuadRequest.h`
- **Jenkins Build**: http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-linux-ci/466/console
- **Triggering Commit**: `8894ec3` (AesWorld: Split AesWorldInsights into AesWorldProfiling and AesWorldInsights)

### Prevention

1. When using `TUniquePtr<T>` in a header, ensure `T` is fully defined where the destructor is instantiated -- either include the full header or move the destructor to a `.cpp` file.
2. Always cross-compile with Clang before pushing to catch warnings that MSVC does not emit.
3. When refactoring modules (splitting/moving types), check all forward declarations and `TUniquePtr`/`TSharedPtr` usages of the moved types across the entire codebase.
