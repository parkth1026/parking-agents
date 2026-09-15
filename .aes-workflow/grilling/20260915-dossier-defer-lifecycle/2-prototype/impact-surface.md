# Impact Surface: 20260915-dossier-defer-lifecycle

改动内容（Q1=A 全栈、Q2=A user_choice:defer）：dossier.mjs 四态渲染+q_id 聚合+triggered_by 连线；session.mjs 校验放行 defer+default 缺 user 警告；aes-interview SKILL.md 文档补约定；issue149 已闭环行补 user 状态。

## 七面扫描

| 影响面 | 有/无 | 具体差异 | 谁看见/受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | **有** | dossier.html trajectory 视图渲染形态变化：四态答案显示（已答/⏸暂缓/悬而未决/机制性默认）、同 q_id 跨轮聚合生命周期、triggered_by 连线 | 打开 dossier 的用户（决策档案读者） | `mock.html` |
| 可观察行为 | **有** | session.mjs round 校验：`user_choice:"defer"` 放行（当前会因非选项值被拒或歧义）；default 行缺 user 字段发非阻断警告 | 落盘 rounds 的宿主 agent | `behavior.md` |
| 可运行输出 | **有（轻）** | 重导 dossier 的 HTML 差异；export-dossier.test.mjs/session.test.mjs 新增用例输出 | skill 维护者 | `example-run.md` |
| 对外接口报文 | **有** | rounds.jsonl 行 schema 扩展：user_choice 新增保留值 "defer"（与选项 key 冲突时以 defer 优先）；跨载体投影 schema 同步 workflow-interview-web | 落盘方与 web 载体 | `api-mock.md` |
| 用户配置 | **无** | 不动配置/env | 无 | — |
| 历史兼容性 | **有（纯不变面+语义升级）** | 旧 rounds 行（无 user/有 verbatim/长文本 user）在新渲染下的行为全部定义（见 behavior.md 兼容表）；已落盘数据零重写 | 既有全部 issue 会话的 dossier | `behavior.md` 兼容节 |
| 架构与依赖 | **无** | 同目录渲染函数改动，无新依赖、无模块边界变化；dossier.mjs 共享实现一处改双载体生效（默认区第 4 条已定） | workflow-interview-web 载体 | 不出 diagram |

## 判「无」的理由记录

- 用户配置：三个文件均无配置面。
- 架构：纯函数级改动（answerSummary/projectFamilyTrajectory/round 校验器），依赖方向不变。
