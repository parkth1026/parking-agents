# 诊断报告: autoci #3939 构建失败

> **Job**: aes6-ue-runtime-ci | **Build**: #3939 | **Result**: FAILURE
> **平台**: Win64 | **配置**: Development | **耗时**: ~280秒
> **日期**: 2026-04-07

---

## 错误摘要

构建在 **BuildCookRun 阶段（Game Target 打包构建）** 失败，ExitCode=6。

Editor Target 构建（第一阶段）成功通过，但 Game Target 构建（第二阶段）因 UBT 无法解析引擎模块 `TraceAnalysis` 的预编译清单而失败。

**错误数量**: 1 个主要错误（UBT ExitCode=6）

---

## 诊断: Missing Precompiled Manifest - TraceAnalysis

**主要错误**:
```
Missing precompiled manifest for 'TraceAnalysis', 'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled.
This module can not be referenced in a monolithic precompiled build, remove this reference or migrate to a fully compiled source build.
Dependent modules 'AesWorldInsights TraceServices'
```

**根因分析**:

提交 `5e33587`（"新增AesWorldInsights性能分析模块，重构ProducerGraph接口"）引入了新的 `AesWorldInsights` 模块，位于 `AesWorld/Tests/AesWorldInsights/` 目录下。

该模块的 `AesWorldInsights.Build.cs` 声明了对以下引擎模块的依赖：
- `TraceAnalysis`（位于 `Engine/Source/Developer/TraceAnalysis`）
- `TraceServices`（位于 `Engine/Source/Developer/TraceServices`）
- `TraceLog`

**依赖链**: `AesWorldInsights` -> `TraceServices` -> `TraceAnalysis`

`TraceAnalysis` 和 `TraceServices` 都是引擎的 **Developer** 类型模块，它们没有设置 `PrecompileForTargets = PrecompileTargetsType.Any`，因此在预编译（Installed）引擎构建中不可用。

**为什么 Editor 构建成功但 Game 构建失败**:
- **Editor Target**（TWEEditor）以非单片（modular）方式构建，可以动态链接 Developer 模块，因此 `TraceAnalysis` 可以被正常引用
- **Game Target**（TWE）以单片预编译（monolithic precompiled）方式构建，要求所有依赖模块都有预编译清单（`.precompiled` 文件），而 `TraceAnalysis` 作为 Developer 模块没有被预编译，导致 UBT 报错 ExitCode=6

此外，`AesWorldInsights` 模块并未在 `AesWorld.uplugin` 的 Modules 列表中注册，但由于它位于插件目录下且有 `.Build.cs` 文件，UBT 仍然会自动发现并尝试编译它。

**置信度**: **高**

### 证据

- **知识库**: 命中已验证条目 `085-precompiled-manifest-traceanalysis-module-dep.md`（评分 8/10），包含完整的根因分析和已验证修复
- **Epic 官方指导**: 跳过 -- 知识库匹配评分 8/10 已足够
- **源码上下文**:
  - `AesWorldInsights.Build.cs` 第 21-23 行直接依赖 `TraceAnalysis`、`TraceServices`、`TraceLog`
  - `TraceAnalysis.Build.cs` 位于 `Engine/Source/Developer/`，是 Developer 类型模块，未设置 `PrecompileForTargets`
  - `TraceServices.Build.cs` 同样位于 `Engine/Source/Developer/`，且依赖 `TraceAnalysis`
- **Web 搜索**: 跳过 -- 已有充分证据

### 推荐修复方案

将 `AesWorldInsights` 模块拆分为两个独立模块：

1. **AesWorldProfiling**（Runtime 类型）-- 包含运行时安全的性能分析代码，不依赖 `TraceAnalysis`/`TraceServices`
2. **AesWorldInsights**（Program/Editor 类型）-- 包含需要 `TraceServices`/`TraceAnalysis` 的分析功能，仅在编辑器构建中使用

这样可以确保 Game Target 的运行时构建不会拉取仅在编辑器/开发工具中可用的引擎模块。

### 已知修复

根据知识库记录，此问题已在 **Build #3940** 中修复：
- **修复提交**: `8894ec3` by xiongxing
- **提交信息**: "拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)"
- **验证结果**: Build #3940 SUCCESS

### 附加警告

构建日志中还有一条弃用警告（非致命）：
```
Plugin 'AesWorld' depends on plugin 'StructUtils' which was deprecated in 5.5 and will soon be removed. Please update your dependencies.
```
建议后续迁移 `StructUtils` 依赖到 UE 5.5 推荐的替代方案。

### 参考

- 知识库文件: `C:\Users\Administrator\memory\jenkins-learnings\details\085-precompiled-manifest-traceanalysis-module-dep.md`
- 引擎模块: `D:\Epic\UE_5.5_51\Engine\Source\Developer\TraceAnalysis\TraceAnalysis.Build.cs`
- 问题模块: `D:\ws_twe_ue5.5_ci\Project\Plugins\G\AesWorld\Tests\AesWorldInsights\AesWorldInsights.Build.cs`
- Jenkins 构建: http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/console

### 预防措施

1. 在 UE5 Installed Build 环境中添加新模块依赖时，先检查目标模块是否设置了 `PrecompileForTargets = PrecompileTargetsType.Any`
2. 如果目标模块位于 `Engine/Source/Developer/` 目录，说明它仅在源码构建中可用，不应在 Runtime 模块中直接依赖
3. 将运行时功能和编辑器/开发工具功能拆分到不同模块中，分别设置正确的 Module Type
