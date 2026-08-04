# linux-ci #466 Build Failure Diagnosis

## Build Overview

| Item | Value |
|------|-------|
| Job | twe-ue5.5-linux-ci #466 |
| Result | FAILURE |
| Trigger | Started by timer |
| Target Platform | Linux (cross-compile from Windows) |
| Previous Build #465 | SUCCESS |
| Duration | ~23 minutes (1413591ms) |
| Exit Code | 6 (UnrealBuildTool failure) |
| Toolchain | clang-18.1.0-rockylinux8 |
| Engine | UE 5.5 (D:\Epic\UE_5.5_51) |

## Root Cause

**Compilation Error: Deleting pointer to incomplete type `FAesTracePayloadScope`**

The build failed during Linux Shipping compilation of the `AesLodSystem` module. The error occurs in:

- **Source File**: `Module.AesLodSystem.cpp` (unity build file, step [13/474])
- **Error Location**: `AesLodSystemLayeredQuadRequest.h` line 14
- **Engine File**: `UniquePtr.h` line 66

### Error Details

```
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniquePtr.h(66,3): error:
  deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior
  [-Werror,-Wdelete-incomplete]

   66 |    delete Ptr;

Note: in instantiation of member function 'TUniquePtr<FAesTracePayloadScope>::~TUniquePtr'
  requested here at AesLodSystemLayeredQuadRequest.h(14)

Note: forward declaration of 'FAesTracePayloadScope' at AesLodSystemLayeredQuadRequest.h(9)
```

### Error Explanation

The file `AesLodSystemLayeredQuadRequest.h` (line 9) contains a **forward declaration** of `FAesTracePayloadScope`:

```cpp
struct FAesTracePayloadScope;  // line 9 - forward declaration only
```

Then at line 14, the constructor of `FAesLodSystemLayeredQuadRequest` is defined **inline** in the header. This class has a `TUniquePtr<FAesTracePayloadScope>` member. When the compiler instantiates the destructor of `TUniquePtr`, it needs to call `delete` on the pointer, which requires a **complete type definition** (not just a forward declaration) to properly call the destructor.

The clang compiler on Linux treats this as an error (`-Werror,-Wdelete-incomplete`), while MSVC on Windows is more lenient -- which is why the Win64 Editor build (steps [1-519]) succeeded but the Linux cross-compile (steps [1-474]) failed.

## Suspect Commit

**AesWorld plugin** updated from a previous commit to:
- **Commit**: `8894ec3`
- **Message**: "拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)"
- **Author's intent**: Splitting AesWorldInsights into AesWorldProfiling (Runtime) and AesWorldInsights (Program)

This refactoring likely moved or reorganized headers in the AesWorld plugin, and in the process, the `AesLodSystem` module's header file (`AesLodSystemLayeredQuadRequest.h`) ended up with only a forward declaration of `FAesTracePayloadScope` where a full `#include` of the header defining this struct is needed.

## Fix Recommendation

In the file `AesLodSystemLayeredQuadRequest.h`, replace the forward declaration with the proper include:

**Before:**
```cpp
struct FAesTracePayloadScope;  // line 9
```

**After:**
```cpp
#include "AesTracePayloadScope.h"  // or wherever FAesTracePayloadScope is fully defined
```

Alternatively, if the intent is to keep the forward declaration to reduce header dependencies, the fix would be to:

1. Move the constructor body from the `.h` file to the `.cpp` file, OR
2. Ensure the destructor of `FAesLodSystemLayeredQuadRequest` is explicitly declared in the header and defined in the `.cpp` file (where the full type is available), so that `TUniquePtr`'s destructor is not instantiated in the header context.

**Option 2 (better practice for TUniquePtr with forward-declared types):**

In the `.h` file:
```cpp
struct FAesTracePayloadScope;

struct FAesLodSystemLayeredQuadRequest
{
    // Declare destructor (defined in .cpp)
    ~FAesLodSystemLayeredQuadRequest();

    // Constructor can remain inline or also move to .cpp
    FORCEINLINE FAesLodSystemLayeredQuadRequest(FAesLodSystemLayeredQuad& InLayeredQuad, double InPriority);

    TUniquePtr<FAesTracePayloadScope> PayloadScope;
    // ...
};
```

In the `.cpp` file:
```cpp
#include "AesTracePayloadScope.h"  // full definition available here

FAesLodSystemLayeredQuadRequest::~FAesLodSystemLayeredQuadRequest() = default;
```

This is the standard UE5 pattern for using `TUniquePtr` with forward-declared types.

## Additional Warnings (Non-blocking)

1. **Deprecated `Sort` API**: `EarthZoneGraphBVTree.cpp` uses deprecated `::Sort()`, should migrate to `Algo::Sort()` (deprecated since UE 5.3)
2. **Deprecated header**: `BezierUtilities.h` should be updated to `Curves/BezierUtilities.h` (deprecated since UE 5.5)
3. **Deprecated plugin dependency**: AesWorld depends on `StructUtils` which was deprecated in UE 5.5
4. **License warning**: "License not activated" from XGE build system

## Summary

Build #466 failed because commit `8894ec3` in the AesWorld plugin introduced an incomplete type issue in the `AesLodSystem` module. The file `AesLodSystemLayeredQuadRequest.h` uses `TUniquePtr<FAesTracePayloadScope>` with only a forward declaration of `FAesTracePayloadScope`. The clang compiler (Linux toolchain) correctly flags this as an error since `delete` on an incomplete type is undefined behavior. The fix is to either include the full type definition or move the destructor to the `.cpp` file where the full definition is available.
