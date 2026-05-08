> 本文件是 `CLAUDE.md` 的详情索引，所有 agent / skill 开发规范、设计原则、参考资料都在此。
> CLAUDE.md 仅保留一句指引，避免在实际开发与测试 agent 时污染上下文。

# CLAUDE.md

## 仓库定位
- 当前仓库 `parking-agents` 是用于**开发 Agents 与 Skills** 的工作区。
- `.copilot/` 目录下的内容专门针对 **VS Code Copilot 的 agents 与 skills**，必须遵守 VS Code Copilot 的官方规范与最佳实践（包括 `.agent.md`、`.prompt.md`、`.instructions.md`、`SKILL.md` 等定制化文件的 frontmatter、applyTo 模式、工具白名单等约定）。

## 设计总原则（Harness 思维）

本仓库所有 agent / skill 的设计都遵循"**Harness（骨架 / 外壳）思维**"。理解这套思维，胜过理解任何具体规范。

### 核心洞察：免费的问答 + 免费的 subagent

VS Code Copilot 有一个关键经济特性：

> **主对话的 Q&A（用户与主 agent 的来回提问）** 与 **主 agent 调用 subagent** 都**不额外消耗 request 配额**。

这意味着：**反复问答 + 把重活全部下放给 subagent**，是成本最低、可控性最高的工作方式。**所有"消耗大上下文 / 长任务 / 高风险操作"全部应当外包给 subagent**，主 agent 只保留决策与摘要。

### 主 agent 的角色定义：纯调度器

主 agent（如 `parking`）是一个 **harness**——只是骨架，不是工人：

- **只做调度**：把任务派发给合适的 subagent，或自行维护 **TODO list** 编排多步任务。
- **只做总结**：从 subagent 回报中提炼关键信息，呈现给用户。
- **只做提问**：每个任务/sprint 完成后，**主动询问用户下一阶段 sprint 是什么**。
- **绝不亲自动手**：不读文件、不改代码、不跑命令、不做长搜索；任何"重上下文"操作一律下放。

### Subagent 的角色定义：场景化的"演员"

Subagent 是真正干活的**角色专家**：

- 每个 subagent 应当**聚焦一种场景 / 角色**（探索者 / 调试者 / 重构者 / 文档撰写者 / 代码评审者 …）。
- 角色通过 `description` 字段表达，让主 agent 能基于任务场景**选角**。
- 同一类工作可以有多个不同侧重的 subagent 并存，由场景选用最合适那个。

### 工作节奏：问答驱动 + 串行 sprint

```
用户提需求
  ↓
主 agent 澄清（提问，免费）
  ↓
主 agent 选角 → 派 subagent 干活（重上下文外包，免费）
  ↓
subagent 回报 → 主 agent 总结
  ↓
主 agent 提问"下一个 sprint 干什么？"
  ↓
循环……
```

每一轮被视为一个 **sprint**：单一目标、单一 subagent、用户可介入校准。

### 三条不可违背的铁律

1. **主 agent 永远不亲自做重活** —— 重上下文工作 100% 外包给 subagent。
2. **subagent 永远只有一个在干活** —— 串行调度，禁止并发。
3. **subagent 永远不嵌套** —— 调用链扁平为单层，避免上下文与控制流失控。

### 设计取舍参考

| 场景 | ✅ 推荐做法 | ❌ 反模式 |
|---|---|---|
| 用户意图模糊 | 主 agent 直接问用户（免费） | 主 agent 自己猜 + 硬干 |
| 需要看 10 个文件 | 派 Explore subagent | 主 agent 自己 read_file 10 次 |
| 跨多步骤的重构 | 主 agent 维护 TODO，逐项派 subagent | 一个 subagent 包圆，链路过长难恢复 |
| 同类任务但场景不同 | 多个角色化 subagent 各司其职 | 一个万能 subagent 用 if/else 分支 |
| 任务结束 | 主动 ask 用户下一步 sprint | 默认结束 / 自行进入下一任务 |

> 后续所有 agent / skill 的具体规范、命名、工具白名单、description 写法，都是在为这套 **Harness 思维**服务的实现细节。

## 工作目录与目录 junction 约定

- 当前仓库的 `.copilot/agents/` 与 `.copilot/skills/` 已通过**目录级 junction**（`mklink /J`）挂载到用户目录 `~/.copilot/` 下。**不是文件级 symlink**——是整目录挂载。
- **所有 agent / skill 的改动一律在本仓库内直接进行**，VS Code Copilot 会通过目录 junction 自动识别。
- **不要**到 `C:\Users\Administrator\.copilot\` 或用户全局目录中去修改文件——那只是 junction 的指向位置，源在本仓库。
- 新增 / 修改 / 删除均以本仓库为准，git 版本控制随之生效。
- **验证 junction 是否有效**（PowerShell，作用于目录而非单文件）：
  ```powershell
  Get-Item "$env:USERPROFILE\.copilot\agents" | Select-Object Name, LinkType, Target
  fsutil reparsepoint query "$env:USERPROFILE\.copilot\agents"
  ```
  `LinkType` 应为 `Junction`，`Target` 应指向本仓库 `D:\GIT\parking-agents\.copilot\agents`。

## Parking 主 Agent 设计原则

本仓库的核心主 agent 命名为 **`parking`**。它是整个 agent 体系的"调度中枢"，遵守以下铁律：

### 职责边界
- **只做三件事**：
  1. **调度任务** —— 把用户请求拆解并分派给合适的 subagent。
  2. **总结结论** —— 收集 subagent 的产出，提炼关键信息回报用户。
  3. **向用户提问下一步** —— 每轮任务完成后，必须主动询问用户下一步动作。
- **不亲自执行任何具体工作**：不读文件、不写代码、不跑命令、不做搜索；所有具体动作一律下放给 subagent。

### 并发与嵌套约束（铁律）
- **永远只有一个 subagent 在工作**：禁止并发派发多个 subagent。
- **禁止 subagent 套 subagent**：subagent 内部不得再启动子 subagent，保持调用链扁平为单层。
- 如需多步骤工作，由 parking 顺序串行调度，每次仅一个 subagent 在跑。

### 交互节奏
- 每完成一次 subagent 调用 → 总结 → 向用户提问 → 等待确认 → 再发起下一次调度。
- 用户意图不明时，先提问澄清，**不要**先行猜测后下发任务。

> 这些原则同时是 `parking` agent 自身 prompt 的核心约束，未来在 `.copilot/agents/parking.agent.md`（或等价文件）中应显式书写并强制执行。

### ⚠️ 模板冻结

> 当前的 **`parking`** 与 **`worker`** 两个 agent 是用户现役的工作模板，**暂不修改**。后续会通过创建"升级版"的方式进行进化（例如新增 `parking-v2.agent.md`、`worker-v2.agent.md` 等），原文件保持不动以保证现有工作流稳定。

## 参考仓库（"军师"）
在设计或实现特定 agents / skills 时，优先参考以下两个仓库中已经过实践验证的实现作为蓝本。**在线优先**，离线或不可访问时 fallback 到本地路径。

1. **superpowers**（通用 agents / skills 实践参考）
   - 在线地址（首选）：https://github.com/obra/superpowers
   - 本地 fallback：`D:\GIT\superpowers`
2. **mattpocock_skills**（skills 设计与组织方式的参考）
   - 在线地址（首选）：https://github.com/mattpocock/skills
   - 本地 fallback：`D:\GIT\mattpocock_skills`

> 在动手前，建议先到对应仓库中查找类似主题的现有实现，吸收其结构、提示词写法、工具调用约束等模式，再结合 VS Code Copilot 的规范进行落地。

## VS Code Copilot 官方规范与参考

### 官方文档链接
- VS Code Copilot 自定义 chat agents/modes：https://code.visualstudio.com/docs/copilot/copilot-customization
- 自定义 instructions 文件：https://code.visualstudio.com/docs/copilot/copilot-customization#_custom-instructions
- 自定义 prompts 文件：https://code.visualstudio.com/docs/copilot/copilot-customization#_prompt-files-experimental
- Copilot 文档总入口：https://code.visualstudio.com/docs/copilot/overview
- GitHub Copilot Customization / Memory：https://docs.github.com/en/copilot/how-tos/use-copilot-agents/copilot-memory

### 官方内置技能参考路径
VS Code 安装目录下的 copilot 扩展资源（写自定义 skill 时可作为模板与规范参照）：

```
C:\Users\Administrator\AppData\Local\Programs\Microsoft VS Code\<version>\resources\app\extensions\copilot\assets\prompts\skills\
```

当前观察到的内置 skills：
- `agent-customization` — 创建/修复 `.instructions.md`、`.prompt.md`、`.agent.md`、`SKILL.md`、`copilot-instructions.md`、`AGENTS.md`
- `create-agent` — 新建 agent 模板
- `create-skill` — 新建 skill 模板
- `create-instructions` — 新建 instructions 文件模板
- `create-prompt` — 新建 prompt 文件模板
- `create-hook` — 新建 hook
- `init` — 工作区初始化
- `install-vscode-extension` — 扩展安装流程
- `project-setup-info-local` / `project-setup-info-context7` — 完整项目脚手架初始化
- `troubleshoot` — 排查 agent / skill 不生效等问题
- `get-search-view-results` — 获取 VS Code Search 视图结果

### 用户全局 Copilot Chat 存储
个人自定义 agents / skills / prompts 的实际存放位置：

```
C:\Users\Administrator\AppData\Roaming\Code\User\globalStorage\github.copilot-chat\
```

当前观察到的关键内容：
- `ask-agent/Ask.agent.md` — 用户级 Ask agent 定义
- `explore-agent/Explore.agent.md` — 用户级 Explore agent 定义
- `plan-agent/Plan.agent.md` — 用户级 Plan agent 定义
- `copilotCli/`、`copilot-cli-images/` — Copilot CLI 相关
- `debugCommand/` — 调试命令
- `commandEmbeddings.json`、`settingEmbeddings.json`、`toolEmbeddingsCache.bin` — 嵌入缓存

### 对应创建技能（可在会话中调用的内置 skill）
- `agent-customization` — 创建/修复 `.instructions.md` / `.prompt.md` / `.agent.md` / `SKILL.md` / `copilot-instructions.md` / `AGENTS.md`
- `project-setup-info-local` — 完整项目脚手架初始化
- `troubleshoot` — 排查 agent / skill 不生效等问题
- `fix-customization-evaluation-diagnostics` — 修复 customization 文件诊断告警

## 工作原则
- 遵循 VS Code Copilot agent / skill 规范（YAML frontmatter、目录结构、命名规则）。
- 新建 agent / skill 前，先扫一遍两个参考仓库是否有相近实现可借鉴。
- `.copilot/` 下的文件须可被 VS Code Copilot 正确识别与加载。
- 保持简洁、单一职责，避免过度工程化。

## 目录约定（建议）
- `.copilot/agents/` — VS Code Copilot 自定义 agents
- `.copilot/skills/` — VS Code Copilot 自定义 skills
- `.copilot/prompts/` — 可复用 prompt 文件
- `.copilot/instructions/` — 作用域化的 instructions 文件

## 开发规范与最佳实践

### P0-1 文件命名与目录语义

| 类型 | 命名规则 | 放置位置 | 触发方式 |
|---|---|---|---|
| Agent | `<Name>.agent.md`（PascalCase 或 kebab-case 均可，文件名即 agent 显示名） | `.copilot/agents/` | 用户在 chat 中显式选择 / 主 agent dispatch |
| Skill | 目录 `<skill-name>/SKILL.md`（kebab-case 目录名） | `.copilot/skills/<skill-name>/SKILL.md` | 由 description 语义匹配触发 |
| Prompt | `<name>.prompt.md` | `.copilot/prompts/` | `/<name>` 斜杠命令调用 |
| Instructions | `<name>.instructions.md` | `.copilot/instructions/` | 按 `applyTo` 自动注入 |
| 仓库根级 | `AGENTS.md` / `copilot-instructions.md` / `CLAUDE.md` | 仓库根 | 自动加载 |

- 扩展名必须**严格小写**：`.agent.md` / `.prompt.md` / `.instructions.md`。
- skill 必须是**目录 + 内含 SKILL.md**，不是单文件。

### P0-2 YAML Frontmatter 字段速查

所有 customization 文件以 `---` 包裹的 YAML frontmatter 开头。常用字段：

```yaml
---
description: 一句话功能说明（用于路由匹配，写法见 P1-4）
tools: ['read_file', 'grep_search', 'replace_string_in_file']  # 省略=继承（推荐）；显式数组=白名单（仅用于隔离）
model: Claude Sonnet 4.6 (copilot)   # 可选；不写则跟随会话
applyTo: '**/*.ts'                    # 仅 instructions 文件使用，glob 匹配
mode: agent                           # prompt 文件可选 ask|edit|agent
argumentHint: '描述参数用法'           # agent/prompt 提示用户输入
---
```

- `tools` **省略 = 继承（推荐默认）**；**显式数组 = 白名单（仅用于隔离）**。
- `applyTo` 仅对 `*.instructions.md` 生效，支持多 glob（`'**/*.{ts,tsx}'`）。
- agent 文件中 `description` 是**唯一**决定何时被调度的字段，必须精准。

### P0-3 工具继承（默认行为）

新原则：**默认省略 `tools:` 字段，继承父 agent 全部权限**。这是因为白名单错一个工具名（拼写、未启用、版本变化）即可让 agent **沉默失效**，无报错、无路由命中——非常坑。

- **默认（推荐）**：subagent 经主 agent dispatch 启动时，`tools` 字段直接省略 = 继承父 agent 全部工具权限。
- **仅在有强烈隔离需求**（read-only / 防破坏性操作 / 明确隔离边界）时，才显式声明 `tools:` 数组作为白名单。
- 工具名以 VS Code Copilot 内置名为准（`grep_search` / `read_file` / `replace_string_in_file` …），MCP 工具使用 `mcp_<server>_<tool>` 全名。
- ⚠️ **白名单警示**：一旦工具名拼写错、未启用、或 Copilot 版本变化导致工具改名，agent 会沉默失效。**不确定就不写**——继承全权限永远比错配白名单更安全。
- 涉及破坏性操作（`run_in_terminal` 跑 `rm`、`git push --force`、删表等）由用户在主对话确认，与 `tools` 字段无关，不要把"安全"压力压在白名单上。

### P0-4 「不生效」故障排查清单

按顺序检查：

1. **文件命名是否正确**（扩展名、目录结构、SKILL.md 必为目录形式）。
2. **frontmatter YAML 是否合法**：用 `Chat Customizations Evaluations` 扩展（已安装）实时检查诊断。
3. **目录 junction 是否有效**（作用于目录，不是单文件）：
   ```powershell
   Get-Item "$env:USERPROFILE\.copilot\agents" | Select-Object Name, LinkType, Target
   fsutil reparsepoint query "$env:USERPROFILE\.copilot\agents"
   ```
   `LinkType` 应为 `Junction`，`Target` 应指向本仓库 `.copilot\agents`。
4. **重载窗口**：`Ctrl+Shift+P` → `Developer: Reload Window`；仍不行则 `Reload With Extensions Disabled` 排除冲突。
5. **查看 debug 日志**：
   - 路径：`%APPDATA%\Code\User\workspaceStorage\<hash>\GitHub.copilot-chat\debug-logs\*.jsonl`
   - 用 `troubleshoot` skill 解析日志找原因。
6. **检查 description 是否过宽/过窄**导致路由错配（参考 P1-4）。
7. **VS Code & Copilot Chat 版本**：实验性特性需较新版本，必要时升级。

---

### P1-1 强制 Lint：Chat Customizations Evaluations

- 仓库内所有 customization 文件**保存即检查**。
- 提交前确保编辑器 Problems 面板中本仓库无 customization 相关诊断。
- 发现诊断时优先用 `fix-customization-evaluation-diagnostics` skill 修复。

### P1-2 冒烟验收清单（每个新 agent / skill 必跑）

新建或修改后，最小验证：

- [ ] Reload Window 后，目标 agent / skill 在选择器或路由中可见。
- [ ] 用一个**典型 prompt** 触发，确认被正确召唤（命中 description）。
- [ ] 用一个**反例 prompt**，确认**不**被错误召唤（避免过度匹配）。
- [ ] **若显式声明了 `tools` 白名单**：试调一个不在白名单里的工具应被拒绝/不可见；未声明则跳过此项（继承全权限是推荐默认）。
- [ ] 输出符合预期格式（agent 模板规定的回复结构）。

### P1-3 版本演进 / Deprecation 策略

- 升级版采用后缀：`<name>-v2.agent.md`、`<name>-v3.agent.md`，与旧版**并存**。
- 旧版在 frontmatter `description` 开头加 `[DEPRECATED] `，并在文件顶部注释指向新版。
- 至少保留 1 个完整迭代周期再删除旧版。
- 路由优先级由 `description` 精度决定，不靠文件名顺序——升级时显式收窄旧版 description。

### P1-4 `description` 写作风格指南（影响路由命中）

- **以"使用场景"开头**，不要只写功能：✅ "Use when: debugging errors, fixing test failures..." ❌ "A debug helper"。
- 列出**典型动词与名词**：debug / refactor / explore / search / generate。
- 明示**反向边界**：何时**不**应使用（参考内置 `agent-customization` 的 "DO NOT USE FOR" 段）。
- 控制在 **1–3 句**，过长会稀释关键词权重。
- 中英任意，但建议关键词用英文（与用户 prompt 习惯对齐，提升匹配）。
