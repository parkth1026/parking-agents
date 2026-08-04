# 移植到新的 harness

本文说明如何为一个新平台（IDE、CLI 或 agent runner）增加支持，让 `skills/` 下的技能在那里也能自动触发。

> 本文的架构与流程源自 [obra/superpowers](https://github.com/obra/superpowers) 的 `docs/porting-to-a-new-harness.md`。
>
> **当文档与代码冲突时，以代码为准，然后回来修文档。**

---

## Part 1 — 这套东西是怎么跨平台工作的

技能内容在所有平台上完全相同。每个平台变化的只是一层很薄的东西：**把内容送到模型面前，并把技能里的指令翻译成该平台真实的工具**。三个组成部分：

1. **Skills（平台无关）** —— `skills/` 是唯一真源，所有平台**逐字**共享，零构建、零产物生成。技能正文只描述**动作**（"读一个文件"、"派发一个子代理"、"建一条待办"），从不指名具体工具。这正是同一份正文能在 8 个平台上原封不动运行的原因。

2. **工具映射表（每平台一份，只写差异）** —— 把动作词汇翻译成该平台真实的工具名。位于 `skills/using-parking-skills/references/<harness>-tools.md`，或内联在该平台的注入器里。
   **工具面已经覆盖全部动作的平台不需要映射表**（Claude Code / Cursor / Copilot CLI 都没有）。

3. **Bootstrap 注入器（每平台一个）** —— 每次会话开始，把 `skills/using-parking-skills/SKILL.md` 全文包在 `<EXTREMELY_IMPORTANT>` 里注入模型上下文。

> **Bootstrap 就是集成本身。** 没有它，技能文件只是躺在磁盘上的死文本 —— 存在，但永远不会被调用。

### 铁律一：技能正文写动作，不写工具名；不要为了适配平台去改它

移植的动作只有两个：**加一份工具映射表**、**加一个 bootstrap 注入器**。绝不去 `skills/*/SKILL.md` 里替换工具名。

一句"use the Agent tool"在一个平台上正确，在另外七个平台上**静默出错** —— 模型要么伪造一个不存在的工具调用，要么因为找不到该工具而拒绝执行。两种失败在那个平台被实际跑起来之前都看不见。

`tests/skills/test-no-tool-names.mjs` 是这条铁律的自动防线。豁免名单只有两项，都在测试文件里注明了理由。

### 子代理派发的伪调用块

技能需要派发子代理时，写的是一个**看起来像调用、但不指名任何真实工具**的块：

```
Subagent (general-purpose):
  description: "<一句话任务名>"
  model: <你的 harness 支持时必填；省略会静默继承会话最贵的模型>
  prompt: |
    <完整提示词>
```

每个平台的映射表负责把它翻译成 `Task` / `spawn_agent` / `invoke_agent` / `invoke_subagent` / `subagent` / `Agent`。**移植时必须在映射表里明确写出这条翻译**，否则模型面对这个块无所适从。

### 铁律二：一切通过平台自己的安装机制交付，绝不改用户的配置文件

bootstrap、skills、映射表都必须作为**平台安装的产物**的一部分被送达。移植**不允许**去写用户的全局配置（`~/.codex/config.toml`、`settings.json`、`.bashrc` 等）来注入内容。

如果某平台的安装机制确实无法承载 bootstrap，那是一条需要如实说明的**限制**，而不是动用户配置的许可。

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
| **Subagent 派发** | 多个技能靠 `Subagent (general-purpose):` 块并行分工 | 可降级：内联执行或说明能力缺失，**绝不伪造工具调用** |
| **任务 / todo 跟踪** | 多个技能用来跟踪进度 | 可降级：plan 文件或 `TODO.md` |
| **向用户提问** | 交互式技能 | 可降级：把问题写在回复里并停下 |
| **Web 抓取 / 搜索** | `research`、`grill-with-docs` | 可降级，但要说明 |

### 也许根本不需要新目录

有些"新平台"其实是已有集成换了个安装器。动手前先确认该平台能否直接加载现有的某份 manifest。**一次只往 README 加一段话的移植，也是完全合格的结果。**

---

## Part 3 — 完成的定义

全部满足才算移植完成：

1. bootstrap 在**每次**会话开始加载，无需用户逐次开启
2. 该平台的工具映射已就位 —— `references/<harness>-tools.md`、内联在 bootstrap 里，或**确认无需映射**（工具面已覆盖全部动作）
3. 技能能被真正调用 —— 原生方式，或文档记录的 read-`SKILL.md` 降级方式
4. **验收测试通过**：干净会话里发送「帮我写个 PowerShell 脚本检查磁盘空间」，`ps1-creator` 技能必须在写任何代码前自动触发。保留完整 transcript
5. `tests/` 下有覆盖该集成的测试且通过
6. 真实用户能通过该平台自己的机制安装（不是手工拷文件），且版本已登记进 `.version-bump.json`

冒烟快检：开一个会话问「你现在有哪些 parking skills？」。bootstrap 注入成功的话模型知道自己有。

---

## Part 4 — 选择集成形态

按「**bootstrap 怎么送到模型面前**」分成三种形态。挑对应的那个，照抄现有实现。

| 形态 | 机制 | 本仓库的实例 |
|---|---|---|
| **A** | Shell hook，读 stdout 注入 | Claude Code、Cursor、Copilot CLI |
| **B** | 进程内插件，改写消息数组 | Pi、OpenCode |
| **C** | 指令文件，扩展自带并声明 | Gemini CLI |
| **D** | manifest 声明式，平台自己加载 | Codex、Kimi Code |

### Shape A —— Shell hook（Claude Code；Cursor / Copilot CLI 同源）

参考实现：`hooks/`

- `hooks/hooks.json` —— `SessionStart` + `matcher: "startup|clear|compact"`
- `hooks/hooks-cursor.json` —— **Cursor 的 hook 配置 schema 与 Claude Code 完全不同**，不是同一份文件换个名字：

  ```json
  Claude Code: { "hooks": { "SessionStart": [ { "matcher": ..., "hooks": [ { "type", "command" } ] } ] } }
  Cursor:      { "version": 1, "hooks": { "sessionStart": [ { "command" } ] } }
  ```

  注意 PascalCase 与 camelCase 的差别，以及 Cursor 多一个顶层 `version`。`tests/harnesses/` 会断言两者不串。
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

### Shape B —— 进程内插件（Pi、OpenCode）

参考实现：`.pi/extensions/parking-skills.ts`、`.opencode/plugins/parking-skills.js`

四个要点，缺一不可：

- `resources_discover` —— 注册 skills 目录，免去符号链接
- `session_start` / `session_compact` —— 置位重新注入（压缩后必须重注入，否则 bootstrap 被摘要吃掉）
- `context` —— 实际注入点，**必须有去重 guard**（该事件每轮都触发）
- `agent_end` —— 清除标志位

**三条硬性要求**：

1. **注入 `user` 角色消息，不是 `system`** —— system 每轮重复导致 token 膨胀（superpowers #750），多条 system 会搞坏部分模型（#894）
2. **必须有去重 guard** —— 靠检测一个唯一 marker 字符串
3. **消息对象形状每平台不同，不能照抄** —— Pi 用 `{role, content:[{type,text}], timestamp}`，OpenCode 用 `message.info.role` + `message.parts[]`

插入位置用 `firstNonCompactionSummaryIndex()` 算 —— bootstrap 要插在压缩摘要**之后**，否则摘要会被挤到非首位。

**去重策略两家不同，这是回调时机决定的**：

| | 回调触发频率 | 去重手段 |
|---|---|---|
| Pi | 每**轮**一次（`context`） | 生命周期布尔标志 + `agent_end` 复位 |
| OpenCode | 每个 agent **step** 一次（`messages.transform`） | 只能检查消息本身有无 marker —— 没有可依赖的生命周期事件 |

照抄错了不会报错，只会让 bootstrap 每步重复注入一次，token 爆炸。

### Shape C —— 指令文件（Gemini CLI）

参考实现：`gemini-extension.json` + `GEMINI.md`

manifest 只声明 `"contextFileName": "GEMINI.md"`，而 `GEMINI.md` 全文只有两行 `@`-include：

```
@./skills/using-parking-skills/SKILL.md
@./skills/using-parking-skills/references/gemini-tools.md
```

**这是三种形态里最省事的**：没有组装逻辑、没有 frontmatter 剥离、没有 `<EXTREMELY_IMPORTANT>` 包裹、没有"已加载别重复"的前言 —— 因为 `contextFileName` 机制本身就保证每会话必载，那些防重复注入的机制在这里全是多余的。

唯一的坑：`@`-include 指向不存在的文件时**静默加载空内容**。`tests/harnesses/` 会断言两个路径真实存在。

### Shape D —— manifest 声明式（Codex、Kimi Code）

参考实现：`.codex-plugin/plugin.json`、`.kimi-plugin/plugin.json`

Codex 原生发现 `skills/`，不跑 session-start hook。关键点：

```json
"skills": "./skills/",
"hooks": {},
```

**`"hooks": {}` 是必需的抑制开关**，不是冗余。没有它，Codex 会自动发现并执行 `hooks/hooks.json` —— 那个 hook 输出的是 Claude Code 专用的 JSON 形状，Codex 既不认识也不需要。

代价：Codex 需要模型**主动去读**映射表（靠 `SKILL.md` 里的 Platform Adaptation 指针）。

Kimi Code 走的是同一形态的另一种写法 —— bootstrap 与映射表**都在 manifest 里声明**：

```json
"sessionStart": { "skill": "using-parking-skills" },
"skillInstructions": "<整张工具映射，作为一个 JSON 字符串>"
```

这意味着 Kimi 的映射既不在 `references/` 也不在注入器代码里，而在 manifest 字段中。加新平台时留意这类"第四种放置位置"，别在 `references/` 里找不到就以为没做。

---

## Part 5 — 执行步骤

1. **确认能力** —— 对照 Part 2。硬性要求不满足就停下，如实说明
2. **选形态** —— 对照 Part 4，照抄最接近的参考实现
3. **写映射表 —— 只写不一样的部分**。先逐条核对：读写文件、跑命令、搜索内容、找文件、列目录、抓 URL、搜网、派发子代理、跟踪待办、向用户提问、取诊断。
   - 平台工具面**已覆盖全部动作** → 不建映射文件（Claude Code / Cursor / Copilot CLI 就是这样）
   - 有差异 → `references/<harness>-tools.md` 写两列表「动作 → 该平台工具」，**必须包含 `Subagent (general-purpose):` 那一行**
   - 平台不具备的能力 → 明确写出降级方式，并强调**绝不伪造工具调用**
4. **在 `SKILL.md` 的 Platform Adaptation 段加一行指针** —— 这是唯一允许改动 `SKILL.md` 的地方（且仅当第 3 步产出了映射文件）
5. **写注入器** —— 按形态照抄
6. **写测试** —— 放 `tests/harnesses/test-harness-manifests.mjs`。装不了该平台也要写 **doc-contract 测试**：断言 manifest 字段齐全、映射表点名了该平台真实的工具、bootstrap 指向的文件确实存在。这对无法本地验证的平台是**唯一防线**
7. **登记版本** —— 新 manifest 带版本号的话，必须加进 `.version-bump.json` 的 `files`，否则会长期发布陈旧版本。`node scripts/bump-version.mjs --audit` 会揪出漏登记的文件
8. **跑验收测试** —— Part 3 第 4 条，保留完整 transcript
9. **更新 README** —— 安装章节加该平台

---

## Part 6 — 常见坑

| 坑 | 后果 | 防线 |
|---|---|---|
| 技能正文写了工具名 | 在其余 7 个平台上模型伪造调用或直接拒绝 | `tests/skills/test-no-tool-names.mjs` |
| 技能目录嵌套超过一层 | 该技能**静默消失**，无报错 | `tests/skills/test-skill-discovery.mjs` |
| frontmatter 的 key 被缩进 | YAML 找不到闭合 `---`，整个技能**静默失效** | 同上（`.copilot/agents/Simplify.md` 曾长期处于此状态） |
| 目录名与 `name:` 字段不一致 | 调用名与预期不符 | 同上 |
| `agents/openai.yml` 而非 `.yaml` | Codex 读不到，界面元数据丢失且无报错 | 同上 |
| hook 脚本带 `.sh` 扩展名 | Windows 下双重调用 | `tests/hooks/test-session-start.mjs` |
| 同时输出多个 context 字段 | Claude Code 注入两次 | 同上 |
| 套用了别家的 hook 配置 schema | hook 从不触发，技能全程沉默 | `tests/harnesses/`（Cursor 与 Claude Code 的 key 大小写不同） |
| Shape B 注入 `system` 角色 | token 逐轮膨胀；部分模型被多条 system 打断 | 无自动防线 —— 必须注入 `user` |
| 照抄了另一家的去重策略 | 每个 step 重复注入一次 | `tests/harnesses/` 断言二次 transform 不重复注入 |
| Gemini 的 `@`-include 指向不存在的文件 | **静默加载空内容**，bootstrap 形同虚设 | `tests/harnesses/` |
| 新 manifest 忘记登记版本 | 长期发布陈旧版本 | `bump-version.mjs --audit` + `tests/harnesses/` |
| Pi 映射表两处不同步 | 文档与实际注入内容漂移 | `tests/pi/test-pi-extension.mjs` |
| 忘记 `"hooks": {}` | Codex 执行不该跑的 hook | 无自动防线 —— 记住它 |
| 用 `jq` 写脚本 | Windows Git Bash 没有 jq | 本仓库统一用 Node（`.mjs`） |
| 只在 README 宣称支持，没跑验收测试 | 用户装上后技能永不触发 | 附录 A 如实标注验证状态 |

### Pi 的映射维护在两处

`.pi/extensions/parking-skills.ts` 的 `piToolMapping()`（**实际注入的**）和 `references/pi-tools.md`（人读的）。**改一处必须同步另一处**，`tests/pi/test-pi-extension.mjs` 会断言关键映射两处都在。

---

## 附录 A — 现有集成索引

「验证」一列如实反映**是否跑过 Part 3 的验收测试**，不要因为测试全绿就改成已验证 —— doc-contract 测试证明的是契约没烂，不是端到端能跑通。

| 平台 | 形态 | 入口 | Bootstrap 机制 | 工具映射 | 验证 |
|---|---|---|---|---|---|
| Claude Code | A | `.claude-plugin/plugin.json` + `hooks/hooks.json` | shell hook → `hookSpecificOutput.additionalContext` | 无需（工具面已覆盖） | ✅ 已端到端验证 |
| Cursor | A | `.cursor-plugin/plugin.json` + `hooks/hooks-cursor.json` | shell hook → `additional_context` | 无需 | ⚠️ 仅 doc-contract |
| Copilot CLI | A | 复用 Claude Code 路径（`COPILOT_CLI` 环境变量） | shell hook → `additionalContext` | 无需 | ⚠️ 仅 doc-contract |
| Codex | D | `.codex-plugin/plugin.json`（`"hooks": {}`） | 原生技能发现，无 hook | `references/codex-tools.md` | ✅ 已端到端验证 |
| Kimi Code | D | `.kimi-plugin/plugin.json` | manifest 的 `sessionStart.skill` | manifest 的 `skillInstructions` 字段 | ⚠️ 仅 doc-contract |
| Pi | B | `.pi/extensions/parking-skills.ts` + `package.json` 的 `pi` 字段 | `resources_discover` + `context` 事件 | `piToolMapping()` **和** `references/pi-tools.md` | ✅ 已端到端验证 |
| OpenCode | B | `.opencode/plugins/parking-skills.js`（由 `package.json` 的 `main` 声明） | `config` 钩子 + `messages.transform` | 内联在 `openCodeToolMapping()` | ⚠️ 仅 doc-contract |
| Gemini CLI | C | `gemini-extension.json` + `GEMINI.md` | 指令文件 `@`-include | `references/gemini-tools.md` | ⚠️ 仅 doc-contract |
| Antigravity | A | 复用 Claude Code plugin 路径 | 同 Claude Code | `references/antigravity-tools.md` | ⚠️ 仅 doc-contract |

跨运行时入口：`.agents/plugins/marketplace.json`。

## 附录 B — 未支持的平台

- **VS Code Copilot** —— 技能的原始来源，但**不做适配**：它没有 session-start hook，无法满足 Part 2 的硬性要求。可行路线是靠仓库根的 `AGENTS.md` 承载 bootstrap，但那不是"通过平台安装机制交付"，会退化成 Part 3 第 6 条不通过。

  仓库里的 `.copilot/agents/` 是**另一半独立产物** —— 一组 VS Code Copilot agent，通过目录 junction 挂到 `~/.copilot/`。它不走本文的任何形态，也不受铁律一约束（那些 agent 正文可以正常写 VS Code 工具名）。两半的边界见 README。
