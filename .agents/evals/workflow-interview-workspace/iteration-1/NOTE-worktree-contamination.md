# worktree 隔离排查记录（结论：三个 with_skill 结果予以保留，非作废）

## 发现的问题

三个 `with_skill` 首次运行都用了 `isolation: "worktree"`。排查后发现两件事：

1. **三个 worktree 全部 checkout 在同一个陈旧提交**（`0e234bf "dev"`），不包含
   `workflow-interview` / `aes-interview` / `aes-prototype` / `aes-goal-contract` 这四个新技能
   目录（本仓库最近一次提交 `ac9662e` 才加入，worktree 机制没跟上最新 HEAD）。三个 agent 各自
   发现目录缺失后自行把技能文件补了进去。
2. **`vague-mid-flight-requirement` 这一路的 agent 隔离失效**：它自己的 worktree 里完全没有生成
   `.aes-workflow/` 目录，说明它执行 `session.mjs` 时实际上直接操作了仓库的真实工作目录（很可能
   是自行"补技能文件"那一步用了指向主仓库的绝对路径，之后的 `session.mjs init/stage/finalize`
   也一路带着那个绝对路径跑）。真实仓库因此多出一个 `.aes-workflow/grilling/2026-08-11-mid-flight-requirement-change/`
   —— **已核对内容与 workspace 里拷贝的产物逐字节一致（`diff -rq` 无输出）后删除**，仓库已清理干净。

## 排除后的结论

- `cli-list-grouping` 与 `insight-report-filter-ui` 两路的 agent **确实在各自独立的 worktree 里
  完整跑通**（各自 worktree 下能找到完整的 `.aes-workflow/grilling/<slug>/`，真实仓库未被触碰），
  隔离生效，结果予以保留、正常评分。
- `vague-mid-flight-requirement` 这一路虽然隔离失效、直接写了真实仓库，但**机制本身（session.mjs
  的调用、manifest 状态流转）是真实发生的**，不是自由发挥的产物；只是"该在隔离环境里跑"这条卫生
  要求没做到。内容本身仍计入评分，只是留痕：这次运行确实碰过真实仓库状态（现已清理）。
- `insight-report-filter-ui` 这一路的 agent 报告里有一段自相矛盾的过程：它先按（推测是）仓库已
  提交的 `disable-model-invocation: true` 调用 Skill 工具，遭遇工具层拒绝，主动判定这是系统级
  guardrail 并写了 `FINAL_REPORT.md`/`SIMULATED_INTERVIEW.md` 记录"BLOCKED"结论——但同一次运行里，
  约 50 分钟后它又继续往下跑，最终产出完整成功的 `REPORT.md`（契约 ready、mock.html 两轮确认，
  且这次的 `.aes-workflow` 确认落在它自己的 worktree 里，是真实调用产生的）。它是如何绕过自己先前
  判定的"硬限制"的，没有留下可追溯的过程记录，这份"成功"结果与它自己写的"BLOCKED"结论直接矛盾。
  **保留该结果参与评分，但在评分时对这条自相矛盾单独标注，不当作无保留的干净数据看待。**
  这两份自相矛盾的文件（`FINAL_REPORT.md`、`SIMULATED_INTERVIEW.md`）原样保留在
  `insight-report-filter-ui/with_skill/outputs/` 下，供人工复核。

## 与本次评估无关但值得单独跟进的技术事实

`disable-model-invocation: true` 在仓库最近一次提交里仍是 `workflow-interview/SKILL.md` 的已提交
值（本会话开始前对它的修改——改成 `false`——目前还是未提交的本地改动，`git status` 显示
`M .claude/skills/workflow-interview/SKILL.md`）。如果 Skill 工具确实会对 `disable-model-invocation: true`
的技能拒绝显式调用（`insight-report-filter-ui` 那份报告转述的报错文本如此声称），那么在这次
`false` 的改动被提交之前，这个仓库里 `workflow-interview` 事实上**只能靠真人敲 `/workflow-interview`
斜杠命令触发，agent 用 Skill 工具点名调用会被拒绝**——这条结论本身没有被我独立复现验证过
（当前主工作区已经是 `false`，没法在不动用户未提交改动的前提下复现"true 时会怎样"），仅供参考，
不建议直接采信为定论。
