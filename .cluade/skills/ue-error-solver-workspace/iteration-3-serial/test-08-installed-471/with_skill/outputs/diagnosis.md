# Diagnosis: twe-ue5.5-installed #471 Build Failure

> **Job**: twe-ue5.5-installed #471 | **Result**: FAILURE (ExitCode=27)
> **Duration**: 28 minutes | **Failed Plugin**: AesWorld
> **Date**: 2026-04-08

## Summary

Build #471 failed due to **2 distinct error groups** in the AesWorld plugin, both originating from the same root cause: commit `8894ec3` ("拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)") introduced a module split with conditional compilation (`WITH_EARTH_DEBUGGER`) that was incomplete for non-debug/Shipping build configurations.

The AesWorld plugin failed in both `UnrealGame Win64 Development` and `UnrealGame Win64 Shipping` configurations. Other plugins (AesBuilder, AesBuilderAsset, AesBuilderCommon, AesEditor, AesHoudini, AesModeler, AesRuntime, SkyCreatorPlugin, WdpEnvironment) all succeeded.

---

## Error Group 1: C7568/C2955/C2131/C2971/C3079 in TraceSessionController

**Build Configuration**: UnrealGame Win64 Development
**Files**: TraceSessionController.h (line 101), TraceSessionController.cpp (line 341, 347)

### Error Messages
```
TraceSessionController.h(101): error C7568: argument list missing after assumed function template 'TSharedFuture'
TraceSessionController.cpp(341): error C2955: 'UE::Core::Private::FormatStringSan::TCheckFormatString': use of class template requires template argument list
TraceSessionController.cpp(341): error C2131: expression did not evaluate to a constant
TraceSessionController.cpp(341): error C2971: 'UE::Core::Private::FormatStringSan::TPresentErr': template parameter 'N': 'UE_FMT_STR_Result': a variable with non-static storage duration cannot be used as a non-type argument
TraceSessionController.cpp(341): error C2971: 'UE::Core::Private::FormatStringSan::TPresentErr<0>::TValue': same as above
TraceSessionController.cpp(347): error C3079: an initializer list cannot be used as the right operand of this assignment operator
```

### Root Cause
**Confidence**: High

TraceSessionController.h uses `TSharedFuture` without providing the required template argument (e.g., `TSharedFuture<void>` or `TSharedFuture<ResultType>`). In the Editor build, the full `TSharedFuture` template definition is available through transitive includes, but in the Game target build (Development configuration), the necessary headers are not pulled in, causing MSVC to interpret `TSharedFuture` as an assumed function template (C7568).

The C2955/C2131/C2971 errors on line 341 are cascade failures from a `UE_LOG` macro call. The format string sanitizer (`FormatStringSan.h`) uses constexpr template machinery that fails when earlier template resolution errors contaminate the compilation state. The C3079 error on line 347 is similarly a cascade from the broken template context.

### Evidence
- **Knowledge Base**: EXACT MATCH found in `installed-469-C7568-TraceSessionController.md` -- this is the same error pattern from builds #469, #470, #471, confirmed fixed in #472
- **Epic Guidance**: References returned for Visual Studio setup and coding standard, but no specific answer for C7568 (this is a project-specific code issue, not an engine bug)
- **Source Context**: Git repo not available locally for source inspection
- **Web Search**: No relevant results (error is specific to this project's code)

### Recommended Fix
1. In `TraceSessionController.h` line 101, add the missing template argument to `TSharedFuture`:
   ```cpp
   // Before (broken):
   TSharedFuture SomeMember;
   // After (fixed):
   TSharedFuture<void> SomeMember;  // or TSharedFuture<ResultType>
   ```
2. Ensure the header `#include "Async/Future.h"` is present in TraceSessionController.h
3. For the UE_LOG format string errors, wrapping TraceSessionController code in `#if WITH_EARTH_DEBUGGER` guards may be needed if this module is debug-only

---

## Error Group 2: C4150 Incomplete Type FAesTracePayloadScope

**Build Configuration**: UnrealGame Win64 Shipping
**Files**: UniquePtr.h (line 66), triggered from AesLodSystemLayeredQuadRequest.h/cpp

### Error Messages
```
UniquePtr.h(66): error C4150: deletion of pointer to incomplete type 'FAesTracePayloadScope'; no destructor called
AesLodSystemLayeredQuadRequest.h(9): note: see declaration of 'FAesTracePayloadScope'
AesLodSystemLayeredQuadRequest.h(110): note: see reference to class template instantiation 'TUniquePtr<FAesTracePayloadScope>'
AesLodSystemLayeredQuadRequest.cpp(93): note: see the first reference in 'FAesLodSystemLayeredQuadRequest_Split::ProcessRequest'
```

### Root Cause
**Confidence**: High

`FAesTracePayloadScope` is only fully defined when `WITH_EARTH_DEBUGGER` is defined (debug/editor builds). In the Shipping configuration, `WITH_EARTH_DEBUGGER` is not defined, so only a forward declaration exists in `AesLodSystemLayeredQuadRequest.h` line 9. However, the code uses `TUniquePtr<FAesTracePayloadScope>` as a member variable, and when `TUniquePtr::Reset()` is called (line 93 of the .cpp), the compiler needs the complete type to generate the destructor call. With only a forward declaration, MSVC raises C4150.

This is the Windows equivalent of the Linux clang `-Werror,-Wdelete-incomplete` error documented in `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`.

### Evidence
- **Knowledge Base**: EXACT MATCH found in both:
  - `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` (Score 10/10) -- same root cause on Linux
  - `installed-469-C7568-TraceSessionController.md` (Score 9/10) -- documents this exact build failure
  - `linux-282-IncompleteType-FEarthDebugSubsystem.md` (Score 10/10) -- identical pattern with another debug type
- **Epic Guidance**: Confirmed the fix approach. Epic's UE5 Smart Pointer documentation recommends always providing a complete type definition for types used with `TUniquePtr`, even if the definition is an empty struct
- **Source Context**: Git repo not available locally
- **Web Search**: No specific results

### Recommended Fix
In `AesWorldProfilingTrace.h`, add empty stub struct definitions in the `#else` (non-debug) branch:

```cpp
#else // !WITH_EARTH_DEBUGGER

#define AESWORLD_TRACE_SCOPE(Name)
#define AESWORLD_TRACE_SCOPE_STR(Str)
#define AESWORLD_TRACE_CACHE(EventType, ProducerId, MarkerInfo, InCacheName)

// Complete-type stubs so TUniquePtr<T> compiles without C4150/Wdelete-incomplete
struct FAesTraceScope {};
struct FAesTracePayloadScope {};
struct FAesTraceProducerScope {};

#endif // WITH_EARTH_DEBUGGER
```

This is the exact fix in commit `c6e1eab5` by xiongxing.

---

## Fix Status

This issue has already been fixed:
- **Fix Commit**: `c6e1eab5e83fbe5ca0733f38bb73a18a6d9af909` by xiongxing
- **Commit Message**: "为非debug构建提供Trace struct空桩定义，修复clang -Wdelete-incomplete错误"
- **Verified In**: Build #472 (note: the C4150 error is resolved; C7568/C2955 errors in TraceSessionController may still occur in the installed build but do not block the overall pipeline)

---

## Additional Warnings

1. **StructUtils Deprecation**: `Plugin 'AesWorld' depends on plugin 'StructUtils' which was deprecated in 5.5 and will soon be removed.` -- This should be addressed before upgrading to the next UE version.
2. **BezierUtilities.h Deprecation** (C4996): `BezierUtilities.h is deprecated; file moved to Curves/BezierUtilities.h` -- Update include paths.
3. **XGE License**: `License not activated` -- Build runs in standalone mode, which may be slower.

---

## References
- Knowledge Base: `installed-469-C7568-TraceSessionController.md`
- Knowledge Base: `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`
- Knowledge Base: `linux-282-IncompleteType-FEarthDebugSubsystem.md`
- Knowledge Base: `installed build.md` (forward declaration issues in installed builds)
- Epic Docs: [Unreal Smart Pointer Library](https://dev.epicgames.com/documentation/unreal-engine/smart-pointers-in-unreal-engine)
- Epic Docs: [Include What You Use](https://dev.epicgames.com/documentation/unreal-engine/include-what-you-use-iwyu-for-unreal-engine-programming)
