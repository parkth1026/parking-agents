# 影响面扫描: 2026-08-29-aes-glab-skill改进

改动对象是技能文档（aes-glab 的 SKILL.md + design.md + output-evals.json），
"程序跑起来不一样" = **agent 加载该技能后的行为与产出不一样**。逐面扫：

| 影响面 | 有/无 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | 无 | 技能无自有 UI；用户看到的"界面"是 agent 产出文档，归入可运行输出面 | — | — |
| 可观察行为 | **有** | ①触发面扩大：`帮我装 glab`/新机器从零配置类请求从「不触发/无指引」变为「触发并产出安装指引」；②配置类请求新增裁决事实（config.yml 位置、gitlab.com 噪音块双路径、agent bash PATH 兜底）；③使用面命令范式扩充（候选：search/label/milestone/release/pipeline/多 host，逐条实测后定去留） | 装新机器的团队成员、agent 会话（本仓库与 parking-agents 全部装此技能的宿主） | `behavior.md` |
| 可运行输出 | **有** | 同样的「零基础安装」请求，agent 改后应产出含安装渠道命令、PATH 说明、双协议登录、PAT 步骤、交互避坑、验证闭环的指引文档（即 output-evals.json 六断言的形态） | 请求安装指引的用户；评测探针 | `example-run.md` |
| 对外接口报文 | 无 | 技能无 API/报文接口；description 变化属触发行为，归可观察行为面 | — | — |
| 用户配置 | 无 | 不改任何用户配置文件；技能内**关于**用户配置（glab config.yml）的指导内容变了，但那是文档内容不是配置变更 | — | — |
| 历史兼容性 | **有**（全部不变） | 现有三节（认证/命令怪癖/免费档裁决）逐条保留；认证类触发场景行为不变；history.json 既有 glab-workflow 轨迹与新 iteration 并存不覆盖；软链分发路径不变 | 现有依赖认证引导与命令怪癖范式的所有 agent 会话 | `behavior.md` 不变清单 |
| 架构与依赖 | **有**（轻量） | SKILL.md 模块结构变化：新增「安装」「配置事实」两节 + 使用面节扩充；design.md 增补 AC 与迭代记录；output-evals.json 沿用既有安装指引评测并按需增补断言。构件间依赖方向不变（SKILL.md ↔ design.md 同目录、软链分发、评测管线读 output-evals.json） | parking-agents 仓库维护者；评测管线 | `diagram.html` |

## 对照物清单

- `behavior.md` — 触发/行为变化行 + 全量不变清单 + 新 SKILL.md 结构裁决（源）
- `example-run.md` — 「零基础安装指引」端到端产出样例（六断言形态）
- `diagram.html` — 技能构件架构视图（改后态，标注新增）
- `mock.html` / `api-mock.md` — 判无，理由见上表
- 草稿迭代在 `drafts/`，确认后落根下固定名
