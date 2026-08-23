# Impact Surface: 2026-08-23-worktree-board

对照基线：本会话已建成并实测的 v1（`worktree-board/` worktree 中心视图 + 用户级 skill + run 动词）。
目标态：访谈锁定的主脑作战系统（wayfinder 风格 issue 全景作战图 + worktree 队员 + 项目级 skill 自包含落位）。

| 影响面 | 判定 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | **有** | 看板主视图整体重做：worktree 环形图 → wayfinder 星图（issue 为地形节点、worktree 为地图上的队员单位、frontier 呼吸高亮、依赖曲线边、缩放平移相机）；新增派发 dirty 二次确认弹层；评估块新增「已过期」标记 | 用户（唯一看板读者） | `mock.html` |
| 可观察行为 | **有** | 采集范围从「worktree 关联 issue」扩到「全仓 issue + 依赖边 + frontier 推导」；派发在目标 worktree dirty 时插入确认步；评估过期自动判定；无 issue 的独立任务在合并建议环节强制降档 | 用户、主 agent（skill 执行者） | `behavior.md` |
| 可运行输出 | **有** | `collect.mjs` CLI 汇总行新增图谱统计（issue 总数/OPEN/frontier/边数）；skill 巡检汇总表增加队员坐标列 | 用户（终端）、主 agent | `example-run.md` |
| 对外接口报文 | **有** | `status.json` schema v1→v2：新增 `graph`（issue 全集节点 + 依赖边 + frontier 标记 + 队员定位）；`POST /api/dispatch` 新增 dirty 确认握手（409 + `confirmDirty` 重试） | board.html（唯一消费方，同步升级）、后续任何读 status.json 的工具 | `api-mock.md` |
| 用户配置 | **有** | 整体落位迁移：`worktree-board/` → `.claude/skills/aes-worktree-board/` 自包含；撤销 run.toml 的 board 动词；launch.json 路径更新；.gitignore 撤销 worktree-board 三行；删除用户级 skill 副本 | 用户（启动命令变化） | `behavior.md` 配置差异节 |
| 历史兼容性 | **有** | v1 已实测链路必须原样保活：dispatch PID 锁/stdin prompt/守护写回、assess 字段契约、双模式加载 trick、仅绑 127.0.0.1、同级 worktree 枚举与绝不新建；`.\run board` 刚建即撤（无外部依赖方，成本≈0 但显式记录） | 主 agent、已写盘的 tasks/ 记录 | `behavior.md` 不变清单 |
| 架构与依赖 | **有** | 数据流新增 gh 全量 issue 采集支路；页面数据模型从 worktree[] 主键改为 graph{issues,edges,units}；代码归属从 repo 顶级目录迁入项目级 skill 目录（自包含、暂不进 git） | 用户（搬迁计划的资产边界）、主 agent | `diagram.html` 架构视图 |

七面全「有」。产出对照物：`mock.html`、`behavior.md`、`api-mock.md`、`example-run.md`、`diagram.html`。
