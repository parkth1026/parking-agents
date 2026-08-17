# `npm run check:repo` 报 Cannot find module — 只读分析

分析时间：2026-08-16 · 方法：analyze 技能（只读、证据/推断分离、按支持度排序）

## Question

`npm run check:repo` 现在报 `Error: Cannot find module '...\skills\making-skills-cross-platform\scripts\check-skill-repo.mjs'`，为什么坏了？

## 结论速览（先答案后过程）

坏的原因是一句话：**commit `ae4befb`（"dev & pub"，2026-08-05）把整个 skills 树从 `skills/<name>/` 重组为 `skills/dev/<name>/` 与 `skills/pub/<name>/`，但 `package.json` 里的 `check:repo` 脚本路径没有跟着改**。Node 按 package.json 写死的旧路径找脚本文件，文件已经不在那里，于是 `MODULE_NOT_FOUND`。

## Ranked synthesis

| Rank | 解释 | Confidence | Basis |
|------|------|------------|-------|
| 1 | `package.json:8` 的 `check:repo` 仍指向 `skills/making-skills-cross-platform/scripts/check-skill-repo.mjs`；该路径在 `ae4befb` 中被 R100 重命名到 `skills/dev/making-skills-cross-platform/...`，旧路径在 HEAD 与工作区均已不存在 → Node 启动即 `MODULE_NOT_FOUND` | High | git rename 记录 + `git ls-files` 为空 + 错误复现 |
| 2 | 第二层损坏（修好 Rank 1 后立即暴露）：checker 的核心不变量是"扁平布局"——默认扫描根 `<root>/skills`、要求 `SKILL.md` 恰好在第一层。`dev/pub` 分组布局违反该不变量，checker 会 FAIL（missing in: dev, pub；31 个 SKILL.md 嵌套过深；0 skills examined） | High | checker 源码 + 从新路径直接运行的实测输出 |
| 3 | 第三层：`--allow` 豁免前缀也是旧路径（`skills/claude-to-vscode-skill-converter/`、`skills/making-skills-cross-platform/references/`），实际已移到 `skills/dev/` 下；不改会导致 41 处工具名误报 | High | `package.json:8` vs 磁盘实际位置；修正前缀后误报消失（实测 41 hits → 0） |
| 4 | 伴随损坏（同一批重组遗留）：bootstrap 技能 `using-parking-skills` 在 `ae4befb` 被移入 `skills/dev/`、随后在 `048efac`（"删掉 顶层skill"，2026-08-07）被整体删除；`GEMINI.md:1-2` 的 `@`-include 仍指向已删除路径，checker 报"loads empty, silently"。`hooks/session-start`、`.pi/extensions/parking-skills.ts`、`.opencode/INSTALL.md`、tests 也仍引用它 | High（引用存在与悬空为证据；删除是否有意属推断，见 Inference） | git 历史 + `git grep` + checker 实测 |

没有合理的竞争性解释：错误栈是 Node 的 CJS loader 在 `runMain` 阶段抛的 `MODULE_NOT_FOUND`（`requireStack: []`），即"入口脚本文件本身找不到"，与依赖缺失、`node_modules`、NODE_PATH 等均无关。文件系统里该脚本确实存在，只是换了位置。

## Evidence

### 1. 崩溃本身（Evidence）

- `package.json:8` — 脚本定义：
  ```
  "check:repo": "node skills/making-skills-cross-platform/scripts/check-skill-repo.mjs . --allow skills/claude-to-vscode-skill-converter/,skills/making-skills-cross-platform/references/"
  ```
- 复现输出（本机，Node v24.19.0）：
  ```
  Error: Cannot find module 'G:\GIT\AI_WorkFlow\parking-agents\skills\making-skills-cross-platform\scripts\check-skill-repo.mjs'
    code: 'MODULE_NOT_FOUND', requireStack: []
  ```
- 磁盘事实：`skills/` 下现在只有 `dev/` 和 `pub/` 两个子目录；`git ls-files skills/making-skills-cross-platform` 为空（HEAD 中旧路径已不存在）。脚本实际位置：
  - `skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs`（git 追踪）
  - `.claude/skills/making-skills-cross-platform/scripts/check-skill-repo.mjs`（本地 Claude 技能镜像，另一份拷贝）

### 2. git 历史定位破坏点（Evidence）

- `git show --stat -M ae4befb`（"dev & pub"，2026-08-05 11:05 +0800，全仓库第 94/125 个提交，距 HEAD 31 个提交）：
  ```
  R100  skills/making-skills-cross-platform/scripts/check-skill-repo.mjs → skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs
  skills/{ => dev}/cpu-monitor/... 、skills/{ => dev}/ps1-creator/... 等整批移动
  ```
  该 commit 对 `package.json` 的改动数为 **0**。
- `git log -- package.json`：最后一次修改 package.json 的提交是 `b8e27f1`（"skills dev"，位于 `ae4befb` **之前** 5 个提交）；当时 `check:repo` 已是现在这条旧路径命令，且当时 skills 是扁平的、命令可正常运行。
- 后续 `048efac`（"删掉 顶层skill"，2026-08-07）删除了 `skills/dev/using-parking-skills/` 全部 5 个文件。

即：`check:repo` 最后一次可用的时刻是 `b8e27f1`；从 `ae4befb` 起命令必然崩，且至今没有任何提交修过 package.json 的这条脚本。

### 3. 第二层：checker 与新布局的结构性冲突（Evidence）

从新位置直接运行（等价于只修 Rank 1 的路径后会发生的事）：

```
$ node skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs .
  ✗ every skill dir has SKILL.md        missing in: dev, pub
  ✗ no SKILL.md nested deeper than one level   （列出全部 31 个 skills/dev|pub/<name>/SKILL.md）
  ✗ frontmatter parses and name matches dir    0 skills examined — Try --skills <dir>
  ✗ skill bodies name actions, not tools       41 hit(s)（多为 claude-to-vscode-skill-converter 内的转换表）
  ✗ a bootstrap skill exists                   no skills/using-* found
  ✗ GEMINI.md @-includes resolve               skills/using-parking-skills/... — loads empty, silently
```

源码依据：

- `skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs:47` — 默认扫描根 `skillsDir = join(repoRoot, "skills")`；文件头注释明确支持分组仓库用法 `--skills skills/engineering`。
- `:131-133` — `deep` 检查：`SKILL.md && depth > 1` 即 FAIL（`skills/dev/<name>/SKILL.md` 在 depth 2）。
- `:168-171` — 扫描根下第一层没有 `SKILL.md` 时显式 FAIL"0 skills examined"，防止静默空转。
- `:206-209` 与 `--allow` 前缀按仓库根相对路径匹配（`rel()` 基于 `repoRoot`），因此豁免前缀必须带 `dev/` 层级才生效。

### 4. 修正扫描根后的残余失败（Evidence，判别性只读探针）

```
$ node skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs . \
      --skills skills/dev \
      --allow skills/dev/claude-to-vscode-skill-converter/,skills/dev/making-skills-cross-platform/references/
  13 passed, 2 failed
  ✗ a bootstrap skill exists          no skills/using-* found
  ✗ GEMINI.md @-includes resolve      skills/using-parking-skills/SKILL.md, .../gemini-tools.md
```

即：仅改 package.json 的路径/前缀仍会 exit 1——剩余两个失败反映的是仓库真实状态（bootstrap 已删、GEMINI.md 悬空），不是路径笔误。

### 5. 波及面（Evidence）

- `package.json:9` — `npm test` 链最后一环是 `npm run check:repo`，故 `npm test` 同样必然失败（推断自脚本串联顺序，未整链运行）。
- `tests/skills/test-no-tool-names.mjs:23` 扫描根仍是 `skills/`，`:80-91` 的 ALLOWLIST 前缀同样是旧路径，且 `:75-79` 注释明确写着"与 package.json 的 --allow 保持同步"——该同步约定在重组时被打破。
- `git grep "skills/using-parking-skills"`（排除 docs）命中：`GEMINI.md`、`hooks/session-start`、`.pi/extensions/parking-skills.ts`、`.opencode/INSTALL.md`、`.copilot/agents/parking-agent-creator.agent.md`、`tests/pi/test-pi-extension.mjs`、`tests/skills/test-no-tool-names.mjs`。
- 其余 `npm test` 目标文件（`tests/...` 各文件、`scripts/bump-version.mjs`）均存在——本问题不涉及文件缺失之外的损坏。
- `package.json:30-31` — `pi.skills = ["./skills"]` 安装指向未变。

## Inference

- **最可能的过程**：`ae4befb` 是一次纯文件移动型重组（stat 显示大量 R100/0 字节改动），作者移动了 skills 树但没有同步更新引用这些路径的 wiring（package.json 脚本、--allow 前缀、GEMINI.md include、tests ALLOWLIST）。checker 的设计初衷正是把这类"静默损坏"变响——它自己成了最早的受害者。
- `048efac` 的提交信息"删掉 顶层skill"表明删除 `using-parking-skills` 是**有意为之**；但 GEMINI.md、hooks、`.pi/extensions` 等注入器未同步清理，属于遗留悬空（对"是否打算彻底废弃 bootstrap 机制"无法从证据判定）。
- 降权说明：不存在"依赖未安装"类解释——该脚本零 npm 依赖（只 import `node:fs`/`node:path`），错误发生在入口文件解析阶段（`requireStack: []`），与 `node_modules` 无关。
- `--skills skills/dev` 探针 13/15 通过表明 checker 本身健康，损坏全部在"调用参数与仓库布局脱节"以及两处真实悬空引用。

## Unknowns / limits

- **dev/pub 分组是否破坏了真实 harness 的技能发现**：checker 的核心论断是"每个 harness 只扫 `skills/<name>/SKILL.md` 一层深"（脚本 119-121 行注释），若成立，`skills/dev/*` 下的技能在 pi/opencode 等 harness 上可能根本加载不到。但各 harness 实际扫描行为未在本仓库验证，`pi.skills = ["./skills"]` 是否递归未知。这是比 check:repo 崩溃更重要的开放问题。
- **修复方向的选择**（回扁平 vs. 教 checker 支持分组）是维护者决策，仓库证据不偏向任何一方：`--skills` 参数的存在说明 checker 设计上兼容分组调用，而"一层深"不变量又说明扁平是它守护的契约。
- `npm test` 前几腿（test-no-tool-names 等）是否在 check:repo 之前就已失败：未整链运行，仅从 stale ALLOWLIST 推断"很可能报同样的工具名命中"。
- `.claude/skills/` 下的技能镜像与 `skills/dev/` 的同步机制未考察（与本问题无直接关联）。

## 怎么修（次要部分，应用户要求附带；非本分析的主要产出）

按证据分层给出，均为选项而非排期计划：

1. **止血（解决 Cannot find module 本身）**：改 `package.json:8` 的脚本路径为 `skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs`。只做到这一步，命令将从"崩溃"变为"报 6 项结构 FAIL"。
2. **对齐布局（解决大部分 FAIL）**：同一行补上扫描根与豁免前缀，例如：
   ```
   --skills skills/dev --allow skills/dev/claude-to-vscode-skill-converter/,skills/dev/making-skills-cross-platform/references/
   ```
   （`skills/pub` 如需检查再跑第二遍；两处 `--allow` 与 `tests/skills/test-no-tool-names.mjs:80-91` 的 ALLOWLIST 按其注释要求保持同步，前缀均需加 `dev/`。）
3. **处理两处真实悬空（否则永远 exit 1）**：
   - `GEMINI.md:1-2` 的 `@`-include 指向已删除的 `skills/using-parking-skills/`——按 `048efac` 的删除意图，应移除或改指新位置；
   - checker 的 bootstrap 检查会因找不到 `using-*` 技能而 FAIL——要么恢复一个 bootstrap 技能，要么用 `--bootstrap <name>` 指定现有技能，要么接受该项失败并调整检查。
4. **先做判别（对应 Unknowns 第 1 条）**：修复前值得先确认 `skills/dev/*` 下的技能在目标 harness 上是否真的能被发现（例如查 pi/opencode 对 `pi.skills=["./skills"]` 的扫描深度）。若 harness 只扫一层，问题优先级要倒过来——先解决布局，check:repo 只是症状。

以上修复均未在本会话执行（分析契约为只读）。
