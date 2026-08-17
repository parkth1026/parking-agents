# Diagnosis: -Wdelete-incomplete in AesLodSystemLayeredQuadRequest.cpp

**Build**: linux #467 (twe-ue5.5-linux-ci)
**Result**: FAILURE
**Date**: 2026-04-08
**Build URL**: http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-linux-ci/467/console

---

## Primary Error

```
UniquePtr.h(66,3): error: deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior [-Werror,-Wdelete-incomplete]
   66 |                 delete Ptr;
      |                 ^      ~~~
UniquePtr.h(272,3): note: in instantiation of member function 'TDefaultDelete<FAesTracePayloadScope>::operator()' requested here
  272 |                 GetDeleter()(Ptr);
      |                 ^
AesLodSystemLayeredQuadRequest.cpp(8,34): note: in instantiation of member function 'TUniquePtr<FAesTracePayloadScope>::~TUniquePtr' requested here
    8 | FAesLodSystemLayeredQuadRequest::FAesLodSystemLayeredQuadRequest(...)
      |                                  ^
AesLodSystemLayeredQuadRequest.h(9,8): note: forward declaration of 'FAesTracePayloadScope'
    9 | struct FAesTracePayloadScope;
      |        ^
1 error generated.
```

**Error Classification**: Clang C++ compilation error (`-Werror,-Wdelete-incomplete`)
**Error Count**: 1 distinct error (1 error generated)
**Affected Target**: TWE Linux Shipping (cross-compile with clang-18.1.0)
**Win64 Build**: PASSED (10/10 actions succeeded -- MSVC is lenient about this)

---

## Root Cause

**Confidence**: High

Commit `8894ec3` ("拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)") introduced a module split that reorganized the AesWorldProfiling code. The header `AesWorldProfilingTrace.h` declared `FAesTraceScope`, `FAesTracePayloadScope`, and `FAesTraceProducerScope` with full definitions only inside `#if WITH_EARTH_DEBUGGER`. In the `#else` branch, only preprocessor macro stubs were provided (`#define AESWORLD_TRACE_SCOPE(Name)` etc.), but no type definitions -- leaving the types as incomplete (forward-declared only).

When building for Linux Shipping target:
1. `WITH_EARTH_DEBUGGER` is NOT defined
2. `FAesTracePayloadScope` is only forward-declared (`struct FAesTracePayloadScope;`)
3. Some class has a `TUniquePtr<FAesTracePayloadScope>` member
4. When `TUniquePtr::~TUniquePtr()` is instantiated, it calls `delete Ptr` on the incomplete type
5. Clang (Linux) strictly enforces `-Wdelete-incomplete` as an error, while MSVC (Win64) silently permits it

This is why the Win64 Development build passed but the Linux Shipping build failed -- different compiler strictness levels.

### Evidence

**Knowledge Base**: EXACT MATCH found at `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`. This is a recurring error from builds #466, #467, #468, fixed in #469 by commit `c6e1eab5e`.

**Source Context**:
- `AesLodSystemLayeredQuadRequest.h` (line 9): contains `struct FAesTracePayloadScope;` forward declaration (indirectly through includes)
- `AesLodSystemLayeredQuadRequest.cpp`: the constructor on line 8 triggers the `TUniquePtr` destructor instantiation
- The actual source files `AesLodSystemLayeredQuadRequest.h` and `.cpp` themselves do NOT reference `FAesTracePayloadScope` directly -- the error propagates through header include chains (`AesLodSystemLayeredQuad.h` -> other headers that use `TUniquePtr<FAesTracePayloadScope>`)

**Epic Guidance**: Epic's official UE5 assistant confirms two valid patterns:
1. **Preferred: Out-of-line destructor (PIMPL pattern)** -- declare destructor in header, define as `= default` in `.cpp` where the full type is visible. This is the canonical UE5 pattern used throughout the engine (e.g., `FRHICommandList`, `FScene`).
2. **Alternative: Empty stub definitions** -- provide `struct FAesTracePayloadScope {};` in the `#else` branch. Less ideal but sufficient.

**Epic References**:
- [Unreal Smart Pointer Library](https://dev.epicgames.com/documentation/unreal-engine/smart-pointers-in-unreal-engine)
- [Epic C++ Coding Standard](https://dev.epicgames.com/documentation/unreal-engine/epic-cplusplus-coding-standard-for-unreal-engine)

---

## Recommended Fix

The fix has already been applied in commit `c6e1eab5e` by xiongxing ("为非debug构建提供Trace struct空桩定义，修复clang -Wdelete-incomplete错误"). The fix uses the stub definition approach:

In `Source/AesWorldProfiling/Public/AesWorldProfilingTrace.h`, add complete-type stub definitions in the `#else` (non-debug) branch:

```diff
 #define AESWORLD_TRACE_SCOPE(Name)
 #define AESWORLD_TRACE_SCOPE_STR(Str)
 #define AESWORLD_TRACE_CACHE(EventType, ProducerId, MarkerInfo, InCacheName)
 
+// Complete-type stubs so TUniquePtr<T> compiles without -Wdelete-incomplete
+struct FAesTraceScope {};
+struct FAesTracePayloadScope {};
+struct FAesTraceProducerScope {};
+
 #endif // WITH_EARTH_DEBUGGER
```

In `Source/AesWorldProfiling/Private/AesWorldProfilingTrace.cpp`, add a missing include:

```diff
 #if WITH_EARTH_DEBUGGER
 
+#include "AesProducerGraphStore.h"
 #include "AesWorldProfilingModule.h"
```

This fix was confirmed working in build #469 (SUCCESS).

---

## Status

This error is a **known, already-fixed issue**. Build #467 was part of the failure streak (#466-#468) before the fix landed in #469. No further action is needed.

---

## References

- **Knowledge Base**: `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` (score 10/10, verified fix)
- **Fix Commit**: `c6e1eab5e` ("为非debug构建提供Trace struct空桩定义，修复clang -Wdelete-incomplete错误")
- **Introducing Commit**: `8894ec3` ("拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)")
- **Epic Smart Pointer Docs**: https://dev.epicgames.com/documentation/unreal-engine/smart-pointers-in-unreal-engine
- **Epic C++ Coding Standard**: https://dev.epicgames.com/documentation/unreal-engine/epic-cplusplus-coding-standard-for-unreal-engine

## Prevention

- When forward-declaring structs used with `TUniquePtr`, always provide a complete type definition in ALL preprocessor branches (not just the debug branch)
- When splitting modules that introduce conditional compilation, test both the `#if` and `#else` branches in CI before merging
- Consider using the PIMPL pattern with explicit destructor definitions in .cpp files (Epic's recommended approach) to avoid incomplete-type issues with smart pointers
