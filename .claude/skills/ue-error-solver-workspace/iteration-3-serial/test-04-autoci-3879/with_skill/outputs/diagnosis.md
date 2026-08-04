# Diagnosis: autoci #3879 - FAILURE

> **Job**: aes6-ue-runtime-ci | **Build**: #3879 | **Date**: 2026-03-24
> **Node**: twe_autoci | **Result**: FAILURE | **Duration**: ~26 min
> **Started by**: tonghu

## Summary

Build failed during the **Package** stage due to **disk space exhaustion** on the build node. The Editor compilation stage completed successfully (918/918 steps), but the subsequent Package build (BuildCookRun) failed at ~250/568 compilation steps when the compiler could not write precompiled header (.pch) files.

**Error count**: 4 identical `fatal error C1085` errors (all same root cause)
**Classification**: Infrastructure error (disk full) -- no code fix possible

---

## Primary Error: fatal error C1085

**Error code**: C1085
**Error message**: `Cannot write precompiled header file: '...SharedPCH.Engine.Project.*.pch': There is not enough space on the disk.`

### Affected Files (all PCH variants):

1. `SharedPCH.Engine.Project.ValApi.Cpp20.h.pch`
2. `SharedPCH.Engine.Project.NonOptimized.Exceptions.ValApi.Cpp20.h.pch`
3. `SharedPCH.Engine.Project.NonOptimized.ValApi.Cpp20.h.pch`
4. `SharedPCH.Engine.Project.RTTI.Exceptions.ValApi.Cpp20.h.pch`

All located under: `D:\ws_twe_ue5.5_ci\Project\Intermediate\Build\Win64\x64\TWE\Development\Engine\`

### Full Error Block

```
[250/568] Compile [x64] SharedPCH.Engine.Project.ValApi.Cpp20.cpp (0:36.25 at +0:00)
D:\ws_twe_ue5.5_ci\Project\Intermediate\Build\Win64\x64\TWE\Development\Engine\SharedPCH.Engine.Project.ValApi.Cpp20.cpp(2): fatal error C1085: Cannot write precompiled header file: 'D:\ws_twe_ue5.5_ci\Project\Intermediate\Build\Win64\x64\TWE\Development\Engine\SharedPCH.Engine.Project.ValApi.Cpp20.h.pch': There is not enough space on the disk.

Error executing D:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.38.33130\bin\Hostx64\x64\cl.exe (tool returned code: 2)

[251/568] Compile [x64] SharedPCH.Engine.Project.NonOptimized.Exceptions.ValApi.Cpp20.cpp (0:36.26 at +0:00)
D:\ws_twe_ue5.5_ci\Project\Intermediate\Build\Win64\x64\TWE\Development\Engine\SharedPCH.Engine.Project.NonOptimized.Exceptions.ValApi.Cpp20.cpp(2): fatal error C1085: Cannot write precompiled header file: 'D:\ws_twe_ue5.5_ci\Project\Intermediate\Build\Win64\x64\TWE\Development\Engine\SharedPCH.Engine.Project.NonOptimized.Exceptions.ValApi.Cpp20.h.pch': There is not enough space on the disk.

Error executing D:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.38.33130\bin\Hostx64\x64\cl.exe (tool returned code: 2)

[252/568] Compile [x64] SharedPCH.Engine.Project.NonOptimized.ValApi.Cpp20.cpp (0:36.25 at +0:00)
D:\ws_twe_ue5.5_ci\Project\Intermediate\Build\Win64\x64\TWE\Development\Engine\SharedPCH.Engine.Project.NonOptimized.ValApi.Cpp20.cpp(2): fatal error C1085: Cannot write precompiled header file: 'D:\ws_twe_ue5.5_ci\Project\Intermediate\Build\Win64\x64\TWE\Development\Engine\SharedPCH.Engine.Project.NonOptimized.ValApi.Cpp20.h.pch': There is not enough space on the disk.

Error executing D:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.38.33130\bin\Hostx64\x64\cl.exe (tool returned code: 2)

[253/568] Compile [x64] SharedPCH.Engine.Project.RTTI.Exceptions.ValApi.Cpp20.cpp (0:36.31 at +0:00)
D:\ws_twe_ue5.5_ci\Project\Intermediate\Build\Win64\x64\TWE\Development\Engine\SharedPCH.Engine.Project.RTTI.Exceptions.ValApi.Cpp20.cpp(2): fatal error C1085: Cannot write precompiled header file: 'D:\ws_twe_ue5.5_ci\Project\Intermediate\Build\Win64\x64\TWE\Development\Engine\SharedPCH.Engine.Project.RTTI.Exceptions.ValApi.Cpp20.h.pch': There is not enough space on the disk.

Error executing D:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.38.33130\bin\Hostx64\x64\cl.exe (tool returned code: 2)
```

### Build Command (Package Stage)

```
RunUAT.bat BuildCookRun
  -project="D:/ws_twe_ue5.5_ci/Project/TWE.uproject"
  -archivedirectory=D:/ws_twe_ue5.5_ci/Package/Windows/ci-1.0.0/Data/TWERuntime
  -targetplatform=Win64
  -clientconfig=Development
  -nocompileeditor -nop4 -pak -cook -stage -archive -package -compressed -prereqs -build -utf8output
```

---

## Root Cause

**Root Cause**: The `D:\` drive on build node `twe_autoci` ran out of disk space during the Package compilation stage.

**Confidence**: High

### Analysis

1. The Editor build (Phase 1) completed successfully with 918/918 steps, consuming significant disk space for intermediate build artifacts under `D:\ws_twe_ue5.5_ci\Project\Intermediate\Build\`.
2. The Package build (Phase 2) started immediately after, recompiling the game target TWE for Win64 Development. This generates a second set of PCH files and object files.
3. At approximately step 250 of 568, the disk could no longer accommodate the precompiled header files (`.pch` files are typically 100-500 MB each for UE5 Engine PCH).
4. All 4 failures are for `SharedPCH.Engine.Project.*.pch` variants -- these are the Engine-level precompiled headers, which are among the largest files generated during compilation.
5. The fact that the first ~249 steps (including Copy, smaller PCH, and Compile steps) succeeded suggests the disk was close to full when the build started, and the large Engine PCH files pushed it over the limit.

### Evidence

- **Knowledge Base**: This pattern is documented as a known infrastructure issue. The knowledge base index notes: "C1085 磁盘空间不足(6.5 通用基础设施)" -- rated 6.5, classified as generic infrastructure, not UE5-specific. Build #3881 also had the same C1085 disk space failure.
- **Epic Guidance**: Skipped (infrastructure error, not a UE5 API/code issue)
- **Source Context**: Not applicable (no code error to inspect)
- **Web Search**: Not needed (well-known MSVC error)

---

## Recommended Actions

This is an **infrastructure issue** -- no code changes will fix it. The following operational actions are needed:

1. **Immediate**: Clean up disk space on `twe_autoci` node
   - Delete old build intermediates: `D:\ws_twe_ue5.5_ci\Project\Intermediate\Build\` (can be rebuilt)
   - Check for old packages under `D:\ws_twe_ue5.5_ci\Package\`
   - Review `D:\Jenkins\workspace\` for stale workspaces from other jobs
2. **Short-term**: Add a disk space check to the Jenkins pipeline before the build starts
   ```powershell
   $drive = Get-PSDrive D
   if ($drive.Free -lt 20GB) { throw "Insufficient disk space: $([math]::Round($drive.Free/1GB,1)) GB free" }
   ```
3. **Long-term**: Consider workspace cleanup policies or increasing disk capacity on the build node
4. **Retry**: Once disk space is freed, re-trigger the build -- there are no code errors

### Additional Note

There is also a deprecation warning (not an error) in the Editor build stage:
```
EarthModelerSelectionUtil.cpp(28): warning C4996: 'FSelectedOjectsChangeList': Use FSelectedObjectsChangeList instead
```
This does not cause the build failure but should be addressed eventually to avoid a future compile error when the deprecated API is removed.

---

## References

- MSVC C1085 Documentation: https://learn.microsoft.com/en-us/cpp/error-messages/compiler-errors-1/fatal-error-c1085
- Knowledge Base: C1085 disk space pattern (rated 6.5, infrastructure category)
- Related build: autoci #3881 (same C1085 disk space failure)
