# 诊断报告：Missing Precompiled Manifest - TraceAnalysis

> **构建**: aes6-ue-runtime-ci #3939 (FAILURE)
> **URL**: http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/
> **日期**: 2026-04-07
> **触发者**: xiongxiong (GitLab push)
> **诊断时间**: 2026-04-14

---

## 构建摘要

| 阶段 | 结果 |
|------|------|
| Prepare | SUCCESS |
| Pull Plugins | SUCCESS |
| Compile (Editor Build) | SUCCESS (519/519) |
| Package Project (BuildCookRun) | **FAILURE** (ExitCode=6) |

编译阶段成功完成（519 个编译单元全部通过），但在 Package Project 阶段（BuildCookRun）失败。构建总耗时约 279 秒。

---

## 诊断：UBT ExitCode=6 - Missing Precompiled Manifest for TraceAnalysis

**主要错误**：
```
Missing precompiled manifest for 'TraceAnalysis', 'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled.
This module can not be referenced in a monolithic precompiled build, remove this reference or migrate to a fully compiled source build.
This module was most likely not flagged during a release for being included in a precompiled build - set 'PrecompileForTargets = PrecompileTargetsType.Any;' in TraceAnalysis.Build.cs to override.
Dependent modules 'AesWorldInsights TraceServices'
```

**根因**：新引入的 `AesWorldInsights` 性能分析模块（commit `5e33587`，"新增AesWorldInsights性能分析模块，重构ProducerGraph接口"）声明了对 `TraceServices` 的依赖，而 `TraceServices` 又传递依赖于引擎模块 `TraceAnalysis`。`TraceAnalysis` 是一个引擎内部模块，其 `PrecompileForTargets` 未设置为 `Any`，因此在 Installed Build（预编译引擎）环境中没有生成 precompiled manifest。当 UBT 在 Package 阶段尝试以 monolithic 模式构建 Game target (`TWE Win64 Development`) 时，无法解析 `TraceAnalysis` 的预编译清单，导致 ExitCode=6 失败。

**注意**：Editor Build 阶段成功是因为 Editor target 以 modular 模式构建，不需要 precompiled manifest。而 Package 阶段的 Game target 以 monolithic 模式构建，要求所有依赖模块都有对应的预编译清单。

**置信度**：高

---

### 证据

- **知识库**：匹配到 `085-precompiled-manifest-traceanalysis-module-dep.md`（score 8/10，已验证修复）。该条目精确记录了相同构建 #3939 的相同错误，包含完整的根因分析和已验证的修复方案。
- **Epic 指导**：已跳过——KB 匹配 score 8/10，有验证过的修复，无需额外查询。
- **源码上下文**：在 `D:/Git/AesWorld` 仓库中确认，commit `5e33587` 引入了 AesWorldInsights 模块，commit `8894ec3` 完成了修复。当前仓库已不再包含有问题的模块结构。
- **Web 搜索**：已跳过——知识库提供了充分证据。

---

### 依赖链分析

```
AesWorldInsights (项目模块)
  └── TraceServices (引擎模块)
        └── TraceAnalysis (引擎模块，无 precompiled manifest)
              ❌ 在 Installed Build 中不可用
```

Editor Build 成功 → Package Build 失败的原因：
- Editor target = modular 构建，模块以 DLL 形式独立加载，不需要 precompiled manifest
- Game target = monolithic 构建，所有模块静态链接，要求每个依赖都有 precompiled manifest

---

### 建议修复

**已验证的修复方案**（commit `8894ec3` by xiongxing）：

将 `AesWorldInsights` 模块拆分为两个独立模块：

1. **AesWorldProfiling**（Runtime）— 包含运行时安全的性能分析代码，不依赖 TraceAnalysis
2. **AesWorldInsights**（Program/Editor）— 包含需要 TraceServices/TraceAnalysis 的分析功能，仅在 Editor 构建中使用

这种架构拆分确保 Runtime 构建（使用预编译引擎）不会引入仅限 Editor 的引擎模块。

**修复已在 build #3940 中验证通过（SUCCESS）。**

---

### 额外警告（非致命）

构建日志中还包含以下 C4996 弃用警告（不影响构建结果，但建议后续处理）：

1. `EarthZoneGraphBVTree.cpp(77)`: `Sort` 已弃用，应使用 `Algo::Sort`
2. `BezierUtilities.h(9)`: 文件已迁移到 `Curves/BezierUtilities.h`
3. `EarthModelerSelectionUtil.cpp(8,17,28)`: `FSelectedOjectsChangeList` 已弃用，应使用 `FSelectedObjectsChangeList`

---

### 预防措施

1. 在 UE5 Installed Build 中添加新模块依赖时，检查目标模块的 `Build.cs` 是否设置了 `PrecompileForTargets = PrecompileTargetsType.Any`
2. 如果目标模块仅在源码构建中可用，则不能在 Runtime 模块中引用
3. 将运行时功能与编辑器工具功能拆分到不同模块，使用 `Type = ModuleType.DeveloperTool` 或 `Type = ModuleType.EditorNoCommandlet` 限定编辑器专用模块

---

### 参考资料

- **知识库文件**: `~/memory/jenkins-learnings/details/085-precompiled-manifest-traceanalysis-module-dep.md`
- **修复 commit**: `8894ec3951df7601814361a2ad93c5b3e4c6965b`（AesWorld 仓库）
- **日志文件**: `D:/Claude_skills/tmp/ue-error-solver/autoci-3939-20260414-003020.log`
- **Jenkins 构建**: http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/
