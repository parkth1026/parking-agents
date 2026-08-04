# C2027 + C2065 + C2280: Missing Engine Includes After Cross-Platform Linux Fix

> **Score**: 10/10 | **Job**: installed | **Date**: 2026-01-06
> **Builds**: #353, #354, #355, #356, #358 (FAILURE) → #359 (SUCCESS)
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Messages

```
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\Editor\AesEditorMode\Private\Property\AesEntityPropertyProxy.cpp(52): error C2027: use of undefined type 'UWorld'
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\Editor\AesEditorMode\Private\Property\AesEntityPropertyProxy.cpp(57): error C2027: use of undefined type 'UWorld'
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\EarthStats\Private\EarthDebugHud.cpp(243): error C2027: use of undefined type 'UGameViewportClient'
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\EarthStats\Private\EarthDebugHud.cpp(1021): error C2065: 'GWhiteTexture': undeclared identifier
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\EarthStats\Private\EarthDebugHud.cpp(1021): error C2280: 'FDrawBuffers::FTileItem::FTileItem(void)': attempting to reference a deleted function
```

## Root Cause

A Linux pipeline fix commit (`4544041` "管线Linux编译不过的问题") changed `AesPOIModule.cpp` to fix case-sensitive include `AesPoiModule.h` → `AesPOIModule.h` for Linux. That commit was unrelated to EarthDebugHud.cpp/AesEntityPropertyProxy.cpp, but at the same point those files lacked explicit includes for `Engine/GameViewportClient.h`, `RenderUtils.h`, and `Engine/World.h`.

Under UE5's IWYU (Include What You Use) policy, each file must include all headers for every type it uses. When the incremental build was triggered by the Linux fix commit on the Windows Installed CI, the PCH cache was partially invalidated, exposing that these files depended on transitive includes from other headers rather than explicit ones. The C2280 error on `FTileItem` was caused by aggregate initialization syntax `= {args}` being used for a type whose default constructor was deleted — fixed by using direct initialization `{args}` instead.

## Fix

- **Commit**: `250aa7ee` by zhuyuekai
- **Message**: "修复5.5Installed包报错" (Fix 5.5 Installed package errors)
- **What changed**:

```cpp
// EarthDebugHud.cpp — Added missing includes:
+#include "Engine/GameViewportClient.h"
+#include "RenderUtils.h"

// AesEntityPropertyProxy.cpp — Added missing include:
+#include "Engine/World.h"

// EarthDebugHud.cpp — Fixed deleted-constructor usage (C2280):
// BEFORE (copy-initialization syntax — fails when default ctor is deleted):
-FDrawBuffers::FTextItem TextItem = {WorldPosition, FText::FromString(Text), ...};
-FDrawBuffers::FTileItem TileItem = {WorldPosition, GWhiteTexture, ...};
// AFTER (direct-initialization — works even without default ctor):
+FDrawBuffers::FTextItem TextItem {WorldPosition, FText::FromString(Text), ...};
+FDrawBuffers::FTileItem TileItem {WorldPosition, GWhiteTexture, ...};
```

## How to Reproduce / Detect

- A developer fixes a Linux include case-sensitivity issue; Windows CI fails on the next build with C2027 on types like `UWorld`, `UGameViewportClient`
- Errors point to `.cpp` files that are missing explicit includes but previously compiled via transitive PCH inclusions
- Also watch for C2280 "attempting to reference a deleted function" on struct constructors — often caused by copy-initialization `= {args}` vs direct-initialization `{args}`

## Epic Official Guidance

- **Query**: "UE5.5 C++ compilation error C2027 'use of undefined type UWorld' and C2065 'GWhiteTexture undeclared identifier' in plugin source files. The errors occur because Engine/GameViewportClient.h and RenderUtils.h and Engine/World.h includes are missing. What causes these errors and how to fix them in UE5 plugin code?"
- **Answer**: Epic confirms these are IWYU violations. Under UE5's Include What You Use policy, large monolithic headers like `Engine.h` are no longer auto-included. Each file must explicitly include headers for every type it references. For `UWorld` add `#include "Engine/World.h"`, for `UGameViewportClient` add `#include "Engine/GameViewportClient.h"`, and for `GWhiteTexture` add `#include "RenderUtils.h"`. Also ensure your plugin's Build.cs lists `"Engine"` and `"RenderCore"` in dependency module names.
- **References**:
  - Include What You Use: https://dev.epicgames.com/documentation/unreal-engine/include-what-you-use-iwyu-for-unreal-engine-programming
  - Using Slate In-Game: https://dev.epicgames.com/documentation/unreal-engine/using-slate-in-game-in-unreal-engine

## Prevention

- After any cross-platform fix commit (Linux/Windows case sensitivity), immediately rebuild the Windows Installed CI to catch IWYU violations exposed by PCH cache invalidation
- Use direct-initialization `T obj{args};` instead of copy-initialization `T obj = {args};` for types with explicit constructors or deleted default constructors — this prevents C2280
- Periodically run with `-DisableUnity` build flag to catch transitive include dependencies that hide IWYU violations
