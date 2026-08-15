# oh-my-codex Skills 深度调研报告

> 调研对象：`G:\GIT\AI_WorkFlow_ref\oh-my-codex\skills`（共 **46 个 skill**）
> 调研日期：2026-08-16 ｜ 内容已逐条与源 SKILL.md 交叉核对

**分组判断标准**

- **深度绑定**：技能会调用 `omx` CLI、读写 `.omx/` 状态目录、依赖 Codex goal mode（`create_goal`/`update_goal`）、tmux 多窗格编排、OMX hooks/通知系统，或强依赖其他 OMX 技能——抽离 OMX 环境就无法运行。
- **通用**：自包含方法论（工作流程、检查清单、输出契约），只在路由建议里顺带提到 OMX 技能名，拿到任何编码 agent 上都能直接用。

另有 13 个纯废弃壳（hard-deprecated，正文只剩一句"别用我，改用 XXX"），单独标注。

## 全量技能表

| 分组 | 技能 | 状态 | 作用与功能 |
|---|---|---|---|
| **深度绑定** | `autopilot` | 活跃（旗舰编排器） | 全自动交付流水线，固定链路 `$deep-interview → $ralplan → $ultragoal (+$team) → $code-review → $ultraqa`。评审不干净先进入 `rework` 阶段做范围内实现修复，仅当评审判定计划/需求本身有误、或 `$ultraqa` 失败时才退回 `$ralplan` 重规划；每阶段写状态机、携带交接工件，支持中断续跑。依赖 `omx state write`、`.omx/` 工件与全套兄弟技能 |
| **深度绑定** | `ultragoal` | 活跃 | 把需求 brief 转为仓库原生持久多目标计划：`omx ultragoal create-goals` 生成 `goals.json` + 审计账本（ledger），逐个目标注册到 Codex goal mode 执行，支持证据驱动的受控转向（`omx ultragoal steer`），终点强制过 ai-slop-cleaner + 双角色评审门 |
| **深度绑定** | `ralph` | 活跃（被定位为 legacy 单所有者循环） | 标志性"滚石不止"持久执行循环：上下文快照 → 循环（继续任务、按 agent_type 并行委派、跑测试/构建取证、强制 architect 验证、强制 deslop、完成审计）→ 直到真正完成才清状态。依赖 `omx state`、goal mode、stop-hook |
| **深度绑定** | `team` | 活跃 | tmux 多 worker 并行执行模式：`omx team 3:executor "任务"` 切分窗格启动真实 Codex/Claude CLI 会话，通过 `.omx/state/team/` 的 mailbox/dispatch 文件协调，leader 用 `omx team status/resume/shutdown` 管理生命周期。OMX 中耦合最深的技能之一 |
| **深度绑定** | `worker` | 活跃（team 的伴随协议） | 专供 team 启动的 worker 会话加载：从 `OMX_TEAM_WORKER` 环境变量解析身份，先向 leader mailbox 发 ACK，按 claim-safe 生命周期认领/完成任务，读 inbox、写 shutdown ack。完全寄生在 team 运行时上，无独立用途 |
| **深度绑定** | `cancel` | 活跃 | 统一取消任何活跃 OMX 模式（autopilot/ralph/ultrawork/team/pipeline 等）：按依赖顺序检测并清理 `.omx/state/` 下各模式状态文件，team 走"两遍协议"（写 shutdown inbox → 等待 15 秒 → `tmux kill-session`），支持 `--force`、明确拒绝 `--all`。整个技能的存在意义就是 OMX 模式生命周期 |
| **深度绑定** | `pipeline` | 活跃 | 可配置流水线编排器，把 autopilot 的五个阶段实现为统一的 `PipelineStage` 接口，支持状态持久化与断点续跑；状态写入 `.omx/state/pipeline-state.json` 并由 HUD 渲染。是 autopilot v0.8+ 的执行引擎 |
| **深度绑定** | `ralplan` | 别名（`$plan --consensus`） | 共识规划入口 + 规划/执行边界守卫：本地 Critic 批准不算数，在拿到"官方 host 收据"前必须停在规划态不得移交执行。依赖 `omx ralplan preflight`（对 Codex 0.144.5 / 0.145.0 / 0.146.1 / 0.148.0-alpha.5 四个版本 fail-closed）、`.omx/` 快照 |
| **深度绑定** | `deep-interview` | 活跃（流水线第一道门） | 苏格拉底式需求访谈：对清晰度维度加权计算模糊度（greenfield 用 5 维：intent/outcome/scope/constraints/success；brownfield 6 维另加 context，两套权重），每轮针对最弱维度压力测试，配合 Contrarian/Terminologist/Simplifier/Ontologist 四种挑战模式做假设压力测试，模糊度降到阈值且 Non-goals、Decision Boundaries 两个就绪门通过后才产出规格。方法论优秀，但按本文实现依赖 `omx question`（tmux 渲染）与 `.omx/specs/` 工件 |
| **深度绑定** | `plan` | 活跃 | 战略规划：自动判断访谈模式或直接出计划；`--consensus` 跑 Planner→Architect→Critic 循环 + RALPLAN-DR 结构化审议（short 默认 / deliberate 高风险），产出含 ADR/验收标准的计划存到 `.omx/plans/`。已吸收旧 `/planner`、`/ralplan`、`/review` 三个技能 |
| **深度绑定** | `prometheus-strict` | 活跃 | 三角色严格规划器：Metis 结构化访谈澄清（最少 2 轮、最多 5 轮封顶）→ Momus 对抗性挑战 → Oracle 两遍法综合出含验证矩阵的交接计划。依赖 `omx question`、OMX 专属子代理（metis/momus/oracle）和精确模型路由 |
| **深度绑定** | `autoresearch` | 活跃 | 有状态的验证器门控研究循环（替代废弃的 `omx autoresearch` 命令）：初始化时在 `mission-validator-script`（脚本验证）与 `prompt-architect-artifact`（提示词+架构师评审）两种验证模式中二选一，之后持续自我推进，直到完成工件里记录了验证通过才算结束——模型自己说"做完了"不算数 |
| **深度绑定** | `autoresearch-goal` | 活跃 | 研究任务的 goal mode 版：`omx autoresearch-goal create` 建任务与评审量规，Codex goal 挂钩目标，迭代研究并用 `verdict` 记录评论家结论，pass 后完成对账。完全构建在 Codex goal mode 之上 |
| **深度绑定** | `performance-goal` | 活跃 | 评估器门控的性能优化循环：先定义 PASS/FAIL 评估契约，小步可回滚补丁优化、跑评估器与回归，checkpoint 记录证据，状态存 `.omx/goals/performance/<slug>/`（须 `lastValidation.status=pass`），完成后走 goal mode 对账收尾 |
| **深度绑定** | `ultraqa` | 活跃 | 对抗性端到端 QA：构建正常路径 + 9 类敌对场景矩阵（畸形输入、重复打断、prompt 注入、取消/恢复、陈旧状态、脏工作区、挂死命令、flaky 测试、误导性成功输出），最多 5 轮循环（同一失败 3 次即止损）。QA 方法论本身很通用，但按实现强制 `omx state` 生命周期跟踪 |
| **深度绑定** | `code-review` | 活跃 | 双通道并行评审：`code-reviewer`（按 CRITICAL~LOW 分级）+ `architect`（魔鬼代言人，CLEAR/WATCH/BLOCK）双独立通道，按确定性规则合成最终裁决（APPROVE/REQUEST CHANGES/COMMENT）；单通道缺失时禁止降级为自我评审。评审方法论通用，实现绑定 `omx state` 与 OMX agent 车道 |
| **深度绑定** | `ultrawork` | 活跃 | 会话内轻量并行执行引擎，官方定位"组件而非持久/验证模式"：动手前定验收标准，按依赖形状分类并行推进，长命令后台跑，收尾轻量验证；不提供持久账本、架构师签核、deslop 保证，需要时升级到 ultragoal/team。绑定 `omx state` 与 OMX 代理分层表（`references/agent-tiers.md`） |
| **深度绑定** | `visual-ralph` | 活跃 | 前端 UI 交付编排：生成/捕获视觉参考 → 用户批准 → `$ralph` 自主实现 → 视觉裁决评分迭代（`score >= 90` 才过）→ 沉淀 design token。依赖 `$imagegen`、`omx imagegen continuation`、omx Stop-hook 后续队列、`.omx/artifacts/visual-ralph/` |
| **深度绑定** | `ask` | 活跃 | 调本地外部顾问 CLI（`omx ask claude/gemini`，底层 `claude -p`/`gemini -p`）获取第二意见，并把问答存为 `.omx/artifacts/ask-<backend>-<slug>-<timestamp>.md` 可复用工件。已合并取代旧 `ask-claude`/`ask-gemini`（耦合较轻） |
| **深度绑定** | `wiki` | 活跃 | 仓库内持久 markdown 知识库：`omx wiki` 子命令做录入/关键词+标签检索（明确不用向量嵌入）/lint/生命周期管理，页面存 `omx_wiki/`，分 8 个类别（architecture/decision/pattern/debugging/environment/session-log/reference/convention），支持 `[[交叉引用]]` 与会话结束自动沉淀 |
| **深度绑定** | `hud` | 活跃 | 配置 OMX 两层状态栏：第一层 Codex 原生 statusLine（模型/分支/上下文占用），第二层 `omx hud` 读 `.omx/state/` 各模式状态，支持 minimal/focused/full 三档预设与健康色标 |
| **深度绑定** | `omx-setup` | 活跃（元技能） | OMX 自身的安装配置：`omx setup` 管理 legacy vs 插件两种交付模式、安装 prompts/skills/native agents、合并 config.toml、配 hooks/通知、生成 AGENTS.md，偏好持久化到 `.omx/setup-scope.json` |
| **深度绑定** | `doctor` | 活跃 | OMX 安装诊断修复：`npm view oh-my-codex version` 比对版本、检查插件缓存堆积、旧 hook 残留、旧 curl 安装遗留目录，输出健康报告并自动修复。诊断对象就是 OMX 安装本身，天然不可移植 |
| **深度绑定** | `configure-notifications` | 活跃 | OMX 通知系统统一配置入口：菜单引导配置 Discord/Telegram/Slack 或通用 webhook/CLI 命令，写 `~/.codex/.omx-config.json`，含横切设置（verbosity/冷却/profiles）与 OpenClaw 代理转发进阶配置 |
| **深度绑定** | `git-master` | 活跃（薄路由壳） | Git 专家路由入口：原子化提交、rebase、历史管理任务转发给 `/prompts:git-master` 智能体。本体只有一句路由指令；底层 Git 方法论本身通用 |
| **深度绑定** | `ecomode` | 废弃（有内容残壳） | 已硬废弃的省 token 模式：模型档位修饰器（优先便宜档位 + `references/agent-tiers.md` 代理分层路由表）。维护中的替代路径是 `$ultrawork`。保留了很有参考价值的 agent 分层省 token 策略 |
| **深度绑定** | `web-clone` | 废弃（有内容残壳） | 已硬废弃的 URL 克隆工作流（Playwright 提取→构建→三维验证[视觉 ≥85 分+功能+结构地标]→最多 5 轮迭代），新任务改走 `$visual-ralph`。正文保留的 Playwright 五遍提取法方法论可参考 |
| **通用** | `analyze` | 活跃 | 只读式仓库深度分析：针对"为什么/什么导致"类问题，比较多个候选解释按证据支持度排名输出，严格区分证据/推断/未知，每条结论带 `file:line` 引用与置信度。完全自包含 |
| **通用** | `ai-slop-cleaner` | 活跃 | AI 生成"代码垃圾"清理工作流：回归测试先行锁行为 → 按坏味道分批清理（fallback 审查→死代码→去重→命名）→ 每轮跑质量门 → 产出证据密集报告。内含具体 UI slop 规则，方法完全通用 |
| **通用** | `best-practice-research` | 活跃 | 有边界的最佳实践调研：官方/上游文档证据优先，标注来源 URL 与版本上下文，产出带引用的推荐结论后即停止（只读默认终止），实现工作显式移交流水线 |
| **通用** | `design` | 活跃 | 建立仓库本地 `DESIGN.md` 作为产品/UI/UX 决策唯一事实来源：先勘察仓库已有设计证据，只对缺口做一轮聚焦访谈，按固定章节清单生成/刷新 DESIGN.md，后续 UI 决策必须引用它 |
| **通用** | `skill` | 活跃（元技能） | 本地技能库管理：`list/add/remove/edit/search/info/sync/setup/scan` 子命令，扫描 Codex 标准 skills 目录（`~/.codex/skills/`、`.codex/skills/`）、解析 frontmatter、提供创建向导与四类模板、双 scope 同步。只依赖文件操作，无 OMX 依赖 |
| **通用** | `tdd` | 废弃（有内容残壳） | 已硬废弃的 TDD 技能（测试先行纪律并入主流实现工作流），正文完整保留 Red-Green-Refactor 铁律：无失败测试不写生产代码、一轮一个功能、重构保持绿色。纯方法论 |
| **废弃壳** | `build-fix` / `deepsearch` / `help` / `note` / `ralph-init` / `trace` | 纯废弃 | 各自只剩一句重定向：构建失败交给执行工作流、深度分析用 `$analyze`、帮助用 `$omx-setup`/`omx doctor`、笔记用 OMX 持久记忆、ralph 初始化直接用 `$ralph`、trace 用 OMX 运行时检查面 |
| **废弃壳** | `review` / `security-review` | 纯废弃 | 评审需求统一改走 `$code-review`（安全关注点也在其范围内） |
| **废弃壳** | `ask-claude` / `ask-gemini` / `swarm` / `frontend-ui-ux` / `visual-verdict` | 纯废弃 | 兼容性垫片：分别重定向到 `$ask`、`$ask`、`$team`、`$design`/`$visual-ralph`、`$visual-ralph`（视觉评分已内置于后者） |

## 关键观察

- **46 个 skill 里只有 6 个是纯通用**（analyze、ai-slop-cleaner、best-practice-research、design、skill、tdd），可直接移植到任何 agent（包括 parking-agents / ZCode 环境）。
- **约 20 个活跃技能深度绑定 OMX 运行时**——其中 `team`/`worker`/`cancel`/`hud`/`omx-setup`/`doctor` 这类是纯 OMX 基础设施技能，移植没有意义；但 `deep-interview`、`plan --consensus`、`ultragoal`、`ultraqa`、`code-review`、`autopilot` 这一批的**方法论内核非常优秀**，只是状态层写死了 `omx` CLI / `.omx/` / Codex goal mode，移植时需要把状态管理换成自己的机制。
- **16 个是废弃垫片**（占 1/3），这是 OMX 近期大整合的结果——大量独立技能被合并进 `$plan`、`$code-review`、`$visual-ralph`、`$ask` 等幸存者，引用旧名时会重定向。参考时以本表的"活跃"技能为准。

## 核对记录（2026-08-16）

全部 46 个技能的描述已与 `skills/*/SKILL.md` 源文件逐条交叉核对。核对中发现并修正了 2 处错误：

1. **`deep-interview`（已修正）**：初版写"六个清晰度维度加权打分"。实际公式：greenfield 用 5 个维度（intent × 0.30 + outcome × 0.25 + scope × 0.20 + constraints × 0.15 + success × 0.10），brownfield 用 6 个维度（另加 context × 0.10）。
2. **`autopilot`（已修正）**：初版写"评审或 QA 不干净就退回 `$ralplan` 重规划"。实际逻辑：`$code-review` 不干净先进入 `rework` 阶段做范围内的实现修复再回到 code-review；只有评审判定**计划/需求本身有误**、或 `$ultraqa` 失败，才退回 `$ralplan`。

以下关键事实点均已核实无误：autopilot 五阶段链路原文、ultraqa 的 9 类敌对场景清单与"最多 5 轮 / 同一失败 3 次止损"、visual-ralph 的 `score >= 90` 阈值、web-clone 的 `score >= 85` 阈值与 Playwright 依赖、code-review 的 CRITICAL~LOW 分级与 CLEAR/WATCH/BLOCK 合成规则、team 的 `omx team 3:executor` 启动示例、cancel 的两遍协议（shutdown inbox → 15 秒 → kill-session）与 `--all` 拒绝、ralplan 锁死的四个 Codex 版本号、plan 吸收 `/planner` `/ralplan` `/review` 的原文声明、deep-interview 四个挑战模式名（Contrarian/Terminologist/Simplifier/Ontologist，第 330–333 行）、prometheus-strict 的最少 2 轮 / 最多 5 轮、wiki 的 8 个类别与"无向量嵌入"、ultrawork 的"组件而非持久模式"定位、ask 的 `omx ask` 命令与 `.omx/artifacts/` 工件路径、worker 的 `OMX_TEAM_WORKER`/ACK 协议、skill 的子命令清单，以及全部废弃壳的重定向目标。
