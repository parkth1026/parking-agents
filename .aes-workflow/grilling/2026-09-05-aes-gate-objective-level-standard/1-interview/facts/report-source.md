# Deep Research: AES 跨仓 Gate Assurance Level 标准

- 日期：2026-09-05
- 受众：AES 技能与各产品仓库维护者
- 范围：跨仓统一的 L0-L5 语义、可机械判定字段、与 test type/size/live/release policy 的边界
- 排除：本阶段不修改 `aes-gate`、目标仓库 gate 或 AES Master

## 执行结论

没有 ISO、ISTQB、Google、Bazel 共同定义的通用 `L0-L5` 门禁标准。AES 可以制定自己的
`AES Gate Assurance Level`，但必须明确它是 AES 组织标准，并用完整命名避免与 SLSA
Build L0-L3 等既有等级冲突。

`AES-QG Lx` 应只表达同一候选上的 functional/artifact assurance boundary（功能与制品保证边界）。
security、performance、accessibility、live、manual/UAT、provenance 不是更高一级的同一概念，
必须作为正交证据字段进入 release profile。`qualifiesForRelease` 是“所需 L + 正交证据 +
candidate/artifact identity 绑定”的 policy verdict，不是第七级。

## 术语裁决

| 概念 | 标准含义 | AES 中的职责 |
| --- | --- | --- |
| test level | 围绕 test object、目标、风险与开发阶段组织的测试活动 | 作为 L 语义设计的理论输入，不直接等同 AES L |
| test type | functional/security/performance/usability 等质量属性 | `qualityAttributes[]`，可横跨任意 L |
| test size | 时间、CPU/RAM、网络、文件系统和外部依赖重量 | `sizeClass`，不决定 assurance level |
| gate profile | 某场景要求的 suites、L 下限、正交证据和完成条件 | 仓库/组织 policy，例如 presubmit/release |
| AES-QG assurance level | AES 自定义的跨仓候选保真度与行为边界 | 本任务要建立的 L0-L5 公共契约 |

## 推荐候选 v0

| Level | 固定保证边界 | 允许的典型对象 | 明确不代表 |
| --- | --- | --- | --- |
| AES-QG L0 | Static conformance：不执行 test item；检查源码、配置、生成物、依赖图、schema、编译/链接可成立 | source tree / build graph | 组件行为正确 |
| AES-QG L1 | Component behavior：单组件/模块在隔离依赖下执行，确定性 oracle，私有临时数据 | unit/component/contract implementation | 组件间真实交互 |
| AES-QG L2 | Component integration：两个以上内部组件或 adapter 与受控 fake/emulator/loopback 交互 | local integration / persistence / protocol boundary | 完整产品可以启动 |
| AES-QG L3 | System smoke：组装后的候选或构建产物在受控环境启动，证明 boot/readiness、最小关键路径与清理 | service/app smoke, desktop CDP smoke | 完整用户旅程或发布资格 |
| AES-QG L4 | System E2E：release candidate artifact 在受控代表性环境执行选定的业务关键旅程，验证真实入口、持久化与生命周期 | packaged Web/CLI/desktop E2E | 安装、升级、回滚或所有风险已覆盖 |
| AES-QG L5 | Operational acceptance：实际可分发/安装制品在代表性受控环境验证安装、升级/降级、兼容、启动/停止、回滚与残留 | installer/package/container/deployment candidate | production live、UAT、安全或性能自动 PASS |

该候选按 test object fidelity（测试对象保真度）递增，不按脚本顺序、层号历史或墙钟时间递增。
单个检查按其实际边界归入最低充分 L；名字叫 unit/e2e 不构成分类证据。

## 规范字段候选

每个已注册 gate 至少声明：

- `assuranceLevel`: `AES-QG-L0` ... `AES-QG-L5`
- `subject`: source SHA / build artifact / release artifact / installed artifact
- `environmentClass`: hermetic / controlled / representative / live
- `networkPolicy`: none / loopback / declared endpoints / external-live
- `dataPolicy`: read-only declared inputs / private temp / isolated persistent / production
- `processPolicy`: none / child-owned / desktop-runtime / exclusive，并声明 cleanup oracle
- `sizeClass`: small / medium / large / enormous 与 timeout/resource budget
- `qualityAttributes[]`: functional / security / performance / reliability / accessibility 等
- `evidenceModes[]`: automated / live / manual / exploratory
- `identity`: candidate SHA、artifact digest、suite/policy version、run ID

`run.toml` 继续是 action 注册真源；等级与上述字段需要一个可版本化的 gate metadata schema，
避免把自由文本 name 当成规范。registry 只记录运行事实，不复制命令定义。

## 主张—来源账本

| 主张 | 一手来源 | 日期/版本 | URL | 置信 |
| --- | --- | --- | --- | --- |
| test level 与 test type 是不同维度；level 由 test object/objective/risk 区分 | ISTQB CTFL Syllabus v4.0.1 | 2024-09-15 | https://www.istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf | 高 |
| ISO 29119 定义通用测试概念并推荐 risk-based testing，不定义 L0-L5 | ISO/IEC/IEEE 29119-1:2022 | 2022 | https://www.iso.org/obp/ui#iso:std:iso-iec-ieee:29119:-1:ed-2:v1:en | 高 |
| Small/Medium/Large 可由网络、文件系统、外部系统与时限等客观约束定义 | Google Testing Blog, Test Sizes | 2010-12-13 | https://testing.googleblog.com/2010/12/test-sizes.html | 中高；旧但仍为官方实践 |
| test size 是 heaviness，默认预算 1/5/15/60 分钟；timeout 可独立 | Bazel Common Definitions | 2026-09-05 检索 | https://bazel.build/reference/be/common-definitions | 高 |
| hermeticity 影响历史复现、归因、发布审计与资源隔离 | Bazel Test Encyclopedia | 2026-09-05 检索 | https://bazel.build/reference/test-encyclopedia | 高 |
| unit/integration/E2E 分层；非功能测试按风险另行选择 | Microsoft Azure Well-Architected, Architecture strategies for testing | 2026-09-05 检索 | https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/testing | 高 |
| production/canary 是带真实流量的发布评估，不等于 hermetic test | Google SRE Workbook, Canarying Releases | 2026-09-05 检索 | https://sre.google/workbook/canarying-releases/ | 高 |
| artifact provenance 证明来源与构建方式，不证明功能或安全正确 | SLSA Build Provenance v1.2 | v1.2 Approved | https://slsa.dev/spec/v1.2/build-provenance | 高 |
| SLSA 已使用 Build L0-L3，AES 裸 Lx 有命名碰撞 | SLSA Build Track Basics | v1.2 | https://slsa.dev/spec/v1.2/build-track-basics | 高 |

## 证据冲突与限制

- Google 2010 对 Small 的文件系统/线程限制严于 Bazel 当前 size 定义；说明 AES 必须发布自己的
  normative matrix，不能只借用名称。
- 没有一手来源支持固定六级功能阶梯；L0-L5 是 AES 设计选择，必须用跨仓反例与真实映射验证。
- “critical journeys 已充分覆盖”不能从运行环境自动推断，必须由 AC/risk traceability manifest 声明。
- 桌面、服务、库、CLI、数据流水线的高层 test object 不同；统一的是边界字段，不是相同测试脚本。

## 研究停止理由

ISO/ISTQB、Google/Bazel、Microsoft、Google SRE、SLSA 已覆盖术语、规模、隔离、流水线、
live 与制品身份六个关键主张；两路独立研究结论一致，继续搜集弱来源不太可能改变核心模型。
