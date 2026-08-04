# C2143 / C4430: Missing Forward Declarations in SkyCreatorActor.h

> **Score**: 10/10 | **Job**: installed (twe-ue5.5-installed) | **Date**: 2026-04-10
> **Builds**: #372 (FAILURE) → #376 (SUCCESS) — also covers #373, #374, #375
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Message

```
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\SkyCreatorPlugin\Source\SkyCreatorPlugin\Public\SkyCreatorActor.h(144): error C2143: syntax error: missing ';' before '*'
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\SkyCreatorPlugin\Source\SkyCreatorPlugin\Public\SkyCreatorActor.h(144): error C4430: missing type specifier - int assumed. Note: C++ does not support default-int
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\SkyCreatorPlugin\Source\SkyCreatorPlugin\Public\SkyCreatorActor.h(144): error C2238: unexpected token(s) preceding ';'
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\SkyCreatorPlugin\Source\SkyCreatorPlugin\Public\SkyCreatorActor.h(153): error C2143: syntax error: missing ';' before '*'
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\SkyCreatorPlugin\Source\SkyCreatorPlugin\Public\SkyCreatorActor.h(168): error C2143: syntax error: missing ';' before '*'
```
Additional cascade errors in SkyCreatorActor.gen.cpp: C2039 ('SkyLight' is not a member of 'ASkyCreator'), C2618, C2737 for members SkyLight, ExponentialHeightFog, OcclusionCapture.

Also TOD_Base.h(535): error C2143 missing ';' before '*' (UAudioComponent* member).

## Root Cause

`SkyCreatorActor.h` declares UPROPERTY members of types `USkyLightComponent*`, `UExponentialHeightFogComponent*`, and `USceneCaptureComponent2D*` without forward declaring those classes. Similarly `TOD_Base.h` declares `UAudioComponent*` without a forward declaration.

When these headers are included in translation units that do not transitively include the full class definitions, the compiler sees pointer-to-unknown-type at the `*` symbol and reports C2143 ("missing ';' before '*'"), C4430 ("missing type specifier"), and C2238. The cascade gen.cpp errors (C2039 — member not found) occur because UHT generates code referencing those members, but the compiler cannot resolve the class layout.

The failing SkyCreatorPlugin commit was `dccf034` ("添加打包缺失报错的几处include") which added `#include`s to `.cpp` files but did not add the required forward declarations to the `.h` files that declare the pointer members.

## Fix

- **Commit**: `b5d1d0aa0a1742aba589e76dc0c7b1a03afa30c5` by luwei (luwei01@51aes.com)
- **Message**: "编译不过的问题"
- **What changed**:

```diff
--- a/Source/SkyCreatorPlugin/Class/TOD_Base.h
+++ b/Source/SkyCreatorPlugin/Class/TOD_Base.h
@@ -11,10 +11,11 @@
 #include "Materials/MaterialParameterCollection.h"
 #include "TOD_Base.generated.h"
 
 #define DEPRECATE_TIMESECTION false
 
+class UAudioComponent;

--- a/Source/SkyCreatorPlugin/Public/SkyCreatorActor.h
+++ b/Source/SkyCreatorPlugin/Public/SkyCreatorActor.h
@@ -19,10 +19,13 @@
 #include "SkyCreatorActor.generated.h"
 
 class UBillboardComponent;
+class USkyLightComponent;
+class UExponentialHeightFogComponent;
+class USceneCaptureComponent2D;
```

Three forward class declarations were added before the UCLASS body — one per pointer member type that was missing from the header.

## How to Reproduce / Detect

- A header file declares `UFoo* Member;` as a UPROPERTY without `#include "FooHeader.h"` or `class UFoo;` forward declaration above the `GENERATED_BODY()` macro.
- The compilation unit including that header does not happen to pull in the full definition through another include chain.
- Symptom: C2143 at the line with `UFoo*`, followed by C4430, C2238, and then C2039/"not a member" errors in the UHT-generated `.gen.cpp` for any UPROPERTY of that type.

## Epic Official Guidance

- **Query**: "UE5.5 C++ compilation error C2143 in SkyCreatorActor.h line 144: syntax error missing ';' before '*'. Also C4430: missing type specifier. The errors are caused by pointer members (USkyLightComponent*, UExponentialHeightFogComponent*, USceneCaptureComponent2D*) declared without forward declarations."
- **Answer**:
  > When you declare a pointer to a class like `USkyLightComponent* SkyLight;` in your header, the compiler must already know that `USkyLightComponent` is a class — otherwise it can't parse `USkyLightComponent*` at all. If it hasn't seen a definition or forward declaration, it reports a syntax error at the `*` and says "missing type".
  >
  > **C++ Solution**: Forward declare UE types you reference only as pointers or references in your header file. Keep heavy `#include`s out of headers unless absolutely required, to reduce compile times and avoid circular dependencies.
  >
  > Add forward declarations at the top of your header (after `#pragma once` and module includes, before `.generated.h`):
  > ```cpp
  > class USkyLightComponent;
  > class UExponentialHeightFogComponent;
  > class USceneCaptureComponent2D;
  > ```
  > In your `.cpp` file, `#include` the real headers when you need to call methods or construct these components.
  >
  > Note: All these classes are UObject-based and do not require additional module dependencies; the Engine module is sufficient.
- **References**:
  - [Gameplay Classes in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/gameplay-classes-in-unreal-engine)

## Prevention

- When adding a new pointer UPROPERTY of type `UFoo*` to a header, always add `class UFoo;` as a forward declaration in the same header if you are not including `UFoo.h` there.
- Follow IWYU (Include What You Use): headers should be self-contained but lightweight — forward declare rather than include when only pointers/references are needed.
- In code review, check that every `UFoo*` member in a `.h` file has either an `#include "UFoo.h"` or a `class UFoo;` forward declaration in the same file.
