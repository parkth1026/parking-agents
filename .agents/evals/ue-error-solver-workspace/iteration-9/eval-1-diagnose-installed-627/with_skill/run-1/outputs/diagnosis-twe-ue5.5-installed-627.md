# 诊断报告：twe-ue5.5-installed #627 构建失败

- **Jenkins 构建**：[twe-ue5.5-installed #627](http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-installed/627/)
- **构建结果**：FAILURE（AutomationTool `ExitCode=27 Error_UnknownBuildFailure`），总耗时约 70.9 分钟，其中 UAT BuildPlugins 阶段 40m10s
- **失败插件**：仅 **AesWorld**（其余 10 个插件 AesBuilder / AesBuilderAsset / AesBuilderCommon / AesEditor / AesHoudini / AesModeler / AesRuntime / SkyCreatorPlugin / WdpCamera / WdpEnvironment 全部编译成功）
- **AesWorld CI commit**：`dev @ 7c23a46f`（"Merge remote-tracking branch 'origin/dev_InstanceOptimize' into dev"，chenwenjie，2026-08-13 19:27 +08）
- **引擎**：UE 5.5 Installed Build（`D:\Epic\UE_5.5_51`，UBT 带 `-installed` 参数），流水线为 UAT BuildPlugins 逐插件调用 UBT
- **诊断结论**：该问题**已在上游修复**——修复 commit `2150b488`（2026-08-14）落地后，#628 已于 2026-08-14 构建 SUCCESS

> 注：构建完成时企业微信通知里的 "FailedPlugins" 字段列出了 6 个插件及其 commit，那是**本次变更的插件清单**，不是失败清单。日志中的权威结论是 `SuccessedPlugins: ... FailedPlugins: AesWorld`，仅 AesWorld 失败。

## 错误摘要

提取到 **2 组独立编译错误**（同组错误在 UnrealEditor Win64 Development 与 UnrealGame Win64 Development 两个 target 重复出现，属同一问题的重复编译，非新错误）：

| # | 文件 | 行 | 错误码 | 信息 |
|---|------|----|--------|------|
| 1 | `AesWorld/Source/AesWorldProfiling/Private/AesWorldGateScenarioController.cpp` | 122 | C2027 | use of undefined type `'FViewport'`（note: 见 `Engine/Classes/Engine/Engine.h(38)` 前置声明） |
| 1b | 同上 | 122 | C2737 | `'ViewportSize': const object must be initialized`（#1 的级联错误） |
| 2 | `AesWorld/Source/AesRenderResource/Private/AesRenderResourceBudgetSubsystem.cpp` | 3664, 3673 | C2027 | use of undefined type `'FTextureResource'`（note: 见 `Engine/Classes/Engine/Texture.h(35)` 前置声明） |

## 诊断 1：error C2027 — AesWorldGateScenarioController.cpp

**错误信息**：

```
AesWorldGateScenarioController.cpp(122): error C2027: use of undefined type 'FViewport'
Engine\Source\Runtime\Engine\Classes\Engine\Engine.h(38): note: see declaration of 'FViewport'
AesWorldGateScenarioController.cpp(122): error C2737: 'ViewportSize': const object must be initialized
```

**根因分析**：出错的源码（CI commit `7c23a46` 处，经 GitLab API 取回）：

```cpp
const FIntPoint ViewportSize = GEngine->GameViewport->Viewport->GetSizeXY();  // L122
```

该文件已 include `Engine/GameViewportClient.h`，因此 `UGameViewportClient` 是完整类型，`->Viewport` 成员访问合法；但 `GameViewportClient.h` 对 `FViewport` 只有**前置声明**（指针可用，成员调用不可用）。对前置声明类型调用 `GetSizeXY()` 需要 `FViewport` 的完整定义，而该文件缺少提供完整定义的头文件 `UnrealClient.h`，MSVC 报 C2027；`GetSizeXY()` 返回值无法构造，进而级联出 C2737。这是 IWYU（Include What You Use）问题：源码构建/编辑器环境下该定义经 PCH 或传递包含"泄漏"进来，Installed Build（`-installed`）编译隔离更严格、PCH 更精简，缺失的 include 即暴露为编译错误。

**置信度**：高（三重证据相互印证，见下）

## 诊断 2：error C2027 — AesRenderResourceBudgetSubsystem.cpp

**错误信息**：

```
AesRenderResourceBudgetSubsystem.cpp(3664): error C2027: use of undefined type 'FTextureResource'
Engine\Source\Runtime\Engine\Classes\Engine\Texture.h(35): note: see declaration of 'FTextureResource'
AesRenderResourceBudgetSubsystem.cpp(3673): error C2027: use of undefined type 'FTextureResource'
```

**根因分析**：出错的源码（CI commit `7c23a46` 处）：

```cpp
if (FTextureResource* Resource = FarShadowMaskTexture->GetResource();   // L3663
    Resource && Resource->TextureRHI.IsValid())                        // L3664 <- 报错
...
FarShadowViewExtension->SetMask_GameThread(Resource->TextureRHI, Parameters);  // L3673 <- 报错
```

文件 include 了 `Engine/Texture2D.h`，但 `Texture.h` 对 `FTextureResource` 只有前置声明。`GetResource()` 返回指针不需要完整定义，**解引用 `Resource->TextureRHI` 需要**。`FTextureResource` 的完整定义在 `TextureResource.h`（基类 `FRenderResource` 在 `RenderResource.h`），该文件缺失此 include，Installed Build 下即报 C2027。与诊断 1 同属 IWYU 缺 include 模式。

**置信度**：高（三重证据相互印证，见下）

## 证据（Phase 2 检查清单）

| 步骤 | 状态 | 结果 |
|---|---|---|
| 2.1 源码 | 已完成 | CI commit 处两文件源码 + include 清单 + git blame（经 GitLab API，见降级说明） |
| 2.2 知识库 | 已完成 | 搜索词 `C2027,FViewport` / `C2027,FTextureResource`，评分 **6/10** |
| 2.3 Epic 助手 | 已完成 | 两个错误分别查询，结论与实际修复逐字吻合 |
| 2.4 Web 搜索 | 已跳过 | Epic 已给出明确修复且被仓库实际修复 commit 验证（技能规则允许跳过） |

- **源码上下文**：
  - 本地 `D:\Git\AesWorld`（dev 分支）**落后于 CI**（本地 budget subsystem 仅 1773 行，CI 版本约 3700 行），`git fetch` 因凭据不可用失败，改用 GitLab API 只读取回 CI commit `7c23a46` 的两份源文件、blame 与对比（见"降级说明"）。
  - blame 结果：错误行引入者为 luwei 的两个提交——L122 来自 `495fe84e`（"aesworld gate 第一阶段实现性能测试…"，2026-08-07 16:54 +08）；L3663-3673 来自 `d675f961`（"通过远处禁用vsm阴影…提升fps"，2026-08-07 09:51 +08）。
  - **引入/修复闭环（最强证据）**：#618（08-06）SUCCESS → luwei 两提交落地（08-07）→ #619 起连续红（#619–#623，错误与 #627 完全相同，gate 行号当时为 120）→ #627 仍红（期间的 `dev_InstanceOptimize` merge `7c23a46` 并未触碰这两个文件）→ `2150b488`（luwei，2026-08-14 12:31 +08，"提交kekins管线编译错误"）恰好只给这两个文件补上缺失 include → **#628（08-14）SUCCESS**。
  - 实际修复 diff（GitLab API 取回）：`AesWorldGateScenarioController.cpp` 增加 `#include "UnrealClient.h"`；`AesRenderResourceBudgetSubsystem.cpp` 增加 `#include "TextureResource.h"`。
- **知识库**（评分 6/10）：
  - `jenkins-learnings/index.md` 引用条目 `twe-installed-313-316-C2027-FTextureResource`——**同一 job、同错误码、同类型** FTextureResource 曾在 #313–#316 出现（说明此类问题在本流水线已不是第一次）；但其详情文件已缺失（index 链接失效，raw 目录无原文），无法取用修复细节，故评分未达 8。
  - `details/077-installed-build-umaterial-forward-declaration-missing.md`（质量分 7.5/10）：同机制先例——Installed Build 下 `UMaterial` 前置声明不足以支撑成员调用（C2027/C2039/C2665），明确记录"**源码构建经 PCH/传递包含间接获得完整定义、Installed Build 编译隔离更严格**"的机制。
  - 本地仓库另有同模式先例：`2ea91f964`（"fix(AesEarth): C2027 FTexture2DMipMap undefined - add TextureResource.h include for UE 5.5"，build 561 修复），同样靠补 `TextureResource.h` 解决。
- **Epic 指引**（dev.epicgames.com 官方助手，两错误分别独立查询）：
  - FViewport：`GameViewportClient.h` 只前置声明 `FViewport`，完整定义在 `UnrealClient.h`；Installed Build 的 PCH 更精简、严格 IWYU，源码构建中"泄漏"进翻译单元的定义不再可用——与实际修复**逐字一致**。
  - FTextureResource：`Texture.h`/`Texture2D.h` 只前置声明，访问 `TextureRHI` 需完整定义，应 include `TextureResource.h`（`RenderResource.h` 只给基类 `FRenderResource`，不够）——与实际修复**逐字一致**。

## 修复建议

**该问题已在 dev 分支修复（`2150b488`），无需再改**：#628 已验证 SUCCESS。修复内容（供其他分支/队列 cherry-pick 参考或 code review 留档）：

```cpp
// Source/AesWorldProfiling/Private/AesWorldGateScenarioController.cpp
#include "TraceSessionController.h"
+#include "UnrealClient.h"     // FViewport 完整定义（原只有 Engine.h 的前置声明）

// Source/AesRenderResource/Private/AesRenderResourceBudgetSubsystem.cpp
 #include "Engine/Texture2D.h"
+#include "TextureResource.h"  // FTextureResource 完整定义（原只有 Texture.h 的前置声明）
```

预防措施：
1. 任何对引擎类型**解引用/成员调用**（`->` 或 `.`）的代码，必须显式 include 提供完整定义的头（IWYU），不要依赖 PCH 或传递包含——本地编辑器源码构建能过不代表 Installed 流水线能过（本流水线同一错误已是第二次大规模出现：#313–316、#561、#619–#627）。
2. 建议在 PR 模板/CI 中加入对新增 `error C2027` 的知识库模式提示（`patterns/error-patterns.md` 已有该模式沉淀）。

## 时间线

| 时间 (+08) | 事件 |
|---|---|
| 08-06 | #618 SUCCESS（最后一个绿构建） |
| 08-07 09:51 | luwei `d675f961` 引入 `Resource->TextureRHI` 用法（缺 `TextureResource.h`） |
| 08-07 16:54 | luwei `495fe84e` 引入 `Viewport->GetSizeXY()` 用法（缺 `UnrealClient.h`） |
| 08-08 03:44 | #619 FAILURE——首次变红，错误与 #627 相同 |
| 08-08 ~ 08-12 | #620–#623 FAILURE（同错误）；#624 NOT_BUILT、#625 ABORTED、#626 NOT_BUILT |
| 08-13 | **#627 FAILURE（本次诊断对象）**；`dev_InstanceOptimize` merge 未触碰出错文件 |
| 08-14 12:31 | luwei `2150b488` "提交kekins管线编译错误"补上两个缺失 include |
| 08-14 13:10 | #628 SUCCESS；#629 RUNNING |

## 降级说明（按技能优雅降级规则处理）

1. **本地仓库落后且无法 fetch**：`D:\Git\AesWorld` dev 落后 CI 数百个 commit；`git fetch`（git.51vr.local 需交互输密码、10.100.10.55 凭据被拒）均失败。降级为 **GitLab REST API + GITLAB_PRIVATE_TOKEN 只读**取回 CI commit 的源码/blame/compare/diff，未做任何写操作。
2. **remote 不一致警告**：本地 origin 为 `git.51vr.local`，CI 使用 `10.100.10.55`（两域名 API 均可达，应属同一 GitLab 的不同入口）。按 check-env 规则记为警告，不阻塞。
3. **知识库详情缺失**：`twe-installed-313-316-C2027-FTextureResource` 条目详情文件不存在（index 链接失效），仅能确认"同 job 同错误曾发生"，评分按 6/10 处理，因此继续执行了 Epic 查询。
4. **Web 搜索跳过**：技能规则"知识库 ≥ 8 或 Epic 已给明确修复"可跳过——本次 Epic 结论与仓库实际修复 commit 完全一致，无需再查。
5. **Phase 4/5/6 未执行**：任务仅要求诊断；且修复已由上游 `2150b488` 合入 dev 并经 #628 验证，无需本地改码/提 MR/写知识条目（技能规定仅保存"已验证修复"知识，本次修复非本技能产出）。

## 参考资料

- Jenkins：http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-installed/627/console
- 修复 commit（GitLab）：http://10.100.10.55/neon/AesWorld/-/commit/2150b488ab4f3b63600c2222d2d6ea6862fb9a2c
- 引入 commit：http://10.100.10.55/neon/AesWorld/-/commit/495fe84ec0468a0798568ace349654bc470672e5 、http://10.100.10.55/neon/AesWorld/-/commit/d675f961a8beeaf2476579ed73537542bf38e21a
- 知识库模式条目：`C:\Users\Administrator\memory\jenkins-learnings\details\077-installed-build-umaterial-forward-declaration-missing.md`
- Epic 官方助手（dev.epicgames.com）问答：UnrealClient.h / TextureResource.h 与 Installed Build PCH/IWYU 机制说明

## 附录：本地产物与中间文件

- 构建日志：`C:\Users\Administrator\memory\jenkins-learnings-raw\tmp\ue-error\twe-ue5_5-installed_627_20260815_035755.log`（435KB）
- CI 版出错源文件：同目录 `ci627_gate_controller.cpp`、`ci627_budget_subsystem.cpp`
- 修复 diff / compare / blame JSON：同目录 `ci628_fix_diff.json`、`ci627_compare.json`、`ci627_merge_diff.json`、`ci627_blame_gate.json`、`ci627_blame_budget.json`
