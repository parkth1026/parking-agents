# 诊断：twe-ue5.5-linux-ci #466 — clang `-Wdelete-incomplete`（不完整类型删除）

- **构建**：`twe-ue5.5-linux-ci` #466（`http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-linux-ci/466/`）
- **构建时间**：2026-04-08 03:55:49 +08:00，耗时 23 分 33 秒，结果 **FAILURE**（Package Error）
- **错误信息**：
  ```
  D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniquePtr.h(66,3):
  error: deleting pointer to incomplete type 'FAesTracePayloadScope' may cause
  undefined behavior [-Werror,-Wdelete-incomplete]
  ```
- **根因分析**：`AesWorld` 仓库（CI commit `8894ec3`）的 `Source/AesLodSystem/Private/AesLodSystemLayeredQuadRequest.h` 中，第 9 行仅对 `FAesTracePayloadScope` 做前向声明（`struct FAesTracePayloadScope;`），但第 14 行在头文件内以 `FORCEINLINE` 定义了 `FAesLodSystemLayeredQuadRequest` 构造函数，且第 122 行持有成员 `TUniquePtr<FAesTracePayloadScope> PayloadTraceScope;`。编译 `Module.AesLodSystem.cpp`（Linux Shipping，clang 18.1 交叉编译，`-Werror`）时，`~TUniquePtr<FAesTracePayloadScope>` 在构造函数处被实例化，执行 `delete Ptr`（UniquePtr.h:66）时类型仍不完整——未定义行为，被 `-Werror` 升级为编译错误，UTB 中止，后续 Package 阶段失败（级联）。
  该问题的引入源头是 commit `8894ec3`「拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)」重构：`FAesTracePayloadScope` 的完整定义被移入新模块头文件 `AesWorldProfiling/Public/AesWorldProfilingTrace.h:79`，而 `AesLodSystemLayeredQuadRequest.h` 只留下了前向声明。Windows/MSVC 侧同一代码模式此前表现为 C4150（twe-ue5.5 #193、twe-ue5.5-installed #493），本次是同一根因在 Linux/clang 下的再现；本次构建中 `TWEEditor Win64` 目标已正常编过，仅 `TWE Linux Shipping` 失败（[13/474]）。
- **置信度**：高（日志实例化链、源码、知识库、git 修复 commit 四重证据一致）

### 证据

| 来源 | 结果 |
|---|---|
| 知识库（评分 8/10） | 搜索词 `Wdelete-incomplete` / `FAesTracePayloadScope` / `AesLodSystemLayeredQuadRequest`，命中 15 条：`C:\Users\Administrator\memory\jenkins-learnings\details\2026-05-04-learning.md`（twe-ue5.5-installed #493 同文件同类型 C4150，修复指引"在使用处包含完整类型定义头文件"）、`details\twe-ue55-193-UNKNOWN-stderr__fatal__unable_to_access__http__.md`（#193 次要错误 C4150 同文件，"C4150 is a code smell indicating a forward declaration where a complete type is needed"）、`index.md` 含本构建专属条目 `[[linux-466-Wdelete-incomplete-FAesTracePayloadScope]]`（该条目详情文件已缺失，内容经由上述关联条目覆盖） |
| Epic 指引 | 跳过：知识库评分 ≥ 8（技能来源选择规则）；且当前会话未安装 `epic-ue-assistant` skill |
| 源码上下文 | CI commit `8894ec3` 下 `AesLodSystemLayeredQuadRequest.h`：L9 前向声明、L14 FORCEINLINE 构造（实例化点，见日志 note: in instantiation of `TUniquePtr<FAesTracePayloadScope>::~TUniquePtr`）、L122 `TUniquePtr<FAesTracePayloadScope>` 成员；完整定义位于 `AesWorldProfiling/Public/AesWorldProfilingTrace.h:79`；`AesLodSystem.Build.cs` 已依赖 `AesWorldProfiling` 模块 |
| Web 搜索 | 跳过：知识库评分 ≥ 8（技能来源选择规则） |
| git 历史（补充） | 本地 `D:\Git\AesWorld` dev 已包含已验证修复 commit `694ca4501`（2026-04-08 09:59:44 +08:00，构建失败当天上午）：「修复clang下TUniquePtr<FAesTracePayloadScope>不完整类型导致的编译错误——将构造函数和析构函数从头文件移到.cpp文件，确保TUniquePtr析构时FAesTracePayloadScope为完整类型」 |

### 修复建议

本错误在当前 dev 分支上**已经修复**（commit `694ca4501` 已合入 dev，本地 HEAD 中构造/析构已移至 `.cpp`），无需再改代码；若需在旧起点重跑或同类问题再现，按已验证方案处理：

1. **首选（与已验证修复一致）**：把 `FAesLodSystemLayeredQuadRequest` 的构造函数与析构函数声明保留在头文件、实现移到 `AesLodSystemLayeredQuadRequest.cpp`（该 .cpp 已 `#include "AesWorldProfilingTrace.h"`，析构实例化点类型完整）。
2. **替代方案**：在 `AesLodSystemLayeredQuadRequest.h` 中直接 `#include "AesWorldProfilingTrace.h"`（模块已依赖 AesWorldProfiling，Build.cs 无需改动；代价是增加头文件耦合，知识库 #493 条目采用的即此思路）。
3. **通用预防**：持有 `TUniquePtr<T>`/`delete T` 的头文件中不要只留 `T` 的前向声明——MSVC 是 C4150 警告（易被忽略），Linux clang `-Werror` 直接失败。

### 错误分组说明

日志共提取 9 个错误块，其中 1 个为真实编译错误（上述 `-Wdelete-incomplete`），其余均为级联/包装错误：UBT 启动命令行 6 块（匹配到 UnrealBuildTool 关键字）、`UnrealBuildTool failed` 1 块、`ERROR: Package project failed` 1 块（UAT 汇总，pipeline 末尾 `Finished: FAILURE`）。

### 参考资料

- Jenkins 控制台日志（本次分析副本）：`D:/GIT_dev/Claude_skills/.claude/skills/ue-error-solver-workspace/iteration-8/eval-2-linuxci/old_skill/outputs/console.log`（原始下载件：`C:\Users\Administrator\memory\jenkins-learnings-raw\tmp\ue-error\twe-ue5_5-linux-ci_466_20260814_150035.log`）
- 知识库：`C:\Users\Administrator\memory\jenkins-learnings\details\2026-05-04-learning.md`、`C:\Users\Administrator\memory\jenkins-learnings\details\twe-ue55-193-UNKNOWN-stderr__fatal__unable_to_access__http__.md`、`C:\Users\Administrator\memory\jenkins-learnings\index.md`
- 修复 commit：AesWorld `694ca4501`（dev）
