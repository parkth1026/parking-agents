# 构建诊断报告: aes6-ue-runtime-ci #3939

> **构建**: [aes6-ue-runtime-ci #3939](http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/)
> **结果**: FAILURE
> **日期**: 2026-04-07
> **触发者**: xiongxiong (GitLab push)
> **耗时**: 约 279 秒

---

## 诊断: Missing Precompiled Manifest — TraceAnalysis 模块依赖

**主要错误**: UBT ExitCode=6 — Missing precompiled manifest for 'TraceAnalysis'
**根因**: 新增的 `AesWorldInsights` 模块依赖了 `TraceServices`，而 `TraceServices` 传递依赖了 `TraceAnalysis`。`TraceAnalysis` 是引擎模块，未设置 `PrecompileForTargets = PrecompileTargetsType.Any`，因此在预编译（Installed）构建环境中不可用。
**置信度**: High（知识库已有验证修复记录）

---

## 错误详情

### 失败阶段

构建在 **Package Project** 阶段失败。第一阶段（Compile Editor）成功通过（519/519 编译目标全部完成，ExitCode=0），但第二阶段 BuildCookRun 打包时，UBT 尝试为 `TWE Win64 Development` 目标构建 Game 模块时失败。

### 完整错误信息

```
Missing precompiled manifest for 'TraceAnalysis', 'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled.
This module can not be referenced in a monolithic precompiled build, remove this reference or migrate to a fully compiled source build.
This module was most likely not flagged during a release for being included in a precompiled build - set 'PrecompileForTargets = PrecompileTargetsType.Any;' in TraceAnalysis.Build.cs to override.
Dependent modules 'AesWorldInsights TraceServices'
```

### 依赖链

```
AesWorldInsights → TraceServices → TraceAnalysis (引擎模块, 无预编译 manifest)
```

### 构建命令（失败的）

```
RunUAT.bat BuildCookRun -project="D:/ws_twe_ue5.5_ci/Project/TWE.uproject"
  -archivedirectory=D:/ws_twe_ue5.5_ci/Package/Windows/ci-1.0.47/Data/TWERuntime
  -targetplatform=Win64 -clientconfig=Development
  -nocompileeditor -nop4 -pak -cook -stage -archive -package -compressed -prereqs -build -utf8output
```

---

## 根因分析

提交 `5e33587`（"新增AesWorldInsights性能分析模块，重构ProducerGraph接口"）引入了新的 `AesWorldInsights` 模块。该模块的 Build.cs 中声明了对 `TraceServices` 的依赖。依赖链如下：

1. `AesWorldInsights` 模块 → 依赖 `TraceServices`（引擎模块）
2. `TraceServices` → 传递依赖 `TraceAnalysis`（引擎模块）
3. `TraceAnalysis` 模块没有设置 `PrecompileForTargets = PrecompileTargetsType.Any`
4. 在 CI 的 Installed Build（预编译引擎）环境中，UBT 无法找到 `TraceAnalysis.precompiled` manifest 文件
5. UBT 以 ExitCode=6 退出

**为什么 Editor 编译成功但 Package 失败？**

- Editor 编译（第一阶段）使用的是 `TWEEditor` target，以 Editor 模式构建，此时 UBT 可以使用源码编译所有引擎模块
- Package 阶段使用的是 `TWE` Game target（`-nocompileeditor`），这是 monolithic precompiled build，只能使用预编译好的引擎模块
- `TraceAnalysis` 模块在预编译引擎中没有被包含，所以 Game target 构建失败

---

## 证据来源

| 来源 | 结果 |
|------|------|
| **知识库** | 命中：`085-precompiled-manifest-traceanalysis-module-dep.md`，评分 8/10，包含已验证的修复方案 |
| **Epic 官方助手** | 跳过 — 知识库匹配评分 8/10 且包含已验证修复，无需额外查询 |
| **源码上下文** | 本地仓库未包含最新的 `AesWorldInsights` 模块（尚未 pull 该提交），但通过日志和知识库确认了依赖关系 |
| **Web 搜索** | 跳过 — 知识库已提供充分的诊断信息 |

---

## 已验证的修复方案

**修复提交**: `8894ec3` (xiongxing)
**修复描述**: "拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)"

将 `AesWorldInsights` 模块拆分为两个独立模块：

1. **AesWorldProfiling**（Runtime 类型）— 包含运行时安全的性能分析代码，不依赖 `TraceAnalysis`
2. **AesWorldInsights**（Program/Editor 类型）— 包含依赖 `TraceServices`/`TraceAnalysis` 的分析功能，仅在 Editor 构建中使用

这种架构拆分确保 Runtime 构建（使用预编译引擎）不会拉入仅编辑器可用的引擎模块。

**验证**: Build #3940 已成功通过。

---

## 其他警告

构建日志中还包含以下非致命警告，建议后续处理：

1. **StructUtils 弃用警告**: Plugin 'AesWorld' depends on plugin 'StructUtils' which was deprecated in 5.5 and will soon be removed.
2. **BezierUtilities.h 弃用**: BezierUtilities.h is deprecated; file moved to Curves/BezierUtilities.h
3. **FSelectedOjectsChangeList 弃用**: Use FSelectedObjectsChangeList instead（出现 3 次，在 `EarthModelerSelectionUtil.cpp`）
4. **License not activated**: 构建系统许可证警告

---

## 预防建议

1. 在 UE5 Installed Build 环境中添加新模块依赖前，检查目标模块的 Build.cs 是否设置了 `PrecompileForTargets = PrecompileTargetsType.Any`
2. 如果目标模块仅在源码构建中可用，需要将 Runtime 和 Editor 功能拆分到不同模块
3. 对于性能分析/调试类功能，使用 `Type = ModuleType.DeveloperTool` 或 `Type = ModuleType.EditorNoCommandlet` 标记模块类型
4. 新增模块依赖后，应在本地先测试 Game target 构建（不仅仅是 Editor 构建），以提前发现预编译兼容性问题

---

## 参考

- **知识库**: `C:\Users\Administrator\memory\jenkins-learnings\details\085-precompiled-manifest-traceanalysis-module-dep.md`
- **修复提交**: AesWorld 仓库 `8894ec3951df7601814361a2ad93c5b3e4c6965b`
- **成功构建**: [aes6-ue-runtime-ci #3940](http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3940/)
