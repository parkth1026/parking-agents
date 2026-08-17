# Wdangling-else + Wnonportable-include-path + Wlogical-op-parentheses: Three Linux compilation errors in AesWorld

> **Score**: 10/10 | **Job**: linux | **Date**: 2026-01-14
> **Builds**: #354-#359 (FAILURE) → #361 (SUCCESS)
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Message
```
AesBuildingPayloadManager.cpp(77,3): error: add explicit braces to avoid dangling else [-Werror,-Wdangling-else]
   77 | else

AesTerrainMarkers.cpp(118,19): error: '&&' within '||' [-Werror,-Wlogical-op-parentheses]
  118 | if (OutMarker && OutMarker->GetMarkerState() == EMarkerState::Available || InFullChunkDataLevels.Contains(InMarker.MarkerLevel))

AesMarkerCacheManager.cpp(13,10): error: non-portable path to file '"HAL/PlatformFileManager.h"'; specified path differs in case from file name on disk [-Werror,-Wnonportable-include-path]
   13 | #include "HAL/PlatformFilemanager.h"
```

## Root Cause
Three distinct Linux cross-compilation errors caught by Clang's -Werror on the Linux build pipeline:

1. **Dangling else (-Wdangling-else)**: A duplicated `if (LocalSettings.bUseEarthPrefab)` statement on consecutive lines created an ambiguous dangling else. The outer `if` had no braces, making it unclear which `if` the `else` belongs to.

2. **Operator precedence (-Wlogical-op-parentheses)**: Mixed `&&` and `||` without parentheses in a compound condition. While C++ defines `&&` as higher precedence, Clang warns about potential confusion.

3. **Case-sensitive include (-Wnonportable-include-path)**: `#include "HAL/PlatformFilemanager.h"` uses lowercase 'm' in "manager" but the actual UE header is `PlatformFileManager.h` with uppercase 'M'. Works on Windows (case-insensitive) but fails on Linux.

## Fix
- **Commit**: `c33e59dc28823b01ebcd80379227b175812480db` by luwei
- **Message**: "修复管线linux编译不过的问题" (Fix pipeline Linux compilation issues)
- **What changed**:

**AesBuildingPayloadManager.cpp** — Removed duplicated `if` statement:
```diff
 if (LocalSettings.bUseEarthPrefab)
-if (LocalSettings.bUseEarthPrefab)
 {
     InMarkerSystem->AddMarkerProducer(...)
```

**AesTerrainMarkers.cpp** — Added explicit parentheses:
```diff
-if (OutMarker && OutMarker->GetMarkerState() == EMarkerState::Available || InFullChunkDataLevels.Contains(InMarker.MarkerLevel))
+if ((OutMarker && OutMarker->GetMarkerState() == EMarkerState::Available) || InFullChunkDataLevels.Contains(InMarker.MarkerLevel))
```

**AesMarkerCacheManager.cpp** — Fixed include case:
```diff
-#include "HAL/PlatformFilemanager.h"
+#include "HAL/PlatformFileManager.h"
```

## How to Reproduce / Detect
- Build for Linux target (cross-compilation from Windows using Clang)
- Duplicate `if` statements create dangling-else when not braced
- Mixed `&&`/`||` without parentheses triggers -Wlogical-op-parentheses
- Case-mismatched includes are invisible on Windows but fail on Linux

## Epic Official Guidance
- **Query**: "UE5.5 Linux cross-compilation error: -Wdangling-else in AesBuildingPayloadManager.cpp line 77. The code has a duplicated 'if' condition. Also -Wnonportable-include-path for '#include HAL/PlatformFilemanager.h' vs actual file 'HAL/PlatformFileManager.h'. How does UE5 handle -Werror warnings on Linux builds?"
- **Answer**: Epic confirms that Unreal Build Tool (UBT) enables most warnings as errors for Linux builds by default via `bWarningsAsErrors`. Always use braces with `if/else` in UE C++ for clarity to avoid dangling-else warnings. For includes, always match exact case when including headers in cross-platform Unreal projects. The `-Werror` behavior is controlled by UBT and can be adjusted per-module via `.Build.cs` settings, but the recommended approach is to fix the source code.
- **References**:
  - [Set Build Options Locally](https://dev.epicgames.com/community/learning/knowledge-base/GD59/unreal-engine-set-build-options-locally)
  - [Build Configuration](https://dev.epicgames.com/documentation/unreal-engine/build-configuration-for-unreal-engine)

## Prevention
- Always use explicit braces for all `if/else` blocks, especially when nesting conditions
- Run Linux CI builds regularly to catch case-sensitivity and Clang-specific warnings early
- Use code review to catch duplicated statements before they reach CI