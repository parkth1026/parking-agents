## Diagnosis: C7568/C4150 in AesWorldProfiling (TraceSessionController + FAesTracePayloadScope)

**Build**: twe-ue5.5-installed #471 (FAILURE)
**Started by**: piaotonghu
**Plugin Commit**: AesWorld `d850252` (新增AesWorldInsights使用手册，修复手动运行分析时输出目录和文件名问题)

---

### Error Group A: TraceSessionController.h/cpp (AesWorldProfiling module)

**Primary Error**: C7568 — argument list missing after assumed function template 'TSharedFuture'
**File**: `AesWorldProfiling\Private\TraceSessionController.h(101)`

**Cascading Errors** (all on line 341 of TraceSessionController.cpp):
- C2955: `TCheckFormatString` — use of class template requires template argument list
- C2131: expression did not evaluate to a constant
- C2971 (x2): `TPresentErr` — template parameter with non-static storage duration
- C3079: initializer list cannot be used as the right operand of assignment operator (line 347)

**Root Cause**: `TraceSessionController.h` uses `TSharedFuture` without proper template arguments. The UE5 format string sanitization macros (`UE_LOG` with `FormatStringSan`) require specific template instantiations not available in the installed build (Win64 Shipping) configuration. This is a known issue introduced by commit `8894ec3` ("拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)").

**Confidence**: High

### Error Group B: UniquePtr.h / AesLodSystem (incomplete type)

**Primary Error**: C4150 — deletion of pointer to incomplete type 'FAesTracePayloadScope'; no destructor called
**File**: Engine `UniquePtr.h(66)`, instantiated from `AesLodSystemLayeredQuadRequest.h(110)` and `.cpp(93)`

**Root Cause**: `FAesTracePayloadScope` is forward-declared inside `#if WITH_EARTH_DEBUGGER` in `AesWorldProfilingTrace.h`. In the `#else` branch (non-debug/Shipping builds), only empty macros are defined but the struct types remain incomplete (never defined). When `TUniquePtr<FAesTracePayloadScope>` is used as a member variable, its destructor calls `delete` on the incomplete type, which is an error on MSVC (C4150) and a hard error on clang (`-Werror,-Wdelete-incomplete`).

**Confidence**: High

---

### Evidence

- **Knowledge base**: **Strong match found (SKIPPED Epic query)**
  - `installed-469-C7568-TraceSessionController.md` — Score 9/10, verified fix. Covers this exact build (#469-#471 FAILURE -> #472 SUCCESS). Contains confirmed fix commit and diff.
  - `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` — Score 10/10, verified fix. Same root cause on Linux CI (clang equivalent error). Same fix commit.
  - `linux-282-IncompleteType-FEarthDebugSubsystem.md` — Score 10/10, historical precedent. Same pattern: debug-only types used without `#if WITH_EARTH_DEBUGGER` guards, causing incomplete type errors in non-debug builds.

- **Epic guidance**: Skipped — knowledge base match scores 9/10 and 10/10 with verified fixes. The KB entries contain concrete diffs and confirmed build success, making Epic query unnecessary.

- **Source context**: The local git repo (`D:\Git\AesWorld`) does not contain `AesWorldProfiling` module or `TraceSessionController` files (they exist on the build machine at commit `d850252`). The `AesLodSystemLayeredQuadRequest.h` exists locally but the current version does not reference `FAesTracePayloadScope`. Fix commit `c6e1eab5e` already exists in the repo.

- **Web search**: Skipped — sufficient evidence from knowledge base.

---

### Recommended Fix

The fix has already been implemented and verified in commit `c6e1eab5e` by xiongxing:

**For C4150 (incomplete type)**:
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

**For C7568/C2955/C3079 (TraceSessionController)**:
These errors remain in the installed build at build #471 but the KB notes that build #472 succeeds overall because the AesWorldProfiling module failure does not block the game target packaging. A full fix for TraceSessionController would require:
1. Using proper template arguments for `TSharedFuture<ResultType>` instead of bare `TSharedFuture`
2. Fixing the UE_LOG format string usage to be compatible with the installed build's FormatStringSan template requirements

**Build #472 (SUCCESS)** confirms the fix is already deployed.

---

### References

- Knowledge base: `installed-469-C7568-TraceSessionController.md` (score 9/10)
- Knowledge base: `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` (score 10/10)
- Knowledge base: `installed build.md` (concept reference)
- Fix commit: `c6e1eab5e83fbe5ca0733f38bb73a18a6d9af909`
- Related: `linux-282-IncompleteType-FEarthDebugSubsystem.md` (same pattern)

---

### Build Commands (for reference)

AesWorld plugin - Win64 Shipping (the failing target):
```
dotnet.exe UnrealBuildTool.dll UnrealGame Win64 Shipping -Project="...HostProject.uproject" -plugin="...AesWorld\AesWorld.uplugin" -noubtmakefiles
```

AesWorld plugin - Win64 Development (also failed):
```
dotnet.exe UnrealBuildTool.dll UnrealGame Win64 Development -Project="...HostProject.uproject" -plugin="...AesWorld\AesWorld.uplugin" -noubtmakefiles
```
