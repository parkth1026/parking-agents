# Diagnosis: installed #470 (twe-ue5.5-installed)

> **Build**: #470 (FAILURE) | **Platform**: Windows (Win64) | **Date**: 2026-04-08
> **Job**: twe-ue5.5-installed | **Duration**: ~33 min | **Failed Plugin**: AesWorld
> **Console**: http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-installed/470/console

## Summary

Build #470 failed with **7 compilation errors** across 2 build configurations, all in the **AesWorld** plugin (specifically the **AesWorldProfiling** and **AesLodSystem** modules). The errors fall into two distinct groups with different root causes.

---

## Error Group 1: C7568/C2955/C2131/C2971/C3079 in TraceSessionController

**Configuration**: UnrealEditor Win64 Development (AesWorld plugin build)

**Primary Error**:
```
TraceSessionController.h(101): error C7568: argument list missing after assumed function template 'TSharedFuture'
```

**Cascading Errors** (all caused by the primary error):
```
TraceSessionController.cpp(341): error C2955: 'TCheckFormatString': use of class template requires template argument list
TraceSessionController.cpp(341): error C2131: expression did not evaluate to a constant
TraceSessionController.cpp(341): error C2971: 'TPresentErr': template parameter 'N': non-static storage
TraceSessionController.cpp(341): error C2971: 'TPresentErr<0>::TValue': template parameter: non-static storage
TraceSessionController.cpp(347): error C3079: an initializer list cannot be used as the right operand
```

**Root Cause**: Missing `#include "Async/Future.h"` in TraceSessionController.h

**Confidence**: HIGH

### Analysis

The header `TraceSessionController.h` declares a member variable:
```cpp
TSharedFuture<FString> CsvEndCaptureFuture;  // line 101
```

But only includes `CoreMinimal.h` and `Containers/Ticker.h`. In UE5.5, `TSharedFuture` is defined in `Async/Future.h`, which is NOT included by `CoreMinimal.h`. Without the proper include, MSVC treats `TSharedFuture` as an unknown identifier and assumes it to be a function template, triggering C7568.

The cascading errors on line 341 (C2955, C2131, C2971) are in a `UE_LOG` call that uses `*CsvEndCaptureFuture.Get()`. Because `CsvEndCaptureFuture` is of unresolved type, the UE5.5 format string sanitizer (`FormatStringSan::TCheckFormatString`) cannot evaluate the format specifiers at compile time, causing template instantiation failures.

The C3079 error on line 347 (`CsvEndCaptureFuture = {};`) occurs because without the complete type definition of `TSharedFuture`, the compiler cannot match the brace-enclosed initializer to any assignment operator.

### Evidence

- **Knowledge Base**: MATCH found in `installed-469-C7568-TraceSessionController.md` (score 9/10). Covers builds #469-#471 (FAILURE) -> #472 (SUCCESS). Documents same errors in this exact file.
- **Epic Guidance**: Epic confirms that `CoreMinimal.h` does NOT include async primitives. Must add `#include "Async/Future.h"`. Also recommends resetting TSharedFuture with `TSharedFuture<FString>()` instead of `{}`.
- **Source Context**: TraceSessionController.h includes only `CoreMinimal.h`, `AesWorldProfilingTrace.h`, and `Containers/Ticker.h`. Module was introduced by commit `8894ec3` ("拆分AesWorldInsights为AesWorldProfiling").
- **Web Search**: No additional findings.

### Recommended Fix

1. Add missing include to `TraceSessionController.h`:
```cpp
#include "CoreMinimal.h"
#include "AesWorldProfilingTrace.h"
+#include "Async/Future.h"       // TSharedFuture

#if WITH_EARTH_DEBUGGER
#include "Containers/Ticker.h"
```

2. In `TraceSessionController.cpp` line 347, replace the initializer-list reset:
```cpp
// Before:
CsvEndCaptureFuture = {};
// After:
CsvEndCaptureFuture = TSharedFuture<FString>();
```

---

## Error Group 2: C4150 in FAesTracePayloadScope (Incomplete Type)

**Configuration**: UnrealGame Win64 Shipping (AesWorld plugin build)

**Primary Error**:
```
UniquePtr.h(66): error C4150: deletion of pointer to incomplete type 'FAesTracePayloadScope'; no destructor called
```

**Root Cause**: `FAesTracePayloadScope` forward-declared but not defined in Shipping builds where `WITH_EARTH_DEBUGGER` is not set.

**Confidence**: HIGH

### Analysis

The `AesWorldProfilingTrace.h` header defines `FAesTracePayloadScope` as a complete struct only inside `#if WITH_EARTH_DEBUGGER`. In Shipping builds (`UE_BUILD_SHIPPING`), `WITH_EARTH_DEBUGGER` is false, so no complete type is available.

Another module (`AesLodSystem`) uses `TUniquePtr<FAesTracePayloadScope>` as a member variable. When `TUniquePtr`'s destructor calls `delete Ptr`, it requires the complete type definition. With only a forward declaration visible, MSVC raises C4150.

The instantiation chain from the log:
```
AesLodSystemLayeredQuadRequest.h(110) -> TUniquePtr<FAesTracePayloadScope> member
  -> TUniquePtr destructor -> TDefaultDelete::operator() -> UniquePtr.h(66) delete Ptr
  -> C4150: incomplete type
```

### Evidence

- **Knowledge Base**: MATCH found in `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` (score 10/10). The Linux build had the identical error (clang variant: `-Werror,-Wdelete-incomplete`). Fixed by commit `c6e1eab5e` which added stub struct definitions.
- **Knowledge Base**: The `installed-469` entry notes commit `c6e1eab5e` added stubs, but this fix had not yet been picked up by build #470.
- **Epic Guidance**: Epic recommends providing complete type definitions in all preprocessor branches when using TUniquePtr. PIMPL pattern with explicit destructor in .cpp is an alternative approach.
- **Source Context**: Current local repo's `AesWorldProfilingTrace.h` (at commit `c6e1eab5e`) already has the stub definitions. The fix exists but was not included in build #470's snapshot.

### Recommended Fix

Already applied in commit `c6e1eab5e`:
```cpp
#else // !WITH_EARTH_DEBUGGER

#define AESWORLD_TRACE_SCOPE(Name)
#define AESWORLD_TRACE_SCOPE_STR(Str)
#define AESWORLD_TRACE_CACHE(EventType, ProducerId, MarkerInfo, InCacheName)

+// Complete-type stubs so TUniquePtr<T> compiles without -Wdelete-incomplete
+struct FAesTraceScope {};
+struct FAesTracePayloadScope {};
+struct FAesTraceProducerScope {};

#endif // WITH_EARTH_DEBUGGER
```

---

## Resolution Status

| Build | Status | Notes |
|-------|--------|-------|
| #469 | FAILURE | Same errors |
| #470 | FAILURE | This build - same errors |
| #471 | FAILURE | Same errors |
| #472 | SUCCESS | Fix applied - errors resolved |

The fix commit `c6e1eab5e` resolved the C4150 error. Build #472 succeeded overall, though the knowledge base notes that the C7568/C2955 errors in TraceSessionController may still exist but do not block the overall installed build pipeline (individual module failures are non-fatal for the package step).

## References

- **Knowledge Base**: `installed-469-C7568-TraceSessionController.md`, `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`
- **Epic Docs**: [Tasks System](https://dev.epicgames.com/documentation/unreal-engine/tasks-systems-in-unreal-engine), [Smart Pointers](https://dev.epicgames.com/documentation/unreal-engine/smart-pointers-in-unreal-engine), [Build Configurations](https://dev.epicgames.com/documentation/unreal-engine/build-configurations-reference-for-unreal-engine)
- **Fix Commit**: `c6e1eab5e` ("为非debug构建提供Trace struct空桩定义，修复clang -Wdelete-incomplete错误")
- **Introducing Commit**: `8894ec3` ("拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)")
