# 安装布局：什么是共享的，什么必须放在平台专属位置

本文回答一个问题：这个仓库里的文件，**哪些是九个平台共用的一份**，哪些是**某个平台硬性要求放在固定位置、换个名字就静默失效的**。

判别标准只有一条：

> **谁去找谁。**
> 平台**主动去固定路径找**的文件 → 位置和文件名不可改（改了 = 静默失效）。
> 被某份 manifest **声明指向**的文件 → 位置随便（改了同步改声明即可）。

---

## 一、共享层 —— 写一份，九个平台复用

| 路径 | 谁在用 | 怎么被找到 |
|---|---|---|
| `skills/` | **全部 9 个平台** | 各平台 manifest 的 `"skills"` 字段声明，或插件代码里 resolve。Claude Code 系是目录约定自动发现 |
| `AGENTS.md` | Claude Code / Cursor / Copilot CLI / Antigravity / Gemini CLI | `hooks/session-start` 每会话注入它；`GEMINI.md` `@`-include 它 |
| `hooks/session-start` | Claude Code / Cursor / Copilot CLI / Antigravity | 由 `run-hook.cmd` 调起，同一份脚本用环境变量分出三种 JSON 形状 |
| `hooks/run-hook.cmd` | 同上 4 个 | 两份 hook 配置都指向它。polyglot 包装器：同一个文件既是合法 `.bat` 又是合法 sh |
| `package.json` | Pi（`pi` 字段）+ OpenCode（`main` 字段）+ npm | 一个文件承载三种消费者 |

**共享层是这套架构的全部价值。** 技能只写一遍，改一处九个平台同时生效。

`skills/` 有两条不可违背的约束（两条都有 `npm test` / `check:repo` 兜底）：

- **分类根下一层扁平**：`skills/<组>/<name>/SKILL.md`（组 = `engineering` / `productivity` / `pub`），组内禁止更深嵌套。嵌套会让技能在所有平台**静默消失**。开发侧真源 `.agents/skills/` 则是不分组的一层扁平
- **正文只写动作，不写工具名**：一句 "use the Agent tool" 在一个平台上对，在另外八个平台上静默出错

---

## 二、平台专属层 —— 位置和文件名硬性固定

这些是**平台主动去仓库根找**的，路径写死在平台代码里。改名或挪位置 = 该平台完全看不见这个插件，且**没有任何报错**。

| 路径 | 平台 | 里面有什么 |
|---|---|---|
| `.claude-plugin/plugin.json` | Claude Code | 插件元数据。**不声明 `skills`/`hooks`** —— 两者都靠目录约定自动发现 |
| `.claude-plugin/marketplace.json` | Claude Code | 本地 dev marketplace 入口 |
| `.cursor-plugin/plugin.json` | Cursor | 显式声明 `"skills": "./skills/"` 和 `"hooks": "./hooks/hooks-cursor.json"` |
| `.codex-plugin/plugin.json` | Codex | 显式声明 `"skills"`，外加 `"hooks": {}`（见下方坑一） |
| `.kimi-plugin/plugin.json` | Kimi Code | 整张工具映射**在 manifest 字段里**（`skillInstructions`） |
| `gemini-extension.json` | Gemini CLI | 仓库根固定文件名，只声明 `"contextFileName": "GEMINI.md"` |
| `GEMINI.md` | Gemini CLI | 全文只有一行 `@AGENTS.md`。**文件名由 `contextFileName` 声明，所以这个可以改** |
| `.agents/plugins/marketplace.json` | 跨运行时 marketplace | 通用安装入口 |
| `hooks/hooks.json` | Claude Code / Copilot CLI / Antigravity | Claude Code 系的 hook schema（PascalCase `SessionStart` + `matcher`） |
| `hooks/hooks-cursor.json` | Cursor | **Cursor 自己的 schema**（camelCase `sessionStart` + 顶层 `version`） |

### 位置其实自由的两个（常被误以为固定）

| 路径 | 平台 | 真正的约束 |
|---|---|---|
| `.pi/extensions/parking-skills.ts` | Pi | 由 `package.json` 的 `pi.extensions` 数组声明 → **改路径同步改声明即可** |
| `.opencode/plugins/parking-skills.js` | OpenCode | 由 `package.json` 的 `main` 字段声明 → 同上 |

目录名带点前缀只是为了与平台专属层视觉一致，不是平台要求。

---

## 三、工具映射的承载位置各不相同

同一件事（把动作翻译成该平台的工具），在不同平台有不同承载方式，全部**内联在注入器 / manifest 里**（引导技能时代的 `references/<harness>-tools.md` 映射文件已随 048efac 移除）。**在一个位置找不到就以为没做，是常见误判。**

| 平台 | 映射放在哪 |
|---|---|
| Pi | 内联在 `.pi/extensions/parking-skills.ts` 的 `piToolMapping()`（唯一真源） |
| OpenCode | 内联在 `.opencode/plugins/parking-skills.js` 的 `openCodeToolMapping()` |
| Kimi Code | `.kimi-plugin/plugin.json` 的 `skillInstructions` 字段（一整个 JSON 字符串） |
| Claude Code / Cursor / Copilot CLI | **没有，也不需要** —— 工具面已覆盖全部动作 |
| Codex / Gemini CLI / Antigravity | **没有** —— 无映射文件，动作词汇由模型自行对应 |

---

## 四、平台之间的复用关系

三个平台**零新增文件**，完全复用 Claude Code 的安装路径：

```
.claude-plugin/plugin.json + hooks/hooks.json + hooks/session-start
   ├── Claude Code    → 输出 hookSpecificOutput.additionalContext
   ├── Copilot CLI    → 靠 COPILOT_CLI 环境变量走第三分支，输出顶层 additionalContext
   └── Antigravity    → 同 Claude Code（无专属映射文件）

Cursor 复用 hooks/session-start 脚本，但 hook 配置必须是自己那份
   └── .cursor-plugin/plugin.json → hooks/hooks-cursor.json → hooks/run-hook.cmd
```

`hooks/session-start` 一个脚本靠环境变量嗅探平台，输出三种 JSON：

| 平台 | 嗅探依据 | 输出字段 |
|---|---|---|
| Cursor | `CURSOR_PLUGIN_ROOT` 非空 | `additional_context`（顶层，snake_case） |
| Claude Code / Antigravity | `CLAUDE_PLUGIN_ROOT` 非空且 `COPILOT_CLI` 为空 | `hookSpecificOutput.additionalContext`（嵌套） |
| Copilot CLI / 未知 | 其余 | `additionalContext`（顶层，SDK 标准） |

**Cursor 也会设 `CLAUDE_PLUGIN_ROOT`，所以 Cursor 的判断必须排在最前面。**

---

## 五、三个由"相互识别"引发的坑

### 坑一：Codex 会误识别 Claude Code 的 hook

`.codex-plugin/plugin.json` 里的 `"hooks": {}` **不是冗余，是必需的抑制开关**。

没有它，Codex 会自动发现并执行 `hooks/hooks.json` —— 那个 hook 输出的是 Claude Code 专用的 JSON 形状，Codex 既不认识也不需要。这是共享目录带来的负面识别。**没有自动防线，只能记住。**

### 坑二：两份 hook 配置的 schema 完全不同

```json
Claude Code: { "hooks": { "SessionStart": [ { "matcher": …, "hooks": [ { "type", "command" } ] } ] } }
Cursor:      { "version": 1, "hooks": { "sessionStart": [ { "command" } ] } }
```

PascalCase 对 camelCase，Cursor 还多一个顶层 `version`。**套错了 hook 从不触发，技能全程沉默。** `tests/harnesses/` 断言两者不串。

### 坑三：Claude Code 同时读两个字段且不去重

Claude Code 会**同时**读 `additional_context` 和 `hookSpecificOutput`。多输出一个字段，bootstrap 就被注入两遍。`tests/hooks/test-session-start.mjs` 断言每种环境**恰好一个**顶层字段。

---

## 六、加新平台时先问这三个问题

1. **它能不能复用已有路径？** 有些"新平台"只是已有集成换了个安装器（Copilot CLI 和 Antigravity 就是）。一次只往 README 加一段话的移植，是完全合格的结果。
2. **它主动去哪里找 manifest？** 那个位置写死，不可改。
3. **它的工具面缺什么动作？** 缺就加一份映射表 —— **永远不是去改技能正文**。

完整流程见 [porting-to-a-new-harness.md](./porting-to-a-new-harness.md)。

---

## 附：一页速查

```
仓库根
├── skills/                          ★ 共享 · 9 平台逐字复用 · 发布侧分类布局 · 正文禁工具名
│   ├── engineering/<name>/SKILL.md
│   ├── productivity/<name>/SKILL.md
│   └── pub/<name>/SKILL.md
│
├── .agents/skills/                  开发侧活跃真源（一层扁平，与 skills/ 经移植流程同步）
├── AGENTS.md                        ★ 共享 · session-start 注入 + GEMINI.md @-include
│
├── hooks/
│   ├── session-start                ★ 共享 · CC/Cursor/CopilotCLI/Antigravity · 无扩展名
│   ├── run-hook.cmd                 ★ 共享 · polyglot 包装器
│   ├── hooks.json                   固定 · CC/CopilotCLI/Antigravity
│   └── hooks-cursor.json            固定 · Cursor 专用 schema
│
├── package.json                     ★ 共享 · pi 字段 + main 字段 + npm
├── .claude-plugin/                  固定 · CC/CopilotCLI/Antigravity
├── .cursor-plugin/                  固定 · Cursor
├── .codex-plugin/                   固定 · Codex（"hooks": {} 是抑制开关）
├── .kimi-plugin/                    固定 · Kimi（映射内联在 skillInstructions）
├── .agents/plugins/                 固定 · 跨运行时 marketplace
├── gemini-extension.json            固定 · Gemini
├── GEMINI.md                        由 contextFileName 声明 → 可改名
├── .pi/extensions/                  由 package.json pi.extensions 声明 → 可挪
└── .opencode/plugins/               由 package.json main 声明 → 可挪
```

`★` = 改一处九个平台同时生效，也意味着**改错一处九个平台同时坏**。
