# C7568 + C2027 + C3203: Test File Template Error and Missing UStaticMesh Include

> **Score**: 10/10 | **Job**: installed | **Date**: 2026-02-05
> **Builds**: #389, #390, #391, #392, #393, #394, #395 (FAILURE) → #396 (SUCCESS)
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Messages

```
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\AesMarkerSystem\Private\DataLayer\Changeset\AesWdpChangesetTest.cpp(136): error C7568: argument list missing after assumed function template 'TCondensedJsonPrintPolicy'
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\AesMarkerSystem\Private\DataLayer\Changeset\AesWdpChangesetTest.cpp(136): error C3203: 'TJsonWriter': unspecialized class template can't be used as a template argument for template parameter 'ObjectType', expected a real type
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\AesMarkerSystem\Private\DataLayer\Changeset\AesWdpChangesetTest.cpp(136): error C2955: 'TJsonWriterFactory': use of class template requires template argument list
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\AesMarkerSystem\Private\DataLayer\Changeset\AesWdpChangesetTest.cpp(137): error C2672: 'FJsonSerializer::Serialize': no matching overloaded function found
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\EarthPrefab\Private\Fragment\EarthMeshFragment.cpp(35): error C2027: use of undefined type 'UStaticMesh'
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\EarthPrefab\Private\Fragment\EarthMeshFragment.cpp(38): error C2027: use of undefined type 'UStaticMesh'
```

## Root Cause

Two separate issues introduced simultaneously:

1. **C7568/C3203 in AesWdpChangesetTest.cpp**: A test file for WDP changeset serialization used `TJsonWriter` and `TCondensedJsonPrintPolicy` as template arguments without providing their required template parameter lists. In the UE5 JSON API, these are templates that must be specialized (e.g. `TJsonWriter<TCHAR>`). Using the bare unspecialized template name as an argument caused C7568 ("argument list missing after assumed function template") and C3203 ("unspecialized class template can't be used as template argument"). The test file also had duplicate includes.

2. **C2027 in EarthMeshFragment.cpp**: The file used `UStaticMesh` (calling methods on it) without including `"Engine/StaticMesh.h"`. Under IWYU, only a forward declaration `class UStaticMesh` was visible, which is not sufficient for method calls.

## Fix

- **Commit**: `bc93e119` by luwei
- **Message**: "管线编译报错的问题" (Pipeline compilation error)
- **What changed**:

```diff
// AesWdpChangesetTest.cpp — File DELETED entirely
// The test file contained broken template usage of TJsonWriter and TJsonWriterFactory
// without providing required template argument lists. Resolution: remove the broken test file.
- AesWdpChangesetTest.cpp (206 lines, entire file deleted)

// EarthMeshFragment.cpp — Added missing static mesh include:
+#include "Engine/StaticMesh.h"

// AesMarkerTexture.cpp — Added missing rendering thread include:
+#include "RenderingThread.h"
```

## How to Reproduce / Detect

- Errors C7568 + C3203 on lines using `TJsonWriter`, `TJsonWriterFactory`, `TCondensedJsonPrintPolicy` without angle brackets `<>` — these are templates requiring explicit type specialization
- C2027 on `UStaticMesh` usage means `Engine/StaticMesh.h` is missing; the forward declaration is not enough when calling methods on the object
- Watch for test files in plugin source that include JSON serialization headers — they may have template usage issues

## Epic Official Guidance

Epic query not performed for this entry (C7568 is a MSVC-specific template diagnostic; root cause is clear from the diff).

For C2027 `UStaticMesh`: IWYU policy requires `#include "Engine/StaticMesh.h"` whenever code dereferences `UStaticMesh` pointers. A forward declaration `class UStaticMesh;` is only sufficient for pointers/references that are not dereferenced. See: https://dev.epicgames.com/documentation/unreal-engine/include-what-you-use-iwyu-for-unreal-engine-programming

## Prevention

- Never use bare template names (without `<>`) as template arguments — always specialize: `TJsonWriter<>` or `TJsonWriter<TCHAR>`
- When writing test files that use complex UE templates like `TJsonWriterFactory`, compile-check them early before merging to CI-tracked branches
- For any `.cpp` file that accesses `UStaticMesh` methods, add `#include "Engine/StaticMesh.h"` — do not rely on transitive includes from other headers
