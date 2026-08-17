# npm test 跑了什么、怎么组织的

### Question

`npm test` 到底执行了哪些测试？这些测试大概是怎么组织的？

### Ranked synthesis

| Rank | 结论 | Confidence | Basis |
|------|------|------------|-------|
| 1 | `npm test` 是一条 8 段的 `&&` 命令链（fail-fast）：5 个测试文件 + 2 个版本一致性检查 + 1 个仓库自检脚本，零第三方测试框架，全部用 Node 原生能力 | High | `package.json:9` 直接可见；各文件已逐一读取核实 |
| 2 | 组织方式按"被测对象"分目录（`tests/skills`、`tests/hooks`、`tests/pi`、`tests/harnesses`），测试目标是仓库契约而非业务逻辑 | High | `tests/` 目录结构 + 各文件头部注释自述 |
| 3 | **当前工作树上 `npm test` 第一步就会失败**（实证运行 exit=1，34 个问题）：skills 已重组为 `skills/dev/`、`skills/pub/` 两层布局，而测试与脚本仍假定旧的 `skills/<name>/` 一层布局，且 `skills/using-parking-skills/` 已不存在 | High | 直接运行 `node tests/skills/test-skill-discovery.mjs` 得到失败输出 |

### Evidence

**1. 命令链本体（`package.json:9`，`check:repo` 在 `package.json:8`）**

```
npm test =
  node tests/skills/test-skill-discovery.mjs        # 步骤1
  && node tests/skills/test-no-tool-names.mjs       # 步骤2
  && node tests/hooks/test-session-start.mjs        # 步骤3
  && node --test tests/pi/test-pi-extension.mjs     # 步骤4
  && node --test tests/harnesses/test-harness-manifests.mjs  # 步骤5
  && node scripts/bump-version.mjs --check          # 步骤6
  && node scripts/bump-version.mjs --audit          # 步骤7
  && npm run check:repo                             # 步骤8
```

**2. 各步骤内容（均按文件实际内容核实）**

| 步骤 | 文件 | 风格 | 测什么 |
|------|------|------|--------|
| 1 | `tests/skills/test-skill-discovery.mjs` (170 行) | 手写断言脚本 | `skills/` 目录结构契约：必须一层深、每个技能目录有 SKILL.md、frontmatter 可解析且 `name` 与目录名一致、`agents/` 下只能叫 `openai.yaml`、bootstrap 技能 `using-parking-skills` 及其 4 个 references 文件存在（理由：技能加载失败是静默的） |
| 2 | `tests/skills/test-no-tool-names.mjs` (143 行) | 手写 lint 式扫描 | 核心不变量："技能正文只写动作、不写工具名"——正文里不得出现 VS Code / Claude Code / 其他 harness 的工具名（三组 DENIED 列表，27-71 行），违者报文件:行号；有 3 条路径 allowlist（80-91 行） |
| 3 | `tests/hooks/test-session-start.mjs` (126 行) | 手写断言（真执行） | 用 `execFileSync("bash", ...)` 真跑 `hooks/session-start`，断言三种平台（Claude Code / Cursor / Copilot CLI）各自只输出唯一正确的 JSON 字段（`hookSpecificOutput` / `additional_context` / `additionalContext`），且注入内容含 bootstrap 要素 |
| 4 | `tests/pi/test-pi-extension.mjs` (180 行) | `node:test`（6 个 test） | Pi 扩展：package.json 声明、5 个生命周期钩子注册、`resources_discover` 贡献 skills 目录、启动时 bootstrap 注入/去重/`agent_end` 后清除、compact 后重注入、`pi-tools.md` 与扩展内联映射两份拷贝不漂移 |
| 5 | `tests/harnesses/test-harness-manifests.mjs` (209 行) | `node:test`（11 个 test） | 各 harness 集成的"文档契约"：Cursor/Gemini/Antigravity/Kimi/OpenCode 的清单字段、指向的文件真实存在、工具映射表内容正确、`.agents` marketplace 条目、带版本的清单都注册进 `.version-bump.json`（理由：这些平台装不了，坏了也是静默失败） |
| 6-7 | `scripts/bump-version.mjs --check` / `--audit` | 检查脚本 | `--check`：所有注册清单版本一致无漂移；`--audit`：全仓扫描找出带版本号却未注册的 JSON（54-123 行） |
| 8 | `check:repo`（`package.json:8`） | 调 bundled checker | 跑 `check-skill-repo.mjs` 做仓库自检，带 `--allow` 豁免参数 |

**3. 组织方式**

- **零依赖**：无 jest/vitest/mocha；两种风格并存——手写"收集 failures + exit 1"脚本（步骤 1-3）和 Node 内置 `node:test`（步骤 4-5）。`node --test` 只用于这两个文件。
- **按被测对象分目录**：`tests/skills/`（技能库结构）、`tests/hooks/`（Claude Code hook）、`tests/pi/`（Pi 扩展）、`tests/harnesses/`（其余各平台集成）。
- **测的是仓库契约，不是业务逻辑**：这个仓库本身是一个跨平台技能库，作者反复强调"坏了没有报错、技能静默消失"，所以测试全是结构断言、清单契约、hook 输出形状、版本 lockstep。
- **fail-fast 链**：`&&` 连接，任一步非零退出即终止。
- 步骤 6-8 严格说是发布/一致性检查，被混进了 `test` 脚本里一起跑。

**4. 当前树上的实际状态（运行时实证）**

- 直接运行步骤 1：`FAIL — 34 problem(s)`，exit=1。典型问题：`skills/dev/SKILL.md missing`、所有 `skills/dev/*/SKILL.md` / `skills/pub/*/SKILL.md` "nested too deep"、`skills/using-parking-skills/ missing`。
- 即 **`npm test` 在当前工作树第一步就挂，后面 7 步不会执行**。
- 佐证的路径脱节：`check:repo`（`package.json:8`）引用 `skills/making-skills-cross-platform/scripts/check-skill-repo.mjs`，实际文件在 `skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs`；`test-no-tool-names.mjs:83-91` 的 allowlist 前缀同样是旧一层路径。

### Inference

- 测试与 package.json 是为旧的 `skills/<name>/SKILL.md` 单层布局写的；之后 skills 目录被重组成 `dev/`（自研技能）+ `pub/`（第三方技能）两类、且 `using-parking-skills` bootstrap 技能被移除/迁移，但测试链没有同步更新。多个独立位置（test-skill-discovery 的断言、test-no-tool-names 的 allowlist、check:repo 的脚本路径、pi/harnesses 测试里对 `skills/using-parking-skills/references/*` 的引用）指向同一结论，故支持度强。
- 因为整条链 fail-fast，当前树上步骤 4-8 的通过情况未知，但这不影响对"组织方式"的描述。

### Unknowns / limits

- 未运行整条 `npm test`（步骤 1 已实证失败，后续被 `&&` 短路；且本分析为只读约定）。
- skills 重组（dev/pub 两层、去掉 using-parking-skills）是"进行中的迁移"还是"测试已被废弃"，仅凭仓库现状无法裁定；需要看 git 历史中重组提交的意图或问作者。
- 若要降低不确定性，下一个只读探针：`git log --oneline -- tests/ package.json skills/` 对比测试与目录重组的时间先后，确认是测试滞后还是布局回退。
