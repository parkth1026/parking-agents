## Diagnosis: Wdelete-incomplete in AesLodSystemLayeredQuadRequest.cpp

**Build**: linux #467 (twe-ue5.5-linux-ci) -- FAILURE
**Duration**: ~37 minutes
**Error Count**: 1

**Primary Error**: `deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior [-Werror,-Wdelete-incomplete]`
**Root Cause**: Forward-declared struct `FAesTracePayloadScope` used with `TUniquePtr<T>` but never fully defined in non-debug builds
**Confidence**: High (knowledge base score 10/10, verified fix from build #469)

### Error Block

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

### Root Cause Analysis

Commit `8894ec3` ("拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)") introduced a module split. The header `AesWorldProfilingTrace.h` declared `FAesTraceScope`, `FAesTracePayloadScope`, and `FAesTraceProducerScope` as forward declarations inside `#if WITH_EARTH_DEBUGGER`, and provided empty `#define` macros in the `#else` branch. However, these structs were used with `TUniquePtr<T>` in other headers. When `WITH_EARTH_DEBUGGER` is not defined (Linux CI / non-debug / release builds), the types remained incomplete (forward-declared only, never defined), and clang's `-Werror,-Wdelete-incomplete` flag turned the deletion of an incomplete type via `TUniquePtr`'s destructor into a hard error.

This is a recurring pattern: `TUniquePtr<T>` requires `T` to be a complete type at the point where the destructor is instantiated. Forward declarations are not sufficient.

### Evidence

- **Knowledge base**: Exact match found -- `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` (score 10/10, verified). Entry confirms builds #466, #467, #468 all failed with the same error and #469 succeeded after the fix.
- **Epic guidance**: Skipped -- knowledge base match score 10/10 with verified fix. No additional information needed.
- **Source context**: `AesLodSystemLayeredQuadRequest.h` in the local AesWorld repo confirmed the file structure. The `AesWorldProfiling` module (containing the fix target `AesWorldProfilingTrace.h`) is in a separate repo not available locally.
- **Web search**: Skipped -- sufficient evidence from knowledge base.

### Recommended Fix

Already fixed in commit `c6e1eab5e83fbe5ca0733f38bb73a18a6d9af909` by xiongxing ("为非debug构建提供Trace struct空桩定义，修复clang -Wdelete-incomplete错误").

The fix added complete-type empty struct stub definitions in the `#else` (non-debug) branch of `AesWorldProfilingTrace.h`:

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

Also added a missing include in `AesWorldProfilingTrace.cpp`:

```diff
 #if WITH_EARTH_DEBUGGER

+#include "AesProducerGraphStore.h"
 #include "AesWorldProfilingModule.h"
```

### Status

This error was already resolved. Build #469 succeeded with the fix applied. No action needed for this build.

### References

- Knowledge base: `raw/jenkins-log-auto-learning/details/linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`
- Fix commit: `c6e1eab5e83fbe5ca0733f38bb73a18a6d9af909`
- Causal commit: `8894ec3` (module split that introduced the issue)

### Prevention

- When forward-declaring structs used with `TUniquePtr`, always provide a complete type definition in all preprocessor branches (not just the active/debug branch)
- When splitting modules that introduce conditional compilation, test both `#if` and `#else` branches in CI before merging
- Consider using the PIMPL pattern with explicit destructor definitions in .cpp files to avoid incomplete-type issues with smart pointers
