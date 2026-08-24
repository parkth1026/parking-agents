<!-- draft v1 | published 2026-08-24T09:40:00Z
     用户意见：待收集
     状态：待确认 -->

# 行为对照表: 2026-08-24-aes-worktree-board-upgrade（草稿 v1）

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | Orchestrator 完成一次 `create_thread`（threadId=T-01H），执行 `orchestrate.mjs task create --issue 17 --worktree dev4 --role executor --thread-id T-01H --model luna-max --routing-reason "单包AC明确"` | 无任何记录，Task 只活在对话记忆 | registry.json 写入 TaskRecord（taskId 自动生成，generation=1，state=dispatching，taskKind=desktop-thread），worktree 租约同笔原子写入；stdout 回 TaskRecord JSON，退出 0 |
| 2 | 同上，但不带 `--thread-id`（headless 派发），且没带 `--fallback-authorized "<用户原话>"` | dispatch.mjs 直接派发，无授权概念 | preflight 拒绝：退出 2，stderr 说明「cli-fallback 需显式授权」，registry 不落任何记录 |
| 3 | `wait_threads` 返回 1 个 wake + 4 个 polls | 上轮事故：只处理 wake，4 个 polls 漏消费 | agent 把 5 个事件全部 `inbox put`（各带唯一 eventId），inbox.jsonl 追加 5 行；`inbox pending` 列出 5 条待消费 |
| 4 | `consume --event-id E-7f3a`（首次） | 无此概念 | 校验事件归属 Task 与 cursor，打印 `{"result":"consumed","nextAction":"spawn-reviewer",...}`，registry 更新 cursor/lastEventId，transitions.jsonl 追加一行；退出 0 |
| 5 | **边界**：`consume --event-id E-7f3a`（重复送达第二次） | 上轮事故：重复触发 reviewer/merge | 打印 `{"result":"already-consumed","eventId":"E-7f3a"}`，不产生任何状态变化与建议动作；退出 0 |
| 6 | `transition --task tk-dev4-17-g1 --to merged --reason ...`，但该 Task 当前 state=reviewing（未 approved） | assess.mjs 可把 merge 字段写成任意值 | 状态机校验拒绝非法转移：退出 2，stderr 列出该状态的合法去向；registry 不变 |
| 7 | `block record --task tk-dev1-56-g1 --commit a1b2c3 --finding-file f.md`，此前 blockCount=2 | blockCount 只活在自然语言 | blockCount→3，Task 自动转移 `handoff-required`，生成交接包 `runtime/handoff/tk-dev1-56-g1.md`（Issue、HEAD、finding、未执行证据、恢复条件）；stdout 提示熔断；后续对该 Task 的 `task create`/reviewer 派发建议一律拒绝 |
| 8 | **边界**：同一 reviewer 对同一 commit 重复报 BLOCK（同 commit+同 verdict） | 无去重，可能重复计数 | 不计数：`{"result":"duplicate-verdict","blockCount":2}`，退出 0 |
| 9 | `verdict set --task ... --code PASS --runtime NOT_RUN --delivery MERGE_READY`，Issue 类别 autonomous 且 AC 不要求真机 | 单一 merge 字段混五种语义 | 三维分开落 registry；规则校验：runtime=NOT_RUN 在此类 Issue 上允许 MERGE_READY；若 Issue 标记要求真机则拒绝 MERGE_READY（退出 2） |
| 10 | `stop eval --write`，此时全部非 test worktree 处于终态/暂停态 | 手写 orchestration-stop.json，脱离代码闭环 | 评估器读 registry 重算：无可推进线路 → registry.orchestration 置 `stopped`（含 reason/时间），stdout 报各线路状态；有可推进线路则退出 1 并列出哪条还能走 |
| 11 | stop 已写入后再跑 `collect.mjs` | collect 可把状态覆盖回 idle/null | collect 只刷新 Git/issue 事实；registry 派生字段（state/verdict/blockCount/orchestration）原样并入 status.json v3，终态不可被 collect 改写 |
| 12 | **边界**：collect 运行中 board 同时读 status.json（并发读写，#25） | torn read 可读到半截 JSON，曾把 assessment 全抹掉 | 全部写入走 `tmp 文件+rename` 原子替换 + `.lock` 互斥；读方永远读到完整旧版或完整新版；assessment/registry 承接不再丢失 |
| 13 | 两个 dispatch 同时抢同一 worktree（#23 TOCTOU） | 检查与占锁分离，可双派发；PID 复用可误判 | 租约=registry 原子写内完成（检查+占用同一笔 rename）；失败方退出 2 LOCKED；判活不再依赖 PID 存活，改看租约 owner+generation+心跳文件 mtime，EPERM 一律按「无法证伪，视为占用」处理 |
| 14 | 跨源网页向 `POST http://127.0.0.1:8321/api/dispatch` 发请求（#22） | 直接受理，可 drive-by 派发 | 无 `X-Board-Token` → 401；Origin/Referer 非本机 board → 403；token 由 server 启动时生成、注入到它自己服务的页面里 |
| 15 | 在目标仓根放 `.aes-worktree-board/board.config.json`（issueRepo 与技能默认不同，#24） | 只读技能目录 config，跨仓错配 | 解析顺序：环境变量 > 目标仓根 config > 技能目录默认；collect preflight 校验 issueRepo 可访问、mainBranch 存在于目标仓，不符退出 2 并写明错配项 |
| 16 | 打开 board 加载 v2 旧快照（schemaVersion=2） | schemaVersion!==2 直接报错拒渲 | v3 正常渲染；v2 降级渲染（老列照显示，新列显示「旧快照」提示条），不报错 |
| 17 | GitHub tracker：升级开工前 | #5 巨型 issue，33 条 AC 未勾，#22~#25 无依赖边 | wayfinder 建图（见下节）：#5 转父/治理节点，P0 拆子 issue，#22~#25 挂 blocked-by 边，P1/P2 建 backlog issue；frontier 由图自然产生 |

## wayfinder 建图（变化行 17 的展开，issue 编号创建时落实）

| 节点 | 标题（拟） | blocked-by | 本次实现 | label（拟） |
| --- | --- | --- | --- | --- |
| N1 | runtime v3 schema + 原子读写与互斥（收编 #25） | — | ✅ | ready-for-agent |
| N2 | Task Registry + worktree 租约 + generation（收编 #23） | N1 | ✅ | ready-for-agent |
| N3 | 事件 inbox + consume/pending 幂等消费 | N1 | ✅ | ready-for-agent |
| N4 | 三维 verdict + 15 态状态机 + 转移校验 + 熔断/交接包 | N2 | ✅ | ready-for-agent |
| N5 | create_thread preflight + cli-fallback 显式授权 | N2 | ✅ | ready-for-agent |
| N6 | 全局停止评估器 | N2,N4 | ✅ | ready-for-agent |
| #22 | server 跨源防护（Origin+token） | N1 | ✅ | ready-for-agent |
| #24 | board.config 目标仓选址与 preflight 校验 | — | ✅ | ready-for-agent |
| N7 | board.html v3 渲染 + v2 兼容 | N1 | ✅ | ready-for-agent |
| N8 | selftest 编排回归域（P2.3 十场景） | N1~N6 | ✅ | ready-for-agent |
| N9 | SKILL.md/#5 契约同步与 #5 正文重排 | N1~N8 | ✅ | ready-for-agent |
| B1~B6 | P1/P2 backlog：progress/stall、reviewer 临时资源、路由评分、merge handler、恢复 automation、board 全量状态展示 | 各挂对应前置 | ❌ 建而不做 | needs-triage |

处置：#23、#25 关闭为「收编入 N2/N1」（正文互链）；#22、#24 保留原 issue 直接实现。全部经原生 issue dependencies 挂到 #5 下。

## 不变清单

| 现有行为 | 谁在依赖它 |
| --- | --- |
| `collect.mjs` / `assess.mjs` / `dispatch.mjs` / `server.mjs` 现有命令行参数与调用方式全部原样可用（dispatch 仅新增授权参数，未加时旧路径按变化行 2 拒绝——这是唯一破坏点，已列变化行） | SKILL.md 现有用法、selftest 七域 |
| selftest 现有七域（collect/fixture/dispatch/server/repo-root/layout/windows-hide）全部保持绿 | 回归基线 |
| runtime 选址链 `AES_WORKTREE_BOARD_RUNTIME_DIR` > 目标仓根 `.aes-worktree-board/runtime/` 不变（f2fa0d2 契约） | #14 的修复成果 |
| `fixtures/aes-agent-issues.json` 与三条 fixture 命令原样可用 | 离线测试 |
| test worktree 永不参与自动派发；dirty/untracked 现场只记录不清理 | 用户手动测试现场 |
| 技能目录旧 runtime（03:21 快照+orchestration-stop.json）原地归档为只读历史素材，不删除、脚本不再读写 | 复盘证据、回归 fixture 素材 |
| 零 npm 依赖、全 `.mjs`、`windowsHide` 纪律（layout/windows-hide 域机械保证） | 仓库约定 |
| 目标仓 aes-agents-v2 现场（分支、dirty、五条挂起线路）本次一概不碰 | 用户裁决 C4 |

## 配置差异

| 字段 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| board.config.json 位置 | 仅技能目录 | 环境变量 > `<目标仓根>/.aes-worktree-board/board.config.json` > 技能目录默认 | 旧文件原样可用（作默认层） |
| `issueRepo` / `mainBranch` | 无校验，跨仓错配静默 | collect preflight 校验，不符退出 2 | 无需迁移，错配会被点名 |
| dispatch 授权 | 无 | headless 真实派发必须带 `--fallback-authorized "<用户原话>"`（`test` 假 agent 豁免，供自检） | 旧脚本调用真实 agent 时需加参数 |
| status.json schemaVersion | 2 | 3（新增 orchestration/task 派生字段） | board 兼容读 v2；collect 只写 v3 |
