## Diagnosis: -Wdelete-incomplete in AesLodSystemLayeredQuadRequest.h

**Primary Error**: `error: deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior [-Werror,-Wdelete-incomplete]`
**Root Cause**: The commit `8894ec3` ("拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)") introduced a module split where `FAesTracePayloadScope` is defined in `AesWorldProfiling` module behind a `#if WITH_EARTH_DEBUGGER` guard. In the `#else` branch (active in Linux Shipping builds where `WITH_EARTH_DEBUGGER` is not defined), the type has no complete definition -- only a forward declaration exists. The `AesLodSystemLayeredQuadRequest` header declares a `TUniquePtr<FAesTracePayloadScope> PayloadTraceScope;` member. When the compiler generates the implicit inline destructor, `TDefaultDelete<FAesTracePayloadScope>::operator()` calls `delete Ptr;` on an incomplete type, which clang flags as `-Wdelete-incomplete` (promoted to error by `-Werror`).
**Confidence**: High

### Complete Error Block

```
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
```

### Evidence

- **Knowledge base**: Exact match found in `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`. Documents this exact error and its fix (commit `c6e1eab5` adding empty stub structs in the `#else` branch). Also found similar pattern in `linux-282-IncompleteType-FEarthDebugSubsystem.md` -- same root cause pattern (debug-only types used without preprocessor guards in shipping builds).

- **Epic guidance**: Epic confirmed this is a classic C++ "incomplete type with unique_ptr" issue. Recommended pattern: move the destructor out of the header into the .cpp file, ensuring the .cpp includes the full type definition. Alternative: provide complete-type stub definitions in all preprocessor branches.

- **Source context**: At the Jenkins build commit `8894ec3`, the header has:
  - Line 9: `struct FAesTracePayloadScope;` (forward declaration only)
  - Line 122: `TUniquePtr<FAesTracePayloadScope> PayloadTraceScope;` (member variable)
  - The constructor is `FORCEINLINE` in the header, causing implicit destructor generation at header inclusion time
  - The .cpp file uses `PayloadTraceScope` under `#if WITH_EARTH_DEBUGGER` guards, but the member variable and destructor are unconditionally compiled

- **Web search**: No additional findings beyond what knowledge base and Epic provided.

### Recommended Fix

Two approaches are valid:

**Approach A (Stub definitions -- minimal change):**
Add empty struct definitions in the `#else` branch of `AesWorldProfilingTrace.h`:
```cpp
#else // !WITH_EARTH_DEBUGGER
// Complete-type stubs so TUniquePtr<T> compiles without -Wdelete-incomplete
struct FAesTraceScope {};
struct FAesTracePayloadScope {};
struct FAesTraceProducerScope {};
#endif
```

**Approach B (Remove dependency -- cleaner long-term):**
Remove `PayloadTraceScope` from `AesLodSystemLayeredQuadRequest` entirely, remove the `AesWorldProfiling` dependency from `AesLodSystem.Build.cs`, and remove all `PayloadTraceScope` usages from the .cpp files. The profiling/trace functionality can be re-added later using a different architecture that doesn't couple the LOD system to the profiling module.

**Approach C (Epic-recommended PIMPL pattern):**
Move the destructor to the .cpp file where the full definition is available via `#include "AesWorldProfilingTrace.h"`.

### References
- Knowledge base: `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`
- Knowledge base: `linux-282-IncompleteType-FEarthDebugSubsystem.md`
- Epic reference: [Linux Development Requirements](https://dev.epicgames.com/documentation/unreal-engine/linux-development-requirements-for-unreal-engine)
