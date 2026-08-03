# parking-agents

> 个人跨平台 skill 库 + VS Code Copilot agent 工具箱。攒一点记一点，**体系未完成，随用随加**。

`skills/` 下的 33 个技能可通过各平台**原生的插件机制**安装到 **Claude Code / Codex / Pi**。
`.copilot/agents/` 下的 agent 仍是 VS Code Copilot 专用。

## 目录结构

```
skills/                  # ★ 跨平台技能真源（一层扁平，33 个）
├── using-parking-skills/    # bootstrap 技能 + 三份平台工具映射表
└── <name>/SKILL.md          # 其余 32 个

.claude-plugin/          # Claude Code 插件清单
.codex-plugin/           # Codex 插件清单
.pi/extensions/          # Pi 进程内扩展
hooks/                   # Claude Code 的 SessionStart 注入器
tests/                   # 结构断言 + 各平台集成测试
scripts/bump-version.mjs # 跨 manifest 版本锁步
docs/                    # 移植文档

.copilot/agents/         # VS Code Copilot agent（未跨平台）
├── eval/                # 行为评估脚本
└── insight/             # 使用行为洞察分析
```

## 安装

### Claude Code

```bash
claude --plugin-dir /path/to/parking-agents
```

或加进 marketplace 后 `/plugin install parking-skills`。

会话开始时 `hooks/session-start` 会自动注入 bootstrap，无需手动开启。

### Codex

把仓库作为插件加载，Codex 会原生发现 `skills/`。需要 subagent 类技能的话，在 `~/.codex/config.toml` 里开启：

```toml
[features]
multi_agent = true
```

### Pi

```bash
pi install git:https://github.com/parkth1026/parking-agents
```

`package.json` 的 `pi` 字段声明了扩展与技能目录。

### VS Code Copilot（未适配，见下文）

第一版**不为 VS Code Copilot 做适配**。若仍想使用，把 junction 指向新的 `skills/` 目录：

```powershell
New-Item -ItemType Junction -Path "$env:USERPROFILE\.copilot\skills" -Target "G:\GIT\AI_WorkFlow\parking-agents-dev\skills"
New-Item -ItemType Junction -Path "$env:USERPROFILE\.copilot\agents" -Target "G:\GIT\AI_WorkFlow\parking-agents-dev\.copilot\agents"
```

技能能被发现（扁平结构是所有平台的最小公倍数），但**没有 bootstrap 注入**，`using-parking-skills` 不会自动生效。原因见 [docs/porting-to-a-new-harness.md](./docs/porting-to-a-new-harness.md) 附录 B。

## 跨平台是怎么做到的

三层结构，零构建：

1. **`skills/` 是唯一真源** —— 所有平台逐字共享
2. **每平台一份工具映射表** —— `skills/using-parking-skills/references/<harness>-tools.md`
3. **每平台一个 bootstrap 注入器** —— 会话开始把 `using-parking-skills/SKILL.md` 注入上下文

⚠️ **技能正文里的工具名是别名，不是真实工具。** 这些技能源自 VS Code Copilot，正文里写的是 `read_file`、`run_in_terminal`、`runSubagent` 等。它们被当作**动作代号**，由各平台的映射表翻译成真实工具名。详见 [docs/porting-to-a-new-harness.md](./docs/porting-to-a-new-harness.md) 的 Part 1.5。

## Skills

**Model-invoked** —— 模型按 `description` 自行匹配触发。

| Skill | 说明 | 来源 |
|---|---|---|
| using-parking-skills | bootstrap：技能使用规则 + 平台工具映射 | 本仓库 |
| cpu-monitor | Windows CPU 进程/线程采样 + WMI 诊断 | 本仓库 |
| ps1-creator | PowerShell 脚本创建规范（契约头 + 强制测试） | 本仓库 |
| dev-environment | .NET + 前端本地开发环境一键启动 | 本仓库 |
| rust-workflow | Rust 双流开发工作流 | 本仓库 |
| react-doctor | React 代码健康度扫描 | 本仓库 |
| shadcn | shadcn/ui 组件管理 | 本仓库 |
| playwright-cli | 浏览器自动化 | 本仓库 |
| gh | GitHub CLI 调用模式 | [cli/cli](https://github.com/cli/cli) |
| simplify | 改动代码的复用 / 质量 / 效率审查 | 本仓库 |
| claude-to-vscode-skill-converter | Claude Code skill → VS Code Copilot 格式 | 本仓库 |
| code-review | 双轴审查：Standards + Spec，并行 subagent | mattpocock |
| codebase-design | 深模块设计的共享词汇 | mattpocock |
| domain-modeling | 构建与打磨领域模型，维护 ADR | mattpocock |
| diagnosing-bugs | 硬 bug 与性能回归的诊断循环 | mattpocock |
| prototype | 一次性原型，回答设计问题 | mattpocock |
| research | 对高可信一手来源做调研并落成 Markdown | mattpocock |
| resolving-merge-conflicts | 逐 hunk 解决进行中的 merge / rebase 冲突 | mattpocock |
| grilling | 对计划、决策、想法做穷追不舍的质询 | mattpocock |
| writing-for-agents | 为 agent 写文档：skills、AGENTS.md | mattpocock |

**User-invoked only** —— frontmatter 标了 `disable-model-invocation: true`，只能由人显式调用。

| Skill | 说明 | 来源 |
|---|---|---|
| rust-workflow-init | 为 Rust 项目初始化双流工作流 | 本仓库 |
| ask-matt | 路由器：问哪个技能适合当前处境 | mattpocock |
| to-spec | 把当前对话综合成 spec 并发布到 issue tracker | mattpocock |
| to-tickets | 把计划拆成带阻塞边的 tracer-bullet 工单 | mattpocock |
| to-questionnaire | 把答不了的决策变成问卷交给能答的人 | mattpocock |
| triage | 用状态机推进 issue 与外部 PR 的分诊 | mattpocock |
| wayfinder | 把超大工作量规划成决策工单地图 | mattpocock |
| improve-codebase-architecture | 扫描深化机会 → HTML 报告 → 逐个质询 | mattpocock |
| grill-me | 穷追不舍的访谈，打磨计划或设计 | mattpocock |
| grill-with-docs | 质询的同时产出 ADR 与术语表 | mattpocock |
| handoff | 把当前对话压缩成交接文档 | mattpocock |
| teach | 把当前目录当作有状态的教学工作区 | mattpocock |
| setup-matt-pocock-skills | 为仓库配置 engineering 技能（跑一次） | mattpocock |

> mattpocock 来源技能出自 [Matt Pocock 的 skills](https://github.com/mattpocock/skills)，迁移时**保持正文原文**便于将来同步上游。
>
> `cpu-monitor` / `ps1-creator` / `dev-environment` 依赖 PowerShell，**仅限 Windows**。

## Agents（VS Code Copilot 专用）

**编排器**

| Agent | 说明 |
|-------|------|
| Master | 编排者，琐碎自干 + 实质任务走 Worker→Evaluator 三角验证 |
| Worker | 全能执行器，按契约回报 Result/Claims |
| Evaluator | 只读第二只眼睛，独立验证 Worker 产出 |
| Parking | 薄编排器，全部委派给 Worker |
| SuperPower | skill 驱动编排器，按技能路由 |
| SuperPowerSub | SuperPower 的执行子代理 |
| Karpathy | 遵循 Karpathy 准则的代码 agent |
| Debug | REPRODUCE→ISOLATE→FIX→PROVE 系统化除虫 |
| Simplify | 代码审查：复用 / 质量 / 效率三维审查 |

**工具链 subagent**（`parking-agent-*`）

| Subagent | 说明 |
|----------|------|
| parking-agent-creator | 创建 / 脚手架新的 agent / skill |
| parking-agent-eval | 只读评估：lint、校验、排错 customization 文件 |
| parking-agent-insight | Insight 分析编排：3-phase 管线（提取→语义→报告）|
| parking-agent-analytics | 脚本执行 + 定量分析 + 错误诊断 |

## 工具链

**eval**（`.copilot/agents/eval/`）— 从 Copilot debug-logs 提取行为数据，用声明式 YAML 断言验证 agent 合规性。详见该目录 `README.md`。

**insight**（`.copilot/agents/insight/`）— 三阶段管线：定量提取 → LLM 语义分析 → HTML 报告。详见该目录 `README.md`。

## 开发

```bash
npm test
```

跑全部断言：技能结构（扁平 + frontmatter 合法 + 目录名与 `name` 一致）、hook 的三种 JSON 形状、Pi 扩展注入与去重、跨 manifest 版本一致性。

**技能结构测试是最重要的一条** —— 技能加载失败在所有平台上都是**静默**的，没有报错也没有警告，技能只是不出现。

- 增加新平台支持 → [docs/porting-to-a-new-harness.md](./docs/porting-to-a-new-harness.md)
- 开发 VS Code Copilot agent → [AGENT_DEVELOPMENT.md](./AGENT_DEVELOPMENT.md)

版本升级（四份 manifest 锁步）：

```bash
node scripts/bump-version.mjs 0.2.0
```

---

> 本仓库是个人自用，**体系还在建设中**，内容随实践增删，不保证稳定。
