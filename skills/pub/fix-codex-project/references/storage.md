# 存储与版本边界

结构不符、来源不唯一或需要解释隔离机制时阅读。

## 已观察的位置

- `.codex-global-state.json`：当前身份使用的字段在顶层。
- `electron-account-renderer-state-v1.owner`：当前界面状态身份键。
- `electron-account-renderer-state-v1.inactive[身份键].globals`：其他身份保存的项目与会话归属。
- `inactive[身份键].atoms`：其他界面状态，保留但不整份复制。
- `local-projects`：项目 ID 到名称与 `rootPaths`。
- `thread-project-assignments`：会话 ID 到 `projectKind`、`projectId`。
- `app-server-project-id-by-legacy-project-id-by-host`：按主机保存的旧新项目 ID 映射。
- `app-server-projects-migration-by-host`：项目迁移完成不代表会话关联迁移完成。
- `state_*.sqlite`：会话索引，以及部分版本的项目表。
- `thread_history_*.sqlite`、`sessions/`、`archived_sessions/`：会话正文和历史，不修改。

2026-11-08 检查的 Windows 26.1103.4239.0 安装包中，`selectRendererOwner` 以 `SHA256(JSON.stringify([userId, accountId]))` 识别状态，把旧项目字段移至 inactive，再加载目标状态。新身份无存档时移除对应顶层字段。同一个登录用户但工作空间不同也可能生成不同键。此实现是历史证据，不能假定后续版本相同。

历史现场的数据库同时保存多个创建者的会话。`creator_account_id`、`creator_user_id` 记录创建来源，是否过滤还需核对列表查询及实际界面。数据库项目存在，但所有会话 `project_id` 为空；旧归属仍在 JSON。两套加载范围不一致可以造成会话可见但分组消失，不代表磁盘目录被删。

## 恢复边界

新版本结构变化时先诊断。认证 token、远程项目、界面 atoms、自动化和删除状态不在恢复白名单。主机迁移记录仅取实际 Home 对应的 `local:` 主机。检查关联指向的旧项目 ID 与映射，新旧 ID 不同本身不是数据损坏。

`.bak` 常被应用同步更新，不能当成独立历史快照。SQLite WAL 可能包含最近事务，用 backup API 创建一致性快照，不单拷数据库主文件。回滚只撤销改动的 JSON，不把旧数据库覆盖回应用。

官方入口：[Projects and chats](https://learn.chatgpt.com/docs/projects)、[Codex App Server](https://learn.chatgpt.com/docs/app-server)。这些页面不足以证明当前内部字段，以实际版本和文件为准。
