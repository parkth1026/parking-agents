# linux-ci #466 Build Failure Diagnosis

## Build Info

| Field | Value |
|-------|-------|
| Job | twe-ue5.5-linux-ci #466 |
| Date | 2026-04-08 |
| Trigger | Timer (scheduled) |
| Result | FAILURE (ExitCode=6) |
| Previous Build #465 | SUCCESS |
| Console | http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-linux-ci/466/console |

## Build Stages

| Stage | Target | Config | Result |
|-------|--------|--------|--------|
| Editor Compile | TWEEditor Win64 Development | MSVC | PASSED |
| Package (dual-target) | TWEEditor Win64 Development + TWE Linux Shipping | Clang 18.1.0 cross-compile | FAILED |

Win64 Editor build succeeded. The failure occurred only during the Linux Shipping cross-compilation stage.

## Root Cause Error

```
error: deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior
       [-Werror,-Wdelete-incomplete]
```

**Compilation unit:** `Module.AesLodSystem.cpp` (Linux x64, UnrealGame, Shipping configuration)

**Full error chain:**

1. `UniquePtr.h(66,3)`: `delete Ptr;` -- deleting pointer to incomplete type `FAesTracePayloadScope`
2. `UniquePtr.h(272,3)`: in instantiation of `TDefaultDelete<FAesTracePayloadScope>::operator()`
3. `AesLodSystemLayeredQuadRequest.h(14,14)`: in instantiation of `TUniquePtr<FAesTracePayloadScope>::~TUniquePtr` (triggered by the inline constructor)
4. `AesLodSystemLayeredQuadRequest.h(9,8)`: forward declaration of `FAesTracePayloadScope`

## Root Cause Analysis

### Offending Commit

**Commit:** `8894ec3` by xiongxing
**Message:** "拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)"
**Plugin:** AesWorld

This commit refactored the AesWorldInsights module, splitting it into:
- `AesWorldProfiling` (Runtime) -- for trace recording
- `AesWorldInsights` (Program target) -- for offline analysis

### What Went Wrong

The header file `AesLodSystemLayeredQuadRequest.h` declares a member:

```cpp
// Line 9:  forward declaration only
struct FAesTracePayloadScope;

// Line 122: member using TUniquePtr with the incomplete type
TUniquePtr<FAesTracePayloadScope> PayloadTraceScope;
```

The problem is that `TUniquePtr<T>::~TUniquePtr()` calls `delete` on the pointer, which requires the full definition of `T` (not just a forward declaration). When the compiler instantiates the destructor of `FAesLodSystemLayeredQuadRequest` (which happens implicitly because the constructor is `FORCEINLINE` in the header at line 14), it needs to know how to destroy all members, including `PayloadTraceScope`.

In the `.cpp` file, `#include "AesWorldProfilingTrace.h"` provides the full definition of `FAesTracePayloadScope`. But the header only has a forward declaration. This is a classic C++ incomplete-type-with-unique-ptr problem.

### Why It Passes on Win64 but Fails on Linux

- **MSVC (Win64):** MSVC is more lenient about `delete` on incomplete types -- it typically emits a warning (C4150) but not an error, even with `-WarningsAsErrors` (unless specifically enabled).
- **Clang 18.1.0 (Linux cross-compile):** Clang treats `-Wdelete-incomplete` as an error when `-Werror` is active. The flag `-Werror,-Wdelete-incomplete` explicitly shows this is a warning promoted to error.

### Why It Worked Before (Build #465)

Build #465 did not have this commit. The `TUniquePtr<FAesTracePayloadScope> PayloadTraceScope` member was added as part of the `8894ec3` refactoring. Before this commit, `AesLodSystemLayeredQuadRequest.h` did not contain this member field at all.

## Suggested Fix

There are two common approaches to fix `TUniquePtr` with incomplete types:

### Option A: Include the full header (simplest)

In `AesLodSystemLayeredQuadRequest.h`, replace the forward declaration with the full include:

```cpp
// Remove: struct FAesTracePayloadScope;
// Add:
#include "AesWorldProfilingTrace.h"
```

This is the simplest fix but increases header coupling.

### Option B: Out-of-line destructor (preferred for large codebases)

Keep the forward declaration in the header, but ensure the destructor of `FAesLodSystemLayeredQuadRequest` is NOT inline. Move it to the `.cpp` file where the full type is visible:

1. In `AesLodSystemLayeredQuadRequest.h`, change the destructor from inline to declared-only:
```cpp
virtual ~FAesLodSystemLayeredQuadRequest();
```

2. In `AesLodSystemLayeredQuadRequest.cpp`, define it:
```cpp
FAesLodSystemLayeredQuadRequest::~FAesLodSystemLayeredQuadRequest()
{
    if (auto LayeredQuad = WeakLayeredQuad.Pin())
    {
        LayeredQuad->UnbindRequest(this);
    }
}
```

This keeps the header clean and avoids pulling in the full `AesWorldProfilingTrace.h` dependency chain.

### Option C: Wrap the member in a conditional guard

Since `PayloadTraceScope` is only used under `#if WITH_EARTH_DEBUGGER` (which is `!UE_BUILD_SHIPPING`), wrap the member declaration too:

```cpp
#if WITH_EARTH_DEBUGGER
    TUniquePtr<FAesTracePayloadScope> PayloadTraceScope;
#endif
```

This avoids the issue entirely in Shipping builds, but still requires Option A or B for non-Shipping configurations.

**Recommended approach:** Combine Option B + Option C for maximum correctness across all configurations.

## Additional Warnings (Non-blocking)

1. **Deprecated `Sort` API** in `EarthZoneGraphBVTree.cpp(77,5)`: `::Sort()` is deprecated since UE 5.3, should use `Algo::Sort()`.
2. **Deprecated header** `BezierUtilities.h` in `EarthZoneGraphTypes.cpp`: Should use `Curves/BezierUtilities.h` instead.
3. **License warning:** "License not activated" -- build system warning, non-fatal.
