# Wdelete-incomplete: FAesTracePayloadScope incomplete type causes clang error

> **Source**: ue-error-solver | **Job**: twe-ue5.5-linux-ci | **Date**: 2026-04-08
> **Build**: #466 (FAILURE)

## Error Message
```
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniquePtr.h(66,3): error: deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior [-Werror,-Wdelete-incomplete]
```

Instantiation chain:
```
UniquePtr.h(66) -> TDefaultDelete<FAesTracePayloadScope>::operator()
UniquePtr.h(272) -> TUniquePtr<FAesTracePayloadScope>::~TUniquePtr
AesLodSystemLayeredQuadRequest.h(14) -> FAesLodSystemLayeredQuadRequest constructor
AesLodSystemLayeredQuadRequest.h(9) -> forward declaration of FAesTracePayloadScope
```

## Root Cause
Commit `8894ec3` introduced `AesWorldProfiling` module with `AesWorldProfilingTrace.h`. The header declares `FAesTraceScope`, `FAesTracePayloadScope`, and `FAesTraceProducerScope` as full structs only inside `#if WITH_EARTH_DEBUGGER`. In the `#else` branch (non-debug builds including Linux CI), only `#define` macros are provided -- no complete type definitions. Since these structs are used with `TUniquePtr<T>`, clang's `-Werror,-Wdelete-incomplete` correctly flags the deletion of an incomplete type as an error.

## Fix
- **What changed**: Added empty struct stub definitions in the `#else` branch of `AesWorldProfilingTrace.h`:

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

Also added missing include in `AesWorldProfilingTrace.cpp`:

```diff
 #if WITH_EARTH_DEBUGGER
+#include "AesProducerGraphStore.h"
 #include "AesWorldProfilingModule.h"
```

## Evidence Sources
- **Knowledge Base**: Exact match found in `raw/jenkins-log-auto-learning/details/linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` (score 10/10)
- **Related Pattern**: `linux-282-IncompleteType-FEarthDebugSubsystem.md` -- same `WITH_EARTH_DEBUGGER` guard issue
- **Web Search**: No additional findings needed

## Epic Official Guidance
- **Query**: "UE5 TUniquePtr with forward-declared incomplete type causes -Wdelete-incomplete error on Linux clang cross-compile. What is the correct pattern?"
- **Answer**: Epic confirms this is a classic cross-platform C++ issue. The correct pattern is either (1) PIMPL with out-of-line destructor in .cpp where full type is visible, or (2) providing complete-type stubs in all preprocessor branches. Never inline a destructor for a class containing TUniquePtr to a forward-declared type.
- **References**:
  - [Unreal Smart Pointer Library](https://dev.epicgames.com/documentation/unreal-engine/smart-pointers-in-unreal-engine)
  - [Object Pointers](https://dev.epicgames.com/documentation/unreal-engine/object-pointers-in-unreal-engine)

## Prevention
- When forward-declaring structs used with `TUniquePtr`, always provide a complete type definition in all preprocessor branches
- When splitting modules that introduce conditional compilation, test both `#if` and `#else` branches in CI before merging
- Consider using the PIMPL pattern with explicit destructor definitions in .cpp files to avoid incomplete-type issues with smart pointers

## Note
This knowledge entry was NOT written to the knowledge base (test run). It WOULD be saved to:
`C:\Users\Administrator\.openclaw-autoclaw\workspace\knowledge-bases\raw\ue-error-solver\details\linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`

However, an existing entry already exists at:
`C:\Users\Administrator\.openclaw-autoclaw\workspace\knowledge-bases\raw\jenkins-log-auto-learning\details\linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`
So in a real run, this would be a duplicate check -- the existing entry would be updated rather than a new file created.
