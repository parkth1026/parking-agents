<!-- draft v1 | published 2026-08-30T00:00:00+08:00
     用户意见：待确认
     状态：awaiting confirmation -->

# 行为对照表: workflow-story-map 新版设计

**草稿，尚未锁定。** 用户确认后才成为执行 Agent 不得修改的尺子。

## 变化行

| # | 输入 / 前置 | 旧设计或当前行为 | 新版设计候选行为 |
| --- | --- | --- | --- |
| B1 | 新会话只有 Story tracker 子图和各 RepoLane 精确 checkout | 会话连续性、tracker-only 与本地目录真源存在冲突，无法保证完整接管 | 从 tracker 的 Story/Ticket/Attempt 控制索引与 repo 的 contract/artifact/receipt 重建同一全局状态；会话不是权威，runtime cache 可删除重建 |
| B2 | 一个用户意图同时修改 GitHub Desktop repo 与 GitLab backend repo | 旧设计以单 tracker/单仓 story 为主，跨仓 done 未定义 | 一个 StoryRoot 包含 `desktop`、`backend` 两个一等 RepoLane；各自有 tracker、exact checkout、integration target 和局部 done；所有必需 lane Gate 合成 Story done |
| B3 | Discovery 已批准第一批实现票，Delivery 验收后出现两个 regression | 旧阶段链偏静态，一次拆票后主要等待清空 | StoryRoot 常驻 DiscoveryMap 与 DeliveryMap；两个 regression 在 contract 不变时自动形成下一 delivery wave，不重新问用户 |
| B4 | 验收发现需要把公开 API 从只读改为可写 | 执行中变化的回流边界未机械定义 | change classifier 产出 `requires-decision`，暂停受影响 lane，回流 Discovery；用户确认 contract revision 后生成新 wave，旧 subject receipts 全部 stale |
| B5 | research ticket 产出三个可独立实现的纵切片 | 票型与阶段可能原地演进或复用同一票 | 原 research ticket 按绑定 profile 关闭，通过 `produces` 创建三张新 implementation ticket；ready 后 profile 不原地变型 |
| B6 | implementation ticket 第一次 attempt 失败后 retry | 旧状态/评论可能覆盖或混用历史证据 | ticket identity 保持稳定；retry 创建新 attempt ID；旧 attempt、commit、QA 和失败证据永久保留但不满足新 Gate |
| B7 | ticket 业务仍 active，但用户 pause，QA receipt 又 failed | 单一状态标签容易把业务进度、控制与证据混在一起 | 公共状态同时保存 `lifecycle=active`、`control=paused`、`gate=failed`；Web 按固定优先级显示主徽章，并能展开三轴详情 |
| B8 | 用户在 Web 点击 `retry`，tracker 临时不可达 | 容易出现 local-first/queued 状态与 tracker 真源分叉 | 返回 `NOT_COMMITTED`；canonical 状态零变化；命令携带 idempotency key，连接恢复后由用户显式重试 |
| B9 | DAG 要求 fresh context、独立 actor、durable receipt，但不要求侧边栏可见 | 载体选择写死为 subagent 或独立 Task，规则分散 | Router 按 capability 选择满足条件的 harness/subagent/独立 Agent/Task/human carrier，并把选择理由与能力证明写入 attempt |
| B10 | 低风险文档改动实际只触及文档路径 | 容易少测，或一律跑全量造成浪费 | 规划锁定最低验证要求；核心依据真实 diff、依赖和运行路径只允许升档、不可降档；session 跑影响面匹配测试，Story 最终仍在 integration SHA 上全量回归 |
| B11 | data-sensitive ticket 没有现成样本，但设计规则足以推导边界值 | 真实样本来源、expected output 与缺失行为未统一 | QA 先使用用户数据，再按设计、一手规则、历史缺陷构造 versioned SamplePack；记录 expected output、provenance、privacy、digest；无法确定才 `AWAITING_INPUT` |
| B12 | candidate 从 `c1` 修复到 `c2`，`c1` 的 live QA 很昂贵 | 旧证据可能按时效或影响判断结转 | 所有绑定 `c1` 的 receipt 无条件 stale，只保留审计；`c2` 必须按当前 profile 重验，不产生 CarryForwardReceipt |
| B13 | 最终 integration SHA 全量回归出现一个 baseline red | 旧设计可能把全票 close/评论证据误当完成，waiver 语义不完整 | 非 PASS 默认阻止 Story done；仅 Gate 在 Profile 中明示 `waivable` 且授权 risk owner 提供完整 WaiverReceipt 时，Story 可为 `done-with-waiver`；不得改写成 PASS |
| B14 | 视觉验收需要人工完成 3 条 checklist | 人工确认可能只有整体 PASS/FAIL，不能证明逐条完成 | Profile 生成逐条 step/expected testcase；授权 tester 逐项签 HumanTestReceipt，全部有效后 Gate 才 passed；Agent 不得代答 |
| B15 | 普通 collaborator、tester、product owner、risk owner 都能写 tracker | tracker 写权限可能被误当验收权限 | Profile/Gate 按 HumanTest、Acceptance、Waiver 分权，声明 actor role/capability、独立性和 quorum；撤销追加 RevocationReceipt，历史不删 |
| B16 | ticket 绑定 profile digest `abc`，当前 checkout 只有同名 digest `def` | 可能静默加载最新版或继续使用缓存规则 | 进入 `DEGRADED_PROFILE_UNAVAILABLE`：只读、诊断及 pause/cancel/release 等 Core 止损动作可用；禁止 claim/dispatch/retry/evidence/gate pass/close/story done；只能找回 `abc` 或回流 Discovery 创建新票 |
| B17 | 两个 RepoLane 均完成实现 | 单仓 merge-ready、旧 receipt 或人工 handed-off 可能提前结束 story | 每条代码 lane 必须合入声明的 integration SHA 并在该 SHA 上完成最终全量回归；全部必需 lane Gate 终态且无人工待办后自动 `done`，只有 contract/risk/不可逆动作要求时等待人工 |

## 边界值与失败态

| # | 输入 / 前置 | 新版设计候选行为 |
| --- | --- | --- |
| E1 | StoryRoot 没有任何必需 RepoLane | 拒绝进入 Delivery；保持 Discovery 的 incomplete/needs-decision，不允许空集合合成 done |
| E2 | 可选 RepoLane blocked，全部必需 RepoLane passed | 可选 lane 显示 blocked/degraded，但不阻止 Story done；其 optional 身份必须在 contract 中明确，不能运行期临时改 |
| E3 | 同一 idempotency key 收到完全相同命令两次 | 返回首次 committed 结果，不重复追加控制事件 |
| E4 | 同一 idempotency key 携带不同 payload | 返回 `IDEMPOTENCY_CONFLICT`，canonical 状态不变 |
| E5 | 新 receipt 的 subject/profile/policy digest 任一不匹配 | receipt 留存为 rejected/stale evidence，不计入 Gate |
| E6 | 最终全量回归为 `NOT_RUN` 或 `BLOCKED` | 与 FAIL 一样默认阻断；不能显示 PASS；只有 Profile 明示可豁免且授权 WaiverReceipt 完整时进入 `done-with-waiver` |
| E7 | Registry 缺失期间收到 `cancel current attempt` | Core 可接受并将 attempt 终止；不得顺带重算 profile Gate 或关闭 ticket |
| E8 | Human Receipt 被撤销后 Gate 原本为 passed | Core 重新投影为 pending/needs-human；历史签发与撤销同时可见 |

## 不变清单

- `workflow-interview` 继续只锁一个任务的“做什么”和“怎么算做完”，不实现目标；story 交付由独立薄组合层拥有。
- `wayfinder` 继续服务路线未知、planning-only 的探索；不被强制升级为交付平台。
- `aes-worktree-board` 继续拥有 worktree、Desktop Task、review、merge 与恢复控制面；Core 不复制这些生命周期。
- GitHub 与 GitLab 都是一等 v1 边界，但只保证共同领域语义等价，不要求相同 API、标签 UI 或原生关系能力。
- Tracker 保存控制索引，repo/Git 保存结构化 contract、artifact 和大 evidence；本地 runtime 仍是可再生缓存，不成为第三真源。
- Map root 权威枚举 story membership，child back-reference 用于对账；关系不一致时必须 degraded 并阻止收口。
- Web 不能直接修改文件、tracker 字段或 Agent/worktree/merge；只能提交白名单 typed commands 给确定性 Core。
- 历史 attempt、receipt、waiver、revocation、withdrawn ticket 和失败日志均保留，不覆盖、不删除。
- 本轮只定稿设计，不实现 `workflow-story-map`、不创建实现票、不做 GitHub/GitLab mutation。

## 配置差异

| 字段 | 旧设计或当前状态 | 新版设计候选 | 迁移 |
| --- | --- | --- | --- |
| `story.repo` | 隐含单仓或未统一 | 改为 `repo_lanes[]`，每项声明 `lane_id`、`required`、repo identity、tracker adapter、exact checkout、integration target | 旧单仓 story 映射为一个 `required=true` lane |
| `profile` | 类型与 Gate 分散在 Skill prose、Issue Contract、Board policy | Repo 内版本化声明式 `ProfileRegistry`；ticket ready 前绑定 `profile_id + schema_version + digest` | 旧票若没有精确绑定，不得自动声称可恢复；需 Discovery 迁移 |
| `verification` | risk、evidenceClass、manual gate 与 full suite 分散 | Profile 声明最低 risk/test intensity、升档规则、SamplePack、GateCatalog、最终 full-suite 标识 | 实现 effort 建立机器可读 catalog；本轮不定字段名 |
| `human_policy` | tracker 写权限或流程文字 | 每种 Human Receipt 独立声明角色/capability、独立性、quorum、revocation authority | 无声明的 human Gate fail-closed |
| `web.commands` | 旧 web v1 只读，或交互边界未统一 | v1 白名单仅三组：human answer/acceptance、claim/release/pause、retry/cancel/withdraw | 其他结构性动作继续走 Skill/Tracker 流程，不进 Web v1 |

## 草稿待确认点

- 是否同意 E2：可选 RepoLane 不阻止 Story done，但必须在 contract 中预先声明 optional。
- 是否同意 Registry degraded 时仍允许 Core 级 `pause/cancel/release` 三类止损动作。
- 是否同意 Web 主徽章只作投影，三轴详情始终可展开，不能让主徽章反向成为真源。
