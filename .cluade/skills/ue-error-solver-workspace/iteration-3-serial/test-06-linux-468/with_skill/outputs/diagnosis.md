# Diagnosis: -Wdelete-incomplete in AesLodSystemLayeredQuadRequest.cpp

**Build**: twe-ue5.5-linux-ci #468 (FAILURE)
**Date**: 2026-04-08
**Triggered by**: tonghu
**Platform**: Linux (cross-compile, clang 18.1.0, Shipping configuration)

---

## Primary Error

```
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniquePtr.h(66,3):
error: deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior [-Werror,-Wdelete-incomplete]
```

**Error Classification**: C++ compilation error (Clang -Werror, incomplete type with TUniquePtr)
**Affected Module**: AesLodSystem (part of AesWorld plugin)
**Affected File**: `AesLodSystemLayeredQuadRequest.cpp` (line 8)

### Complete Error Block

```
In file included from Module.AesLodSystem.cpp:1:
  ...chain of PCH includes...
UniquePtr.h(66,3): error: deleting pointer to incomplete type 'FAesTracePayloadScope'
   may cause undefined behavior [-Werror,-Wdelete-incomplete]
   66 |                 delete Ptr;
      |                 ^      ~~~
UniquePtr.h(272,3): note: in instantiation of member function
   'TDefaultDelete<FAesTracePayloadScope>::operator()' requested here
  272 |                 GetDeleter()(Ptr);
      |                 ^
AesLodSystemLayeredQuadRequest.cpp(8,34): note: in instantiation of member function
   'TUniquePtr<FAesTracePayloadScope>::~TUniquePtr' requested here
    8 | FAesLodSystemLayeredQuadRequest::FAesLodSystemLayeredQuadRequest(...)
      |                                  ^
AesLodSystemLayeredQuadRequest.h(9,8): note: forward declaration of 'FAesTracePayloadScope'
    9 | struct FAesTracePayloadScope;
      |        ^
1 error generated.
```

---

## Root Cause

**Confidence**: High (exact match in knowledge base with verified fix)

Commit `8894ec3` ("拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)") introduced a module split that created conditional compilation for trace types. In `AesWorldProfilingTrace.h`:

- When `WITH_EARTH_DEBUGGER` is defined (Editor/Development builds): `FAesTracePayloadScope` is fully defined as a real struct
- When `WITH_EARTH_DEBUGGER` is NOT defined (Linux Shipping builds, like this CI): only `#define` macros are provided, and the types remain as forward declarations only

The problem: `AesLodSystemLayeredQuadRequest.h` has a `TUniquePtr<FAesTracePayloadScope>` member (or the type appears in the instantiation chain). When the `TUniquePtr` destructor is instantiated, it calls `delete Ptr;` on the incomplete type. MSVC (Windows) silently allows this, but Clang (Linux cross-compile) correctly treats it as an error under `-Werror,-Wdelete-incomplete`.

This is a **known recurring pattern** in this project: debug/profiling types guarded by `WITH_EARTH_DEBUGGER` cause incomplete-type errors in non-debug builds. A similar issue occurred with `FEarthDebugSubsystem` (linux builds #282-#286).

---

## Evidence

### Knowledge Base (EXACT MATCH)
File: `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`
- Score: 10/10 (verified fix)
- This exact error occurred in builds #466, #467, #468 (all FAILURE)
- Build #469 was the first SUCCESS after the fix
- Fix commit: `c6e1eab5e83fbe5ca0733f38bb73a18a6d9af909` by xiongxing

### Epic Official Guidance
- Epic confirms this is a standard C++ issue with `TUniquePtr` and incomplete types
- **Recommended UE5 pattern**: Declare destructor in header, define it out-of-line in .cpp where the complete type is visible
- Alternative: provide complete-type stub definitions in all preprocessor branches
- References:
  - [Unreal Smart Pointer Library](https://dev.epicgames.com/documentation/unreal-engine/smart-pointers-in-unreal-engine)
  - [Linux Development Quickstart](https://dev.epicgames.com/documentation/unreal-engine/linux-development-quickstart-for-unreal-engine)

### Source Context
- The local AesWorld repo (D:\Git\AesWorld) already has the fix applied -- the current `AesLodSystemLayeredQuadRequest.h` no longer contains `FAesTracePayloadScope` forward declaration
- Build 468 used AesWorld commit `e6f45cf` ("修复PrefabActor在保存InputCollection时混入了Prefab本身的Fragment的问题"), which was BEFORE the fix commit `c6e1eab5`

### Related Knowledge Base Entry
- `linux-282-IncompleteType-FEarthDebugSubsystem.md` -- same pattern: `WITH_EARTH_DEBUGGER` conditional compilation causing incomplete type errors in non-debug builds

---

## Fix (Already Applied)

The fix was committed as `c6e1eab5` by xiongxing with message: "为非debug构建提供Trace struct空桩定义，修复clang -Wdelete-incomplete错误"

### What Changed

**File 1**: `Source/AesWorldProfiling/Public/AesWorldProfilingTrace.h`

Added complete-type stub definitions in the `#else` (non-debug) branch so that `TUniquePtr<T>` can safely call `delete` on these types even when `WITH_EARTH_DEBUGGER` is off:

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

**File 2**: `Source/AesWorldProfiling/Private/AesWorldProfilingTrace.cpp`

Added a missing include:

```diff
 #if WITH_EARTH_DEBUGGER
 
+#include "AesProducerGraphStore.h"
 #include "AesWorldProfilingModule.h"
```

---

## Build Status

| Build | Result | Notes |
|-------|--------|-------|
| #466 | FAILURE | Same error (first occurrence) |
| #467 | FAILURE | Same error (not yet fixed) |
| **#468** | **FAILURE** | **This build -- same error, AesWorld at e6f45cf (pre-fix)** |
| #469 | SUCCESS | Fix applied (commit c6e1eab5) |

**No action needed** -- this error has already been fixed and build #469 succeeded.

---

## Prevention

1. When forward-declaring structs used with `TUniquePtr`, always provide a complete type definition in ALL preprocessor branches (not just the active/debug branch)
2. When splitting modules that introduce conditional compilation (`#if WITH_EARTH_DEBUGGER`), test both the `#if` and `#else` branches in CI before merging
3. Consider using the PIMPL pattern with explicit destructor definitions in .cpp files to avoid incomplete-type issues with smart pointers
