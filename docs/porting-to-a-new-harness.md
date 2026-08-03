# 移植到新的 harness

本文说明如何为一个新平台（IDE、CLI 或 agent runner）增加支持，让 `skills/` 下的技能在那里也能自动触发。

> 本文的架构与流程源自 [obra/superpowers](https://github.com/obra/superpowers) 的 `docs/porting-to-a-new-harness.md`。差异之处（尤其是 **pivot 语言**一节）已明确标注。
>
> **当文档与代码冲突时，以代码为准，然后回来修文档。**

---

## Part 1 — 这套东西是怎么跨平台工作的

技能内容在所有平台上完全相同。每个平台变化的只是一层很薄的东西：**把内容送到模型面前，并把技能里的指令翻译成该平台真实的工具**。三个组成部分：

1. **Skills（平台无关）** —— `skills/` 是唯一真源，所有平台**逐字**共享，零构建、零产物生成。

2. **工具映射表（每平台一份）** —— 位于 `skills/using-parking-skills/references/<harness>-tools.md`，和/或内联在该平台的注入器里。

3. **Bootstrap 注入器（每平台一个）** —— 每次会话开始，把 `skills/using-parking-skills/SKILL.md` 全文包在 `<EXTREMELY_IMPORTANT>` 里注入模型上下文，后面拼上工具映射。

> **Bootstrap 就是集成本身。** 没有它，技能文件只是躺在磁盘上的死文本 —— 存在，但永远不会被调用。

### 铁律一：不要为了适配新平台去改技能正文

移植的动作只有两个：**加一份工具映射表**、**加一个 bootstrap 注入器**。绝不去 `skills/*/SKILL.md` 里替换工具名。

技能正文是经过调校的行为塑造代码。为了"兼容"而改写它，会让所有平台一起承受这次改动的风险。

### 铁律二：一切通过平台自己的安装机制交付，绝不改用户的配置文件

bootstrap、skills、映射表都必须作为**平台安装的产物**的一部分被送达。移植**不允许**去写用户的全局配置（`~/.codex/config.toml`、`settings.json`、`.bashrc` 等）来注入内容。

如果某平台的安装机制确实无法承载 bootstrap，那是一条需要如实说明的**限制**，而不是动用户配置的许可。

---

## Part 1.5 — 本仓库特有：pivot 语言约定

**这一节是本仓库与 superpowers 最大的差异，移植前必须理解。**

superpowers 的技能正文只写**动作**（"read a file"、"dispatch a subagent"），映射表做「动作 → 工具名」的翻译。

本仓库的 32 个技能来自 VS Code Copilot，正文里硬编码了它的工具名：`runSubagent` 出现 34 次、`run_in_terminal` 20 次、`read_file` 12 次。迁移时**明确决定不改动技能正文**。

因此本仓库采用：**把 VS Code Copilot 的工具名当作 pivot language（中间语言）**，每个平台写一张「VS Code 名 → 本平台名」的反向映射表。

```
superpowers:   动作语言 ──映射表──> 平台工具名
本仓库:        VS Code 名 ──映射表──> 平台工具名
```

技术上两者等价 —— 都是往模型上下文里塞一张对照表，翻译发生在**模型推理时**而非构建期。superpowers 的 Kimi 集成也是这种具名到具名的翻译。

### 由此带来的两个后果

**1. Claude Code 反而最需要映射表。** 在 superpowers 里 Claude Code 不需要映射表（技能用动作语言，Claude 的工具面就是参照系）。在这里正相反：技能正文全是 VS Code 名，如果不给映射表，模型会照着 `read_file` 去调一个不存在的工具。

所以 `hooks/session-start` **必须**把 `references/claude-code-tools.md` 一起拼进注入内容。这是本仓库对 superpowers 的必要偏离。

**2. 维护成本会随平台数增长。** 新写技能的人仍会继续写 VS Code 工具名；每加一个平台就多维护一张表。

> **将来如果要收敛**：单独做一轮「正文动作语言化」改写，把 `read_file` 换成 "read a file"。届时映射表可退化成 superpowers 原版形态，本节可整节删除。在那之前，`using-parking-skills/SKILL.md` 里的 alias 声明段是防止模型误调工具的唯一保障 —— **不要删它**。

---

## Part 2 — 这个平台能被支持吗

### 硬性要求：会话开始时的自动注入

平台必须允许你在**每次会话开始时、无需用户逐次手动开启**地向模型上下文注入文本。这是唯一不可妥协的能力。形式不限：

- **hook / 事件系统** —— 会话开始时运行一个命令并读取其 stdout（Claude Code、Cursor、Copilot CLI）
- **进程内插件 / 扩展** —— 有会话开始或消息生命周期回调，能改写消息数组（Pi、OpenCode）
- **指令文件约定** —— 平台加载一个**由你安装的扩展自带并声明**的上下文文件（不是你去用户家目录里改的文件）

如果唯一的办法是让用户每次会话手动开启（粘提示词、跑命令、切模式），**这个平台不能被正确支持**。

### 其余能力清单

| 能力 | 为什么需要 | 缺失时 |
|---|---|---|
| **技能发现 + 调用** | 模型要能按需加载技能全文 | 没有原生 skill 工具时，允许的降级是直接 `read` 对应的 `SKILL.md` |
| **文件读 / 写 / 改** | 几乎每个技能都要 | 必需，无解 |
| **执行 shell 命令** | 验证、git 流程、脚本类技能 | 必需 |
| **Subagent 派发** | `runSubagent` 在本仓库出现 34 次，是最高频的工具名 | 可降级：内联执行或说明能力缺失，**绝不伪造工具调用** |
| **任务 / todo 跟踪** | 多个技能用来跟踪进度 | 可降级：plan 文件或 `TODO.md` |
| **向用户提问** | 交互式技能 | 可降级：把问题写在回复里并停下 |
| **Web 抓取 / 搜索** | `research`、`grill-with-docs` | 可降级，但要说明 |

### 也许根本不需要新目录

有些"新平台"其实是已有集成换了个安装器。动手前先确认该平台能否直接加载现有的某份 manifest。**一次只往 README 加一段话的移植，也是完全合格的结果。**

---

## Part 3 — 完成的定义

全部满足才算移植完成：

1. bootstrap 在**每次**会话开始加载，无需用户逐次开启
2. 该平台有工具映射表（`references/<harness>-tools.md`、内联在 bootstrap 里，或两者都有）
3. 技能能被真正调用 —— 原生方式，或文档记录的 read-`SKILL.md` 降级方式
4. **验收测试通过**：干净会话里发送「帮我写个 PowerShell 脚本检查磁盘空间」，`ps1-creator` 技能必须在写任何代码前自动触发。保留完整 transcript
5. `tests/` 下有覆盖该集成的测试且通过
6. 真实用户能通过该平台自己的机制安装（不是手工拷文件），且版本已登记进 `.version-bump.json`

冒烟快检：开一个会话问「你现在有哪些 parking skills？」。bootstrap 注入成功的话模型知道自己有。

---

## Part 4 — 选择集成形态

按「**bootstrap 怎么送到模型面前**」分成三种形态。挑对应的那个，照抄现有实现。

### Shape A —— Shell hook（Claude Code；Cursor / Copilot CLI 同源）

参考实现：`hooks/`

- `hooks/hooks.json` —— `SessionStart` + `matcher: "startup|clear|compact"`
- `hooks/session-start` —— **必须无扩展名**。Claude Code 在 Windows 下会给任何含 `.sh` 的命令前置 `bash`，造成双重调用
- `hooks/run-hook.cmd` —— polyglot 包装器，同一个文件既是合法 `.bat` 又是合法 sh

**同一个脚本靠环境变量嗅探平台，输出三种不同的 JSON 形状**：

| 平台 | 嗅探依据 | 输出字段 |
|---|---|---|
| Cursor | `CURSOR_PLUGIN_ROOT` 非空 | `additional_context`（顶层，snake_case） |
| Claude Code | `CLAUDE_PLUGIN_ROOT` 非空且 `COPILOT_CLI` 为空 | `hookSpecificOutput.additionalContext`（嵌套） |
| Copilot CLI / 未知 | 其余 | `additionalContext`（顶层，SDK 标准） |

**两个必须知道的坑**：

- Claude Code 会**同时**读 `additional_context` 和 `hookSpecificOutput` 且**不去重** —— 只能输出其中一个字段，否则 bootstrap 被注入两次
- Cursor **也会**设 `CLAUDE_PLUGIN_ROOT`，所以 Cursor 的分支必须排在前面

JSON 转义用 bash 参数替换手写（`escape_for_json`），输出用 `printf` 而非 heredoc —— 规避 bash 5.3+ 的 heredoc 挂起问题（superpowers issue #571）。

### Shape B —— 进程内插件（Pi）

参考实现：`.pi/extensions/parking-skills.ts`

四个要点，缺一不可：

- `resources_discover` —— 注册 skills 目录，免去符号链接
- `session_start` / `session_compact` —— 置位重新注入（压缩后必须重注入，否则 bootstrap 被摘要吃掉）
- `context` —— 实际注入点，**必须有去重 guard**（该事件每轮都触发）
- `agent_end` —— 清除标志位

**三条硬性要求**：

1. **注入 `user` 角色消息，不是 `system`** —— system 每轮重复导致 token 膨胀（superpowers #750），多条 system 会搞坏部分模型（#894）
2. **必须有去重 guard** —— 靠检测一个唯一 marker 字符串
3. **消息对象形状每平台不同，不能照抄** —— Pi 用 `{role, content:[{type,text}], timestamp}`

插入位置用 `firstNonCompactionSummaryIndex()` 算 —— bootstrap 要插在压缩摘要**之后**，否则摘要会被挤到非首位。

### Shape C —— 原生技能发现，无需注入器（Codex）

参考实现：`.codex-plugin/plugin.json`

Codex 原生发现 `skills/`，不跑 session-start hook。关键点：

```json
"skills": "./skills/",
"hooks": {},
```

**`"hooks": {}` 是必需的抑制开关**，不是冗余。没有它，Codex 会自动发现并执行 `hooks/hooks.json` —— 那个 hook 输出的是 Claude Code 专用的 JSON 形状，Codex 既不认识也不需要。

代价：Codex 是唯一需要模型**主动去读**映射表的平台（靠 `SKILL.md` 里的 Platform Adaptation 指针）。

---

## Part 5 — 执行步骤

1. **确认能力** —— 对照 Part 2。硬性要求不满足就停下，如实说明
2. **选形态** —— 对照 Part 4，照抄最接近的参考实现
3. **写映射表** —— `skills/using-parking-skills/references/<harness>-tools.md`。**必须覆盖** `using-parking-skills/SKILL.md` alias 表里的全部 12 个条目；平台不具备的能力，明确写出降级方式
4. **在 `SKILL.md` 的 Platform Adaptation 段加一行指针** —— 这是唯一允许改动 `SKILL.md` 的地方
5. **写注入器** —— 按形态照抄
6. **写测试** —— 放 `tests/<harness>/`。至少断言：bootstrap 被注入、只注入一次、映射表内容还在
7. **登记版本** —— 新 manifest 带版本号的话，必须加进 `.version-bump.json` 的 `files`，否则会长期发布陈旧版本。`node scripts/bump-version.mjs --audit` 会揪出漏登记的文件
8. **跑验收测试** —— Part 3 第 4 条，保留完整 transcript
9. **更新 README** —— 安装章节加该平台

---

## Part 6 — 常见坑

| 坑 | 后果 | 防线 |
|---|---|---|
| 技能目录嵌套超过一层 | 该技能**静默消失**，无报错 | `tests/skills/test-skill-discovery.mjs` |
| frontmatter 的 key 被缩进 | YAML 找不到闭合 `---`，整个技能**静默失效** | 同上（本仓库的 `simplify` 曾长期处于此状态） |
| 目录名与 `name:` 字段不一致 | 调用名与预期不符 | 同上 |
| hook 脚本带 `.sh` 扩展名 | Windows 下双重调用 | `tests/hooks/test-session-start.mjs` |
| 同时输出多个 context 字段 | Claude Code 注入两次 | 同上 |
| 新 manifest 忘记登记版本 | 长期发布陈旧版本 | `bump-version.mjs --audit` |
| Pi 映射表两处不同步 | 文档与实际注入内容漂移 | `tests/pi/test-pi-extension.mjs` |
| 忘记 `"hooks": {}` | Codex 执行不该跑的 hook | 无自动防线 —— 记住它 |
| 用 `jq` 写脚本 | Windows Git Bash 没有 jq | 本仓库统一用 Node（`.mjs`） |

### Pi 的映射维护在两处

`.pi/extensions/parking-skills.ts` 的 `piToolMapping()`（**实际注入的**）和 `references/pi-tools.md`（人读的）。**改一处必须同步另一处**，`tests/pi/test-pi-extension.mjs` 会断言关键映射两处都在。

---

## 附录 A — 现有集成索引

| 平台 | 入口 | Bootstrap 机制 | 工具映射 | 测试 |
|---|---|---|---|---|
| Claude Code | `.claude-plugin/plugin.json` + `hooks/hooks.json` | shell hook → `hookSpecificOutput.additionalContext` | `references/claude-code-tools.md`（**由 hook 拼进注入内容**） | `tests/hooks/` |
| Codex | `.codex-plugin/plugin.json`（`"hooks": {}`） | 原生技能发现，无 hook | `references/codex-tools.md`（模型自行读取） | — |
| Pi | `.pi/extensions/parking-skills.ts` + `package.json` 的 `pi` 字段 | `resources_discover` + `context` 事件 | `piToolMapping()` **和** `references/pi-tools.md` | `tests/pi/` |

## 附录 B — 未支持的平台

- **VS Code Copilot** —— 技能的原始来源。第一版**不做适配**：它没有 session-start hook，无法满足 Part 2 的硬性要求。可行路线是靠仓库根的 `AGENTS.md` 承载 bootstrap，但那不是"通过平台安装机制交付"，会退化成 Part 3 第 6 条不通过。
- **Cursor / Copilot CLI** —— `hooks/session-start` 已保留对应分支且有测试覆盖，但未做端到端验证。加它们主要是写 manifest 和跑验收测试。
