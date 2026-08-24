# parking-agents

本仓库承载 AES 工作流技能族与 agent 工程实践。单一上下文：术语表在此，已确认的架构决策记录在 `docs/adr/`；当前目录只有说明页，首条决策由 `domain-modeling` 按需创建。

## Language

### 测试域（aes-qa 努力）

**aes-qa**:
AES 技能族中的权威测试技能：对代码或需求生成合理测试、严格执行、以证据报告结果。
_Avoid_: ultraqa（那是被参考的 OMX 原型）、rigorous-qa

**aes-gate**:
AES 技能族中的门禁技能（计划中）：盘点项目既有门禁、对照行为目标与风险产出缺口清单；aes-qa 开测前调用其检测结果。
_Avoid_: gate-builder（对外通用名）、twe-gate（引擎名，另一层）

**可辩护（Defensible）**:
「权威」的仓库内锐化：每个测试结论都必须有证据链（命令、退出码、产物、转录），无证据不得宣称成功。
_Avoid_: 权威、可信（未锐化的模糊说法）

**可运行行为目标（Runnable Behavior Goal）**:
aes-qa 的一致锚点：无论输入是代码变更还是需求描述，先推导出可运行的行为目标，所有测试场景都打在这个锚上。
_Avoid_: 测试目标、验收目标

**契约 AC（Contract AC）**:
有显式来源（goal-contract、issue、需求原文）的验收标准，aes-qa 中唯一判 PASS/FAIL 的依据。
_Avoid_: 惯例 AC（判罚地位不同的另一层）

**惯例 AC（Convention AC）**:
从 `references/ac-conventions.md` 行业惯例库推导的验收预期，须引条目出处；只进验收意见，不判 FAIL。
_Avoid_: 最佳实践（上下文驱动学派否定的说法）

**验收意见（Acceptance Opinion）**:
aes-qa 报告中惯例 AC 与品味发现的落点：有证据、有出处、不阻断交付；与契约 AC 的 FAIL 分层。
_Avoid_: 建议（太泛）、缺陷（那是 FAIL 层）

**业务终态（Business End-State）**:
用户操作最终落在系统里的可验证状态（数据库记录、文件、Git 提交、事件、服务端状态）；判定强度高于界面文案或退出码。
_Avoid_: 界面反馈（可能是假成功）

**golden 确认（Golden Confirmation）**:
golden 基准的合法性来源：首跑输出须经用户确认才成为后续回归基准，「金」来自点头而非首跑本身。
_Avoid_: 首跑即基准
