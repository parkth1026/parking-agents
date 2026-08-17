# `npm run check:repo` 报 `Cannot find module` — 原因分析与修复建议

> 分析对象：`G:/GIT/AI_WorkFlow/parking-agents`（HEAD = `f1da45d omx`，2026-08-16）
> 分析性质：只读诊断。本文只做分析和给出修复方案，未改动仓库任何文件。

## 1. 现象

```
$ npm run check:repo

> node skills/making-skills-cross-platform/scripts/check-skill-repo.mjs . --allow skills/claude-to-vscode-skill-converter/,skills/making-skills-cross-platform/references/

Error: Cannot find module 'G:\GIT\AI_WorkFlow\parking-agents\skills\making-skills-cross-platform\scripts\check-skill-repo.mjs'
  code: 'MODULE_NOT_FOUND',
  requireStack: []
```

Node 在加载入口脚本之前就失败——`requireStack: []` 说明这是命令行入口本身找不到，脚本一行都没执行。

## 2. 直接原因：脚本文件被移动，`package.json` 里的硬编码路径没有跟着改

`package.json:8` 写死了相对路径：

```json
"check:repo": "node skills/making-skills-cross-platform/scripts/check-skill-repo.mjs . --allow skills/claude-to-vscode-skill-converter/,skills/making-skills-cross-platform/references/"
```

但 `skills/` 目录已经从扁平结构（`skills/<skill-name>/`）重组为分组结构（`skills/dev/`、`skills/pub/`）。该脚本现在的真实位置是：

```
skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs   ← 现在在这里
skills/making-skills-cross-platform/scripts/check-skill-repo.mjs       ← package.json 找的位置，已不存在
```

## 3. 根因与时间线（git 考证）

| 时间 | 提交 | 做了什么 | 后果 |
|---|---|---|---|
| 2026-08-04 | `b8e27f1` "skills dev" | 在 `package.json` 新增 `check:repo` 脚本（当时路径正确，skills 还是扁平结构），并把 `npm run check:repo` 追加到 `test` 链末尾 | — |
| 2026-08-05 | `ae4befb` "dev & pub" | 把所有 skill 从 `skills/<name>/` 整体移动到 `skills/dev/<name>/` 和 `skills/pub/<name>/`（git 识别为 rename）。**该提交没有改 `package.json`** | `check:repo` 从这一天起就坏了 |
| 2026-08-07 | `048efac` "删掉 顶层skill" | 删除了 bootstrap skill `skills/dev/using-parking-skills/`（SKILL.md + 全部 references/*-tools.md，共 282 行） | 埋下更多失败（见 §5） |

根因一句话：**目录重构（`ae4befb`）只搬了文件、没有同步更新 `package.json` 中硬编码的脚本路径和 `--allow` 豁免清单**。这是一个典型的"移动文件但引用未更新"的破坏，且因为 `check:repo` 挂在 `test` 链末尾、而 `test` 链前面的测试也可能在失败，导致这个破损一直没被注意到。

## 4. 同源连锁损伤（同一批重构留下的过期路径）

用 `grep -rn "skills/making-skills-cross-platform"` 和对 `using-parking-skills` 的排查，发现不止 `package.json` 一处过期：

| 位置 | 过期内容 | 现状 |
|---|---|---|
| `package.json:8` | 脚本路径 `skills/making-skills-cross-platform/scripts/...` | 实际在 `skills/dev/...`（本次报错的直接原因） |
| `package.json:8` | `--allow skills/claude-to-vscode-skill-converter/,skills/making-skills-cross-platform/references/` | 两个豁免前缀都已失效，实际应为 `skills/dev/...` |
| `tests/skills/test-no-tool-names.mjs:80-91` | ALLOWLIST 三个前缀 `skills/claude-to-vscode-skill-converter/`、`skills/using-parking-skills/references/`、`skills/making-skills-cross-platform/references/` | 全部失效。豁免不生效后，converter skill 里的"工具名对照表"（本来就是它的主题内容）会被当成违规误报 |
| `tests/skills/test-skill-discovery.mjs:143,151` | `BOOTSTRAP = "using-parking-skills"`，并断言 `skills/` 的每个直接子目录都有 SKILL.md | bootstrap 已被删；`dev`/`pub` 是分组目录没有 SKILL.md，此测试同样失败 |
| `hooks/session-start:10` | `BOOTSTRAP_SKILL="${PLUGIN_ROOT}/skills/using-parking-skills/SKILL.md"` | 指向已删除的文件，session 启动时 bootstrap 注入实际读到错误信息 |
| `GEMINI.md:1-2` | `@./skills/using-parking-skills/SKILL.md` 等 2 个 @-include | 悬空引用，Gemini CLI 会**静默加载为空** |

注意 `test-no-tool-names.mjs:78-79` 的注释本身就写着"Keep both in sync when you add or remove an exemption"——`package.json` 的 `--allow` 与测试的 ALLOWLIST 是一份契约的两份拷贝，这次重构两份都没更新。

## 5. 重要提醒：只改路径还修不好——checker 本身也会 FAIL

为了验证，我从新位置直接运行了 checker（带修正后的 allow 前缀，只读运行，未改任何文件）：

```
node skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs . --allow skills/dev/...
```

结果：**9 passed, 5 failed**。剩余 5 个 FAIL：

1. `every skill dir has SKILL.md` — `dev`、`pub` 是分组目录，没有 SKILL.md
2. `no SKILL.md nested deeper than one level` — 全部 31 个 SKILL.md 现在都在两层深；`skills/pub/matt/<name>/SKILL.md` 甚至三层深（matt 下还有 14 个子 skill）
3. `frontmatter parses and name matches dir` — "0 skills examined"，扫描根不对（脚本自己提示 `Try --skills <dir>`）
4. `a bootstrap skill exists` — `using-parking-skills` 已被 `048efac` 删除
5. `GEMINI.md @-includes resolve` — 上述悬空 include

也就是说这次"坏了"其实是两层问题：入口路径断了（Cannot find module）只是把更深的结构性问题挡在了视线之外。

## 6. 修复建议（按依赖顺序）

### 第 1 步：修 `package.json:8` 的路径与 allow 清单（立即消除 Cannot find module）

```json
"check:repo": "node skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs . --allow skills/dev/claude-to-vscode-skill-converter/,skills/dev/making-skills-cross-platform/references/"
```

改动点：脚本路径加 `dev/`，两个 `--allow` 前缀各加 `dev/`。

### 第 2 步：同步修 `tests/skills/test-no-tool-names.mjs` 的 ALLOWLIST

三个前缀同步改为 `skills/dev/...`（`using-parking-skills` 那条按第 4 步的取舍决定去留），并顺手更新第 75 行注释里的旧路径。这正是该文件注释里要求的"两份拷贝保持同步"。

### 第 3 步：解决 bootstrap 的去留（决策点）

`048efac` 删了 `using-parking-skills`，但 `hooks/session-start`、`GEMINI.md`、checker、`test-skill-discovery.mjs` 四处都还假设它存在。两个方向二选一：

- **恢复**：`git revert 048efac` 或把该 skill 放回 `skills/dev/using-parking-skills/`，同时更新 `GEMINI.md` 和 `hooks/session-start` 里的路径（加 `dev/`）。
- **彻底移除**：删除 `hooks/session-start` 中的 BOOTSTRAP_SKILL 注入逻辑、`GEMINI.md` 的两个 @-include，并让 checker 用 `--bootstrap <name>` 显式指定新的引导 skill（或接受没有 bootstrap）。

### 第 4 步：让 checker 适配分组布局（结构性修复）

checker 支持 `--skills <dir>` 指定单个分组根，例如 `--skills skills/dev`。但本仓库有两个分组根（`dev`、`pub`），且 `pub/matt` 还有第三层嵌套，单次调用覆盖不了。可选方案：

- **多次调用**：`check:repo` 改为串联三段（`--skills skills/dev`、`--skills skills/pub/matt`、`--skills skills/pub` 剩余部分），较笨拙且 pub 段会误报 `matt` 目录。
- **增强 checker（推荐）**：让 `check-skill-repo.mjs` 接受多个 `--skills` 根，或把"只含子目录、无 SKILL.md 的目录"识别为分组目录并递归。既然仓库已永久采用 dev/pub 布局，这是一次性投入。
- 同步修改 `tests/skills/test-skill-discovery.mjs` 的"一层深"断言，使其理解分组目录。

### 第 5 步：回归验证

```
npm run check:repo   # 应先变绿或只剩已知决策项
npm test             # test 链末尾挂着 check:repo，前面 4 个测试也要一起过
```

## 7. 防复发建议

- 这类硬编码相对路径在文件移动时最容易断。可考虑把 `check:repo` 脚本改为在运行时探测（如 `skills/dev/...` 不存在时给出可读提示），或用 git mv 后跑一次 `npm test` 作为重构提交的门禁。
- `--allow` 与 `test-no-tool-names.mjs` ALLOWLIST 的双份拷贝契约，可考虑让测试直接读取 `package.json` 解析出 allow 列表，消除人工同步。

## 8. 关键文件清单

- `G:/GIT/AI_WorkFlow/parking-agents/package.json`（第 8 行，报错源头）
- `G:/GIT/AI_WorkFlow/parking-agents/skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs`（checker 实际位置）
- `G:/GIT/AI_WorkFlow/parking-agents/tests/skills/test-no-tool-names.mjs`（第 80-91 行 ALLOWLIST 过期）
- `G:/GIT/AI_WorkFlow/parking-agents/tests/skills/test-skill-discovery.mjs`（第 143、151 行 bootstrap 断言过期）
- `G:/GIT/AI_WorkFlow/parking-agents/hooks/session-start`（第 10 行指向已删除文件）
- `G:/GIT/AI_WorkFlow/parking-agents/GEMINI.md`（第 1-2 行悬空 @-include）
- 关键提交：`ae4befb`（dev & pub 重构，未同步 package.json）、`048efac`（删除 bootstrap skill）、`b8e27f1`（引入 check:repo）
