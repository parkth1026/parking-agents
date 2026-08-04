# Wnonportable-include-path + Wlogical-op-parentheses: Linux cross-compilation errors in AesPOIModule and AesTerrainMarkers

> **Score**: 10/10 | **Job**: linux | **Date**: 2025-12-31
> **Builds**: #341-#344 (FAILURE) → #345 (SUCCESS)
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Message
```
D:\ws_twe_ue5.5_linux_ci\Project\Plugins\G\AesWorld\Source\AesPOI\Private\AesPOIModule.cpp(1,10): error: non-portable path to file '"AesPOIModule.h"'; specified path differs in case from file name on disk [-Werror,-Wnonportable-include-path]
    1 | #include "AesPoiModule.h"

D:\ws_twe_ue5.5_linux_ci\Project\Plugins\G\AesWorld\Source\AesEarth\Private\AesTerrain\AesTerrainPayload\AesTerrainMarkers.cpp(118,19): error: '&&' within '||' [-Werror,-Wlogical-op-parentheses]
  118 | if (OutMarker && OutMarker->GetMarkerState() == EMarkerState::Available || InFullChunkDataLevels.Contains(InMarker.MarkerLevel))
```

## Root Cause
Two distinct but related Linux cross-compilation errors that pass on Windows but fail on Linux (Clang with -Werror):

1. **Case-sensitive include path**: `#include "AesPoiModule.h"` does not match the actual filename `AesPOIModule.h`. Windows filesystem is case-insensitive so this works on Windows, but Linux is case-sensitive and treats this as a non-portable path.

2. **Operator precedence ambiguity**: The condition `OutMarker && OutMarker->GetMarkerState() == EMarkerState::Available || InFullChunkDataLevels.Contains(InMarker.MarkerLevel)` mixes `&&` and `||` without parentheses. While C++ defines `&&` as higher precedence than `||`, Clang flags this as potentially confusing with `-Wlogical-op-parentheses`.

## Fix
- **Commit**: `4544041a500389ebe488558d751f76778a29a330` by luwei
- **Message**: "管线Linux编译不过的问题" (Fix pipeline Linux compilation issues)
- **What changed**:

**AesPOIModule.cpp** — Fixed include case:
```diff
-#include "AesPoiModule.h"
+#include "AesPOIModule.h"
```

**AesTerrainMarkers.cpp** — Added explicit parentheses:
```diff
-if (OutMarker && OutMarker->GetMarkerState() == EMarkerState::Available || InFullChunkDataLevels.Contains(InMarker.MarkerLevel))
+if ((OutMarker && OutMarker->GetMarkerState() == EMarkerState::Available) || InFullChunkDataLevels.Contains(InMarker.MarkerLevel))
```

## How to Reproduce / Detect
- Build the project for Linux target (cross-compilation from Windows using Clang)
- Any `#include` with mismatched case vs. the actual filename will trigger `-Wnonportable-include-path`
- Any mixed `&&`/`||` expression without explicit parentheses will trigger `-Wlogical-op-parentheses`
- Both are promoted to errors by UE5's default `-Werror` flag

## Epic Official Guidance
- **Query**: "In UE5.5 C++ compilation for Linux, I get error: -Wnonportable-include-path because include path case does not match filename case, and error: -Wlogical-op-parentheses for && within || without parentheses. Both are -Werror. How should I fix these?"
- **Answer**: Epic confirms Linux filesystems are case-sensitive, so `#include` paths must exactly match filenames. For `-Wlogical-op-parentheses`, always add explicit parentheses when mixing `&&` and `||`. If the code is third-party and cannot be modified, use `THIRD_PARTY_INCLUDES_START`/`THIRD_PARTY_INCLUDES_END` macros or add `-Wno-error=nonportable-include-path` and `-Wno-error=logical-op-parentheses` in `.Build.cs`. For your own code, always fix the source directly.
- **References**:
  - [Module Properties](https://dev.epicgames.com/documentation/unreal-engine/module-properties-in-unreal-engine)
  - [Build Configuration](https://dev.epicgames.com/documentation/unreal-engine/build-configuration-for-unreal-engine)
  - [Linux Development Quickstart](https://dev.epicgames.com/documentation/unreal-engine/linux-development-quickstart-for-unreal-engine)
  - [Include What You Use](https://dev.epicgames.com/documentation/unreal-engine/include-what-you-use-iwyu-for-unreal-engine-programming)

## Prevention
- Always verify `#include` paths match the exact casing of the actual filename, especially for cross-platform builds
- When mixing `&&` and `||` operators, always use explicit parentheses to clarify intent
- Run Linux CI builds regularly to catch case-sensitivity issues early — they are invisible on Windows