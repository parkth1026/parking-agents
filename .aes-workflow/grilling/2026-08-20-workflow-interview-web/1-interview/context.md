# Context Snapshot: 2026-08-20-workflow-interview-web

- 创建：2026-08-20T00:00:00Z
- 分片来源：facts/workflow-interview-family.md、facts/aes-grilling-web-runtime.md、facts/web-interaction-references.md

## 任务陈述

> 我需要开发一个新的skill  worflow-interview-web ，核心是跟 workflow-interview 的核心逻辑，
> 但是所有提问跟 用户的决策交互， 核心内容展现  都使用一个 web 跟agent 进行 双向交互。
> 你可以参考这里的部分实现 .agents/skills/aes-grilling-web，（但这个技能只是单向，并不能双向操作）
> 我整体的想要的效果 有点类似 superpowers/skills/brainstorming 的 web 交互模式与 open-design 的多提问窗口。
> 当然 我最终目标是期望跟 claude design 的多提问窗口一样的体验（附 html 样例
> G:\GIT\ClaudeWork\Design\projects\221d22fb-10d4-4a0b-9721-8f1aee3351d6\收敛-单页全流程.dc.html，
> 这个html是跟 claude design 的交互类似）

补充决定（访谈前用户已答复）：

> 我想要不要超时时间，而且 就算过了一天 在页面里 点确认 就能 agent 继续，你仔细看看 opendesign 是怎么做的

> （交付范围）完整技能+基础测试（推荐）

> 继续走 workflow-interview 流程 不要走 plan

## 用户提出的方案

- 复用 workflow-interview 核心逻辑，只换交互载体（Web 单页双向）
- 参考 aes-grilling-web 的服务实现、superpowers/brainstorming 的交互模式、open-design 的多提问窗口
- 体验对标 Claude Design（.dc.html 样例）

## 意图假设

用户不是要再造一套访谈方法论，而是把已验证的 workflow-interview 三阶段访谈从「终端文本+AskUserQuestion」
升级为「浏览器单页双向」载体：问题、分诊默认、原型质疑、契约确认全部在网页作答，提交后 Agent 自动继续。
关键体验硬指标：**无超时**——发布后隔任意久（含隔天）在页面提交/点确认，Agent 都能接着跑。
与任务陈述的差别：陈述只说「双向交互」，答复把「双向」钉死为无超时唤醒（open-design 式），这排除了
aes-grilling-web 的「回终端发消息」回合模式作为主路径，它只能降级备用。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| workflow-interview 是编排器不自产出文件，三阶段经 session.mjs 门禁流转 | facts/workflow-interview-family.md | Fact |
| rounds.jsonl 只经 session.mjs round 写；ask 行 pct 和 100±2 | 同上 | Fact |
| asking.md 分诊三档 + 批量问 + 三段选项是共用方法论，Web 化不应改方法论本身 | 同上 | Fact |
| aes-grilling-web 数据层已有浏览器→文件回传通道（WS choice 事件→events JSONL），缺自由文本/整轮提交/唤醒 | facts/aes-grilling-web-runtime.md | Fact |
| aes-grilling-web 协议红线：不等待不唤醒、Web 只收点击、契约确认回终端——本次需有意放宽并记录取舍 | 同上 | Fact |
| open-design 双向本质 = 表单提交即新用户消息开启新回合，无轮询无等待 | facts/web-interaction-references.md | Fact |
| ZCode 宿主的等价唤醒通道 = Bash 后台任务退出时重新唤起 agent | 同上 | Fact |
| .dc.html 给出完整目标 UX（面包屑/歧义计数/左问右锁/chip 选项/默认虚线/Other/终态文档溯源）与视觉语言 | 同上 | Fact |
| 仓库约定：.mjs 零依赖、禁 PowerShell、.agents/skills 为开发真源、根目录禁散落产物 | facts/workflow-interview-family.md | Fact |
| 验证基建见下方候选池 | package.json；5 个 run-tests.mjs 先例 | Fact |

## 验证基建候选池

- **技能自带 `run-tests.mjs` 黑盒测试**（execFileSync + check() 计数 + fixtures/）——仓库 5 技能先例；
  代价：需自建，但模式成熟可照抄。**主途径**。
- `npm test` 全链（hygiene/discovery/no-tool-names/session-start/pi/harness/bump-version/check:repo）——现成；
  代价：只验仓库级约定（根目录卫生、发现、措辞），不验技能行为。**收尾必跑**。
- `node --test` 内置运行器——现成；代价：需按其断言风格组织。
- browser-use 技能实点浏览器——半自动；代价：依赖插件与人工判断，进 evidence 不进门禁。
- 无覆盖率工具——AC 不设覆盖率指标。

## 术语冲突

- 用户消息写的 `worflow-interview-web`（少 k）与 issue slug `2026-08-20-workflow-interview-web` 不一致：
  按 slug 走，技能名 `workflow-interview-web`，已列默认区待不反对。
- 「单向/双向」：aes-grilling-web 数据层其实有回传，用户说的「单向」指控制流（agent 不会被浏览器唤醒）。
  本访谈按控制流语义使用「双向」。

## 四分类

- **Fact**：三阶段编排与门禁机制；asking 方法论；aes-grilling-web 可复用逻辑与红线清单；
  open-design 提交即新回合机制；ZCode 后台任务唤醒语义；.dc.html UX 细节；仓库脚本/落盘约定；验证基建。
- **User decision**：
  - 唤醒模型（已决：无超时，隔天页面确认可用，机制研究 open-design）；
  - 交付范围（已决：完整三阶段 Web 化 + run-tests + design.md，evals 后补）；
  - 跨天边界：宿主会话关闭后 server 是否独立存活（本轮提问区 Q1）；
  - 契约最终确认在 Web（本轮确认区 C2）；
  - 原型对照物在单页内的呈现方式（本轮确认区 C3）；
  - 唤醒技术机制的采纳（本轮确认区 C1）。
- **Agent-owned**：默认端口与粘性端口文件、state.json/submissions schema 细节、UI 组件实现、
  publish/wait-submit 脚本参数、测试组织方式、localStorage 草稿保存、开场卡只读。
- **Blocked**：无。

## 决定边界未知项

- 无（跨天边界已归入提问区 Q1）。

## 未知项

- 无跨仓库边界未知项（用户对体验的要求已在对话中给出；其余为实现选择，归 Agent-owned）。
