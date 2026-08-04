# Diagnosis: -Wdelete-incomplete in AesLodSystemLayeredQuadRequest.h

**Build**: twe-ue5.5-linux-ci #466 (FAILURE)
**Date**: 2026-04-08
**Duration**: 1413 seconds (~23 minutes)
**Platform**: Linux (cross-compile with clang 18.1.0)

## Primary Error

```
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniquePtr.h(66,3): error: deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior [-Werror,-Wdelete-incomplete]
```

**Instantiation chain**:
- `UniquePtr.h(66)`: `TDefaultDelete<FAesTracePayloadScope>::operator()` calls `delete Ptr;`
- `UniquePtr.h(272)`: `TUniquePtr<FAesTracePayloadScope>::~TUniquePtr` calls `GetDeleter()(Ptr);`
- `AesLodSystemLayeredQuadRequest.h(14)`: constructor of `FAesLodSystemLayeredQuadRequest` triggers implicit destructor instantiation
- `AesLodSystemLayeredQuadRequest.h(9)`: forward declaration `struct FAesTracePayloadScope;` -- incomplete type

**Error count**: 1 error, 2 warnings (deprecation)
**Cascading errors**: None -- single root cause

## Root Cause

**Confidence**: High

Commit `8894ec3` ("拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)") introduced a new module `AesWorldProfiling`. The header `AesWorldProfilingTrace.h` declares `FAesTraceScope`, `FAesTracePayloadScope`, and `FAesTraceProducerScope` as full struct definitions inside `#if WITH_EARTH_DEBUGGER`, but in the `#else` branch (non-debug builds, including Linux CI), only provides `#define` macros that expand to nothing -- without providing complete type definitions for the structs.

These structs are used with `TUniquePtr<T>` in other headers. When `WITH_EARTH_DEBUGGER` is not defined:
1. `FAesTracePayloadScope` is only forward-declared (incomplete type)
2. `TUniquePtr<FAesTracePayloadScope>` member destructor tries to `delete` the incomplete type
3. Clang's `-Werror,-Wdelete-incomplete` turns this into a hard error

MSVC (Win64 editor build) does NOT flag this because it is more permissive with inline-generated destructors for incomplete types. The Linux cross-compile with Clang is strict and correctly enforces the C++ standard.

## Evidence

### Knowledge Base
- **Exact match found**: `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` in `raw/jenkins-log-auto-learning/details/`
- **Related pattern found**: `linux-282-IncompleteType-FEarthDebugSubsystem.md` -- same root pattern (incomplete type behind `WITH_EARTH_DEBUGGER` guard)
- The fix was already committed as `c6e1eab5` by xiongxing in build #469 (SUCCESS)

### Epic Guidance
Epic's official UE assistant confirmed:
- This is a classic cross-platform C++ issue prominent with Clang on Linux
- When `TUniquePtr<T>` destructor is inlined in a header where `T` is incomplete, Clang errors
- **Correct patterns**:
  1. **PIMPL pattern**: Move destructor definition to .cpp where full type is visible
  2. **Provide complete-type stubs**: Define empty struct bodies in all preprocessor branches
- **Key rule**: Never rely on only a forward declaration for types used with `TUniquePtr`

### Source Context
- `D:\Git\AesWorld\Source\AesLodSystem\Private\AesLodSystemLayeredQuadRequest.h` -- the instantiation point
- `D:\Git\AesWorld\Source\AesLodSystem\Private\AesLodSystemLayeredQuad.h` -- included header
- The `AesWorldProfiling` module does not exist in the local Git clone (older version)
- The fix needs to be applied in `Source/AesWorldProfiling/Public/AesWorldProfilingTrace.h`

### Web Search
- No additional findings (this is a well-known C++ pattern issue)

## Recommended Fix

In `Source/AesWorldProfiling/Public/AesWorldProfilingTrace.h`, add complete-type stub definitions in the `#else` (non-debug) branch:

```cpp
#define AESWORLD_TRACE_SCOPE(Name)
#define AESWORLD_TRACE_SCOPE_STR(Str)
#define AESWORLD_TRACE_CACHE(EventType, ProducerId, MarkerInfo, InCacheName)

// Complete-type stubs so TUniquePtr<T> compiles without -Wdelete-incomplete
struct FAesTraceScope {};
struct FAesTracePayloadScope {};
struct FAesTraceProducerScope {};

#endif // WITH_EARTH_DEBUGGER
```

Also add a missing include in `Source/AesWorldProfiling/Private/AesWorldProfilingTrace.cpp`:

```cpp
#if WITH_EARTH_DEBUGGER

#include "AesProducerGraphStore.h"
#include "AesWorldProfilingModule.h"
```

## References

- **Knowledge Base**: `C:\Users\Administrator\.openclaw-autoclaw\workspace\knowledge-bases\raw\jenkins-log-auto-learning\details\linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`
- **Related Knowledge**: `C:\Users\Administrator\.openclaw-autoclaw\workspace\knowledge-bases\raw\jenkins-log-auto-learning\details\linux-282-IncompleteType-FEarthDebugSubsystem.md`
- **Epic Documentation**: [Unreal Smart Pointer Library](https://dev.epicgames.com/documentation/unreal-engine/smart-pointers-in-unreal-engine)
- **Epic Documentation**: [Object Pointers](https://dev.epicgames.com/documentation/unreal-engine/object-pointers-in-unreal-engine)
- **Verified Fix Commit**: `c6e1eab5e83fbe5ca0733f38bb73a18a6d9af909` by xiongxing (build #469 SUCCESS)
