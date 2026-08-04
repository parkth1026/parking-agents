# Wdelete-incomplete: FAesTracePayloadScope incomplete type in TUniquePtr

> **Source**: ue-error-solver | **Job**: linux (twe-ue5.5-linux-ci) | **Date**: 2026-04-10
> **Build**: #466 (FAILURE)

## Error Message
```
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniquePtr.h(66,3): error: deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior [-Werror,-Wdelete-incomplete]
   66 |                 delete Ptr;
      |                 ^      ~~~
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniquePtr.h(272,3): note: in instantiation of member function 'TDefaultDelete<FAesTracePayloadScope>::operator()' requested here
  272 |                 GetDeleter()(Ptr);
      |                 ^
AesLodSystemLayeredQuadRequest.h(14,14): note: in instantiation of member function 'TUniquePtr<FAesTracePayloadScope>::~TUniquePtr' requested here
   14 |         FORCEINLINE FAesLodSystemLayeredQuadRequest(...)
      |                     ^
AesLodSystemLayeredQuadRequest.h(9,8): note: forward declaration of 'FAesTracePayloadScope'
    9 | struct FAesTracePayloadScope;
      |        ^
1 error generated.
```

## Root Cause
The commit `8894ec3` refactored AesWorldInsights into AesWorldProfiling, introducing `FAesTracePayloadScope` with its complete definition behind `#if WITH_EARTH_DEBUGGER`. In Shipping builds (Linux CI), `WITH_EARTH_DEBUGGER` is not defined, so the type remains incomplete. `AesLodSystemLayeredQuadRequest.h` declares `TUniquePtr<FAesTracePayloadScope> PayloadTraceScope;` as a member, and since the constructor is `FORCEINLINE`, the compiler generates the destructor inline in the header where only a forward declaration is visible. Clang's `-Werror,-Wdelete-incomplete` treats deletion of incomplete types as an error.

## Fix
- **What changed**: Added empty stub struct definitions (`struct FAesTraceScope {}; struct FAesTracePayloadScope {}; struct FAesTraceProducerScope {};`) in the `#else` (non-debug) branch of `AesWorldProfilingTrace.h`, ensuring TUniquePtr always has a complete type to delete.

```diff
 #else // !WITH_EARTH_DEBUGGER
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

## Evidence Sources
- **Knowledge Base**: Exact match in `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` (from jenkins-log-auto-learning). Also similar pattern in `linux-282-IncompleteType-FEarthDebugSubsystem.md`.
- **Epic Guidance**: Confirmed this is a standard C++ issue. Recommended moving destructor to .cpp or providing complete type definitions in all preprocessor branches.
- **Web Search**: No additional findings.

## Epic Official Guidance
- **Query**: "UE5.5 compilation error when cross-compiling for Linux Shipping. Error: deleting pointer to incomplete type FAesTracePayloadScope may cause undefined behavior [-Werror,-Wdelete-incomplete]. What is the correct UE5 pattern to fix TUniquePtr with incomplete types?"
- **Answer**: Move destructor out of header to .cpp file where full type is available, or provide complete-type stub definitions in all preprocessor branches. Standard UE engine pattern for conditional compilation with smart pointers.
- **References**:
  - [Linux Development Requirements](https://dev.epicgames.com/documentation/unreal-engine/linux-development-requirements-for-unreal-engine)

## Prevention
- When forward-declaring structs used with TUniquePtr, always provide a complete type definition in ALL preprocessor branches (not just the active/debug branch)
- When splitting modules that introduce conditional compilation, test both `#if` and `#else` branches in CI before merging
- Consider using the PIMPL pattern with explicit destructor definitions in .cpp files to avoid incomplete-type issues with smart pointers
