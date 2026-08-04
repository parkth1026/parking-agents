# Diagnosis: installed #469 — AesWorld Plugin Build Failure

**Job**: twe-ue5.5-installed #469
**Result**: FAILURE (ExitCode=27, Error_UnknownBuildFailure)
**Failed Plugin**: AesWorld
**Triggering Commit**: `8894ec3` — "拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)"
**Date**: 2026-04-08

---

## Error Group 1: C7568 / C2955 / C2131 / C2971 / C3079 in TraceSessionController

**Primary Error**: `error C7568: argument list missing after assumed function template 'TSharedFuture'`
**File**: `AesWorldProfiling/Private/TraceSessionController.h`, line 101
**Root Cause**: `TSharedFuture<FString>` is used as a member variable but the installed build environment does not resolve `TSharedFuture` correctly. The header `TraceSessionController.h` includes `CoreMinimal.h` and `AesWorldProfilingTrace.h`, but `TSharedFuture` requires `#include "Async/Future.h"` or similar — which is available in the full (source) engine but may not be transitively included in the installed build's precompiled module configuration. This cascades into all the C2955/C2131/C2971/C3079 errors on line 341 of the .cpp file (a `UE_LOG` call that references `CsvEndCaptureFuture.Get()`), and line 347 (`CsvEndCaptureFuture = {};`).

**Confidence**: High

### Evidence
- **Knowledge base**: Exact match — `installed-469-C7568-TraceSessionController.md` (score 9/10, verified). Documents this exact build failure and confirms the C7568 errors persist in the installed build even after the C4150 fix. Build #472 succeeds overall because the AesWorldProfiling module failure is non-fatal to the game target.
- **Epic guidance**: Skipped — KB match score 9/10 with verified fix is sufficient.
- **Source context**: `TraceSessionController.h` line 101 declares `TSharedFuture<FString> CsvEndCaptureFuture;` inside a `#if WITH_EARTH_DEBUGGER` block. The entire class `FTraceSessionController` is guarded by `WITH_EARTH_DEBUGGER`, so in Shipping/installed builds where the macro is undefined, the class should not compile at all. However, the AesWorldProfiling module is still built as a plugin in the installed pipeline — the `WITH_EARTH_DEBUGGER` guards only strip the class body but the module's unity build file (`Module.AesWorldProfiling.cpp`) still compiles the translation unit. The missing `#include "Async/Future.h"` causes MSVC to fail to resolve `TSharedFuture` as a template.
- **Web search**: Skipped — sufficient evidence from earlier sources.

### Recommended Fix
1. Add `#include "Async/Future.h"` to `TraceSessionController.h` (or `"Templates/SharedPointer.h"` which also defines `TSharedFuture`).
2. Alternatively, ensure the entire `TraceSessionController.cpp` translation unit is excluded from compilation when `WITH_EARTH_DEBUGGER` is not defined, either via Build.cs conditional file listing or by wrapping the entire .cpp in the guard.

---

## Error Group 2: C4150 in UniquePtr.h — Incomplete Type FAesTracePayloadScope

**Primary Error**: `error C4150: deletion of pointer to incomplete type 'FAesTracePayloadScope'; no destructor called`
**File**: `Engine/.../UniquePtr.h` line 66, instantiated from `AesLodSystem/Private/AesLodSystemLayeredQuadRequest.h` line 122
**Root Cause**: `AesLodSystemLayeredQuadRequest.h` declares `struct FAesTracePayloadScope;` (forward declaration) and uses `TUniquePtr<FAesTracePayloadScope>` as a member. In non-debug builds (`WITH_EARTH_DEBUGGER` not defined), `AesWorldProfilingTrace.h` originally only provided empty macros but no struct definitions. `TUniquePtr`'s destructor calls `delete` on the pointer, which requires a complete type definition — a forward declaration is insufficient.

**Confidence**: High

### Evidence
- **Knowledge base**: Exact match — `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` (score 10/10, verified) and `installed-469-C7568-TraceSessionController.md` (score 9/10). Both document this exact issue and confirm the fix.
- **Epic guidance**: Skipped — KB match score 10/10 with verified fix is sufficient.
- **Source context**: Confirmed `AesLodSystemLayeredQuadRequest.h` at commit `8894ec3` has `struct FAesTracePayloadScope;` forward declaration and `TUniquePtr<FAesTracePayloadScope> PayloadTraceScope;` member. The `AesWorldProfilingTrace.h` `#else` branch (non-debug) had no struct definitions.
- **Web search**: Skipped — sufficient evidence from earlier sources.

### Recommended Fix
**Already fixed** in commit `c6e1eab5e` ("为非debug构建提供Trace struct空桩定义，修复clang -Wdelete-incomplete错误"):

Added empty stub struct definitions in `AesWorldProfilingTrace.h` inside the `#else` branch:
```cpp
// Complete-type stubs so TUniquePtr<T> compiles without -Wdelete-incomplete
struct FAesTraceScope {};
struct FAesTracePayloadScope {};
struct FAesTraceProducerScope {};
```

---

## Overall Assessment

Both error groups stem from the same commit `8894ec3` which split the AesWorldInsights module into AesWorldProfiling (Runtime) and AesWorldInsights (Program). The split did not fully account for installed/shipping build configurations where `WITH_EARTH_DEBUGGER` is not defined:

1. **C4150** (incomplete type): Fixed by `c6e1eab5e` — adding stub struct definitions in the non-debug `#else` branch.
2. **C7568/C2955 etc.** (TraceSessionController template resolution): The KB notes that build #472 succeeded overall because this module's compilation failure is non-fatal in the installed pipeline. A proper fix would require either excluding `TraceSessionController.cpp` from compilation in non-debug builds or adding the missing includes.

The AesWorld plugin failure does not block game packaging — the installed build pipeline treats individual module failures as non-fatal if the game target itself succeeds.

### References
- KB: `installed-469-C7568-TraceSessionController.md` (score 9/10)
- KB: `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` (score 10/10)
- KB: `linux-282-IncompleteType-FEarthDebugSubsystem.md` (score 10/10, analogous pattern)
- KB: `installed build.md` (wiki concept — forward declaration limitations)
- Fix commit: `c6e1eab5e` (stub struct definitions)
