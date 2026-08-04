# Diagnosis: Build #466 - twe-ue5.5-linux-ci

## Build Information
- **Job**: wdp-ue / Earth / twe-ue5.5-linux-ci / #466
- **Date**: Wednesday, April 8, 2026
- **Node**: twe_autoci
- **Target Platform**: Linux (cross-compiled from Windows using clang-18.1.0)
- **Result**: FAILURE (ExitCode=6)

## Error Summary

### Fatal Error (1 total)

**Error**: `deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior [-Werror,-Wdelete-incomplete]`

- **Location**: Triggered in UE engine header `UniquePtr.h(66,3)`, but root cause is in project code
- **Source File**: `AesWorld/Source/AesLodSystem/Private/AesLodSystemLayeredQuadRequest.h`
- **Compilation Unit**: `Module.AesLodSystem.cpp` (step [13/474])
- **Compiler**: clang++ 18.1.0 (Linux cross-compile toolchain v23)

### Root Cause Analysis

The file `AesLodSystemLayeredQuadRequest.h` at **line 9** has a **forward declaration** of `FAesTracePayloadScope`:

```cpp
struct FAesTracePayloadScope;  // line 9 - forward declaration only
```

This struct is used as the template parameter for a `TUniquePtr<FAesTracePayloadScope>` member in the class. The constructor of `FAesLodSystemLayeredQuadRequest` (line 14) is defined **inline** (`FORCEINLINE`) in the header, which means the compiler needs to generate the destructor of `TUniquePtr<FAesTracePayloadScope>` at that point. The `TUniquePtr` destructor calls `delete Ptr`, which requires the **complete type definition** of `FAesTracePayloadScope` -- not just a forward declaration.

**Why this is failing now**: The AesWorld plugin was updated from commit `e2a90d1` ("修复watermask丢失的问题") to commit `8894ec3` ("拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)"). This commit refactored and split the `AesWorldInsights` module into `AesWorldProfiling` (Runtime) and `AesWorldInsights` (Program). This refactoring likely moved `FAesTracePayloadScope`'s full definition to a different module/header, breaking the include chain that previously allowed the type to be complete at the point of use. Alternatively, it may have always been a latent issue that clang-18 on the Linux toolchain catches while MSVC on Windows does not.

### Additional Warnings (non-fatal, but worth noting)

1. **Deprecated `Sort` usage** in `EarthZoneGraphBVTree.cpp(77)`: `::Sort()` should be replaced with `Algo::Sort()` (deprecated since UE 5.3).
2. **Deprecated header** `BezierUtilities.h`: Should be replaced with `Curves/BezierUtilities.h` (deprecated since UE 5.5).

## Suggested Fix

### Primary Fix: Add `#include` for the full type definition of `FAesTracePayloadScope`

**File to modify**: `Project/Plugins/G/AesWorld/Source/AesLodSystem/Private/AesLodSystemLayeredQuadRequest.h`

**What to change**:
- Replace the forward declaration `struct FAesTracePayloadScope;` (line 9) with the proper `#include` that provides the **full definition** of `FAesTracePayloadScope`.
- The include would be something like:
  ```cpp
  #include "AesTracePayloadScope.h"  // or wherever FAesTracePayloadScope is fully defined
  ```
  The exact header path depends on where `FAesTracePayloadScope` is defined in the codebase after the refactor. It was likely in the old `AesWorldInsights` module and may now be in `AesWorldProfiling`.

### Alternative Fix: Move destructor out of the header

If adding the include creates circular dependency issues, the alternative approach is:

1. **Remove the `FORCEINLINE` from the constructor** in the header (or at minimum, ensure the destructor is not implicitly generated in the header).
2. **Declare the destructor** explicitly in the header:
   ```cpp
   ~FAesLodSystemLayeredQuadRequest();
   ```
3. **Define the destructor** in the corresponding `.cpp` file where the full definition of `FAesTracePayloadScope` is available:
   ```cpp
   #include "AesTracePayloadScope.h"
   FAesLodSystemLayeredQuadRequest::~FAesLodSystemLayeredQuadRequest() = default;
   ```

This is the standard C++ pattern for using `TUniquePtr` with forward-declared types.

## Git Commands to Apply Fix

```bash
# 1. Navigate to the AesWorld plugin repo
cd D:\ws_twe_ue5.5_linux_ci\Project\Plugins\G\AesWorld

# 2. Create a fix branch
git checkout -b fix/incomplete-type-AesTracePayloadScope dev

# 3. Edit the file (apply one of the fixes described above)
# Edit: Source/AesLodSystem/Private/AesLodSystemLayeredQuadRequest.h

# 4. Stage the changes
git add Source/AesLodSystem/Private/AesLodSystemLayeredQuadRequest.h
# If using the alternative fix, also add the .cpp file:
# git add Source/AesLodSystem/Private/AesLodSystemLayeredQuadRequest.cpp

# 5. Commit
git commit -m "Fix: Add #include for FAesTracePayloadScope to resolve incomplete type error on Linux

The forward declaration of FAesTracePayloadScope in AesLodSystemLayeredQuadRequest.h
is insufficient for TUniquePtr destruction. The full type definition is required when
the destructor is instantiated inline. This was exposed after the AesWorldInsights
refactor (8894ec3) and caught by clang-18 on the Linux cross-compile toolchain.

Resolves build failure in twe-ue5.5-linux-ci #466."

# 6. Push to remote
git push origin fix/incomplete-type-AesTracePayloadScope

# 7. Create merge request (if using GitLab)
# Or merge directly to dev if policy allows
```
