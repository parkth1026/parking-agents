# UE 5.5 插件编译报 LNK2019：无法解析 `Z_Construct_UFunction_UMyWidget_ExecuteEvent` — 常见原因与修复步骤

> 答案来源：Epic Games 官方 AI 助手（dev.epicgames.com 社区助手，Unreal Engine 频道）实际查询结果。
> 下方"官方参考链接"均为 Epic 官方文档 / 官方学习资源，且已逐一验证可访问（HTTP 200）。
> 原始 API 返回见同目录 `result.json`（主查询）与 `result-followup.json`（追问：Live Coding / 过期生成代码场景）。

---

## 这个错误到底意味着什么

`MyWidget.gen.cpp` 是 Unreal Header Tool（UHT）为你的 `UMyWidget` 类自动生成的反射代码；`Z_Construct_UFunction_UMyWidget_ExecuteEvent` 是 UHT 为 `UFUNCTION`（此处是 `ExecuteEvent`）生成的反射 thunk（桩函数）。

错误前缀是 `__declspec(dllimport)`，说明链接器正在**从其他 DLL 导入**这个符号——它期望该符号由你插件模块的 DLL **导出**，但找不到定义。本质上只有两类根因：

1. 符号根本没有被导出（缺少模块 API 导出宏）；
2. 生成代码与你的源码不同步（陈旧的 `.gen.cpp`，或 Live Coding / 热重载残留）。

---

## 常见原因（按官方助手给出的可能性排序）

### 原因 1：类声明缺少模块 API 导出宏（最常见）

`MYPLUGIN_API`（= 模块名全大写 + `_API`）控制 `__declspec(dllexport)` / `__declspec(dllimport)`。缺少该宏时，`.gen.cpp` 里的 `Z_Construct…` 系列符号不会被导出，跨模块（或同模块 DLL 边界）链接即报 LNK2019。

修复——在类声明上加导出宏（拼写必须与模块名完全一致）：

```cpp
// MyWidget.h
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "MyWidget.generated.h"

// 模块名为 MyPlugin → 宏是 MYPLUGIN_API
UCLASS()
class MYPLUGIN_API UMyWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    // 这个函数会在 .gen.cpp 里生成 Z_Construct_UFunction_UMyWidget_ExecuteEvent
    UFUNCTION(BlueprintCallable, Category = "Events")
    void ExecuteEvent();
};
```

### 原因 2：Build.cs 模块依赖缺失

`UMyWidget` 继承自 `UUserWidget`，模块必须显式依赖 `UMG`、`Slate`、`SlateCore`，否则与控件层级/反射数据相关的符号解析会失败。

```csharp
// MyPlugin.Build.cs
PublicDependencyModuleNames.AddRange(new string[]
{
    "Core", "CoreUObject", "Engine", "InputCore",
    "UMG",       // UUserWidget 必需
    "Slate", "SlateCore"
});
```

### 原因 3：UHT 生成代码过期（Intermediate 不同步）

重命名类/函数、改动 `UFUNCTION` 签名、移动文件之后，`Intermediate` 里的陈旧 `.gen.cpp` 仍会引用已不存在或签名不符的符号。此类结构性改动也不被 Live Coding 完全支持（详见原因 5）。

### 原因 4：函数实现问题

- `UFUNCTION` 声明了但 `.cpp` 里没有实现体；
- 函数被定义成 `inline` 或整体写在头文件里，UHT 生成的 thunk 期望链接一个常规非 inline 符号；
- 想让蓝图实现该事件，却没用 `BlueprintImplementableEvent`（该情况下**不要**提供 C++ 函数体）；
- `.h` 与 `.cpp` 的签名不完全一致（包括 `const` 限定符）。

### 原因 5：Live Coding / 热重载（Hot Reload）的固有限制

官方 Live Coding 文档明确：Live Coding 主要面向 `.cpp` 内的逻辑改动；修改 `UCLASS` / `UFUNCTION` / `USTRUCT` / `UENUM` 等结构性头文件变更**不受完整支持**。重命名类或函数后，UHT 生成新的反射符号（`Z_Construct_…`），Live Coding 无法把它们可靠地重绑定到正在运行的编辑器进程，于是出现"无法解析的外部符号"。

---

## 推荐修复步骤（按顺序执行）

1. **查导出宏**：确认 `class MYPLUGIN_API UMyWidget`，宏拼写与模块名一致。
2. **查 Build.cs**：确认 `PublicDependencyModuleNames` 含 `"UMG"`（UUserWidget 子类还需要 `Slate`、`SlateCore`）。
3. **查函数实现**：`ExecuteEvent` 在 `.cpp` 中有与头文件完全一致的实现；不要 `inline`；若为蓝图实现事件改用 `BlueprintImplementableEvent` 且不写 C++ 函数体。
4. **深度清理并冷重建**（Epic 官方推荐流程）：
   1. 关闭 Unreal Editor、Visual Studio/Rider，并确认 `LiveCodingConsole.exe` 也已退出；
   2. 删除**项目根目录**和**插件目录**下的 `Binaries/` 与 `Intermediate/`（结构性大改时建议连 `DerivedDataCache/` 一起删）；
   3. 右键 `.uproject` → **Generate Visual Studio project files**，强制 UBT 重新扫描头文件、重建 UHT 清单；
   4. 打开 `.sln` 执行 **Rebuild**（重新生成，不是 Build），让 UHT 从零生成正确的 `Z_Construct` 符号。
5. **预防**：以后做结构性改动（新增/重命名 `UFUNCTION`、改 `UPROPERTY` 说明符、重命名类）时，先关闭 Live Coding，改完冷编译并重启编辑器；插件开发优先用 Live Coding（Ctrl+Alt+F11）而非旧版编辑器 Compile 按钮的热重载，但两者都不能替代冷启动。

---

## 官方参考链接

| 标题 | 链接 | 说明 |
|---|---|---|
| Module API Specifiers | https://dev.epicgames.com/documentation/unreal-engine/module-api-specifiers-in-unreal-engine | `MODULENAME_API` 宏如何等价于 `dllexport`/`dllimport`；缺失它即 LNK2019 首因 |
| Unreal Header Tool | https://dev.epicgames.com/documentation/unreal-engine/unreal-header-tool-for-unreal-engine | UHT 解析 `UFUNCTION` 等宏并生成 `Z_Construct` thunk 的机制 |
| Live Coding（官方文档） | https://dev.epicgames.com/documentation/unreal-engine/using-live-coding-to-recompile-unreal-engine-applications-at-runtime | 运行时重编译/打补丁的官方说明与限制 |
| Live Coding Primer（官方社区知识库） | https://dev.epicgames.com/community/learning/knowledge-base/GDdl/unreal-engine-live-coding-primer | 头文件/结构性变更的常见问题（Common Issues） |

---

## 一句话总结

这个错误几乎总是意味着"`Z_Construct…` 符号没有从你插件的 DLL 导出，或 `.gen.cpp` 已过期"：先补 `MYPLUGIN_API` 导出宏与 `UMG` 依赖，再删 `Binaries`/`Intermediate` 后重新生成工程文件并 Rebuild；若是在 Live Coding/热重载后出现，按官方建议冷编译重启。
