# 诊断报告：UBT Missing Precompiled Manifest for TraceAnalysis

> **构建**: aes6-ue-runtime-ci [#3939](http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/)
> **结果**: FAILURE (ExitCode=6)
> **耗时**: 279701ms (~4分40秒)
> **日期**: 2026-04-07
> **触发者**: GitLab push by xiongxiong
> **节点**: twe_autoci (D:/Jenkins/workspace/wdp-ue/Earth/aes6-ue-runtime-ci)

---

## Phase 0：配置解析

| 配置项 | 原始值 | 解析后路径 |
|--------|--------|------------|
| jenkins.baseUrl | `http://10.66.12.40` | `http://10.66.12.40` |
| gitRepos | `D:/Git` | `D:\Git` |
| tmpDir | `./tmp/ue-error-solver` | `D:\Claude_skills\tmp\ue-error-solver` |
| knowledgeBase.wikiDir | `~/memory/jenkins-learnings` | `C:\Users\Administrator\memory\jenkins-learnings` |
| knowledgeBase.rawDir | `./wiki-raw/jenkins-learnings` | `D:\Claude_skills\wiki-raw\jenkins-learnings` |

**Job 匹配**：用户输入 "autoci #3939" -> 匹配 config 中 `name: "autoci"` -> job path: `wdp-ue/job/Earth/job/aes6-ue-runtime-ci`，构建号 `3939`。

---

## Phase 1：日志下载与错误提取

**日志下载**：
- URL: `http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/consoleText`
- 保存路径: `D:\Claude_skills\tmp\ue-error-solver\autoci-3939-20260414-003214.log`
- 日志行数: 1758 行

**构建 API 结果**：
```json
{"_class":"org.jenkinsci.plugins.workflow.job.WorkflowRun","duration":279701,"result":"FAILURE","timestamp":1775568112898}
```

### 构建流水线执行顺序

| 阶段 | 命令 | 结果 | 耗时 |
|------|------|------|------|
| Prepare | 拉取工具、清理进程 | SUCCESS | - |
| Pull Plugins | git checkout 6个插件仓库 | SUCCESS | - |
| Pull Project | P4 sync 项目代码 | SUCCESS | - |
| Build Editor | `RunUAT.bat BuildTarget -Target=Editor -Platform=Win64 -Configuration=Development` | **SUCCESS** (ExitCode=0) | 200.83s |
| Package Project | `RunUAT.bat BuildCookRun -project=TWE.uproject -targetplatform=Win64 -clientconfig=Development -build -cook -stage -archive -package` | **FAILED** (ExitCode=6) | 2.59s |
| Auto Test | 跳过（前序失败） | SKIPPED | - |
| Archive | 跳过（前序失败） | SKIPPED | - |

### 主要错误

```
Missing precompiled manifest for 'TraceAnalysis', 'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled.
This module can not be referenced in a monolithic precompiled build, remove this reference or migrate to a fully compiled source build.
This module was most likely not flagged during a release for being included in a precompiled build - set 'PrecompileForTargets = PrecompileTargetsType.Any;' in TraceAnalysis.Build.cs to override.
Dependent modules 'AesWorldInsights TraceServices'
```

**错误分类**: UBT (UnrealBuildTool) 模块依赖错误
**错误数量**: 1 个主要错误（Missing precompiled manifest），无级联编译错误
**失败阶段**: Package Project（BuildCookRun — TWE Win64 Development Game target）

### 构建命令提取

```
D:\Epic\UE_5.5_51\Engine\Binaries\ThirdParty\DotNet\8.0.300\win-x64\dotnet.exe
  "D:\Epic\UE_5.5_51\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.dll"
  TWE Win64 Development
  -Project=D:\ws_twe_ue5.5_ci\Project\TWE.uproject
  -Manifest=D:\ws_twe_ue5.5_ci\Project\Intermediate\Build\Manifest.xml
  -remoteini="D:\ws_twe_ue5.5_ci\Project"
  -skipdeploy
  -log="C:\Users\Administrator\AppData\Roaming\Unreal Engine\AutomationTool\Logs\D+Epic+UE_5.5_51\UBT-TWE-Win64-Development.txt"
```

### 额外 Warnings（非阻塞）

1. **C4996: Sort deprecated** — `AesWorld\Source\AesRenderResource\Private\Traffic\EarthZoneGraphBVTree.cpp(77)`: `Sort` 已弃用，请使用 `Algo::Sort`
2. **C4996: BezierUtilities.h deprecated** — 文件已移动到 `Curves/BezierUtilities.h`
3. **StructUtils plugin deprecated** — AesWorld 插件依赖的 StructUtils 在 UE5.5 中已弃用
4. **License not activated** — XGE 构建系统许可证未激活（standalone 模式运行）

---

## Phase 2：多源诊断

### 2.1 源码上下文

触发此次构建的关键提交来自 AesWorld 插件：

- **Commit**: `5e33587` — "新增AesWorldInsights性能分析模块，重构ProducerGraph接口"
- **作者**: xiongxiong

该提交引入了一个新的 `AesWorldInsights` 模块，该模块声明了对以下引擎模块的依赖：
- **TraceServices** — UE5 Trace 服务基础设施模块
- **TraceAnalysis** — UE5 Unreal Insights 追踪分析框架（TraceServices 的传递依赖）

**关键发现**：Editor 构建成功通过（因为 Editor 目标包含所有开发者模块），但 Game 目标构建在 Package Project 阶段失败，因为 `TraceAnalysis` 是一个**仅 Editor/Program 可用**的引擎模块，在 installed/precompiled 引擎构建中没有预编译的 `.lib` 文件。

### 2.2 本地知识库搜索

**搜索路径**: `C:\Users\Administrator\memory\jenkins-learnings\details\`

**直接匹配**：`085-precompiled-manifest-traceanalysis-module-dep.md`
- **Score**: 8/10（已验证的修复）
- **内容**：记录了完全相同的错误模式——AesWorldInsights 模块依赖 TraceServices/TraceAnalysis 导致 UBT ExitCode=6
- **验证的修复**：Commit `8894ec3` by xiongxing — 将模块拆分为 AesWorldProfiling (Runtime) 和 AesWorldInsights (Program)
- **修复构建**：#3940 (SUCCESS)

知识库条目包含完整的根因分析、修复 commit 和预防措施。

### 2.3 Epic UE Assistant 查询

**跳过 Epic 查询** — 知识库匹配 score 8/10，包含经过构建验证的具体修复。

知识库条目 `085-precompiled-manifest-traceanalysis-module-dep.md` 是高置信度的已验证条目（score >= 8），且包含：
- 明确的根因分析
- 经过验证的修复 commit (`8894ec3`)
- 修复后的成功构建确认 (#3940 SUCCESS)

查询 Epic 不会带来有意义的新信息。

### 2.4 Web 搜索

**跳过 Web 搜索** — 知识库已有强匹配（score 8/10），根因和修复方案均已确认。

---

## Phase 3：诊断呈现

## 诊断：UBT ExitCode=6 — Missing Precompiled Manifest for TraceAnalysis

**主要错误**：`Missing precompiled manifest for 'TraceAnalysis'` — 在 monolithic precompiled build 中无法引用该模块

**根因**：Commit `5e33587`（by xiongxiong）新增的 `AesWorldInsights` 性能分析模块声明了对 `TraceServices` 的依赖，而 `TraceServices` 传递依赖 `TraceAnalysis`。`TraceAnalysis` 是 UE5 Unreal Insights 框架的一部分，属于 **Editor/Program-only** 引擎模块，在 installed engine 的 precompiled 构建中没有预编译二进制文件。当 CI 流水线执行 Package Project 阶段（BuildCookRun for Game target）时，UBT 尝试在 monolithic precompiled 配置下构建 Game 目标，找不到 `TraceAnalysis` 的预编译 manifest，导致 ExitCode=6 失败。

**为什么 Editor 构建通过了**：Editor target 包含所有开发者模块（包括 TraceAnalysis），因此 Editor 编译阶段正常完成（ExitCode=0, 200.83s）。Missing precompiled manifest 错误只在构建 Game target 时触发，因为 Game target 会剥离 editor-only 模块。

**置信度**：高

### 证据

| 来源 | 结果 |
|------|------|
| **知识库** | 直接匹配 `085-precompiled-manifest-traceanalysis-module-dep.md` (score 8/10)，包含已验证的修复 |
| **Epic 指导** | 已跳过——KB 匹配 score 8/10，有经过构建验证的修复 |
| **源码上下文** | Commit `5e33587` 引入 AesWorldInsights 模块，依赖链 AesWorldInsights -> TraceServices -> TraceAnalysis |
| **Web 搜索** | 已跳过——早期来源提供了充分证据 |

### 建议修复

修复已在构建 #3940 中应用（Commit `8894ec3` by xiongxing）。采取的方案是正确的模块拆分策略：

1. **拆分模块为两部分**：
   - **AesWorldProfiling** (Runtime 模块) — 包含运行时安全的 profiling 代码，**不依赖** TraceAnalysis/TraceServices。可安全用于 Game target。
   - **Tests/AesWorldInsights** (独立 Program target) — 包含离线分析功能，依赖 TraceAnalysis/TraceServices。作为独立可执行文件构建，永远不会链接到 Game target。

2. **关键文件变更**（Commit `8894ec3`）：
   - `AesWorld.uplugin`: 将 AesWorldInsights 模块条目替换为 AesWorldProfiling
   - `AesWorldProfiling.Build.cs`: 新的 Build.cs，不含 TraceAnalysis 依赖
   - `Tests/AesWorldInsights/AesWorldInsights.Build.cs`: 独立 Program，保留 TraceAnalysis 依赖
   - `Tests/AesWorldInsights/AesWorldInsights.Target.cs`: 新增 `.Target.cs` 用于独立 Program
   - Runtime trace 记录代码移至 `Source/AesWorldProfiling/`
   - 离线分析代码移至 `Tests/AesWorldInsights/`

### 参考资料

- **知识库条目**: `C:\Users\Administrator\memory\jenkins-learnings\details\085-precompiled-manifest-traceanalysis-module-dep.md`
- **Jenkins 构建**: [autoci #3939](http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/console)
- **修复构建**: [autoci #3940](http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3940/)
- **日志文件**: `D:\Claude_skills\tmp\ue-error-solver\autoci-3939-20260414-003214.log`

---

## 预防措施

1. **永远不要在 Runtime/Game 模块中添加 `TraceAnalysis` 或 `TraceServices` 依赖** — 这些是 Editor/Program-only 引擎模块，在 installed/precompiled 引擎构建中不可用
2. **创建性能分析功能时，拆分为两个模块** — Runtime 记录模块（无分析依赖）和独立 Program target 用于离线分析
3. **新模块合并前同时测试 Editor 和 Game 构建目标** — 仅通过 Editor 构建不足以验证模块依赖的正确性
4. **使用 `UE_TRACE_CHANNEL` 宏**（来自 `TraceLog`）进行运行时事件发射；将 `TraceAnalysis` 保留给仅 Editor 的分析工具
