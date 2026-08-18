# 诊断报告：autoci（aes6-ue-runtime-ci）#3939 构建失败

> 任务定位：`autoci` 为 `aes6-ue-runtime-ci`（/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci）的别名（依据知识库条目 autoci-3784 中 "Job: autoci (aes6-ue-runtime-ci)" 的映射记录；Jenkins 上不存在名称含 "auto" 的 job）。
> 构建时间：2026-04-07（timestamp 1775568112898），历时约 4.7 分钟，结果 FAILURE。

## 诊断：Missing precompiled manifest（TraceAnalysis）— AesWorldInsights.Build.cs

**错误信息**：
```
Missing precompiled manifest for 'TraceAnalysis',
'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled.
This module can not be referenced in a monolithic precompiled build, remove this reference or
migrate to a fully compiled source build.
Dependent modules 'AesWorldInsights TraceServices'
```
UBT ExitCode=6，发生在 **Package Project** 阶段的 `TWE` game target（Win64 Development，monolithic，installed 引擎 D:\Epic\UE_5.5_51）。前置的 Build Editor 阶段（TWEEditor target）编译成功（BUILD SUCCESSFUL，ExitCode=0）。

**根因分析**：
AesWorld 仓库本次构建引入的 commit `5e3358744 新增AesWorldInsights性能分析模块，重构ProducerGraph接口` 新增了 `AesWorldInsights` 模块，其 `PrivateDependencyModuleNames` 直接依赖引擎的 `TraceAnalysis` 与 `TraceServices`。CI 使用的是 launcher installed 版 UE 5.5.51，`TraceAnalysis` 属于引擎侧分析工具模块，未设置 `PrecompileForTargets = PrecompileTargetsType.Any`，installed 引擎不携带其 precompiled manifest；`TWE` game target 是 monolithic precompiled build，UBT 解析依赖链 `TWE → AesWorld 插件 → AesWorldInsights → TraceServices → TraceAnalysis` 时发现 manifest 缺失，直接终止（ExitCode=6）。TWEEditor 阶段之所以成功，是因为 editor target 为模块化构建，允许从源码编译这些模块。

**置信度**：高（日志原文、CI commit 处的源码、知识库已验证修复三方证据一致）

### 证据
- **知识库**：`C:\Users\Administrator\memory\jenkins-learnings\details\085-precompiled-manifest-traceanalysis-module-dep.md`，匹配评分 **9/10**——同 job（aes6-ue-runtime-ci）、同 build（#3939）、同错误信息、同依赖链（AesWorldInsights → TraceServices → TraceAnalysis），且含已验证修复（commit 8894ec3，后续构建 #3940 SUCCESS）。
- **Epic 指引**：跳过——知识库评分 ≥ 8 且已含验证过的修复（按技能来源选择规则 2.3 跳过）。
- **源码上下文**：AesWorld @ CI commit `5e3358744` 的 `Source/AesWorldInsights/AesWorldInsights.Build.cs`（git show 只读取证，未切换分支）：
  ```csharp
  PrivateDependencyModuleNames.AddRange(new string[] {
      "Json", "JsonUtilities", "Projects",
      "TraceAnalysis",   // ← 本次失败根因
      "TraceServices"
  });
  ```
  修复 commit `8894ec395 拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)` 将该文件移至 `Tests/AesWorldInsights/`（仅 Program 用），新 Runtime 模块 `Source/AesWorldProfiling/AesWorldProfiling.Build.cs` 的依赖仅剩 `Core/CoreUObject/Engine/TraceLog/Json/JsonUtilities/Projects`，不再引用 TraceServices/TraceAnalysis（source-context 已核实当前工作区内容）。
- **Web 搜索**：跳过——知识库 ≥ 8，且该错误为 UE installed build 的已知模块依赖模式（错误信息本身即给出官方指引），无新增信息可预期。

### 修复建议
**本失败已在 dev 分支上修复，无需任何代码改动。**
1. 修复 commit `8894ec395 拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)` 已存在于 AesWorld dev（紧随触发 commit 5e3358744），后续构建 **#3940 已验证 SUCCESS**。
2. 若同类问题再次出现，方向性方案（来自已验证修复）：将依赖 `TraceServices/TraceAnalysis` 的分析功能隔离到 Editor/Program 专用模块，Runtime 模块只保留 `TraceLog` 等运行时安全的依赖；或在引擎源码构建中为 TraceAnalysis 设置 `PrecompileForTargets = PrecompileTargetsType.Any`（对 launcher installed 引擎不可行）。
3. 顺带提醒：本次构建日志中的 C4996 弃用警告（`Sort → Algo::Sort`、`BezierUtilities.h 迁移`、`FSelectedOjectsChangeList 拼写`）未导致失败，但 UHT 以 `-WarningsAsErrors` 运行，建议按提示更新，避免未来升级阻塞。另本地 D:/Git/AesWorld 的 dev 落后 origin/dev 46 个提交，建议同步。

### 参考资料
- 知识库条目：`C:\Users\Administrator\memory\jenkins-learnings\details\085-precompiled-manifest-traceanalysis-module-dep.md`
- 构建控制台：http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/console
- 触发变更：AesWorld commit `5e335874472e28884e1471209aa29ba41fc3fd08`（dev）
- 修复变更：AesWorld commit `8894ec3951df7601814361a2ad93c5b3e4c6965b`（dev）

---
*Phase 2 检查清单：2.1 源码=已完成（git show @CI commit + git-history + source-context）；2.2 知识库=已完成（search-kb，评分 9/10）；2.3 Epic=跳过（知识库 ≥ 8 且含已验证修复）；2.4 Web=跳过（同上）。Phase 1.5/4/5/6 未执行（纯诊断任务，用户明确禁止创建/切换分支与任何修改）。*
