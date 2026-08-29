# parking-agents

> 个人自用的跨平台 skill 开发与发布仓库 + VS Code Copilot agent 工具箱。`skills/` 单树分类、junction 即时生效，`.agents/skills/` 是新技能孵化位。

## 这个仓库有两半

它们**互不依赖**，规则也不同：

| | `skills/` | `.copilot/agents/` |
|---|---|---|
| 是什么 | 跨平台技能库，9 个 harness 共享 | VS Code Copilot 专用 agent |
| 交付方式 | 各平台原生插件机制 / 本机 junction 安装器 | 目录 junction 挂到 `~/.copilot/` |
| 正文能否写工具名 | **不能**（`npm test` 会拦） | 能，本来就只跑在 Copilot 上 |
| 开发文档 | [docs/porting-to-a-new-harness.md](./docs/porting-to-a-new-harness.md) | 各 agent 文件头部 + `eval/`、`insight/` 内 README |

## 目录结构

```
skills/                  # ★ 唯一安装源：分类=顶层目录，63 个技能
├── deprecated/ in-progress/    # 生命周期分类，默认不安装
├── life/ matt-skills/ pub/ ue/ workflow/
│   └── <分类>/<名字>/SKILL.md  （matt-skills 下再分 engineering/productivity 子组）

.agents/skills/          # ★ 新技能孵化位（项目级加载即可用，不参与安装）

AGENTS.md                # ★ 仓库 Agent 约定（.mjs 脚本规则、目录约定、issue/标签/领域文档入口）
CLAUDE.md / GEMINI.md    # 指令文件（@-include AGENTS.md；hooks/session-start 每会话注入它）
CONTEXT.md               # 领域术语表（单一上下文，决策记录在 docs/adr/，见 docs/agents/domain.md）

install-skills.cmd       # 双击进安装菜单（junction 本机技能目录，见下节）
uninstall-skills.cmd     # 双击进卸载菜单（全清指向本仓 skills/ 的链接）
scripts/                 # skill-links.mjs 安装核心库 + install/uninstall 入口 + 版本锁步 + evals
hooks/                   # SessionStart 注入器（注入 AGENTS.md；Claude Code / Cursor / Copilot CLI 共用）
tests/                   # 结构断言 + 工具名 lint + 安装器测试 + 各平台契约测试

docs/
├── agents/              # issue-tracker / triage-labels / domain 三份约定
├── design/ research/ retrospectives/
├── install-layout.md / porting-to-a-new-harness.md / testing.md
├── eval-gates-best-practices.md / GOALCONTRACT-GUIDE.md
└── reports/             # 运行生成的报告/审计产物（gitignored）

.claude-plugin/ .cursor-plugin/ .codex-plugin/ .kimi-plugin/
.pi/ .opencode/          # 各平台插件清单与扩展
gemini-extension.json    # Gemini CLI 扩展清单

.copilot/agents/         # 另一半：VS Code Copilot agent
├── *.agent.md           # 编排器 + 工具链 subagent
├── eval/                # 行为评估脚本
└── insight/             # 使用行为洞察分析

.aes-workflow/           # 工作流技能族运行时目录（有意入库）
.aes-worktree-board/     # worktree 看板运行时目录
```

## 安装

### 本机一键安装（junction 安装器）

给**自己机器上的 agent** 用：双击仓库根的 `install-skills.cmd` 进菜单（选目标 `~/.agents/skills` / `~/.claude/skills` / 两者，选套档，确认执行）。命令行等价：

```bash
node scripts/install-skills.mjs --target both --set default
```

- `--target agents|claude|both`（默认 both）
- `--set default|progress|all` —— 三档套装：**default** 排除 deprecated + in-progress；**progress** 排除 deprecated；**all** 全装
- `--only <分类>` / `--skills a,b,c` —— 显式选择，**绕过套档排除**（如 `--only deprecated`、`--skills cpu-monitor` 能选中 in-progress 里的技能）
- `--dry-run` 只报告；`--list` 按分类列出技能与各套档是否包含

每个技能一条 junction 指向 `skills/<分类>/<名字>/`，agent 直读工作区、永不漂移；**整档安装**（菜单或 `--set`）会把套装外的本仓旧链接一并收走（从 all 档切回 default 档时 deprecated/in-progress 链接自动清除），`--only` / `--skills` 则是外科手术式选择、只动选中项。已存在的真实目录先挪进 `skills-backup-<ts>/`；每次安装附带体检：清死链、报告异常项，lark-* 等外来链接不动。POSIX 下退化为普通 symlink。

卸载：双击 `uninstall-skills.cmd` 或 `npm run uninstall:skills`，删除目标里**所有**指向本仓 `skills/` 的链接（含历史上装的 deprecated/in-progress），外来项与真实目录不动。

### 平台插件安装

支持 9 个 harness。**✅ 表示跑过验收测试**（干净会话里技能能自动触发）；⚠️ 表示集成已写好、契约测试覆盖，但没做端到端验证 —— 装了之后请自己冒烟确认一次。

#### ✅ Claude Code

```bash
claude --plugin-dir /path/to/parking-agents
```

或加进 marketplace 后 `/plugin install parking-skills`。会话开始时 `hooks/session-start` 自动注入仓库约定（AGENTS.md）；技能由 Claude Code 原生发现。

#### ✅ Codex

把仓库作为插件加载，Codex 会原生发现 `skills/`。需要 subagent 类技能的话，在 `~/.codex/config.toml` 里开启：

```toml
[features]
multi_agent = true
```

#### ✅ Pi

```bash
pi install git:https://github.com/parkth1026/parking-agents
```

`package.json` 的 `pi` 字段声明了扩展与技能目录。

#### ⚠️ Cursor

作为插件加载仓库。`.cursor-plugin/plugin.json` 指向 `hooks/hooks-cursor.json`（Cursor 的 hook schema 与 Claude Code 不同，是另一份文件）。

#### ⚠️ Gemini CLI

```bash
gemini extensions install https://github.com/parkth1026/parking-agents
```

`gemini-extension.json` 声明 `GEMINI.md` 为上下文文件，后者 `@`-include 仓库约定（AGENTS.md）。

#### ⚠️ OpenCode

在 `opencode.json` 里加：

```json
{ "plugin": ["https://github.com/parkth1026/parking-agents"] }
```

详见 [.opencode/INSTALL.md](./.opencode/INSTALL.md)。

#### ⚠️ Kimi Code

marketplace 安装，或 `/plugins install` 加 GitHub URL。工具映射由 `.kimi-plugin/plugin.json` 的 `skillInstructions` 字段内联声明。

#### ⚠️ Copilot CLI / Antigravity

两者都复用 Claude Code 的插件路径。Copilot CLI 靠 `COPILOT_CLI` 环境变量走 hook 的第三个分支；Antigravity 无专属映射文件（原 `antigravity-tools.md` 已随引导技能架构移除）。

#### ❌ VS Code Copilot（不适配）

它没有 session-start hook，无法满足自动注入的硬性要求。且 `skills/` 已改为三分类两层布局，不再能靠单条 junction 满足「扁平一层」的发现要求 —— 如确需使用，参考 `scripts/install-skills.mjs` 的扁平化规则逐技能挂接。原因见 [docs/porting-to-a-new-harness.md](./docs/porting-to-a-new-harness.md) 附录 B。

## 跨平台是怎么做到的

三层结构，零构建、零依赖：

1. **`skills/` 逐字共享** —— 所有平台读同一份正文。技能正文只写**动作**（"读一个文件"、"派发一个子代理"），从不指名具体工具。这就是同一份正文能在 9 个平台上原封不动运行的原因。
2. **每平台一份工具映射，只写差异，内联在该平台的注入器里** —— Pi 在 `piToolMapping()`、OpenCode 在 `openCodeToolMapping()`、Kimi 在 manifest 的 `skillInstructions`，各自是唯一真源。**工具面已覆盖全部动作的平台不需要映射**（Claude Code / Cursor / Copilot CLI 都没有）。
3. **每平台一个会话开始注入器** —— Shape A 平台（Claude Code / Cursor / Copilot CLI）注入仓库约定（AGENTS.md），Shape B 平台（Pi / OpenCode）注入各自的内联映射。早期由 `using-parking-skills` 引导技能统一承载，该技能已移除（048efac），注入器现已自包含。

> **会话开始注入就是集成本身。** 没有它，约定与映射只是躺在磁盘上的死文本 —— 存在，但永远不会被送到模型面前。

⚠️ **技能正文里不允许出现任何 harness 的工具名。** 一句 "use the Agent tool" 在一个平台上正确，在另外八个平台上静默出错。`npm test` 里的 `tests/skills/test-no-tool-names.mjs` 会拦下来。缺能力的修法永远是**改该平台的内联映射**，不是改技能正文。

## Skills（`skills/` 单树）

`skills/` 是唯一安装源，分类=顶层目录。deprecated、in-progress 是生命周期分类，默认不被安装（default 档排除两者，progress 档排除 deprecated）；新技能在 `.agents/skills/` 孵化，五件套评测门槛过了 `git mv` 晋级进树，见 [自研技能晋级约定](./docs/agents/skill-release.md)。

| 分类 | 数量 | 内容 | default 档 |
|---|---|---|---|
| deprecated | 5 | 已废弃技能 | ✗ |
| in-progress | 6 | 开发中技能 | ✗ |
| life | 1 | 生活类（shopping-deep-research） | ✓ |
| matt-skills | 25 | Matt Pocock 移植（下分 engineering/productivity 子组） | ✓ |
| pub | 5 | 对外发布参考 | ✓ |
| ue | 7 | Unreal Engine 与 Jenkins 相关 | ✓ |
| workflow | 14 | aes-* 访谈/工作流家族与通用流程 | ✓ |

**仅用户可调用** = frontmatter 标 `disable-model-invocation: true`，只能由人显式调用；其余模型按 `description` 自行匹配触发。

### matt-skills/engineering/ —— 日常写码

| Skill | 说明 | 触发 |
|---|---|---|
| code-review | 双轴审查：Standards + Spec，并行 subagent | 模型 |
| codebase-design | 深模块设计的共享词汇 | 模型 |
| diagnosing-bugs | 硬 bug 与性能回归的诊断循环 | 模型 |
| domain-modeling | 构建与打磨领域模型，维护 ADR | 模型 |
| prototype | 一次性原型，回答设计问题 | 模型 |
| research | 对高可信一手来源做调研并落成 Markdown | 模型 |
| resolving-merge-conflicts | 逐 hunk 解决进行中的 merge / rebase 冲突 | 模型 |
| tdd | 红绿重构循环：测试驱动开发 | 模型 |
| wizard | 生成 bash 向导，带人走完只有人能做的步骤（密钥/CI/第三方控制台） | 模型 |
| ask-matt | 路由器：问哪个技能适合当前处境 | 仅用户 |
| grill-with-docs | 质询的同时产出 ADR 与术语表 | 仅用户 |
| implement | 按 spec/工单实施，约定缝处走 /tdd，收尾 /code-review | 仅用户 |
| improve-codebase-architecture | 扫描深化机会 → HTML 报告 → 逐个质询 | 仅用户 |
| setup-matt-pocock-skills | 为仓库配置 engineering 技能（跑一次） | 仅用户 |
| to-spec | 把当前对话综合成 spec 并发布到 issue tracker | 仅用户 |
| to-tickets | 把计划拆成带阻塞边的 tracer-bullet 工单 | 仅用户 |
| triage | 用状态机推进 issue 与外部 PR 的分诊 | 仅用户 |
| wayfinder | 把超大工作量规划成决策工单地图 | 仅用户 |

### matt-skills/productivity/ —— 通用工作流

| Skill | 说明 | 触发 |
|---|---|---|
| grilling | 对计划、决策、想法做穷追不舍的质询 | 模型 |
| writing-for-agents | 为 agent 写文档：skills、AGENTS.md | 模型 |
| grill-me | 穷追不舍的访谈，打磨计划或设计 | 仅用户 |
| handoff | 把当前对话压缩成交接文档 | 仅用户 |
| teach | 把当前目录当作有状态的教学工作区 | 仅用户 |
| to-questionnaire | 把答不了的决策变成问卷交给能答的人 | 仅用户 |
| wait-what | 消息没看懂时立刻喊停，用 CONTEXT.md 词汇重新讲 | 仅用户 |

### pub/ —— 对外发布参考

| Skill | 说明 | 触发 |
|---|---|---|
| gh | GitHub CLI 调用模式（[cli/cli](https://github.com/cli/cli)） | 模型 |
| glab | GitLab CLI（自建实例）认证与 issue/MR 使用范式 | 模型 |
| playwright-cli | 浏览器自动化 | 模型 |
| shadcn | shadcn/ui 组件管理 | 模型 |
| simplify | 审查当前 diff 的复用/质量/效率，按需窄幅修复 | 模型 |

> matt-skills/ 的 engineering 与 productivity 子组出自 [Matt Pocock 的 skills](https://github.com/mattpocock/skills)，迁移时**保持正文原文**便于将来同步上游。ue/、workflow/、life/ 的技能说明见各自 SKILL.md。

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
| Simplify | 薄入口，转发到 simplify 技能（避免同一套流程维护两份） |

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

零依赖纯 Node。跑：技能发现与结构断言、安装器夹具（套装排除/套装外清除/选装/卸载全清）、**工具名 lint**、session-start hook 的三种 JSON 形状、Pi 扩展注入与去重、各平台 manifest 契约、跨 manifest 版本一致性（`--check` / `--audit`）、`check:repo` 跨平台结构检查器。

**这些测试的价值在于把静默失败变成响亮失败** —— 技能加载在所有平台上都无报错、无警告，出错时技能只是不出现。详见 [docs/testing.md](./docs/testing.md)。

- 哪些文件多平台共享、哪些必须放固定位置 → [docs/install-layout.md](./docs/install-layout.md)
- 增加新平台支持 → [docs/porting-to-a-new-harness.md](./docs/porting-to-a-new-harness.md)
- 测试分层与验收标准 → [docs/testing.md](./docs/testing.md)
- issue / 分诊标签 / 领域文档约定 → [docs/agents/](./docs/agents/)
- 自研技能评测与分类晋级 → [docs/agents/skill-release.md](./docs/agents/skill-release.md)

评测入口独立于 `npm test`（避免真实模型评测意外耗时或耗 key）：

```bash
npm run evals --list
npm run evals
npm run evals -- --skill parking-skill-creator
```

版本升级（七份 manifest 锁步）：

```bash
node scripts/bump-version.mjs 0.2.0
```

---

> 本仓库是个人自用，**体系还在建设中**，内容随实践增删，不保证稳定。
