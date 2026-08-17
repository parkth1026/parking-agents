# Diagnosis: installed #470 Build Failure

**Job**: twe-ue5.5-installed #470
**Result**: FAILURE (ExitCode=27, Error_UnknownBuildFailure)
**Duration**: ~33 minutes
**Failed Plugin**: AesWorld
**Succeeded Plugins**: AesBuilder, AesBuilderAsset, AesBuilderCommon, AesEditor, AesHoudini, AesModeler, AesRuntime, SkyCreatorPlugin, WdpEnvironment

---

## Error Group 1: C7568/C2955/C2131/C2971/C3079 in TraceSessionController (AesWorldProfiling module)

**Primary Error**: `error C7568: argument list missing after assumed function template 'TSharedFuture'`
**File**: `AesWorldProfiling/Private/TraceSessionController.h` line 101
**Root Cause**: The AesWorldProfiling module (introduced by commit `8894ec3` "拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)") has two issues in installed build configuration:
1. `TraceSessionController.h` uses `TSharedFuture` without proper template arguments. In installed builds, the template is not fully visible and MSVC requires explicit template parameter lists.
2. `TraceSessionController.cpp` line 341 uses UE5 formatting macros (likely `UE_LOG` with format string sanitization via `FormatStringSan.h`) that trigger cascading template instantiation errors (C2955, C2131, C2971) because the format string check templates are not fully resolvable in this configuration.
3. Line 347 has an assignment using an initializer list that is not valid in this context (C3079).

**Confidence**: High

### Evidence
- **Knowledge base**: Strong match found -- `installed-469-C7568-TraceSessionController.md` (score 9/10, verified). This exact error pattern was documented from builds #469-#471, with the fix confirmed in build #472.
- **Epic guidance**: Skipped -- knowledge base match score 9/10 with verified fix is sufficient.
- **Source context**: `AesWorldProfiling` module is not present in the local D:\Git\AesWorld repo (only exists on the build machine), which limits local source analysis. However, the KB entry provides the full context.
- **Web search**: Skipped -- sufficient evidence from knowledge base.

### Recommended Fix
The fix commit `c6e1eab5e` by xiongxing ("为非debug构建提供Trace struct空桩定义，修复clang -Wdelete-incomplete错误") partially addresses these errors. For the C4150 incomplete type error, it adds stub struct definitions. The C7568/C2955/C3079 errors in TraceSessionController need additional fixes:
- Add proper template arguments to `TSharedFuture<>` usage in TraceSessionController.h line 101
- Fix the UE_LOG/format string usage in TraceSessionController.cpp line 341 to be compatible with installed build's FormatStringSan
- Fix the initializer list assignment on TraceSessionController.cpp line 347

**Note**: Per the KB entry, build #472 succeeded because the AesWorldProfiling module compilation failure is non-fatal in the installed build pipeline -- the main game target proceeds even when individual plugin modules fail.

---

## Error Group 2: C4150 in UniquePtr.h (AesLodSystem module)

**Primary Error**: `error C4150: deletion of pointer to incomplete type 'FAesTracePayloadScope'; no destructor called`
**File**: Engine `UniquePtr.h` line 66, triggered from `AesLodSystem/Private/AesLodSystemLayeredQuadRequest.h` line 110
**Root Cause**: `FAesTracePayloadScope` is forward-declared (line 9 of AesLodSystemLayeredQuadRequest.h on the build machine) but has no complete type definition when `WITH_EARTH_DEBUGGER` is not defined. The `TUniquePtr<FAesTracePayloadScope>` destructor at line 110 requires a complete type to call `delete`, but only a forward declaration is available, causing C4150.

**Confidence**: High

### Evidence
- **Knowledge base**: Same KB entry (`installed-469-C7568-TraceSessionController.md`, score 9/10) covers this error. The verified fix adds empty stub struct definitions in the `#else` branch of `WITH_EARTH_DEBUGGER`.
- **Epic guidance**: Skipped -- knowledge base match score 9/10 with verified fix is sufficient.
- **Source context**: Local `AesLodSystemLayeredQuadRequest.h` (D:\Git\AesWorld\Source\AesLodSystem\Private\) does not have `FAesTracePayloadScope` at all -- the build machine version has been updated with a `TUniquePtr<FAesTracePayloadScope>` member that the local repo has not yet received. The `AesLodSystemLayeredQuadRequest.cpp` line 93 calls `.Reset()` on this unique pointer, triggering the destructor instantiation.
- **Web search**: Skipped -- sufficient evidence from knowledge base.

### Recommended Fix
Already fixed in commit `c6e1eab5e`:
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

This ensures `FAesTracePayloadScope` has a complete type definition in both debug and non-debug builds, so `TUniquePtr` can properly compile its destructor.

---

## Summary

| # | Error Code | File | Severity | Status |
|---|-----------|------|----------|--------|
| 1 | C7568 | TraceSessionController.h:101 | Primary | Fix partially applied (C4150 fixed, C7568/C2955 still present but non-blocking) |
| 2 | C2955/C2131/C2971 | TraceSessionController.cpp:341 | Cascading from #1 | Same as above |
| 3 | C3079 | TraceSessionController.cpp:347 | Independent | Needs separate fix |
| 4 | C4150 | UniquePtr.h:66 (via AesLodSystemLayeredQuadRequest.h) | Primary | Fixed in commit c6e1eab5e |

**Build #472 succeeded** after the fix, confirming the C4150 error is resolved. The C7568/C2955/C3079 errors in AesWorldProfiling still occur but do not block the overall installed build.

### References
- Knowledge base: `installed-469-C7568-TraceSessionController.md` (score 9/10)
- Knowledge base: `installed build.md` (concepts)
- Fix commit: `c6e1eab5e` by xiongxing
- Jenkins: http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-installed/470/console
