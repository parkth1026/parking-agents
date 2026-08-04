## Diagnosis: Wdelete-incomplete in AesLodSystemLayeredQuadRequest.cpp

**Build**: linux #468 (twe-ue5.5-linux-ci)
**Result**: FAILURE
**Primary Error**: `-Werror,-Wdelete-incomplete` on `FAesTracePayloadScope`
**Root Cause**: Incomplete type `FAesTracePayloadScope` used with `TUniquePtr<T>` in a non-debug build configuration where the struct was only forward-declared, not fully defined.
**Confidence**: High

### Error Message

```
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniquePtr.h(66,3): error: deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior [-Werror,-Wdelete-incomplete]
   66 |                 delete Ptr;
      |                 ^      ~~~
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniquePtr.h(272,3): note: in instantiation of member function 'TDefaultDelete<FAesTracePayloadScope>::operator()' requested here
  272 |                 GetDeleter()(Ptr);
      |                 ^
D:\ws_twe_ue5.5_linux_ci\Project\Plugins\G\AesWorld\Source\AesLodSystem\Private\AesLodSystemLayeredQuadRequest.cpp(8,34): note: in instantiation of member function 'TUniquePtr<FAesTracePayloadScope>::~TUniquePtr' requested here
    8 | FAesLodSystemLayeredQuadRequest::FAesLodSystemLayeredQuadRequest(FAesLodSystemLayeredQuad& InLayeredQuad, double InPriority)
      |                                  ^
D:\ws_twe_ue5.5_linux_ci\Project\Plugins\G\AesWorld\Source\AesLodSystem\Private\AesLodSystemLayeredQuadRequest.h(9,8): note: forward declaration of 'FAesTracePayloadScope'
    9 | struct FAesTracePayloadScope;
      |        ^
1 error generated.
```

### Root Cause Analysis

The commit `8894ec3` ("拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)") introduced a module split that created `AesWorldProfilingTrace.h`. This header declared `FAesTraceScope`, `FAesTracePayloadScope`, and `FAesTraceProducerScope` as forward declarations inside `#if WITH_EARTH_DEBUGGER`, and provided empty `#define` macros in the `#else` branch. However, these structs were used with `TUniquePtr<T>` in other headers.

In the Linux CI build (Shipping configuration), `WITH_EARTH_DEBUGGER` is not defined. The types remained incomplete (only forward-declared, never fully defined), and clang's `-Werror,-Wdelete-incomplete` flag turned the deletion of an incomplete type via the `TUniquePtr` destructor into a hard error.

The error manifests in `AesLodSystemLayeredQuadRequest.cpp` at the constructor, because the compiler instantiates `TUniquePtr<FAesTracePayloadScope>::~TUniquePtr` at that point, which calls `delete` on the incomplete type.

### Evidence

- **Knowledge base**: **STRONG MATCH** - `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` (Score: 10/10, verified). This exact error occurred in builds #466, #467, and #468. The fix was applied in commit `c6e1eab5e` and verified by build #469 (SUCCESS).
- **Epic guidance**: Skipped - knowledge base match score 10/10 with verified fix is sufficient.
- **Source context**: `AesLodSystemLayeredQuadRequest.h` in the local repo (`D:\Git\AesWorld`) shows the class structure. The header file on the CI machine at line 9 has `struct FAesTracePayloadScope;` as a forward declaration, used with `TUniquePtr` as a member.
- **Web search**: Skipped - sufficient evidence from knowledge base.

### Recommended Fix

The fix has already been applied in commit `c6e1eab5e83fbe5ca0733f38bb73a18a6d9af909` by xiongxing:

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

### Status

This error is **already fixed**. Build #469 (SUCCESS) confirms the fix works. No further action needed.

### References

- Knowledge base: `raw/jenkins-log-auto-learning/details/linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`
- Related KB entry: `raw/jenkins-log-auto-learning/details/linux-282-IncompleteType-FEarthDebugSubsystem.md` (similar pattern with `WITH_EARTH_DEBUGGER` guards)
- Fix commit: `c6e1eab5e83fbe5ca0733f38bb73a18a6d9af909`
- Verified build: linux #469 (SUCCESS)
