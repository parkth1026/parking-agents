# parking-agents

> 个人跨平台 skill 库 + VS Code Copilot agent 工具箱。攒一点记一点，**体系未完成，随用随加**。

## 这个仓库有两半

它们**互不依赖**，规则也不同：

| | `skills/` | `.copilot/agents/` |
|---|---|---|
| 是什么 | 跨平台技能库，9 个 harness 共享 | VS Code Copilot 专用 agent |
| 交付方式 | 各平台原生插件机制 | 目录 junction 挂到 `~/.copilot/` |
| 正文能否写工具名 | **不能**（`npm test` 会拦） | 能，本来就只跑在 Copilot 上 |
| 开发文档 | [docs/porting-to-a-new-harness.md](./docs/porting-to-a-new-harness.md) | [AGENT_DEVELOPMENT.md](./AGENT_DEVELOPMENT.md) |

下面的「安装」「跨平台是怎么做到的」「Skills」三节只讲左边那半。

## 目录结构

```
skills/                  # ★ 跨平台技能真源（一层扁平，33 个）
├── using-parking-skills/    # bootstrap 技能 + references/ 平台工具映射表
└── <name>/SKILL.md          # 其余 32 个

.claude-plugin/          # Claude Code 插件清单 + dev marketplace
.cursor-plugin/          # Cursor 插件清单
.codex-plugin/           # Codex 插件清单
.kimi-plugin/            # Kimi Code 插件清单（映射内联在 skillInstructions）
.pi/extensions/          # Pi 进程内扩展
.opencode/plugins/       # OpenCode 进程内插件（映射内联在 .js）
.agents/plugins/         # 跨运行时 marketplace 入口
gemini-extension.json    # Gemini CLI 扩展清单
GEMINI.md                # Gemini 的指令文件（两行 @-include）
hooks/                   # SessionStart 注入器（Claude Code / Cursor / Copilot CLI 共用）
tests/                   # 结构断言 + 工具名 lint + 各平台契约测试
scripts/bump-version.mjs # 跨 manifest 版本锁步
docs/                    # 移植文档 + 测试文档

.copilot/agents/         # 另一半：VS Code Copilot agent
├── eval/                # 行为评估脚本
└── insight/             # 使用行为洞察分析
```

## 安装

支持 9 个 harness。**✅ 表示跑过验收测试**（干净会话里技能能自动触发）；⚠️ 表示集成已写好、契约测试覆盖，但没做端到端验证 —— 装了之后请自己冒烟确认一次。

### ✅ Claude Code

```bash
claude --plugin-dir /path/to/parking-agents
```

或加进 marketplace 后 `/plugin install parking-skills`。会话开始时 `hooks/session-start` 自动注入 bootstrap。

### ✅ Codex

把仓库作为插件加载，Codex 会原生发现 `skills/`。需要 subagent 类技能的话，在 `~/.codex/config.toml` 里开启：

```toml
[features]
multi_agent = true
```

### ✅ Pi

```bash
pi install git:https://github.com/parkth1026/parking-agents
```

`package.json` 的 `pi` 字段声明了扩展与技能目录。

### ⚠️ Cursor

作为插件加载仓库。`.cursor-plugin/plugin.json` 指向 `hooks/hooks-cursor.json`（Cursor 的 hook schema 与 Claude Code 不同，是另一份文件）。

### ⚠️ Gemini CLI

```bash
gemini extensions install https://github.com/parkth1026/parking-agents
```

`gemini-extension.json` 声明 `GEMINI.md` 为上下文文件，后者 `@`-include bootstrap 与工具映射。

### ⚠️ OpenCode

在 `opencode.json` 里加：

```json
{ "plugin": ["https://github.com/parkth1026/parking-agents"] }
```

详见 [.opencode/INSTALL.md](./.opencode/INSTALL.md)。

### ⚠️ Kimi Code

marketplace 安装，或 `/plugins install` 加 GitHub URL。bootstrap 与工具映射都由 `.kimi-plugin/plugin.json` 声明。

### ⚠️ Copilot CLI / Antigravity

两者都复用 Claude Code 的插件路径。Copilot CLI 靠 `COPILOT_CLI` 环境变量走 hook 的第三个分支；Antigravity 的工具差异见 `references/antigravity-tools.md`。

### ❌ VS Code Copilot（不适配）

它没有 session-start hook，无法满足自动注入的硬性要求。若仍想用技能，挂 junction：

```powershell
New-Item -ItemType Junction -Path "$env:USERPROFILE\.copilot\skills" -Target "G:\GIT\AI_WorkFlow\parking-agents-dev\skills"
```

技能能被发现（扁平结构是所有平台的最小公倍数），但**没有 bootstrap 注入**，`using-parking-skills` 不会自动生效。原因见 [docs/porting-to-a-new-harness.md](./docs/porting-to-a-new-harness.md) 附录 B。

## 跨平台是怎么做到的

三层结构，零构建、零依赖：

1. **`skills/` 是唯一真源** —— 所有平台逐字共享。技能正文只写**动作**（"读一个文件"、"派发一个子代理"），从不指名具体工具。这就是同一份正文能在 9 个平台上原封不动运行的原因。
2. **每平台一份工具映射表，只写差异** —— `references/<harness>-tools.md` 做「动作 → 该平台工具」的两列翻译。**工具面已覆盖全部动作的平台不需要映射表**（Claude Code / Cursor / Copilot CLI 都没有）。
3. **每平台一个 bootstrap 注入器** —— 会话开始把 `using-parking-skills/SKILL.md` 注入上下文。

> **Bootstrap 就是集成本身。** 没有它，技能文件只是躺在磁盘上的死文本 —— 存在，但永远不会被调用。

⚠️ **技能正文里不允许出现任何 harness 的工具名。** 一句 "use the Agent tool" 在一个平台上正确，在另外八个平台上静默出错。`npm test` 里的 `tests/skills/test-no-tool-names.mjs` 会拦下来。缺能力的修法永远是**改映射表**，不是改技能正文。

## Skills

**Model-invoked** —— 模型按 `description` 自行匹配触发。

| Skill | 说明 | 来源 |
|---|---|---|
| using-parking-skills | bootstrap：技能使用规则 + 各平台工具映射（`references/`） | 本仓库 |
| making-skills-cross-platform | 把任意技能仓库改造成多 harness 插件，含可移植结构检查器 | 本仓库 |
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
| Simplify | 薄入口，转发到 `skills/simplify`（避免同一套流程维护两份） |

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

零依赖纯 Node。跑：技能结构断言、**工具名 lint**、hook 的三种 JSON 形状、Pi 扩展注入与去重、9 个平台的契约测试、跨 manifest 版本一致性。

**这些测试的价值在于把静默失败变成响亮失败** —— 技能加载在所有平台上都无报错、无警告，出错时技能只是不出现。详见 [docs/testing.md](./docs/testing.md)。

- 哪些文件九平台共享、哪些必须放固定位置 → [docs/install-layout.md](./docs/install-layout.md)
- 增加新平台支持 → [docs/porting-to-a-new-harness.md](./docs/porting-to-a-new-harness.md)
- 测试分层与验收标准 → [docs/testing.md](./docs/testing.md)
- 开发 VS Code Copilot agent → [AGENT_DEVELOPMENT.md](./AGENT_DEVELOPMENT.md)

版本升级（七份 manifest 锁步）：

```bash
node scripts/bump-version.mjs 0.2.0
```

---

> 本仓库是个人自用，**体系还在建设中**，内容随实践增删，不保证稳定。
