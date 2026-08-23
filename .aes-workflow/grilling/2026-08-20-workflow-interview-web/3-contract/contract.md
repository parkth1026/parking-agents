# Goal Contract: workflow-interview-web — workflow-interview 的 Web 入口（三阶段访谈浏览器单页双向、无超时唤醒、隔天可提交）

- Status: Ready
- Target: `.agents/skills/workflow-interview-web/`（新建，开发侧真源；`skills/` 发布侧不在本轮）
- Updated: 2026-08-20

## 原始请求

> 我需要开发一个新的skill worflow-interview-web，核心是跟 workflow-interview 的核心逻辑，但是所有提问跟 用户的决策交互， 核心内容展现 都使用一个 web 跟agent 进行 双向交互。你可以参考这里的部分实现 .agents/skills/aes-grilling-web，（但这个技能只是单向，并不能双向操作）我整体的想要的效果 有点类似 superpowers/skills/brainstorming 的 web 交互模式与 open-design 的多提问窗口。当然 我最终目标是期望跟 claude design 的多提问窗口一样的体验（附 html 样例 G:\GIT\ClaudeWork\Design\projects\221d22fb-10d4-4a0b-9721-8f1aee3351d6\收敛-单页全流程.dc.html）

> 我想要不要超时时间，而且 就算过了一天 在页面里 点确认 就能 agent 继续，你仔细看看 opendesign 是怎么做的

> （交付范围）完整技能+基础测试（推荐）

> 继续走 workflow-interview 流程 不要走 plan

## 目标

显式调用 `$workflow-interview-web` 后，workflow-interview 三阶段访谈的全部提问、分诊默认、原型质疑与契约确认在本地浏览器单页中双向完成：提交即时唤醒 agent 继续下一轮；宿主会话关闭期间提交入盘不丢，重开自动吸收。

## Why

- 现有载体（终端文本 + AskUserQuestion 选项卡）在问题多、三段选项长时，用户读代价困难、易挤牙膏。
- aes-grilling-web 只有单向展示 + 点击收集，答案仍要回终端，且每屏手写 HTML token 成本高。
- 用户明确要求 Claude Design 式单页全流程体验与无超时双向。

## 范围

做：
- 技能全套目录 `.agents/skills/workflow-interview-web/`：`SKILL.md`、`agents/openai.yaml`、`references/`（web-protocol.md、design.md、SUPERPOWERS-LICENSE.txt）、`scripts/`（server.mjs、publish.mjs、wait-submit.mjs、web/ 单页三件、run-tests.mjs）。

不做（执行 Agent 停手的地方）：
- 不修改 workflow-interview 家族（workflow-interview / aes-interview / aes-prototype / aes-goal-contract）与 aes-grilling-web 的任何文件。
- 不改 asking.md 方法论、session.mjs 门禁，以及家族逐轮问答记录与阶段状态文件的结构。
- 不做 `skills/` 发布侧移植（另走移植流程）。
- 不做 trigger-evals/output-evals 评测集（dogfood 一轮后另立 issue）。
- 本技能不实现任务目标（同家族边界）。

## 强约束

- 全部脚本 `.mjs`、Node 内置模块、零 npm 依赖、无 PowerShell（AGENTS.md）。
- server 仅绑定 loopback；token 鉴权全链（URL `?key=` 首跳 + HttpOnly SameSite=Strict cookie + 常时比较 + WS 升级同源校验）；token 不进 git、不进日志。
- 唤醒只经宿主后台任务退出通知；不使用 hook、插件、MCP 通知、CLI resume、模型侧轮询或无限阻塞模拟唤醒。
- 家族阶段状态文件（manifest）只由 session.mjs 写；逐轮问答记录（rounds）只经 `session.mjs round` 写——Web 提交由 agent 映射回 round 行，Web 状态文件不是第二真源。
- 提交先落盘再回执；按 round-id 幂等，重复提交 409。
- 确认版对照物（`../2-prototype/` 五份）不可修改：执行 Agent 改的是产品，不是对照物。
- 依赖断言（diagram 架构视图标注）：runtime 三脚本不 import workflow-interview 家族代码（薄层，靠 agent 串联两条 CLI）；浏览器单页不直接读写家族过程文件。
- UI 中文行文；视觉对标 `.dc.html` 暖纸语言为**结构对照**（mock.html 非像素规范）。

## 自主边界

不用问，直接定：
- state.json / submissions 的字段命名与内部结构细节。
- UI 组件实现、样式微调、动画参数（fadeUp 时长等）。
- 默认端口 19433、粘性端口文件位置、WS 重连退避参数。
- run-tests 的检查组织与命名；openai.yaml 文案。
- localStorage 草稿的键名与序列化格式。
- server 内部路由实现（满足 api-mock.md 报文契约即可）。

必须停下来问：
- 改家族逐轮问答记录或阶段状态文件的结构，或动 session.mjs 门禁逻辑。
- 修改 aes-grilling-web 或 workflow-interview 家族任何文件。
- 引入任何 npm 依赖或外部服务。
- 放宽 loopback / token 鉴权语义。
- 在本轮塞进 AC 之外的新功能（含 evals、发布侧移植）。

## 读什么

- `../2-prototype/mock.html` — 界面结构与关键交互的确认版。
- `../2-prototype/behavior.md` — 行为对照（变化行 1-10、边界 B1-B8、不变清单）。
- `../2-prototype/api-mock.md` — HTTP/WS 报文结构与已锁定约定。
- `../2-prototype/example-run.md` — 端到端场景（含隔天与降级）。
- `../2-prototype/diagram.html` — 架构拓扑与回合循环（拓扑事实源）。

## 要落盘的东西

- D-01: `.aes-workflow/grilling/2026-08-20-workflow-interview-web/web/evidence/ac-004/` — 实点步骤记录 + 截图/录屏（AC-004 的 `[B]` 输入与期望观察清单：三档问题卡渲染 / 作答含 Other / 提交后本轮锁定 / 刷新恢复草稿 / 契约视图确认交互）。
- D-02: `.aes-workflow/grilling/2026-08-20-workflow-interview-web/web/evidence/ac-005/` — 模拟隔天过程记录（杀 wait-submit 前后提交回执、submissions 落盘证据、吸收检查输出）。

## 验收条件

- AC-001: 发布链路可用——server 启动写出 server-info（含 URL/token）；publish.mjs 对不合 schema 的轮次（pct 和不在 100±2）拒收；`/api/state` 返回含新轮的合法 state。
  - Verify: [A] `node .agents/skills/workflow-interview-web/scripts/run-tests.mjs` → 退出码 0（含上述检查）
- AC-002: 提交与唤醒闭环——POST /api/submit 200 时 `submissions/` 目录下该轮 JSON 提交文件先落盘；wait-submit 检测到提交文件即退出并以 stdout 打印该 JSON；无等待者在场时提交仍成功落盘。
  - Verify: [A] `node .agents/skills/workflow-interview-web/scripts/run-tests.mjs` → 退出码 0（含上述检查）
- AC-003: 提交语义边界——同轮重复提交 409；必答缺失 422；Other 超 2000 字符截断并回执 truncated；`/files/` 越权路径 404；shutdown 后进程退出且写 server-stopped 标记。
  - Verify: [A] `node .agents/skills/workflow-interview-web/scripts/run-tests.mjs` → 退出码 0（含上述检查）
- AC-004: 浏览器单页交互符合 mock.html 结构——三档问题卡、右栏已锁定结论、歧义计数渲染正确；作答含 Other 自由文本；提交后本轮锁定；刷新恢复未提交草稿；契约视图确认/需修改交互可用。
  - Verify: [B] `web/evidence/ac-004/steps.md`（实点步骤记录）→ 匹配 `web/evidence/ac-004/expected.md`（期望观察清单；截图/录屏同目录）
- AC-005: 隔天缓冲与吸收——杀掉 wait-submit（模拟宿主关闭）后浏览器提交仍 200 且文件在盘；模拟新会话按续跑协议扫描未消化提交并标记吸收。
  - Verify: [C] 杀 wait-submit → 浏览器提交 200 → 检查 `web/submissions/` 文件存在 → 运行吸收检查步骤 → 全部可观察结果落 D-02
- AC-006: 降级协议文档化——SKILL.md 写明三级降级阶梯（宿主无后台任务→回合模式；Node 不可用→纯文本；浏览器不可用→纯文本），逐字可查。
  - Verify: [D] `.agents/skills/workflow-interview-web/SKILL.md` 降级节内容检查

## 挡着的事

- None.

## 残留风险

- trigger/output evals 延后到 dogfood 之后 — 错了会怎样：触发可靠性与质量回归未量化，误触发/漏触发风险由首轮真实使用承担（Round 1 Q0b 用户裁决）。
- 48h 空闲超时是拍的数值（24h-72h 区间均可） — 错了会怎样：用户隔更久回来时页面已死，需重启恢复（可接受降级，非数据丢失）。
- 契约最终确认在 Web（放宽家族红线） — 错了会怎样：若实测发现 Web 确认易误点，回退终端确认（取舍记录于 D-3）。

## 访谈记录

### 第 1 轮（1-interview）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Agent 如何被浏览器唤醒（Q0，计划阶段先问） | A 有界阻塞等待≤9min 55% / B 回合结束模式 45% | A | 均未选，自定义：「不要超时，过了一天在页面点确认也能继续，看看 opendesign 怎么做」（**推翻推荐**） |
| 首轮交付范围（Q0b） | A 完整+基础测试 75% / B 连评测集 15% / C 最小竖切 10% | A | A |
| 跨天边界（Q1，Deep Research 后重提） | A 修订版：后台任务唤醒+detached server 48h 缓冲+重开吸收 65% / B 会话内存活 35% | A | A |
| 唤醒机制采纳（C1） | 采纳 / 翻掉另议 | 采纳 | 确认采纳 |
| 契约确认位置（C2） | Web / 终端 | Web | 「在web 完成所有 交互与修改文本输入」 |
| 原型呈现（C3） | iframe 内嵌 / 链接新标签 / 不上 Web | iframe | iframe 内嵌 |

Deep Research（用户要求的调研，四路证据：open-design 源码 / Claude Design 公开资料 / Claude Code 官方文档 / 社区工具）：提交即新回合、消息先落盘、daemon 不保活 agent 只保活提交入口与状态、ZCode 后台任务退出通知是本宿主唯一合法等价物（hooks 不支持 defer+resume）。

### 第 2 轮（2-prototype）

五份对照物（mock/behavior/api-mock/example-run/diagram）v1 一次确认（用户 "ok"，含自亮三弱点：整轮提交粒度、Other 与选项互斥、48h 数值）。

### 第 3 轮（3-contract）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | ---|
| AC-004 验证途径 | A 用户实点+evidence 50% / B browser-use 自动 40% / C 只跑 run-tests 10% | A | A |
| AC-005 验证途径 | A 模拟隔天 70% / B 真隔天演练 25% / C 只验缓冲 5% | A | A |

六条 AC 的「错了会怎样」后果描述逐条确认。

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 技能名 workflow-interview-web | 默认 | slug 已存在 | 未反对 |
| 只建 .agents/skills/ 开发侧 | 默认 | AGENTS.md 双侧约定 | 未反对 |
| 全新 .mjs 实现服务（不复制 .cjs/.ps1） | 默认 | 仓库脚本约定+审计教训 | 未反对 |
| UI 中文 + 复刻 .dc.html 暖纸视觉 | 默认 | 用户给定样例 | 未反对 |
| session.mjs 与逐轮记录唯一真源 | 默认 | 家族模式 | 未反对 |
| localStorage 草稿自动保存 | 默认 | 基本输入体验 | 未反对 |
| disable-model-invocation: true | 默认 | 同 3853974 修正 | 未反对 |
| 默认端口 19433 + 粘性端口 | 默认 | 避开 19432 | 未反对 |
| 不动 aes-grilling-web | 默认 | 范围控制 | 未反对 |
| 开场卡只读 | 默认 | 访谈记录不可变纪律 | 未反对 |
| 提交幂等/失败语义照抄 open-design | 默认 | 深度调研验证的成熟语义 | 未反对 |
| AC-001/002/003 走 run-tests；AC-006 走 [D] | 默认 | 仓库技能自带测试先例 | 后果确认 |

## 设计取舍

### D-1 唤醒机制

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 有界阻塞等待 | agent 原地等 ≤9min | 占用回合；超时回退 | 用户明确不要超时 |
| B 回合结束模式 | 同 aes-grilling-web，答完回终端 | 体验断档 | 与目标体验冲突 |
| C（选定）后台任务退出通知 | 挂无超时 wait-submit 后台任务，结束回合，提交→退出→宿主唤起 | 绑定有后台任务能力的宿主 | 无 |
| 什么都不做 | 保持终端模式 | — | 用户要求升级 |

选定 C。理由：open-design「提交即新消息」在本宿主的唯一合法等价物；模型不阻塞，不违反家族禁轮询红线（等待由宿主后台任务承担）。落进契约：`强约束`「唤醒只经宿主后台任务退出通知」。

### D-2 server 生命周期

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A（选定）detached 无看门狗 + 48h 空闲超时 | 宿主关闭后页面仍可提交，重开吸收 | 忘收尾留进程到超时 | 无 |
| B owner 看门狗随宿主死 | aes-grilling-web 纪律 | 关宿主页面变墓碑，隔天提交丢失 | 违背「过了一天」要求 |

选定 A。理由：调研确认业界无人保活 agent，保活的是提交入口+状态；open-design daemon 随应用死但消息先落盘——我们取其落盘纪律、加强其存活窗口。落进契约：`强约束` 提交先落盘；残留风险记 48h 数值。

### D-3 契约最终确认位置

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A（选定）Web 确认+需修改文本框 | 单页内闭环 | 放宽家族红线，误点风险 | 无 |
| B 终端确认 | aes-grilling-web 红线 | 体验断档最后一截 | 用户明确「所有交互在 Web」 |

选定 A。理由：唤醒机制使 Web 确认可靠（有真实提交记录可审计）；红线当初的成因（无法唤醒）已被 D-1 消除。落进契约：残留风险记回退路径。

### D-4 UI 驱动方式

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 每轮手写整页 HTML | aes-grilling-web 模式 | token 贵、易错、右栏累积难 | 弃 |
| B（选定）JSON 状态驱动单页 | publish 写 state.json，页面渲染 | 前端复杂度高一点 | 无 |

选定 B。理由：open-design 的核心启示——声明式 JSON 即 UI；累积栏/计数/锁定态天然由状态派生。
