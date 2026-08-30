# Fact: aes-worktree-board 的人类状态获取 UX

- 派遣问题：只读调查 `aes-worktree-board` 现有星图、List、Workers/Runner、详情面板、告警、frontier、三维 verdict、人工态、操作入口、渐进披露与刷新机制，判断哪些事实可供 `workflow-story-map` 的「10 秒内看懂 Now / Why / Next」参考，哪些属于 board 专属边界。
- 完成：2026-08-30T06:20:00+08:00

## 结论摘要

现有 board 比当前只展示 Map 的原型更接近「人类状态工作台」，原因不是星图更漂亮，而是它把同一份状态同时投影成三层：

1. **Now（现在怎样）**：顶部 Goal/Orchestration 胶囊、全局进度、状态计数、Workers/Runner 在场与位置、Task state、工作时长、dirty/stale、BLOCK 计数和三维 verdict。
2. **Why（为什么）**：Map 的依赖边与阻塞链、List 的状态队列、Issue 详情里的来路/完成后解锁、候选/Review/QA/Delivery、最近 transition 和显式 `NOT_RUN`。
3. **Next（下一步是什么）**：全局 `nextAction`、每个 Task 的 `nextAction`、可开工 frontier、worker 定位、查看日志/打开 Issue/派发入口，以及 dirty 现场的「取消 / 先侦查 / 仍要派发」。

但它还不是完整的 10 秒决策台：桌面全局胶囊把 `whyNotComplete` 藏在 hover title；没有一等的 Action Center；LIVE 只手动取新数据；竖屏工作台虽有更好的五态、peek→完整证据和 Runner 抽屉，却有明显的 v3→v4 数据投影缺口。`workflow-story-map` 应复用信息架构和渐进披露，不应照搬单仓 Issue 四态、worktree/runner 调度模型或 closed/total 进度口径。

## 查到的：人类如何快速获得 Now / Why / Next

| 维度 | 已实现事实 | 证据出处 |
| --- | --- | --- |
| 设计目标 | 星图设计明确把「Issue 状态与依赖一眼看清」和「每个 worker 走到哪里随时可知」列为两个核心诉求；worker 既是画布常显 beacon，又有 Workers 停靠面板兜底。 | `docs/design/design_handoff_issue_starmap/README.md:3-10` |
| 全局 Now | 桌面顶部同时显示 Map/List、LIVE/SNAPSHOT、ORCH/GOAL 胶囊、刷新按钮和全仓 closed/total 进度；图例显示四态计数并可过滤。 | `skills/workflow/aes-worktree-board/board.html:202-220`; `skills/workflow/aes-worktree-board/board.html:784-854` |
| 编排 Now/Next | ORCH 胶囊直接展示 orchestration state、goal state、全局 `nextAction`、last action、merge queue 数和 unclassified final 数；完整 `whyNotComplete[]` 只放在胶囊 `title`。 | `skills/workflow/aes-worktree-board/board.html:844-854` |
| Lane/worker Now | Workers 面板逐 lane 显示在场位置、Task state、`BLOCK n/3`、`C/R/D` 三维 verdict、模型、dirty、评估过期、工作时长，并能一键定位该 Issue。 | `skills/workflow/aes-worktree-board/board.html:794-816` |
| 队列 Now | List 不是另一张图，而是按 `resolved / claimed / frontier / blocked` 四列聚合的状态队列，卡片包含 Issue、worker 与回归波动；它是对复杂依赖图的降维视图。 | `skills/workflow/aes-worktree-board/board.html:819-833`; `docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md:55-68` |
| Why | Map 用依赖边、阻塞边、节点形态与回归警示编码关系；点击 Issue 后展示状态、分支、前置「来路」、完成后解锁的下游、评估 stale、Task/Thread/Role、时间、模型、Task `nextAction`、未分类 final、三维 verdict 与最近 8 条 transition。 | `skills/workflow/aes-worktree-board/board.html:880-897`; `docs/design/design_handoff_issue_starmap/README.md:38-57` |
| Next/操作入口 | 详情页提供查看 Task 日志、打开 Issue、从 frontier 派活；dirty worktree 会弹出修改数/未跟踪数，并让人选择取消、先做只读侦查或明确继续。 | `skills/workflow/aes-worktree-board/board.html:897-935`; `skills/workflow/aes-worktree-board/board.html:1011-1025` |
| 快速查找 | 搜索支持 Issue 编号、标题、claimed worker；结果会 fly-to、缩放并短暂闪烁。图例过滤与 hover 一跳高亮用于局部聚焦，running worker beacon 不会被完全淡出。 | `skills/workflow/aes-worktree-board/board.html:940-979`; `docs/design/design_handoff_issue_starmap/README.md:83-95` |
| 事实来源 | frontier 不是 Agent 文案：`CLOSED→resolved`、被认领→claimed、存在未关闭依赖→blocked、否则 frontier；三维 verdict 是 registry 事实，不是 collect 自动猜测。 | `skills/workflow/aes-worktree-board/scripts/collect.mjs:510-572`; `docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md:10-14` |
| 诚实缺口 | 缺字段在竖屏详情明确显示「未产生 / NOT_RUN」；UI 自检逐条验证未领取 Job、awaiting-human、delivery 终态和 legacy 证据均可达，避免空白被误读为成功。 | `skills/workflow/aes-worktree-board/board.html:427-464`; `skills/workflow/aes-worktree-board/scripts/selftest-board-ui.mjs:187-217` |

## 竖屏工作台为何比纯 Map 更接近状态工作台

| 已实现事实 | 证据出处 |
| --- | --- |
| 700×1000 工作台首屏同时放置模式/Goal pill、Map/List、Runner 计数、Issue/worker/job 搜索、完成进度和五态计数（可开工、进行中、阻塞、待人工、已探明），而不是只留图。 | `skills/workflow/aes-worktree-board/board.html:407-417`; `skills/workflow/aes-worktree-board/board.html:427-444` |
| 概览默认只保留关键节点；选中节点后才真实展开一跳，并同时打开不遮挡图谱的 peek sheet。用户再点「完整证据」才进入大详情。这是明确的概览→一跳→完整证据三级渐进披露。 | `skills/workflow/aes-worktree-board/board.html:441-467`; `skills/workflow/aes-worktree-board/scripts/selftest-board-ui.mjs:155-185` |
| 完整详情按 `Job/Attempt`、`Runner/Model`、Candidate、Owner Workflow（stage/review/QA）和 Discovery/Delivery 分区；Runner 独立抽屉展示 running/quarantine/idle、位置和定位入口，与详情 sheet 互斥，减少同时开两个上下文的噪声。 | `skills/workflow/aes-worktree-board/board.html:419-420`; `skills/workflow/aes-worktree-board/board.html:427-440`; `skills/workflow/aes-worktree-board/board.html:462-470`; `skills/workflow/aes-worktree-board/scripts/selftest-board-ui.mjs:220-240` |
| Map/List/search/filter 共用单一状态源；切视图会清 selection/detail，键盘 Enter、Escape、ARIA button/dialog/listbox 和 focus trap 都有浏览器自检。 | `skills/workflow/aes-worktree-board/scripts/selftest-board-ui.mjs:250-308` |
| 竖屏工作台从确认版 mock 机械生成并记录 SHA，产品与 mock 做逐像素校验；桌面 1440×900 星图独立做非回归，避免响应式改造破坏既有工作台。 | `skills/workflow/aes-worktree-board/scripts/build-portrait.mjs:1-10`; `skills/workflow/aes-worktree-board/scripts/selftest-board-ui.mjs:70-80`; `skills/workflow/aes-worktree-board/scripts/selftest-board-ui.mjs:448-475` |

## 可复用为 workflow-story-map 的优点（证据支持的推论）

1. **首屏先回答 Now/Why/Next，再把 Map 作为关系解释器。** 可复用的不是四种颜色本身，而是同屏的全局状态、行动/异常计数、lane 摘要、状态队列和关系图互补。Map 擅长回答「为什么被挡住/会解锁谁」，List/摘要擅长回答「现在有几件事需要处理」。
2. **把 lane 变成常显 beacon。** workflow-story-map 的 RepoLane/Delivery wave 可以采用 board 的 worker 常显原则：即使过滤某类节点，活跃、人工等待或降级 lane 仍需保持可见，并提供一键定位。
3. **沿用三级渐进披露。** 概览只显示高信号节点；点选后展开一跳和 peek（状态、owner、next）；再由「完整证据」展开 receipt、Gate、transition、运行日志。这样既可 10 秒扫视，也保留审计深度。
4. **同一事实多投影，不维护两套状态。** Map、List、搜索、筛选、lane drawer 与详情应消费同一 StoryRoot/RepoLane/Gate 投影；board 已用浏览器自检锁定 Map/List/search/filter 一致性。
5. **缺证据必须成为显式 UI 状态。** `NOT_RUN`、stale、unclassified、dirty、blocked、degraded 和 human-wait 不能藏在详情末尾或被绿色总状态吞掉；board 对 `NOT_RUN`、stale、BLOCK n/3 和 dirty 的做法值得继承。
6. **操作入口靠近解释上下文。** 「查看日志 / 打开 tracker / 定位 lane / 执行下一安全动作」应放在对应 Story/RepoLane 详情，而不是让人离开工作台自行拼接上下文。

## Board 专属、不可直接照搬的边界

| 边界 | 为什么不能直接照搬 | 证据出处 |
| --- | --- | --- |
| 单仓 Issue 图 | board 的关系数据只来自一个 `issueRepo` 的 Issue + `blockedBy`；多仓聚合、parent/sub-issue、StoryRoot→RepoLane 都不在当前数据面。 | `docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md:8-14`; `docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md:123-129` |
| 四态和 `closed/total` 进度 | `frontier/claimed/blocked/resolved` 是 Issue/worktree 投影，`resolved` 等同 tracker CLOSED；workflow-story-map 还需 Discovery/Delivery wave、Contract、Gate、Receipt、degraded、requires-decision 和跨 RepoLane Story done，不能把 Issue close 当总完成。 | `skills/workflow/aes-worktree-board/scripts/collect.mjs:537-572`; `docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md:149-149` |
| worktree/runner 调度 | board 的 lane 与本机既有 worktree、writer lease、runner slot、dirty/quarantine、Desktop Task/CLI fallback 强绑定；RepoLane 不必等于一个本机 worktree，人工 lane/远端 CI/只读调查也可能没有 runner。 | `skills/workflow/aes-worktree-board/SKILL.md:49-57`; `skills/workflow/aes-worktree-board/SKILL.md:364-379` |
| merge 专属三维 verdict | `code/runtime/delivery` 很适合交付执行，但不能替代 StoryRoot 的承诺状态、Contract revision、Discovery decision、Receipt freshness 和多仓 Gate 合成；现有文档也确认 Task/job/story 三种粒度不同。 | `docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md:75-102`; `docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md:131-149` |
| 页面内 fallback 派发 | board 的 POST 入口只服务明确授权的 CLI fallback，正常路径仍是 Desktop `create_thread`；workflow-story-map 不应把这一按钮误当通用 Skill Router 或完整 workflow 调用链。 | `skills/workflow/aes-worktree-board/SKILL.md:337-357`; `skills/workflow/aes-worktree-board/board.html:897-901` |

## 已确认的 UX 缺口 / 风险

| 事实或高置信推论 | 证据出处 |
| --- | --- |
| **没有真正的自动数据刷新。** LIVE 的新状态只在点击刷新时 `fetch /api/status`；派发成功后做一次 fast refresh。60 秒 interval 只重渲染已有 `state.status` 以更新时间/布局，不向服务端取新状态。SNAPSHOT 禁用刷新。 | `skills/workflow/aes-worktree-board/board.html:835-843`; `skills/workflow/aes-worktree-board/board.html:995-1028`; `skills/workflow/aes-worktree-board/scripts/server.mjs:333-352` |
| **竖屏工作台的 v4 信息目前不是完整真实投影。** 它预留 stage/job/attempt/runner/review/qa/delivery，但 v3 collect 不产出这些字段，实际会大量落为默认 `ready/NOT_RUN`。 | `skills/workflow/aes-worktree-board/board.html:1076-1111`; `docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md:70-73` |
| **claimed→running 映射存在字段闭集错位。** v3 collect 产出 `claimed`，竖屏映射只承认 `running`；不命中时 OPEN Issue 回退成 `frontier`。因此 fixture 上的 running/human 很强，但不能直接当作 live v3 状态已正确接通的证据。 | `skills/workflow/aes-worktree-board/scripts/collect.mjs:537-560`; `skills/workflow/aes-worktree-board/board.html:1074-1095` |
| **全局阻塞原因不够显眼。** `whyNotComplete[]` 仅进入 ORCH pill 的 `title`，主文只显示 next/last/merge/unclassified；没有按严重度排列的「需要你处理」清单。 | `skills/workflow/aes-worktree-board/board.html:844-854` |
| **frontier 不等于可自动领取。** 视图的 frontier 不读 labels；控制面还需 `ready-for-agent` 且排除 human/info/triage/wontfix。若人把橙色 frontier 理解为「现在 Agent 可开工」，会有语义偏差。 | `docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md:10-14`; `docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md:118-121` |
| **结构化 humanRequest 与 outbox warning 尚未成为一等 Web 面板。** Core 要求人工态携带 prompt/requiredEvidence/resumeToken，gate 也有不阻断 merge 的 outboxWarning；当前桌面总览/详情字段没有展示这两组完整载荷。 | `skills/workflow/aes-worktree-board/SKILL.md:411-445`; `skills/workflow/aes-worktree-board/SKILL.md:498-503`; `skills/workflow/aes-worktree-board/board.html:844-897` |

## 对 workflow-story-map Web 的最小参考骨架（推论，不是用户裁决）

首屏若以 10 秒可读为目标，board 证据支持如下信息优先级：

1. **顶栏：** Story 状态、Contract revision/freshness、总体进度、最后刷新时间、`needs-human / blocked / degraded / stale / unclassified` 计数。
2. **行动中心：** 只列当前需要人或 Agent 做的最高优先级动作，每项说明 owner、why、next 和会解锁什么。
3. **RepoLane 条带/抽屉：** 每 lane 的 tracker/checkout、owner workflow、stage、attempt、Gate/Receipt、工作时长、blocked reason、next action；常显且可定位到图。
4. **Map + List 双投影：** Map 解释依赖/解锁关系，List 按「待人工 / 阻塞 / 降级 / 执行中 / 可启动 / 已完成」做状态队列；两者共享过滤和 selection。
5. **渐进详情：** peek 回答 Now/Why/Next；完整详情再展示 Contract、Receipt、Gate、transition 与日志。

这只是从现有 board 的成功与缺口推导出的 UI 参考，不代表 Story 状态闭集、优先级算法或操作权限已经被用户批准。

## 未知项

- 仓库没有真实用户的 10 秒任务测试、眼动/可用性研究或对「第一眼最重要信息」的量化证据；“Now/Why/Next”排序是基于现有信息架构的高置信推论，不是已完成的人因验收。
- 竖屏五态、human beacon、v4 stage/review/QA/delivery 在 fixture 上有浏览器自检，但当前 live v3 数据不能完整驱动它们；尚不能把 demo screenshot 当作真实运行时证明。
- 没有找到 board 对 `humanRequest.requiredEvidence`、`resumeToken`、waiver 权限、outbox backlog 的专门可视组件，也没有找到 WebSocket/SSE/long-poll 自动刷新机制。
- 当前 board 未聚合多 RepoLane，也未证明如何计算跨仓 Story done；这必须由 workflow-story-map 自己的 StoryRoot 投影定义。

## 没查的

- 未运行 server、浏览器、截图或 live GitHub/GitLab 采集；本分片核对的是仓库技能、HTML、脚本、自检与研究文档。
- 未修改 `manifest.json`、`rounds.jsonl`、`context.md`、`2-prototype` 或产品代码，也未替用户裁决新 Web 布局。
