# 诊断报告：twe-ue5.5-installed #627 构建失败

- **构建**：http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-installed/627/
- **结果**：FAILURE（Plugins Error）
- **触发**：定时器（ nightly，StartByUser: null）
- **时间**：2026-08-13 19:44:47 UTC 开始，历时 70.9 分钟（agent 本地约 2026-08-14 03:44 起）
- **执行机**：SlaveName = `twe_autoci`，引擎 `D:\Epic\UE_5.5_51`（UE 5.5 Installed/Rocket 版）
- **诊断时间**：2026-08-15，数据来源为 Jenkins REST API 与 consoleText（只读）

---

## 一、结论（TL;DR）

**失败的直接原因是 AesWorld 插件在 UnrealGame（游戏）目标下编译失败，共 4 处 MSVC C2027/C2737 编译错误，全部是"使用了仅前置声明、未包含完整定义头文件的 UE 引擎类型"：**

| 文件（均在 AesWorld 插件内） | 行号 | 错误 | 缺少完整定义的类型 | 前置声明位置 |
|---|---|---|---|---|
| `Source/AesWorldProfiling/Private/AesWorldGateScenarioController.cpp` | 122 | C2027: use of undefined type `'FViewport'` | `FViewport` | `Engine/Source/Runtime/Engine/Classes/Engine/Engine.h(38)` |
| `Source/AesWorldProfiling/Private/AesWorldGateScenarioController.cpp` | 122 | C2737: `'ViewportSize': const object must be initialized`（上一条错误的连带错误） | 同上 | 同上 |
| `Source/AesRenderResource/Private/AesRenderResourceBudgetSubsystem.cpp` | 3664 | C2027: use of undefined type `'FTextureResource'` | `FTextureResource` | `Engine/Source/Runtime/Engine/Classes/Engine/Texture.h(35)` |
| `Source/AesRenderResource/Private/AesRenderResourceBudgetSubsystem.cpp` | 3673 | C2027: use of undefined type `'FTextureResource'` | 同上 | 同上 |

UAT `BuildPlugins` 汇总：`SuccessedPlugins: AesBuilder AesBuilderAsset AesBuilderCommon AesEditor AesHoudini AesModeler AesRuntime SkyCreatorPlugin WdpCamera WdpEnvironment`，**`FailedPlugins: AesWorld`**，最终 `AutomationTool exiting with ExitCode=27 (Error_UnknownBuildFailure)`，流水线抛出 `ERROR: Build plugins failed`。

**该错误已在构建 #628 中被修复**：AesWorld 仓库 dev 分支提交 `2150b48 "提交kekins管线编译错误"`（从 `7c23a46` 更新而来）后，#628 全绿（`BUILD SUCCESSFUL`，0 个 C2027 错误）。**#627 无需再处理，重跑最新 dev 即可通过。**

---

## 二、失败位置与错误原文

### 阶段 1：AesWorld → `UnrealGame Win64 Development`（console 第 3761 行起的 UBT 调用，约第 4289-4297 行报错）

```text
[513/551] Compile [x64] Module.AesWorldProfiling.cpp
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\AesWorldProfiling\Private\AesWorldGateScenarioController.cpp(122): error C2027: use of undefined type 'FViewport'
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Engine\Classes\Engine\Engine.h(38): note: see declaration of 'FViewport'
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\AesWorldProfiling\Private\AesWorldGateScenarioController.cpp(122): error C2737: 'ViewportSize': const object must be initialized
...
[516/551] Compile [x64] Module.AesRenderResource.2.cpp
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\AesRenderResource\Private\AesRenderResourceBudgetSubsystem.cpp(3664): error C2027: use of undefined type 'FTextureResource'
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Engine\Classes\Engine\Texture.h(35): note: see declaration of 'FTextureResource'
D:\ws_twe_ue5.5_installed\PluginsOutput\Windows\HostProject\Plugins\AesWorld\Source\AesRenderResource\Private\AesRenderResourceBudgetSubsystem.cpp(3673): error C2027: use of undefined type 'FTextureResource'
```

### 阶段 2：AesWorld → `UnrealGame Win64 Shipping`（console 第 4349 行起的 UBT 调用，第 4879-4881 行报错）

```text
[515/551] Compile [x64] Module.AesRenderResource.2.cpp
...AesRenderResourceBudgetSubsystem.cpp(3664): error C2027: use of undefined type 'FTextureResource'
...AesRenderResourceBudgetSubsystem.cpp(3673): error C2027: use of undefined type 'FTextureResource'
```

### 收尾（console 第 5492-5616 行）

```text
FailedPlugins: AesWorld
 BuildPlugins failed. See log for more details.
AutomationTool executed for 0h 40m 10s
AutomationTool exiting with ExitCode=27 (Error_UnknownBuildFailure)
BUILD FAILED
...
ERROR: Build plugins failed.
```

---

## 三、根因分析

1. **错误性质**：典型的 IWYU（Include-What-You-Use）缺失问题。
   - `FViewport` 的完整定义在 `Runtime/Engine/Public/UnrealClient.h`，`Engine.h` 只做了前置声明（`class FViewport;`）。业务代码在 `AesWorldGateScenarioController.cpp:122` 对 `FViewport` 调用成员（取视口尺寸并初始化 `const` 变量 `ViewportSize`），需要完整类型，因此 C2027 + C2737（const 对象无法初始化是 C2027 的连带错误）。
   - `FTextureResource` 的完整定义在 `Runtime/RenderCore/Public/RenderResource.h`，`Texture.h` 只做了前置声明。`AesRenderResourceBudgetSubsystem.cpp:3664/3673` 对其调用成员函数同样触发 C2027。
2. **为什么只在游戏目标炸、编辑器目标没炸**：同一插件的 `UnrealEditor Win64 Development` 编译（console 第 2972 行起）通过了，错误只出现在 `UnrealGame`（Development 与 Shipping）。Editor 目标的头文件包含链会间接把 `UnrealClient.h` / `RenderResource.h` 的完整定义带进来，而裁剪后的 Game 目标没有这条间接路径——这是"编辑器能编、打包/游戏目标编不过"的经典不完整 include 问题的特征。
3. **引入源头（据 Jenkins 日志交叉验证）**：AesWorld 插件按 dev 分支浅拉取（depth=1）。
   - 最后一次成功 #618（08-06）：AesWorld @ `a2191038`（"修复loadScenNode的底板会被LOD调度清空的问题…"）
   - 首次失败 #619（08-07）：AesWorld @ `c4217813`（"修改BuildingSetting的BuildLevel的配置"）→ 同样的 C2027 错误（当时在 120 行）
   - **#627（08-13）：AesWorld @ `7c23a46f`（"Merge remote-tracking branch 'origin dev_InstanceOptimize' into dev"）→ 错误仍在（行号漂移到 122）**
   - **#628（08-14）：AesWorld @ `2150b488`（"提交kekins管线编译错误"）→ 修复，BUILD SUCCESSFUL**
   - 即：错误代码在 #618→#619 之间（08-06~08-07）合入 AesWorld dev，跨 619–627 九次构建持续报红，最终由 `2150b48` 修复。#627 只是这条失败长河中的一站，不是新问题。

---

## 四、构建历史佐证（同 Job）

| 构建 | 时间 (UTC) | 结果 | AesWorld dev commit | 说明 |
|---|---|---|---|---|
| 616-618 | 08-04~08-06 | SUCCESS | …→ `a2191038` | 最后的绿 |
| 619 | 08-07 | FAILURE | `c4217813` 修改BuildingSetting的BuildLevel的配置 | **首次出现本错误** |
| 620 | 08-08 | FAILURE | — | 同样 C2027（120 行） |
| 621 / 622 | 08-09 / 08-10 | FAILURE | — | 同样 C2027 |
| 623 | 08-11 | FAILURE | `7d07d9c` | **不同原因**：UAT SafeCopyFile "The file or directory is corrupted and unreadable"（agent 工作区/磁盘文件损坏，ExitCode=1），属环境问题 |
| 624 / 626 | — | NOT_BUILT | — | 前置失败被跳过 |
| 625 | 08-13 02:18 | ABORTED | — | 被中止 |
| **627** | **08-13 19:44** | **FAILURE** | **`7c23a46f` Merge origin dev_InstanceOptimize into dev** | **本次诊断对象，C2027×4** |
| 628 | 08-14 05:10 | SUCCESS | `2150b488` 提交kekins管线编译错误 | **修复确认：0 个 C2027，BUILD SUCCESSFUL** |

修复验证（#628 console）：

```text
Before: 7c23a46 Merge remote-tracking branch 'origin/dev_InstanceOptimize' into dev
Checking out Revision 2150b488ab4f3b63600c2222d2d6ea6862fb9a2c (refs/remotes/origin/dev)
Commit message: "提交kekins管线编译错误"
After: 2150b48 提交kekins管线编译错误
...
BUILD SUCCESSFUL
AutomationTool exiting with ExitCode=0 (Success)
```

且 #628 中 `Module.AesWorldProfiling.cpp` 在 Editor/Game Dev/Game Shipping 三个阶段全部编译通过（0 个 C2027）。

---

## 五、建议

1. **#627 本身**：无需行动。缺陷已由 AesWorld dev `2150b48`（"提交kekins管线编译错误"）修复，#628 已验证通过；如需该版本产物，直接用 #628（产物目录 `\\10.66.12.53\eci\UE5\TWEBuild\twe-ue5.5-installed\1.0.205-...-628\1.0.205`）。
2. **防复发（面向团队）**：
   - AesWorld 开发规范应补 IWYU 要求：用到 `FViewport` 就直接 `#include "UnrealClient.h"`，用到 `FTextureResource` 就 `#include "RenderResource.h"`，不要依赖 Editor 目标间接带入的头文件链；
   - 仅在编辑器/本地 IDE 编译通过不足以保证插件可打包，插件仓库 PR 至少跑一次 Game（Shipping）目标编译（本 Job 的 BuildPlugins UnrealGame 阶段正是拦住了它）；
   - 事件顺序显示错误在 #619 已出现但 5 天后才修复——建议把 FailedPlugins 的企微通知接到 AesWorld 负责人的值班响应流程，缩短红构建的修复时长。
3. **通知文案纠偏**：企微通知里的 "FailedPlugins:" 列表实际列出的是**全部插件及其 commit**，并非真正失败的插件，容易误导（真正失败的只有 `AesWorld`，以 UAT 汇总行 `FailedPlugins: AesWorld` 为准）。建议修正 Jenkins 通知模板。
4. **环境问题（与本失败无关但值得跟进）**：#623 因 agent `twe_autoci` 工作区文件损坏（"file or directory is corrupted and unreadable"，`D:\ws_twe_ue5.5_installed\PluginsOutput\...EarthMaskActionProperties.cpp`）而失败，建议对该机 D: 盘做 chkdsk 并考虑周期性清理工作区。

---

## 六、诊断局限

- Git 服务器 `10.100.10.55`（AesWorld.git 等）匿名访问被拒绝（HTTP 401 需凭据，Jenkins 用 `devopsjenkins` 凭据拉取），因此**无法直接展示 `7c23a46 → 2150b48` 的源码 diff**。修复内容（大概率是在两个 .cpp/.h 中补 `#include "UnrealClient.h"` / `#include "RenderResource.h"`）由"commit message + #628 全绿"的对照证据推断，置信度高但未逐行核实。
- UAT 完整日志（`C:\Users\Administrator\AppData\Roaming\Unreal Engine\AutomationTool\Logs\D+Epic+UE_5.5_51\Log.txt` 及 UBT_*.txt）位于构建机上，本次仅基于 Jenkins consoleText 分析；consoleText 已包含全部关键错误行，不影响结论。
- console 第 722 行的 PowerShell `Get-ChildItem PathNotFound`（`BuildPlugins\Windows` 首次不存在）为良性噪声，与失败无关。

---

## 附：证据文件（本地缓存）

- 构建 627 元数据/控制台日志、628/619/620/623/618 控制台日志（对比用）均通过 Jenkins 只读接口 `consoleText` / `api/json` 获取，未对 Jenkins 与仓库做任何写操作。
