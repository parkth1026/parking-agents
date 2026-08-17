# `npm test` 都跑了什么、怎么组织的

## 一句话总结

`npm test` 不是单一测试框架，而是把 **5 个测试脚本 + 2 个版本一致性检查 + 1 个仓库结构检查** 用 `&&` 串成的一条顺序执行链（定义在 `package.json` 的 `scripts.test`），全部用 Node 内置能力，零第三方测试依赖。

## 执行链（按顺序，前一个失败即停止）

```
npm test
├── 1. node tests/skills/test-skill-discovery.mjs        # skills/ 目录结构断言
├── 2. node tests/skills/test-no-tool-names.mjs          # 技能正文禁止出现工具名
├── 3. node tests/hooks/test-session-start.mjs           # session-start 钩子输出 JSON 形状
├── 4. node --test tests/pi/test-pi-extension.mjs        # Pi 扩展（node:test 套件）
├── 5. node --test tests/harnesses/test-harness-manifests.mjs  # 各平台清单契约（node:test 套件）
├── 6. node scripts/bump-version.mjs --check             # 各清单版本号一致
├── 7. node scripts/bump-version.mjs --audit             # 有版本号的文件必须登记在册
└── 8. npm run check:repo                                # 调用随仓库分发的结构检查器
```

## 各项内容

### 1. `tests/skills/test-skill-discovery.mjs`（结构自检脚本）
断言 `skills/` 目录能被各平台正确发现：每个技能必须是一级子目录且含 `SKILL.md`（平台只扫一层深度）；frontmatter 可解析、含 `name`/`description` 且 `name` 与目录名一致；`agents/` 下只认 `openai.yaml`（Codex 忽略 `.yml`）；引导技能 `using-parking-skills` 及其 4 个 references 映射文件必须存在。

### 2. `tests/skills/test-no-tool-names.mjs`（不变量检查脚本）
扫描所有技能 Markdown 正文，禁止出现任何特定平台（harness）的工具名——VS Code Copilot 的 `read_file`、Claude Code 的 `TodoWrite`、Gemini 的 `google_web_search` 等三组黑名单。核心不变量：**技能正文只描述"动作"，工具名映射放在引导技能的 references/<harness>-tools.md 里**。带一个白名单（转换器技能、映射表本身等）。

### 3. `tests/hooks/test-session-start.mjs`（行为测试脚本）
用 `bash` 真实执行 `hooks/session-start`，在三种环境变量组合（Claude Code / Cursor / Copilot CLI）下运行，断言每种平台输出的 JSON **恰好只有一个字段**且形状正确（Claude Code 只出 `hookSpecificOutput.additionalContext`，Cursor 只出 `additional_context`，Copilot 只出 `additionalContext`——因为 Claude 会无去重地读两个字段导致重复注入），并校验注入内容包含引导文案的关键段落。

### 4. `tests/pi/test-pi-extension.mjs`（node:test 套件，6 个 test）
针对 `.pi/extensions/parking-skills.ts` 扩展：动态 import 后注册 mock 事件总线，验证 package.json 的 pi 声明、5 个生命周期钩子注册、skills 目录注入、启动引导作为首条 user 消息注入且不重复、`agent_end` 后清除、压缩后重新注入、以及 `pi-tools.md` 文档与扩展内 `piToolMapping()` 注入内容保持同步（两处副本防漂移）。

### 5. `tests/harnesses/test-harness-manifests.mjs`（node:test 套件，约 10 个 test）
逐平台"文档契约"测试：Cursor 的 plugin.json 与 hooks-cursor.json 各自的 schema（不能混用 Claude Code 的）；Gemini 的 gemini-extension.json、GEMINI.md 的 `@` include 指向真实文件、gemini-tools.md 覆盖真实工具；antigravity-tools.md 只记录差异点；Kimi 清单的 `sessionStart.skill` 与内联 skillInstructions；OpenCode 插件被真实 import 并验证 config 注册、消息转换注入和去重；`.agents` marketplace 条目；所有带版本号的清单都登记在 `.version-bump.json`。

### 6–7. `scripts/bump-version.mjs --check / --audit`
`--check`：`.version-bump.json` 登记的所有版本字段必须同步；`--audit`：扫描仓库，找出"带了版本号却没登记"的清单（防止某平台悄悄发旧版本）。

### 8. `check:repo`
调用随仓库分发的可移植检查器 `skills/making-skills-cross-platform/scripts/check-skill-repo.mjs`，把第 1、2 项的结构/工具名规则作为通用工具再跑一遍（`--allow` 传入同样的白名单）。

## 组织方式小结

- **目录按被测对象划分**：`tests/skills/`、`tests/hooks/`、`tests/pi/`、`tests/harnesses/`，与仓库顶层 `skills/`、`hooks/`、`.pi/` 一一对应；版本检查和仓库检查放在 `scripts/`，作为测试链尾部的"门禁"。
- **两种写法并存**：简单的结构断言用自写脚本（自积累 failures + `process.exit(1)`）；有多个用例的用 Node 内置 `node:test` + `node:assert/strict`。全部零 npm 依赖，只需 Node 和 bash。
- **测试哲学**：这是一个跨 8 个 AI 编码平台的技能库，多数平台无法在本机安装运行，所以测试全是"契约/结构"型——把平时会**静默失败**的事（技能因目录深度或 frontmatter 坏了而不加载、清单指向不存在的文件、钩子多发一个字段导致重复注入、版本漂移）变成响亮的失败。

## 备注（当前工作区状态）

工作区中 `skills/` 正被重组为 `skills/dev/` 和 `skills/pub/` 两层分组（未提交的进行中改动），而第 1 项测试仍断言"技能必须位于 skills/ 一级深度"、第 8 项引用的路径 `skills/making-skills-cross-platform/...` 已移到 `skills/dev/` 下——以当前工作区状态直接跑 `npm test` 预计会在这些点失败（测试与新的目录布局尚未同步）。
