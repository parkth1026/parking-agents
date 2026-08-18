# 诊断报告：aes6-ue-runtime-ci #3939 构建失败

> 用户请求："autoci #3939 构建失败了，帮我看看什么问题"（纯诊断，未做任何代码/Jenkins 改动）

## 构建信息

| 项 | 值 |
|---|---|
| Job | `wdp-ue/job/Earth/job/aes6-ue-runtime-ci`（用户所称 "autoci"，全站唯一存在 #3939 的 job） |
| 构建编号 | #3939 |
| 结果 | **FAILURE**（2026-04-07，耗时约 4 分 40 秒） |
| 前后构建 | #3938 SUCCESS → **#3939 FAILURE** → #3940 SUCCESS（当前最新 #4280 SUCCESS，问题未复发） |
| 关键仓库 | AesWorld `dev` @ `5e335874472e28884e1471209aa29ba41fc3fd08` |
| 构建命令 | `RunUAT.bat BuildCookRun -project=.../TWE.uproject -targetplatform=Win64 -clientconfig=Development -pak -cook -stage -archive -package -compressed -prereqs -build -utf8output` |

## 错误摘要（Phase 1）

共提取 7 个错误块，按分类分组后实为 **1 个主要错误 + 级联外壳错误**：

| 组 | 类型 | 错误 | 性质 |
|---|---|---|---|
| 1 | UBT（主要） | `Missing precompiled manifest for 'TraceAnalysis' ... ExitCode=6` | **根因** |
| 2 | UBT/Cook（级联） | `UnrealBuildTool failed` / `BUILD FAILED` / `ERROR: Package project failed.` | 组 1 的连锁结果 |

说明：Editor target（TWEEditor）编译实际**成功**（`BUILD SUCCESSFUL`，Rebuild All: 1 succeeded）；失败发生在 Package 阶段的 game target（TWE）UBT 编译，仅 2.48 秒即退出（ExitCode=6）。

## 诊断：UBT ExitCode=6 — Missing precompiled manifest for 'TraceAnalysis'

**错误信息**：

```
Missing precompiled manifest for 'TraceAnalysis', 'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled. This module can not be referenced in a monolithic precompiled build, remove this reference or migrate to a fully compiled source build.
Dependent modules 'AesWorldInsights TraceServices'
Took 2.59s to run dotnet.exe, ExitCode=6
```

**根因分析**：

commit `5e335874`（2026-04-07，xiongxing，"新增AesWorldInsights性能分析模块，重构ProducerGraph接口"）引入的新模块 `AesWorldInsights` 在 Build.cs 中声明了对 `TraceServices`、`TraceAnalysis` 的依赖（`TraceServices` 又传递依赖 `TraceAnalysis`）。而 CI 使用**安装版引擎**（`D:\Epic\UE_5.5_51`，`-installed`）打包 game target（monolithic precompiled build）：`TraceAnalysis` 属于引擎的分析工具链模块，未设置 `PrecompileForTargets = PrecompileTargetsType.Any`，安装版引擎中没有为 `UnrealGame` target 预编译它，UBT 解析依赖链时找不到 `TraceAnalysis.precompiled` manifest，直接失败退出（ExitCode=6）。

典型场景：把仅适合 Editor/Program 环境的引擎 trace 分析模块依赖，带进了运行时（game/program）构建。

**置信度**：高（知识库同构建号条目 + 源码 Build.cs + git 历史 + 修复后 #3940 SUCCESS 四重印证）

### 证据

- **知识库**：`C:\Users\Administrator\memory\jenkins-learnings\details\085-precompiled-manifest-traceanalysis-module-dep.md`，匹配评分 **8/10**（同错误信息 + 同 job + 同构建号 #3939 + 含已验证修复段落；该条目记录修复 commit `8894ec3`、Fix Build #3940 SUCCESS）
- **源码上下文**：`D:\Git\AesWorld\Tests\AesWorldInsights\AesWorldInsights.Build.cs`（CI commit `5e335874` 版本）中 `PrivateDependencyModuleNames` 含 `"TraceAnalysis"`、`"TraceServices"`、`"TraceLog"`；`Get-FileGitHistory` 显示该文件最近一次变更即修复 commit `8894ec3`
- **Epic 指引**：跳过——知识库评分 8/10 ≥ 8（技能来源选择规则）；且本执行环境未安装 `epic-ue-assistant` skill
- **Web 搜索**：跳过——知识库评分 ≥ 8，且知识库已给出经编译验证的修复（技能来源选择规则）
- **Jenkins 验证**：#3938 SUCCESS（旧代码）→ #3939 FAILURE（引入 5e335874）→ #3940 SUCCESS（含修复 8894ec3）→ #4280 SUCCESS（最新，未复发）

### 修复建议

**本次无需任何操作**——该问题已在 #3939 的下一个构建中修复并验证：

修复 commit：`8894ec3951df7601814361a2ad93c5b3e4c6965b`（xiongxing，2026-04-08，"拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)"）：

1. **AesWorldProfiling**（Runtime 模块）：仅保留运行时安全的 profiling 代码，依赖中不再包含 `TraceServices`/`TraceAnalysis`（仅 `TraceLog`）
2. **AesWorldInsights**（Program/Editor 模块）：保留依赖 `TraceServices`/`TraceAnalysis` 的分析功能，只在 editor/program 构建中使用

**预防措施**（后续新增模块依赖时）：
1. 在 installed build 中引用引擎模块前，检查其 Build.cs 是否设置 `PrecompileForTargets = PrecompileTargetsType.Any`
2. 未设置的模块仅在源码构建可用，不得进入运行时 target
3. 运行时与编辑器功能拆分为独立模块
4. 编辑器专用模块可标记 `Type = ModuleType.DeveloperTool` / `ModuleType.EditorNoCommandlet`

### 附带发现（非致命，不阻塞构建）

- `EarthModelerSelectionUtil.cpp(28): warning C4996`：`FSelectedOjectsChangeList` 拼写即将废弃，应改用 `FSelectedObjectsChangeList`（引擎提示升级下一版本前必须更新，否则未来无法编译）
- `AesWorld` 依赖 `StructUtils` 插件已在 5.5 标记 deprecated，将 soon be removed

### 参考资料

- 知识库：`C:\Users\Administrator\memory\jenkins-learnings\details\085-precompiled-manifest-traceanalysis-module-dep.md`
- Jenkins：`http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/console`
- 日志副本：`outputs/console.log`（原保存于 `C:\Users\Administrator\memory\jenkins-learnings-raw\tmp\ue-error\aes6-ue-runtime-ci_3939_20260814_145917.log`）

## Phase 2 检查清单

| 步骤 | 状态 | 结果 |
|---|---|---|
| 2.1 源码 | 已完成 | `Tests\AesWorldInsights\AesWorldInsights.Build.cs` 含 TraceAnalysis/TraceServices 依赖；CI commit 5e335874、修复 commit 8894ec3 |
| 2.2 知识库 | 已完成 | 搜索词 TraceAnalysis / precompiled manifest / AesWorldInsights / TraceServices / ExitCode=6；评分 8/10 |
| 2.3 Epic | 已跳过（知识库评分 ≥ 8；环境无 epic-ue-assistant skill） | — |
| 2.4 Web | 已跳过（知识库评分 ≥ 8 且已含验证修复） | — |

## 任务边界声明

纯诊断任务：未修改任何代码、未创建/切换分支、未 commit/push、未改动 Jenkins（全程只读 API）。Phase 1.5（修复分支）、Phase 4（修复）、Phase 5（MR）、Phase 6（知识条目——该构建已有条目 085，无需重复写入）均按任务要求跳过。
