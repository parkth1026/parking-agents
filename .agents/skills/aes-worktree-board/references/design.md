# aes-worktree-board 设计依据

## 意图与触发场景

把主仓 Orchestrator、Codex Desktop Task、既有 Git worktree、GitHub Issue 图和需求星图接到同一套可恢复控制面。脚本只负责事实采集、身份与租约、事件入箱、状态门禁、审计和渲染；任务选择、Desktop `create_thread`、独立 review、合并及 post-merge verification 仍由宿主主 agent 执行。

## 设计取舍

- `registry.json` 是判断真源，`status.json` 是渲染快照；全部可变写入共用 runtime 互斥与 tmp+rename。
- worker identity 以目标仓 `git worktree list` 为边界，短名和完整 basename 归一到同一租约 key。
- executor 持有 writer 租约；关联 reviewer 加入同一 generation，但保持只读且不能夺取或释放 writer 租约。
- Desktop Task 可以先记录 `clientThreadId`，随后原子附加真实 `threadId`；CLI fallback 必须保存用户授权原话。
- worker 工作周期以 executor Task 登记为起点：`createdAt` 保留首次登记审计时间，`startedAt` / `finishedAt` 记录当前工作周期；reviewer 不重置 worktree 计时，终态冻结，parked 显式恢复时开始新周期。
- inbox 同时校验 eventId 幂等与 thread→Task 归属。关联 reviewer thread 可以向 parent executor 提交 verdict，其他 foreign thread fail closed。
- 状态边和交付证据是两层门禁：合法转移不等于证据齐全；有效 verdict、commit、review 和 merge commit 缺一不可进入对应终态。
- stop 的读取、判断和写入与 Task 创建使用同一临界区，保证 `stopped` 与 active Task 不会并存。
- LIVE 页面由 server 注入 `/runtime/status.js`；collect 在目标 runtime 生成只读 `board.html + status.js` 快照，技能目录历史 runtime 不参与读取。
- runtime 中已有快照必须与本次解析出的 `repo.root / issueRepo / mainBranch` 完全同源；任一字段错配都以 `REPO_MISMATCH`、exit 2 拒绝复用，不能从旧快照提取 Issue 或控制面事实。
- runtime identity 必须在 collect 的锁前快检和取得 runtime 锁后的最终快照上各校验一次；两个目标仓从同一空 runtime 并发 collect 时只能有一个写入，另一方必须 `REPO_MISMATCH`，不得 last-writer-wins。
- server API 使用专属 `aes-worktree-board/1` marker 与 status schema；端口冲突探测只有验证 marker/schema 后才比较 identity。另一目标仓返回可诊断的 `REPO_MISMATCH`，同仓或非 board 服务返回 `PORT_CONFLICT`；任何冲突都拒绝把旧实例当成本次启动成功。

## 验收条件

| AC | 条件 |
| --- | --- |
| AC-1 | 短名与完整 worktree basename 命中同一租约；不存在的 worker 被 CLI 拒绝。 |
| AC-2 | executor 到达 committed 后可登记同 generation reviewer；reviewer 不取得 writer 租约。 |
| AC-3 | 仅有 clientThreadId 的 queued Desktop Task 可登记，并可原子补齐 threadId/hostId/projectId。 |
| AC-4 | foreign thread 不能写入 Task 或覆盖 cursor；关联 reviewer APPROVE 可形成独立 review 证据。 |
| AC-5 | 分步写 verdict 不能绕过 runtime/code 门禁；commit/review/mergeCommit 证据不足时拒绝终态。 |
| AC-6 | stop eval 与 task create 并发时，不得出现 stopped 与 active Task/lease 并存。 |
| AC-7 | 已预登记的 fallback wrapper 在 agent 启动前失败时收敛为可审计、可重试 parked，并释放 writer 租约。 |
| AC-8 | assess 的失败路径释放 runtime 锁。 |
| AC-9 | 锁定 HTTP 报文使用 worker 与 500 message；旧 worktree 字段仅作兼容输入。 |
| AC-10 | collect 在目标 runtime 生成读取同目录 status.js 的快照页面；技能模板不读取历史 runtime。 |
| AC-11 | 旧七域、自带 orchestration 域、issue graph、真实浏览器 v3/v2 验收全部保持通过。 |
| AC-12 | registry 中最新 executor Task 是 worker 计时真源；活动时长持续增长，merged/parked/handoff-required 后冻结，reviewer 不重置，parked 恢复后开始新周期。 |
| AC-13 | 显式目标仓、runtime 旧快照和 server 监听端口形成同一 repo identity 边界；跨项目错配以 exit 2 fail closed，当前项目 API 的仓、Issue 图谱与 worktree 列表必须同源。 |
| AC-14 | 锁内二次 identity 校验阻止空 runtime 的双仓并发覆盖；repo-shaped 非 board JSON 未通过专属 marker/schema 时只能判为 `PORT_CONFLICT`。 |

## 迭代记录

| 日期 | 改动 | 验证 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-08-24 | 修复独立复核确认的租约、门禁、queued identity、stop TOCTOU、fallback settlement、snapshot、HTTP 与锁释放缺陷，并补 thread 归属和 worker canonicalization。 | 针对性红绿测试 + 全域回归 + 浏览器与双轴复审。 | 控制面原语仍集中在单一 Skill，暂不拆分。 |
| 2026-08-25 | 默认 collect 改用完整 Issue fixture，并把真实 GitHub 二次对账拆成显式 `collect-live` smoke，消除授权、网络及两次查询间 Issue 变化造成的 flaky。 | 无效 `issueRepo` 下 collect 绿、collect-live 红；八域 `run-tests.mjs` 8/8 通过。 | 这是测试证据分层，不新增技能职责，无需拆分。 |
| 2026-08-25 | 为 Desktop worker lane 增加可恢复的开始/结束时间投影，统一 registry、collect 与 web 面板的工作时长。 | lifecycle/storage/contract 回归、八域回归与真实浏览器活动/冻结计时验收。 | 复用既有 TaskRecord 与 schema v3，不引入后台计时服务。 |
| 2026-08-25 | 锁定跨项目 repo identity：拒绝错误 runtime 快照，并在端口占用时区分另一仓 server 与普通冲突。 | repo-root 跨项目 runtime/port/API 回归 + 八域回归 + 真实 parking-agents API smoke。 | 沿用既有 `/api/status?fast=1`，不增加监听地址、路由或第三方依赖。 |
| 2026-08-25 | BLOCK 1/3 follow-up：目标仓 integration 配置落为 `dev`，collect 增加锁内 identity 复核，端口探测增加专属 board marker/schema。 | 双仓 barrier 并发回归、repo-shaped 伪服务回归、无 env 目标主仓 live API/Playwright。 | marker 是 additive v3 字段与响应头；页面仍可降级读取旧 v2/v3 快照。 |
