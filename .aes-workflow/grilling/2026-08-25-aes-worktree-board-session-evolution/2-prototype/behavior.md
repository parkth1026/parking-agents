<!-- 修订候选 v3 | revised 2026-08-25
     依据用户要求与三路独立审查修正，等待重新确认
     执行 Agent 改的是产品，不是这份对照物。 -->

# 行为对照表：GitHub Actions 式 Issue 消化控制面

**修订候选 v3。** 执行 Agent 改的是产品，不是这份对照表；用户重新确认后锁定。

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| B1 | 首次在目标 repo 启动 board | LLM 扫描同级 worktree 并临场决定 worker；旧 `board.config.json` 可能带错 repo。 | `runner init` 由确定性脚本生成 Git 忽略的 slot allowlist，锁定 repo identity、5 个 slot、saved project 与 capabilities；LLM 只能消费配置。 |
| B2 | 已配置 slot 的路径缺失、移动或指向别的 repo | collect/运行时后置发现，可能污染状态。 | slot 立即 `QUARANTINED_CONFIG_DRIFT`，不领取 job；只有显式 `runner update/init` 可修复配置。 |
| B3 | slot 上一单已 terminal、lease 已释放、工作区 clean | 长期 branch 可能保留旧 ancestry，由 Master 临场处理。 | managed runner 自动把固定 worker branch 同步到精确 integration HEAD，然后才允许 claim。 |
| B4 | slot 存在 dirty/untracked | Master 询问用户是否继续，可能阻塞整个 Goal。 | 该 slot `QUARANTINED_DIRTY`，绝不 reset/clean；Master 继续调度其他 slot，只有无可用容量时汇总报告。 |
| B5 | frontier 出现 `ready-for-agent` Issue | 只检查 OPEN/frontier/标签，worker 自行理解正文。 | 先校验最小 Issue Contract；缺目标、workflow role、AC、依赖、风险/人工门或副作用边界时不 claim，回流 `needs-info/for-human`。 |
| B6 | Master 领取一个合法 Issue | 创建 executor Task，prompt 直接承担大部分流程。 | 创建稳定 `jobId` 和 `attemptId`，向一个 owner session 发送 typed `IssueWorkOrder`，owner 启动绑定该 Issue 的 Worker Goal。 |
| B7 | workflow role=`implement` | executor 自行决定是否调用 TDD/review。 | `aes-issue-worker` 主 Agent 显式调用 implement/TDD，在同一 owner session 完成实现与每轮修复。 |
| B8 | candidate commit 产生 | Master 另开 reviewer Task并解释 finding。 | owner session 固定启动只读 review subagent，绑定 Issue Contract digest、base 和 candidate commit，返回 typed Standards+Spec findings。 |
| B9 | review 返回 must-fix | 每次 BLOCK 都进入全局 ledger，三次后人工 handoff；manual debt 曾被机械循环。 | owner 主 Agent 在 Worker Goal 内修复、提交新 commit、使旧 review 失效并重新 review；普通 finding 不通知用户或 Master。 |
| B10 | review 通过且改动需要 QA | runtime verdict/人工债务由 Master自然语言判断。 | owner 启动 `aes-qa` subagent；按影响面选择自动/live/manual 档，返回绑定 commit/environment 的 `QaReceipt`。 |
| B11 | QA/test 出现可复现失败、timeout 或环境污染 | 统一表现为 FAIL/BLOCK，依赖 Master诊断。 | StageResult 分类为 must-fix/retryable/environment；owner 在阶段预算内修复、重试、调整 timeout 或升模。 |
| B12 | Worker 发现不属于当前 AC 的独立问题 | 容易 scope creep，或问题只留在聊天中。 | 输出 `DISCOVERED_WORK`；Master 去重并调用 Wayfinder 创建/拆分/关联 Issue。非阻塞时当前 job 不停。 |
| B13 | 新问题是当前 AC 的 blocking dependency | 可能由 worker越界修复或直接请求用户。 | Master→Wayfinder 建立 blocking edge；当前 job typed `BLOCKED_DEPENDENCY`，依赖 Issue 可继续进入其他 slot，不必立即找用户。 |
| B14 | 发现 AC 自相矛盾或需要改变目标 | Master/worker 临场放宽。 | typed `CONTRACT_CONFLICT`，Worker Goal 终止为 awaiting decision；只有用户 waiver 可改变 AC。 |
| B15 | owner thread 暂时中断 | Root 依赖自然语言恢复。 | 优先恢复原 thread；确认不可恢复后同 job 新建 attempt，使用持久 handoff bundle 从 live worktree/commit/证据续跑。 |
| B16 | stage 循环消耗超过预算 | 三次 BLOCK 统一 handoff，或继续烧 token。 | Worker Goal 输出 `BUDGET_EXHAUSTED`；Master 可按政策换 attempt/runner、调用 Wayfinder 或进入 awaiting-human。 |
| B17 | 所有 AC、test、review、所需 QA 通过 | worker 文本声称完成，Master再拼装 merge gate。 | owner 输出 typed `READY_TO_MERGE`，精确绑定 job/attempt/Issue/contract/base/candidate/review/QA。 |
| B18 | Master 收到 READY_TO_MERGE | host-only merge 已有门禁，但 job/session/QA 证据不完整。 | Master fresh 校验 slot、commit、integration、AC、review、QA；串行 merge 并运行 post-merge verification。 |
| B19 | post-merge verification 通过 | integration 非默认分支时 Issue 可能保持 OPEN。 | Master 给精确 Issue 写证据 comment，幂等 close，并释放 slot；随后恢复 clean baseline 领取下一 job。 |
| B20 | for-human 需求或人工验收 | parked/manual debt 表达不统一。 | owner 进入 `awaiting-human`，冻结 immutable candidate/QA environment receipt 并释放 writer slot；PASS 后 Master 继续 delivery，FAIL 时同 job 分配 slot/恢复 attempt；需保活的测试环境使用独立 environment lease。 |
| B21 | Master Goal 无 active job | 静态 frontier/未登记 lane 曾导致提前 complete 或 idle。 | fresh runner registry + job queue + inbox + Git + Issue graph 同时为空/terminal 才 STOP；每个空闲 slot 都有可解释状态。 |
| B22 | 启用新 runner/job/attempt 模型 | 现有 v3 runtime 保存 Task/reviewer/transition 历史。 | v3 runtime 原样封存为 read-only legacy archive；新模型从干净 registry 启动，session evidence exporter 只用路径/hash/引用纳入历史与 eval，不反向推导伪 job/attempt。 |
| B23 | 中尺寸竖屏 `700×1000` 打开 Board | 旧候选把 SVG 永久锁在 390 宽坐标系，700 宽时只是把小手机稿整体放大，节点、文字、拖拽和缩放中心均不是原生 700 布局。 | `700×1000` 是本轮精确视觉截图基线；图谱按容器实时宽高建立原生坐标，使用竖向放射布局，runner 使用底部抽屉，Issue 详情先显示不遮挡图谱的 peek sheet，List 为单列。`640×960` 与 `768×1024` 只做相邻竖屏回归；产品 desktop 仍保留原全屏星图、右侧 Workers 和原交互。旧 `390×844` 候选及证据只作为 superseded 历史保留。 |
| B24 | 选择一个 Issue 节点 | 只展示静态位置或把固定节点淡出，文案却称为“展开”。 | 首次选择进入真实一跳展开状态：揭示概览中折叠的一跳节点，当前节点与一跳邻居按竖屏放射布局移动，相关边突出、其他概览节点淡出；再次选择同一节点或点复位回到概览。搜索、List、worker 定位与键盘 Enter/Space 复用同一 `selectIssue` 语义。 |
| B25 | 打开无真实状态源的确认版 mock / snapshot | 硬编码内容可能显示 `LIVE`、running，并留下可点击但无行为的外部操作按钮。 | 明确显示 `DEMO SNAPSHOT`；所有示例数据来自同一 fixture，外部日志/GitHub 操作禁用并标“仅示意”。只有合法 live API/identity 校验成功后产品才可显示 `LIVE`。 |
| B26 | 选择不同 Issue、切换 List、搜索或按状态过滤 | 详情可能只换标题却复用别的 Issue 证据；List/搜索/图例各自维护不一致状态。 | Issue、status、runner、job、attempt、Goal、candidate、review、QA、discovery、delivery/lease 必须从同一记录原子渲染；字段缺失显示 `未产生 / NOT_RUN`。Map/List/search/filter/runner drawer 共用单一状态源，切换视图时隐藏不适用的 Map 浮层。 |

## 边界值与失败形态

| # | 边界 | 锁定行为 |
| --- | --- | --- |
| E1 | slot 配置为空 | Master Goal 不启动，退出非零并提示先 `runner init`；不由 LLM 自动补 slot。 |
| E2 | 所有 slot quarantined | 不 claim；输出每个 slot 原因和恢复命令，不把 Goal 标 complete。 |
| E3 | Issue label ready 但合同不完整 | 不创建 owner session；产生 contract rejection，不计 worker failure。 |
| E4 | review/QA 返回未知 schema | 不推进 cursor/commit gate；StageResult 保持 pending，要求合法 replacement。 |
| E5 | owner commit 在 review 后前进 | 旧 review 与 QA 全部失效，必须绑定新 commit 重跑。 |
| E6 | Master 重复收到同一 discovery | 通过 discovery digest/Issue search 幂等关联已有 Issue，不重复创建。 |
| E7 | Issue 已被其他 job claim | reservation 冲突，当前 slot 改领下一项。 |
| E8 | merge 成功但 post-merge verification 失败 | Issue 不关闭、slot 不释放为可领取；保留 merge commit 和失败证据，进入 typed Master disposition。 |
| E9 | close API 重试 | 已关闭且证据 comment digest 相同视为 already-succeeded。 |
| E10 | 用户长期不回复 | job 保持 awaiting-human，不占 managed runner writer lease；immutable candidate 与 QA receipt 保留。环境必须保活时只占独立 environment lease。 |

## 不变清单

- Worker 永远不能 merge integration branch；只有 Master host merge。
- 不自动删除 worktree，不自动清理 dirty/untracked，不覆盖用户现场。
- merge/review/QA 始终绑定精确 commit；candidate 前进使旧证据失效。
- registry 是当前状态真源；inbox/transitions/receipts 保持 append-only 审计。
- `runtime=NOT_RUN` 不能伪装为 PASS；人工验收不能由 Agent 代答。
- GitHub repo/account/permission、repo root、integration branch 和 runtime identity 继续 fail closed。
- 多 runner 可并行执行/review/QA；integration merge 与 post-merge verification 保持串行。
- 旧 session 与失败记录不删除；新 attempt 不覆盖旧 attempt。
- 明确 `ready-for-human` 的 Issue 不进入无人值守 for-agent claim。
- `700×1000` 锁定中尺寸竖屏工作台基线；`640×960` / `768×1024` 是相邻回归，旧 `390×844` 只保留为历史；desktop 产品全屏星图与既有交互不得降级。
- worker beacon 独立于节点淡出层；聚焦、搜索和过滤时仍保持可辨认。
- 静态 mock/fixture 不得显示成 `LIVE`；任意 Issue 详情不得复用其他 Issue 的领域证据。

## 配置差异

| 字段/文件 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| `board.config.json` | 混有 mainBranch、issueRepo、port、CLI agent，当前内容可能跨 repo 过期。 | 只保留可提交的 board/UI 默认值；不得作为本机 runner identity 真源。 | 检测到 repo identity 字段时提示迁移，不静默使用。 |
| `.aes-worktree-board/runner-slots.local.json` | 不存在。 | 本机、Git 忽略、schema 校验的 slot allowlist。 | `runner init` 从用户指定/确认的既有 worktree 和 saved project 生成。 |
| model | `luna-max \| sol-high` 字符串。 | `economy` / `standard` / `frontier` 语义档，provider adapter 映射 model + reasoning effort。 | 旧值可读并映射，写回只用新格式。 |
| budgets | 主要是三次 BLOCK。 | job、review、QA、env retry、模型升级、时间/token 分层预算。 | 缺失使用版本化默认值并在 status 显示来源。 |
| runtime registry | Task 为中心。 | runner/job/attempt/session/stage evidence 分层。 | 旧 v3 registry 原样只读封存；新 registry 干净启动，禁止迁移推导和半新半旧写入。 |

## 待用户质疑点

1. Worker Goal 的阶段预算默认值由 prototype 后续契约决定，不在本表写死具体数字。
