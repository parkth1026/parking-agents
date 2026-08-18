# 诊断报告：twe-ue5.5-linux-ci #466 构建失败

> Job: `/job/wdp-ue/job/Earth/job/twe-ue5.5-linux-ci` #466 | 结果: FAILURE | 构建时长: 约 23.6 分钟
> 日志副本: 本目录 `console.log`（原始保存路径 `C:\Users\Administrator\memory\jenkins-learnings-raw\tmp\ue-error\twe-ue5_5-linux-ci_466_20260814_145522.log`，132,069 字节）

## 诊断：-Wdelete-incomplete（deleting pointer to incomplete type）— AesLodSystemLayeredQuadRequest.h

**错误信息**：
```
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniquePtr.h(66,3):
error: deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior
[-Werror,-Wdelete-incomplete]
note: in instantiation of member function 'TDefaultDelete<FAesTracePayloadScope>::operator()' requested here (UniquePtr.h:272)
note: in instantiation of member function 'TUniquePtr<FAesTracePayloadScope>::~TUniquePtr' requested here
  → D:\ws_twe_ue5.5_linux_ci\Project\Plugins\G\AesWorld\Source\AesLodSystem\Private\AesLodSystemLayeredQuadRequest.h(14,14)
note: forward declaration of 'FAesTracePayloadScope'
  → AesLodSystemLayeredQuadRequest.h(9,8)
1 error generated.（编译单元：Module.AesLodSystem.cpp，[13/474]，TWE Linux Shipping 目标）
```

**根因分析**：
CI 构建的 AesWorld `dev@8894ec395`（2026-04-08 02:07，"拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)"）中，头文件 `AesLodSystemLayeredQuadRequest.h` 同时存在三件事：
1. 第 9 行仅有前向声明 `struct FAesTracePayloadScope;`（完整定义不在本头文件，也未 include）；
2. 第 122 行成员 `TUniquePtr<FAesTracePayloadScope> PayloadTraceScope;`；
3. 第 14-22 行 `FORCEINLINE` 构造函数与 inline 虚析构函数**定义在头文件内**。

任何包含该头文件的翻译单元（本例为 unity build 产物 `Module.AesLodSystem.cpp`）编译 inline 构造/析构时都要实例化 `TUniquePtr<FAesTracePayloadScope>::~TUniquePtr`，进而在 `FAesTracePayloadScope` 不完整的情况下执行 `delete Ptr`——这是未定义行为。Linux 工具链（v23_clang-18.1.0-rockylinux8）开启 `-Werror`，将 clang 的 `-Wdelete-incomplete` 诊断升级为 error，编译在 [13/474] 步终止，最终 `Rebuild All: 0 succeeded, 1 failed` → `ERROR: Package project failed.`。

为什么只有 Linux CI 挂、Windows Editor 不挂：同一份代码在前一阶段 `TWEEditor Win64 Development`（MSVC 2022）编译 519/519 全部成功——MSVC 对 delete 不完整类型是 C4150 warning（默认不升 error），而 Linux clang + `-Werror` 直接判死。这是"仅 Linux CI 红而 Windows 绿"的典型模式。

**引入源头**：触碰该文件的最近提交为 `5e3358744`（2026-04-07 21:17，"新增AesWorldInsights性能分析模块，重构ProducerGraph接口"），`PayloadTraceScope` 成员与 inline 化的构造/析构由此进入，#466（2026-04-08 03:55 左右触发）首次在其上构建失败。

**重要结论：该错误已在 dev 修复，流水线已恢复绿色，无需再行动。**
- 修复提交 `694ca4501`（2026-04-08 09:59，"修复clang下TUniquePtr<FAesTracePayloadScope>不完整类型导致的编译错误"）将构造/析构移出 header 到 `AesLodSystemLayeredQuadRequest.cpp`（该 .cpp include 了含完整定义的 `AesWorldProfilingTrace.h`），头文件仅保留声明。
- 时间线验证：`merge-base --is-ancestor` 确认修复 commit **不在** CI #466 构建的 commit（8894ec395）中（CI 构建早于修复约 8 小时）；#466/#467/#468 连续 FAILURE，#469（2026-04-08）起恢复 SUCCESS，#470 亦 SUCCESS。

**置信度**：高

### 证据

| 来源 | 状态 | 结果 |
|---|---|---|
| 2.1 源码 | 已完成 | `git show 8894ec395:...AesLodSystemLayeredQuadRequest.h`：第 9 行前向声明、第 122 行 `TUniquePtr<FAesTracePayloadScope> PayloadTraceScope;`、第 14 行 FORCEINLINE 构造（本地仓库 `D:\Git\AesWorld`，工作区干净，dev 分支含 CI commit）；`git show 694ca4501` 修复 diff 将构造/析构移入 .cpp |
| 2.2 知识库 | 已完成 | 搜索词 `Wdelete-incomplete,FAesTracePayloadScope,AesLodSystemLayeredQuadRequest,TUniquePtr`；评分 **9/10**（同错误代码 + 同文件 + 同类型 + 含修复指引）。关键条目：`jenkins-learnings\details\2026-05-04-learning.md`（"FAesTracePayloadScope is forward-declared but not fully defined at the point where TUniquePtr destructor runs ... Include the full type definition header where TUniquePtr<FAesTracePayloadScope> is used"）、`details\twe-ue55-193-UNKNOWN-stderr__fatal__unable_to_access__http__.md`（同类型 C4150 次要错误与修复原则 "never rely on forward declarations when delete will be called"）、index.md 中 `linux-466-Wdelete-incomplete-FAesTracePayloadScope` 与 `linux-468-FAesTracePayloadScope-incomplete`（本构建及 #468 的既有索引条目，details 正文文件缺失，视为悬空链接） |
| 2.3 Epic 助手 | 已跳过 | 双重原因：(a) 知识库评分 9 ≥ 8，按技能规则跳过；(b) 当前环境不存在 `epic-ue-assistant` skill 模块 |
| 2.4 Web 搜索 | 已跳过 | 知识库评分 9 ≥ 8 且根因/修复均已有本地实证（修复 commit 已验证），按技能规则跳过 |

其他日志发现（非失败原因，顺带提示）：
- `EarthZoneGraphBVTree.cpp(77)`：`::Sort` deprecated warning（建议改用 `Algo::Sort`）；
- `EarthZoneGraphTypes.cpp`：`BezierUtilities.h` deprecated header warning（已迁移至 `Curves/BezierUtilities.h`）。
- 两处均为 warning，未阻断构建，但按提示"下个版本将不再编译"，建议择期清理。

### 修复建议

**本次 #466 无需任何改动**——修复 `694ca4501` 已在 dev 上，且 #469 起流水线已绿。若需回溯验证，修复手法为：
1. 将 `FAesLodSystemLayeredQuadRequest` 的构造/析构函数从 `AesLodSystemLayeredQuadRequest.h` 移到 `.cpp`（.cpp 已 include 定义 `FAesTracePayloadScope` 的 `AesWorldProfilingTrace.h`），头文件只留声明；
2. 备选方案：在头文件直接 include 完整定义头（知识库建议做法），但会加大编译依赖，团队实际采用的"移到 .cpp"更优；
3. 预防：凡是声明了 `TUniquePtr<T>` 成员且构造/析构 inline 化的头文件，禁止只依赖 `T` 的前向声明（clang `-Wdelete-incomplete` / MSVC C4150 都会指出来）；CI 侧 Linux `-Werror` 比 Windows 更严格，本地 Windows 编译通过不代表 Linux CI 通过。

### 参考资料

- 知识库：`C:\Users\Administrator\memory\jenkins-learnings\details\2026-05-04-learning.md`、`C:\Users\Administrator\memory\jenkins-learnings\details\twe-ue55-193-UNKNOWN-stderr__fatal__unable_to_access__http__.md`、`C:\Users\Administrator\memory\jenkins-learnings\index.md`（条目 `linux-466-Wdelete-incomplete-FAesTracePayloadScope`）
- 源码证据：本地 AesWorld 仓库（`D:\Git\AesWorld`）commits `5e3358744`（引入）、`8894ec395`（CI 构建点）、`694ca4501`（修复）
- 构建日志：本目录 `console.log`（错误位于第 1746-1775 行附近；deprecated warnings 位于第 2233-2258 行附近）
- Epic 指引 / Web 搜索：跳过（原因见证据表）
