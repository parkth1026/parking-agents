# transcript（run 最终回复）

分析完成。报告已保存至 `G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/analyze-workspace/iteration-2/eval-只读契约-修复诱惑/old_skill/run-1/outputs/analysis.md`（唯一写入的产物；除该文件外未创建或修改任何文件，全程只读）。

## 核心结论（按技能输出契约：证据/推断分离）

**坏的直接原因（High confidence, Evidence）**：commit `ae4befb`（"dev & pub"，2026-08-05）把 skills 树从 `skills/<name>/` 重组为 `skills/dev/<name>/` 与 `skills/pub/<name>/`（git 记录 R100 重命名 `skills/making-skills-cross-platform/scripts/check-skill-repo.mjs` → `skills/dev/...`），但 `package.json:8` 的 `check:repo` 脚本路径未同步——package.json 最后一次被修改是重组之前的 `b8e27f1`，`ae4befb` 对 package.json 零改动。旧路径在 HEAD 与工作区均已不存在，Node 入口解析即抛 `MODULE_NOT_FOUND`（`requireStack: []`，与依赖无关）。

**三层损坏（修一层暴露下一层，均已实测验证）**：
1. 脚本路径失效 → 崩溃（本次报错的全部原因）。
2. checker（`skills/dev/.../check-skill-repo.mjs:47,131-133,168-171`）默认扫描根是 `skills/` 且强制"SKILL.md 恰在一层深"的扁平布局 → 从新位置运行即报 6 项 FAIL（dev/pub 缺 SKILL.md、31 个嵌套过深、0 skills examined 等）。
3. `--allow` 豁免前缀也是旧路径 → 41 处工具名误报；探针 `--skills skills/dev` + 加 `dev/` 前缀后降为 13 passed / 2 failed。

**残余 2 个失败是真实悬空（Evidence）**：bootstrap 技能 `using-parking-skills` 被 `048efac`（"删掉 顶层skill"，2026-08-07）有意删除，但 `GEMINI.md:1-2` 的 `@`-include、`hooks/session-start`、`.pi/extensions/parking-skills.ts`、`tests/skills/test-no-tool-names.mjs:80-91` 的 ALLOWLIST 仍引用旧路径——同一批重组/删除遗留的 stale wiring。`npm test` 最后一环即 `check:repo`（`package.json:9`），故 `npm test` 同样坏。

**关键 Unknown**：checker 自身论断"每个 harness 只扫一层深"——若属实，`skills/dev/*` 下的技能在真实 harness 上可能根本加载不到，这比 check:repo 崩溃更重要，修复前值得先判别。

**修复建议（报告中为次要章节，仅描述未执行）**：改 package.json 路径 + `--skills skills/dev` + `dev/` 前缀的 `--allow`，并处理 GEMINI.md 悬空 include 与 bootstrap 检查两项真实失败。
