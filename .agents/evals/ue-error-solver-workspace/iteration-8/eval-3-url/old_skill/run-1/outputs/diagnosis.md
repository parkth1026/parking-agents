# 诊断报告：aes6-ue-runtime-ci #3939

- **Jenkins**: http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/
- **结果**: FAILURE（Package 阶段，总时长 4.7 分钟，构建时间 2026-04-07 21:21:52）
- **本任务性质**: 纯诊断，未修改任何代码/分支/Jenkins

## 诊断：Missing precompiled manifest (UBT ExitCode=6) — Source/AesWorldInsights/AesWorldInsights.Build.cs

**错误信息**（console.log 第 1708-1713 行）：

```
Missing precompiled manifest for 'TraceAnalysis', 'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled. This module can not be referenced in a monolithic precompiled build, remove this reference or migrate to a fully compiled source build.
This module was most likely not flagged during a release for being included in a precompiled build - set 'PrecompileForTargets = PrecompileTargetsType.Any;' in TraceAnalysis.Build.cs to override.
Dependent modules 'AesWorldInsights TraceServices'
Took 2.59s to run dotnet.exe, ExitCode=6
UnrealBuildTool failed.
ERROR: Package project failed.
```

**错误分类与分组**（LLM 判断）：
- **主错误（1 个）**：UBT 模块依赖错误 —— 新模块 `AesWorldInsights` 在游戏（Runtime）目标中依赖了 installed 引擎不提供 precompiled manifest 的引擎分析模块 `TraceAnalysis`/`TraceServices`
- **级联错误**：`UnrealBuildTool failed` → `ERROR: Package project failed` → `BUILD FAILED` → Auto Test / Archive 阶段跳过 —— 均为同一主错误的下游表现，不需单独处理

**根因分析**：

本次构建把 AesWorld dev 推进到新提交 `5e3358744`「新增AesWorldInsights性能分析模块，重构ProducerGraph接口」。该提交新增的 `AesWorldInsights` 模块存在两个致命组合：

1. `Source/AesWorldInsights/AesWorldInsights.Build.cs` 中**无条件**声明 `PrivateDependencyModuleNames: "TraceAnalysis", "TraceServices"`（对包括游戏目标在内的所有 target 生效）；
2. `AesWorld.uplugin` 中该模块注册为 `Type: "DeveloperTool"`（而非 Editor），DeveloperTool 模块在**游戏目标打包时也会被编译链接**。

流水线分两段构建：第一段 TWEEditor（编辑器目标）编译成功（`ExitCode=0`，耗时 200.83s）——编辑器目标下 TraceServices/TraceAnalysis 可用；第二段 TWE（游戏目标，installed 预编译引擎 `D:\Epic\UE_5.5_51`，UHT 以 `-installed` 运行）在 UBT 依赖解析阶段即失败（2.59s, `ExitCode=6`）：`TraceAnalysis` 是引擎的 Trace 分析模块，Epic 发布 installed 引擎时未将其标记为可预编译（`PrecompileForTargets` 未设为 `Any`），因此 monolithic precompiled（游戏打包）构建中没有 `TraceAnalysis.precompiled` manifest，依赖链 `AesWorldInsights → TraceServices → TraceAnalysis` 无法满足。

**置信度**：高（错误信息、源码、知识库、修复后构建绿灯四类证据互相印证）

### 证据

- **知识库**（评分 10/10）：`C:\Users\Administrator\memory\jenkins-learnings\details\085-precompiled-manifest-traceanalysis-module-dep.md` —— 与本次为**同一构建 #3939** 的已验证条目，记录了相同错误、依赖链 `AesWorldInsights -> TraceServices -> TraceAnalysis`、修复提交 `8894ec3` 与修复后构建 #3940 SUCCESS。
- **源码上下文**（AesWorld 本地仓库 D:\Git\AesWorld，dev 分支，CI commit `5e3358744` 已存在本地，behind=0/ahead=0 相对检出点）：
  - CI commit 处 `AesWorldInsights.Build.cs` 关键片段：
    ```csharp
    PrivateDependencyModuleNames.AddRange(new string[] {
        "Json", "JsonUtilities", "Projects",
        "TraceAnalysis",   // ← installed 引擎游戏目标无 precompiled manifest
        "TraceServices"    // ← 传递依赖 TraceAnalysis
    });
    ```
  - `AesWorld.uplugin`（CI commit 处）：`{ "Name": "AesWorldInsights", "Type": "DeveloperTool", ... }` —— DeveloperTool 类型使游戏打包目标也尝试编译该模块。
  - 该模块 git 历史：`5e3358744 新增AesWorldInsights性能分析模块`（引入）→ `8894ec395 拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)`（修复，作者 xiongxing，2026-04-08）。
- **Epic 指引**：跳过 —— 知识库评分 ≥ 8（规则 2.3），且当前环境中不存在 `epic-ue-assistant` skill（已确认 `~/.claude/skills` 与插件缓存均无），双重理由，按优雅降级规则继续。
- **Web 搜索**：跳过 —— 知识库评分 ≥ 8 且已含经验证的修复方案（规则 2.4），无需外部检索。
- **Jenkins 交叉验证**（只读 API）：修复后的 #3940 = SUCCESS（814s）、#3941 = SUCCESS（488s），确认根因已被修复提交消除。

### 修复建议

**该错误已在 dev 分支修复，无需再改动**：

1. 修复提交 `8894ec3951df7601814361a2ad93c5b3e4c6965b`「拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)」已合入 dev（本地 dev HEAD `ba832a9ea` 包含该提交，领先本次 CI commit 414 个提交）：
   - 运行时录制（Trace）代码移入 `Source/AesWorldProfiling`（Runtime 类型，**不依赖** TraceAnalysis/TraceServices）；
   - 离线分析代码移入 `Tests/AesWorldInsights` 独立 Program 目标（`AesWorldInsights.exe`，仍依赖 TraceServices/TraceAnalysis），录制完成后通过子进程启动分析工具，完全解耦。
   - Jenkins 验证：#3940 起恢复绿灯。
2. 若需在 #3939 当时的代码上重跑（不建议）：将 `AesWorldInsights.Build.cs` 中 `TraceAnalysis`/`TraceServices` 的依赖限制为编辑器/Program 目标（`if (Target.Type == TargetType.Editor)` 或改为 Editor 类型模块），或参照修复提交做模块拆分。
3. **预防**（来自知识库条目，针对 installed 引擎构建）：新增模块依赖前检查目标引擎模块的 `PrecompileForTargets` 是否为 `PrecompileTargetsType.Any`；运行时与编辑器/分析功能拆分到不同模块（Runtime vs DeveloperTool/Program）；DeveloperTool 类型模块会进入游戏打包目标，等同于 Runtime 对待依赖约束。

### 参考资料

- 知识库条目：`C:\Users\Administrator\memory\jenkins-learnings\details\085-precompiled-manifest-traceanalysis-module-dep.md`
- 修复提交：AesWorld 仓库 `8894ec3951df7601814361a2ad93c5b3e4c6965b`（本地 `D:\Git\AesWorld` dev 可见）
- 引入提交：AesWorld `5e335874472e28884e1471209aa29ba41fc3fd08`
- 构建日志：本目录 `console.log`（原始 consoleText 副本）；技能流程另存 `C:\Users\Administrator\memory\jenkins-learnings-raw\tmp\ue-error\aes6-ue-runtime-ci_3939_20260814_145655.log`
- Epic 指引 / Web 搜索：按技能规则跳过（见证据部分原因）

### 环境备注（Phase 0.5 检查记录）

- 配置合并正常：config.json ⊕ `~/.claude/skill-env.json`（jenkins.baseUrl=http://10.66.12.40，gitRepos=D:\Git，知识库两目录均存在）。
- 仓库检查：AesWorld 存在于 `D:\Git\AesWorld`；**警告**：本地 origin 为 `http://git.51vr.local/neon/AesWorld.git`，CI 使用 `http://10.100.10.55/neon/AesWorld.git`（同一 GitLab 的不同地址别名），按规则警告并继续。
- 本任务为纯诊断：未创建/切换分支，未 checkout CI commit（源码均通过 `git show <commit>:<path>` 只读读取），未修改任何文件。
