# Multiple Missing Includes in AesWorld — C2027 ULevel, C2653 FPaths, C7568 TJsonWriter

> **Score**: 10/10 | **Job**: installed (twe-ue5.5-installed) | **Date**: 2026-04-10
> **Builds**: #381 (FAILURE) → #384 (SUCCESS) — also covers #382, #383
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Message

Three distinct errors across three files in AesWorld:

**File 1 — AesTerrainEditorAction_FlattenPolygon.cpp(1496):**
```
error C2027: use of undefined type 'ULevel'
error C2143: syntax error: missing ';' before ':'
error C2143: syntax error: missing ';' before ')'
```

**File 2 — AesWdpChangesetTest.cpp(135):**
```
error C7568: argument list missing after assumed function template 'TCondensedJsonPrintPolicy'
error C3203: 'TJsonWriter': unspecialized class template can't be used as a template argument for template parameter 'ObjectType', expected a real type
error C2955: 'TJsonWriterFactory': use of class template requires template argument list
error C2672: 'FJsonSerializer::Serialize': no matching overloaded function found
```

**File 3 — EarthAssistantActor.cpp(115):**
```
error C2653: 'FPaths': is not a class or namespace name
error C3861: 'Combine': identifier not found
error C2653: 'FPaths': is not a class or namespace name
error C3861: 'DirectoryExists': identifier not found
```

## Root Cause

Three separate `.cpp` files in AesWorld were introduced or modified without including the correct UE5.5 IWYU headers:

1. **AesTerrainEditorAction_FlattenPolygon.cpp**: A new polygon terrain flatten tool was added that iterates `Level->Actors`. The full `ULevel` definition requires `Engine/Level.h`, which was not included.

2. **AesWdpChangesetTest.cpp**: A changeset serialization test uses `TJsonWriter<>`, `TJsonWriterFactory<>`, and `FJsonSerializer::Serialize()`. These require `Serialization/JsonSerializer.h` and `Serialization/JsonWriter.h` with template arguments. While `JsonWriter.h` was included twice (duplicate), `JsonSerializer.h` was missing, causing the template instantiation to fail.

3. **EarthAssistantActor.cpp**: The actor uses `FPaths::Combine()` and `FPaths::DirectoryExists()` without including `Misc/Paths.h`. Under IWYU, `FPaths` is not transitively available.

All three failures were introduced by the same AesWorld commit `2203de9` ("优化AesObject属性访问性能") which added new code paths touching these files but did not add the required includes.

## Fix

- **Commit**: `4b4df900113f704875e02d066be6c23a67cff335` by luwei (luwei01@51aes.com)
- **Message**: "关闭报错的问题"
- **What changed** (three separate hunks):

```diff
--- a/Source/AesMarkerSystem/Private/DataLayer/Changeset/AesWdpChangesetTest.cpp
+++ b/Source/AesMarkerSystem/Private/DataLayer/Changeset/AesWdpChangesetTest.cpp
@@ -10,10 +10,11 @@
 #include "Serialization/JsonSerializer.h"
 #include "Serialization/JsonWriter.h"
 #include "Misc/AutomationTest.h"
 #include "Runtime/Launch/Resources/Version.h"
 #include "Serialization/JsonWriter.h"
+#include "Serialization/JsonSerializer.h"

--- a/Source/Editor/AesEditorMode/Private/Actions/Terrain/AesTerrainEditorAction_FlattenPolygon.cpp
+++ b/Source/Editor/AesEditorMode/Private/Actions/Terrain/AesTerrainEditorAction_FlattenPolygon.cpp
@@ -21,10 +21,11 @@
 #include "Transaction/AesRasterEditingTransaction.h"
 #include "Utils/AesGameplayStatics.h"
 #include "Materials/MaterialParameterCollection.h"
 #include "Math/UnrealMathUtility.h"
+#include "Engine/Level.h"

--- a/Source/Editor/AesEditorMode/Private/EarthAssistantActor.cpp
+++ b/Source/Editor/AesEditorMode/Private/EarthAssistantActor.cpp
@@ -17,10 +17,11 @@
 #include "Serialization/JsonSerializer.h"
 #include "HAL/PlatformFileManager.h"
 #include "Tracks/MovieSceneFloatTrack.h"
 #include "Algo/Reverse.h"
 #include "DataLayer/Raster/AesRasterMaskDataLayer.h"
+#include "Misc/Paths.h"
 #include "Runtime/Launch/Resources/Version.h"
```

## How to Reproduce / Detect

Pattern: a commit adds new code that uses UE5.5 types without adding the corresponding `#include`:
- Accessing `Level->Actors` or any `ULevel` member → needs `#include "Engine/Level.h"`
- Using `FPaths::Combine()`, `FPaths::DirectoryExists()`, etc. → needs `#include "Misc/Paths.h"`
- Using `TJsonWriter<>`, `TJsonWriterFactory<>` → needs `#include "Serialization/JsonWriter.h"` (template arguments required); `FJsonSerializer::Serialize()` needs `#include "Serialization/JsonSerializer.h"`

## Epic Official Guidance

**Query 1** (C2653 FPaths):
- **Query**: "UE5.5 C++ compilation error C2653: 'FPaths' is not a class or namespace name in EarthAssistantActor.cpp line 115, and C3861: 'Combine' identifier not found."
- **Answer**:
  > In UE5.5, `FPaths` resides in the **Core** module specifically in the `Misc` folder. Under IWYU, ubiquitous headers like `Engine.h` are no longer included by default. Add `#include "Misc/Paths.h"` to your `.cpp` file.
  >
  > C2653 means the compiler encountered `FPaths::` but doesn't recognize `FPaths` as a valid type because its definition hasn't been provided to the translation unit. C3861 cascades because the scope failed to resolve.
  >
  > **Best Practices for IWYU in UE5.5**: Always include the specific header for each class used. Do not try to fix by including `Engine.h` or `Core.h` — this increases compile times and violates IWYU standards.
- **References**:
  - [Include What You Use (IWYU)](https://dev.epicgames.com/documentation/unreal-engine/include-what-you-use-iwyu-for-unreal-engine-programming)
  - [Epic C++ Coding Standard](https://dev.epicgames.com/documentation/unreal-engine/epic-cplusplus-coding-standard-for-unreal-engine)

**Query 2** (C2027 ULevel — see also knowledge file installed-377-379-C2027-ULevel-AesTerrainRamp.md for detailed guidance):
> Add `#include "Engine/Level.h"` to any `.cpp` that accesses `ULevel` member variables.

## Prevention

- When code review encounters new usage of `ULevel*` members, `FPaths::`, or JSON serialization templates, verify the correct IWYU includes are present in the same commit.
- Keep a cheat-sheet of common UE5.5 IWYU mappings:
  - `ULevel` → `Engine/Level.h`
  - `FPaths` → `Misc/Paths.h`
  - `TJsonWriter` / `TJsonWriterFactory` → `Serialization/JsonWriter.h`
  - `FJsonSerializer` → `Serialization/JsonSerializer.h`
- CI pipeline errors caused by missing includes in a feature branch indicate the developer did not compile locally with the full IWYU enforcement before pushing.
