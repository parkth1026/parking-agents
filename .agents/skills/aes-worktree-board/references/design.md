# aes-worktree-board 设计依据

## 意图与触发场景

把主仓 Orchestrator、Codex Desktop Task、既有 Git worktree、GitHub Issue 图和需求星图接到同一套可恢复控制面。脚本只负责事实采集、身份与租约、事件入箱、状态门禁、审计和渲染；任务选择、Desktop `create_thread`、独立 review、合并及 post-merge verification 仍由宿主主 agent 执行。

## 设计取舍

- `registry.json` 是判断真源，`status.json` 是渲染快照；全部可变写入共用 runtime 互斥与 tmp+rename。
- worker identity 以目标仓 `git worktree list` 为边界，短名和完整 basename 归一到同一租约 key。
- executor 持有 writer 租约；关联 reviewer 加入同一 generation，但保持只读且不能夺取或释放 writer 租约。
- Desktop Task 可以先记录 `clientThreadId`，随后原子附加真实 `threadId`；CLI fallback 必须保存用户授权原话。
- inbox 同时校验 eventId 幂等与 thread→Task 归属。关联 reviewer thread 可以向 parent executor 提交 verdict，其他 foreign thread fail closed。
- 状态边和交付证据是两层门禁：合法转移不等于证据齐全；有效 verdict、commit、review 和 merge commit 缺一不可进入对应终态。
- stop 的读取、判断和写入与 Task 创建使用同一临界区，保证 `stopped` 与 active Task 不会并存。
- LIVE 页面由 server 注入 `/runtime/status.js`；collect 在目标 runtime 生成只读 `board.html + status.js` 快照，技能目录历史 runtime 不参与读取。

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

## 迭代记录

| 日期 | 改动 | 验证 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-08-24 | 修复独立复核确认的租约、门禁、queued identity、stop TOCTOU、fallback settlement、snapshot、HTTP 与锁释放缺陷，并补 thread 归属和 worker canonicalization。 | 针对性红绿测试 + 全域回归 + 浏览器与双轴复审。 | 控制面原语仍集中在单一 Skill，暂不拆分。 |
| 2026-08-25 | 默认 collect 改用完整 Issue fixture，并把真实 GitHub 二次对账拆成显式 `collect-live` smoke，消除授权、网络及两次查询间 Issue 变化造成的 flaky。 | 无效 `issueRepo` 下 collect 绿、collect-live 红；八域 `run-tests.mjs` 8/8 通过。 | 这是测试证据分层，不新增技能职责，无需拆分。 |
