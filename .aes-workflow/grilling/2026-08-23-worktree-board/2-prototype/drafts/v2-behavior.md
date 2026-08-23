<!-- draft v2 | published 2026-08-23
     变更：视觉基准切换为 design_handoff_issue_starmap；吸收 v2~v4 mock 迭代的全部裁决
     用户意见：待收集
     状态：待确认 -->

# 行为对照表: 2026-08-23-worktree-board

对照基线 = 本会话已建成的 v1 实现（worktree 环形视图）。改后 = v4 mock 终态。
视觉规格源 = `docs/uiux/design_handoff_issue_starmap/README.md`（High-fidelity，像素级还原；本表只记行为，不复述像素值）。

## 变化行

| # | 输入 / 前置 | 现在的行为（v1 实现） | 改后的行为 |
| --- | --- | --- | --- |
| 1 | `node …/collect.mjs`（gh 在线） | 只采 worktree 关联 issue（4 个），无依赖概念 | 全仓 issue 全采（61 = 17 OPEN + 44 CLOSED），解析 body 依赖边、计算连接度（星等）、推导 frontier；对 CLOSED 加查 timeline：曾 reopen 又再关闭 → 标 ⚠ 回归 |
| 2 | 打开看板 | 单视图环形图 | 双视图应用（纸面 design tokens 全页统一）：默认**图谱视图** = handoff 知识图谱；**地图视图** = 四列进度轴（已探明 dchip 网格 / 进行中 / 可开工 / 被阻塞）；顶栏含视图切换 + 探明进度条 |
| 3 | 图谱视图节点/边 | 环形布局、按钮式节点 | 按 handoff 规格：星等 = 依赖连接数决定半径；frontier 橙实心双晕、claimed 紫实心三层信标环（2s 呼吸）、blocked 空心虚线圆、resolved 暗点、背景小星；贝塞尔弯曲边，阻塞链虚线；静态力导向一次收敛后冻结，数据更新增量重算 ~600ms 过渡 |
| 4 | worker 呈现 | 行星环绕 main + 卫星 | worker 名牌旗信标钉在认领节点上方（▶ 运行中紫底 / ✋ 手动推进琥珀底），任何淡出下名牌不透明度恒 1、claimed 节点最低 0.5；右上 **Workers 停靠面板**（N/5 在场、⌖ 定位、dirty/评估过期徽标）替代横排名册，两视图共用；空闲 worker 不上图，面板显示「未在场」 |
| 5 | 图上探索交互 | 仅点击 | hover 邻域高亮（150ms ease-out，无关节点淡至 0.15/边 0.1/背景星 0.3）；图例行点击按状态过滤；搜索框匹配 id/标题/worker 后 ~450ms 飞行定位 + 描边闪烁；滚轮缩放 25%–400%，<60% 隐藏 resolved 标签 |
| 6 | 派发到 dirty worktree（如 dev3 31 项未提交） | 直接派发 | 页面弹确认层（取消/先侦查/仍要派发）；API 首次 409 `dirty_confirm_required`，带 `confirmDirty:true` 重试才执行；主 agent 对话派发先复述 dirty 征求确认 |
| 7 | 派发到干净 worktree（边界） | 直接派发 | **不变**：直接派发，报文与 v1 逐字节兼容 |
| 8 | 评估陈旧（assessedAt 早于最新 commit/任务结束） | 只显示时间戳 | 评估块自动加「已过期」琥珀虚线标记；dock 行同步显示徽标 |
| 9 | 合并建议遇无 issue 独立任务分支 | 未涉及 | 最高只能 `not-yet`，reason 强制注明「需先补 issue」 |
| 10 | frontier 派活 | 无 | 图上点 frontier 星 → 详情面板「从这里派活」区（预填 issue 上下文、选空闲 worker + agent）；巡检汇总附 frontier 清单 |
| 11 | 详情面板 | 全高侧滑暗色面板 | handoff 浮动白卡 340px（盖住 dock）：serif 标题、键值行、「完成后解锁」灰底 chips（依赖反查）、「查看运行日志」主按钮 + 「打开 issue」次按钮（handoff 的「打开 PR」不适用：仓库无 PR 流程） |
| 12 | ⚠ 回归警示（边界） | 无 | 曾 reopen 又关闭的 CLOSED issue：图谱暗点加琥珀虚线环 + 副标「⚠ 回归有波动」，地图视图 dchip 虚线框 |
| 13 | 依赖边缺失（issue body 没写，边界） | — | 无入边即按依赖全闭参与 frontier 判定，不报错（访谈已确认此代价） |
| 14 | frontier 为空（边界） | — | 图例计数 0；巡检汇总注明「无可开工项」 |

## 不变清单

- **派发内核**：dispatch.mjs PID 锁、prompt 走 stdin、守护到结束、tasks/ 三件套——主 agent 与 server 都依赖。
- **评估内核**：assess.mjs CLI 与 assessment 字段结构，collect 重采按节点保留。
- **服务边界**：仅绑 127.0.0.1；`/api/status`、`/api/dispatch`、`/api/task/<id>` 三端点；干净派发报文 v1 兼容。
- **双模式**：LIVE fetch 失败自动降级读快照 `<script src>`——file:// 双击可用不许破坏（Google Fonts 断网时退化系统字体，属同一承诺）。
- **作用范围**：同级既有 worktree；不创建不删除 worktree；合并只建议不执行；issue 关闭不由系统执行。
- **worker 名册语义**（v2 确认保留，v4 换承载不换内容）：每个 worker 的 状态/在做什么/异常徽标 必须一屏可见——由 dock 面板承载。
- **配置**：board.config.json 现有字段原样有效。
- **test agent 冒烟**：行为与输出结构一致（路径前缀除外）。
- **历史 tasks/ 记录**：新代码可读旧 json（字段只增不改义）。

## 配置差异

| 项 | 现在（v1） | 改后 | 迁移 |
| --- | --- | --- | --- |
| 脚本落位 | `worktree-board/*.mjs` | `.claude/skills/aes-worktree-board/scripts/*.mjs` | 整目录搬移，旧目录删除 |
| 页面落位 | `worktree-board/board.html` | `.claude/skills/aes-worktree-board/board.html` | 同上 |
| 运行时生成物 | `worktree-board/{status.json,status.js,tasks/}` | `.claude/skills/aes-worktree-board/runtime/` | 旧生成物废弃，首跑重采（schema v1 不做兼容读取） |
| 后端启动 | `.\run board` | `node .claude/skills/aes-worktree-board/scripts/server.mjs`（launch.json 同步） | run.toml board 动词撤销 |
| skill 落位 | 用户级 `~/.claude/skills/aes-worktree-board/` | 项目级 `.claude/skills/aes-worktree-board/`（自包含） | 用户级副本删除 |
| git 状态 | run.toml、.gitignore 已改未提交 | 两文件改动撤销；`.claude/` 整体暂不进 git，由用户后续处理 | `git checkout -- run.toml .gitignore` |
| 字体 | 系统字体 | Google Fonts（Source Serif 4 / Archivo / IBM Plex Mono）+ 中文回退，断网退化 | 无迁移动作 |
