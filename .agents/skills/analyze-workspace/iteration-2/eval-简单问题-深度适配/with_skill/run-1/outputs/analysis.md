# `npm test` 跑了哪些测试、怎么组织的

## 直接回答

`npm test` 不是任何测试框架的自动发现，而是 `package.json:9` 里一条用 `&&` 串联的固定命令链，共 8 步，按顺序执行、任一步失败即中断：

| 步骤 | 命令 | 测什么 | 运行方式 |
|---|---|---|---|
| 1 | `node tests/skills/test-skill-discovery.mjs` | `skills/` 目录结构不变量：每个 skill 必须是 `skills/<name>/SKILL.md` 一级嵌套、frontmatter 合法且 `name` 与目录名一致、`agents/` 下只能叫 `openai.yaml`、bootstrap skill `using-parking-skills` 及其引用文件存在 | 自写脚本（无框架），自己收集失败项、打印 `PASS/FAIL`、`process.exit(1)` |
| 2 | `node tests/skills/test-no-tool-names.mjs` | "skill 正文只说动作、不说工具名"这一跨平台不变量：扫描所有 SKILL.md 正文，禁止出现任何单一 harness 的工具词汇（如 VS Code Copilot 的 `read_file`、Claude Code 的 `TodoWrite`/`Agent tool` 等），因为多数平台加载失败是静默的 | 同上，自写脚本 |
| 3 | `node tests/hooks/test-session-start.mjs` | 执行 `hooks/session-start` 脚本两遍，断言其输出 JSON 在 Claude Code / Cursor / Copilot CLI 三个平台各自的字段形状（`hookSpecificOutput.additionalContext` / `additional_context` / `additionalContext`） | 同上，自写脚本 |
| 4 | `node --test tests/pi/test-pi-extension.mjs` | pi 扩展 `.pi/extensions/parking-skills.ts` 的单元测试：`package.json` 的 pi 声明、扩展注册的 5 个生命周期钩子（`resources_discover`、`session_start`、`session_compact`、`context`、`agent_end`）、skills 目录注入等 | Node 内置 `node:test` |
| 5 | `node --test tests/harnesses/test-harness-manifests.mjs` | 各 harness 集成的"文档契约"测试：Cursor 的 `plugin.json`/`hooks-cursor.json` 用 Cursor 自己的 schema、Gemini 的 `GEMINI.md` `@`-include 指向真实存在的文件等（这些平台无法在本机安装驱动，只能钉住清单契约） | Node 内置 `node:test` |
| 6 | `node scripts/bump-version.mjs --check` | 报告已注册清单文件之间的版本号漂移 | 自写脚本 |
| 7 | `node scripts/bump-version.mjs --audit` | 找出带了版本号但未注册的文件 | 自写脚本 |
| 8 | `npm run check:repo` → `node skills/making-skills-cross-platform/scripts/check-skill-repo.mjs . --allow ...` | 仓库整体结构检查 | 自写脚本 |

## 组织方式

- **按子系统分目录**：`tests/skills/`（技能库结构）、`tests/hooks/`（会话启动钩子）、`tests/pi/`（pi 扩展）、`tests/harnesses/（各平台集成清单）`，目录名即被测对象。
- **两种运行风格并存**：前 3 个是零依赖的纯 Node 脚本（自己断言、自己报错退出）；后 2 个用 Node 内置 `node:test`（无第三方测试依赖，`package.json` 无 devDependencies）。链条尾部还挂了 3 个"验证脚本"（版本一致性 + 仓库结构检查），不属于严格意义的测试但进入了同一条 CI 链。
- **测试哲学一以贯之——全是结构/契约测试，没有运行时行为测试**：因为这是一个跨 8 个平台的技能库，各平台加载失败都是静默的（skill 直接消失、无任何报错），所以测试全部用来钉住"磁盘上的结构和清单必须长什么样"（证据：各测试文件头部注释，如 `tests/harnesses/test-harness-manifests.mjs:6-10`）。

## 当前状态的重要提醒（运行验证过）

**这条链现在第一步就会失败。** 我实际执行了步骤 1，`node tests/skills/test-skill-discovery.mjs` 以 34 个问题失败退出。原因（均为直接证据）：

- 仓库已把 skills 重组为两级分组 `skills/dev/<name>`（14 个）和 `skills/pub/<name>`（gh、matt/*、playwright-cli、shadcn），而测试仍断言一级结构 `skills/<name>/SKILL.md`；
- `skills/using-parking-skills/`（bootstrap skill）已不存在，测试步骤 1、2、4 都引用它（如 `tests/pi/test-pi-extension.mjs:12`）；
- 步骤 8 的 `check:repo` 路径也已失效：`package.json:8` 指向 `skills/making-skills-cross-platform/...`，实际文件在 `skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs`。

也就是说：**`npm test` 声明的测试范围如上表，但在当前 HEAD 下它会在第 1 步中断，后面的步骤实际不会执行。** 这是仓库重组后测试未同步适配的迹象（此判断为推理；失败本身是运行验证过的事实）。

## 证据清单

- `package.json:7-9` — `test` 脚本的完整 `&&` 链（8 步）与 `check:repo` 定义
- `tests/skills/test-skill-discovery.mjs:23-160` — 五组结构断言（一级嵌套、SKILL.md 存在、frontmatter、openai.yaml 命名、bootstrap 引用文件）
- `tests/skills/test-no-tool-names.mjs:1-50` — 按 harness 分组的 DENIED 工具名词汇表及不变量说明
- `tests/hooks/test-session-start.mjs:45-123` — `assertBootstrapContent` 对三个平台输出形状的钉住
- `tests/pi/test-pi-extension.mjs:43-70` — pi 包声明与扩展生命周期钩子断言
- `tests/harnesses/test-harness-manifests.mjs:27-70` — Cursor / Gemini 清单契约测试
- `scripts/bump-version.mjs:15-16` — `--check` / `--audit` 两种模式的定义
- 实际运行 `node tests/skills/test-skill-discovery.mjs` 的输出（exit=1，34 项失败）— 链条当前中断于第 1 步
- `skills/` 目录实际布局（`dev/` 14 个、`pub/` 5 个，均为二级嵌套；`using-parking-skills` 不存在）— 与测试断言的旧结构不一致

## 推理与不确定

- 推理：测试链是针对重组前的一级 skills 布局写的，`dev/pub` 重组发生在测试适配之前（依据：断言、路径、bootstrap 引用三处同时失配，方向一致）。
- 不确定：`hooks/test-session-start.mjs`（步骤 3）在当前布局下能否通过未实际运行验证（因链条在步骤 1 即中断）；各步骤在重组前是否全绿也无历史运行记录可查。
