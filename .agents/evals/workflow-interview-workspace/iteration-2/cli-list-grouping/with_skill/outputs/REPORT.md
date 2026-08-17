# REPORT — cli-list-grouping / with_skill

## Issue 目录

Original (worktree): `C:\wt\new\.aes-workflow\grilling\2026-08-13-cli-list-grouping`

Copied to: `G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\workflow-interview-workspace\iteration-2\cli-list-grouping\with_skill\outputs\issue\`
(contains `1-interview/context.md`, `1-interview/rounds.jsonl`, `2-prototype/impact-surface.md`, `2-prototype/behavior.md`, `2-prototype/example-run.md`, `2-prototype/drafts/v1-*.md`, `3-contract/contract.md`, `3-contract/verify.txt`, `manifest.json`)

## 最终 manifest 状态

All three stages `done`; top-level `status: "ready"`; `validation.status: "valid"`, `ac_count: 5`, `verify_tiers: {A:5,B:0,C:0,D:0}`, `blocked: []`, `residual_risk: null`.

## finalize 校验与冒烟结果（原文）

```
AC_COUNT: 5
VALID: ...\3-contract\contract.md
─── [A] 档冒烟 ───
[FAIL] AC-001..AC-005  exit=1  $ node .../session.test.mjs
绿 0 / 红 5 / 跑不起来 0
─── 交接可执行性 ───
档位分布：[A] 5 / [B] 0 / [C] 0 / [D] 0
─── 交接指令 ───
/goal 完成 ...\3-contract\contract.md 定义的目标：...
```

`finalize` overall exit code 0. 五条 AC 共用同一条 Verify 命令（`node .claude/skills/workflow-interview/scripts/session.test.mjs`），内部任何一条断言失败都会让整条命令退出非 0，所以冒烟粗粒度地把 5 条全标了 FAIL——但直接跑那份测试文件本身显示 `47/53` 通过（AC-001 的两条断言和 AC-005 的退出码断言其实已经合法地是绿的，因为它们测的是本来就已成立的行为；真正的 4 条红是 `--group`、`--stage` 筛选+校验、`--status`、零命中提示——这些确实还没实现）。

## 闸门拒收记录

**真实 issue 流程：零拒收。** 针对 `2026-08-13-cli-list-grouping` 跑的每一条 `round`/`stage`/`finalize` 命令都是第一次就退出 0。

有一次拒收，但发生在为新增回归测试搭建探索性 fixture 的过程中（不属于真实访谈流程本身）：
- 命令：对一份一次性调试用 fixture 跑 `finalize` + `stage 3-contract done`
- 报错：`ERROR: AC-001 太短，说不清一个可判定的结果。` / `ERROR: Verify [C] 的内容太短，没法照着验：人工看` → `INVALID` → 随后 `stage done` 因「`finalize` 还没通过」被拒
- 处理：把占位符式的 AC/Verify 文字换成实质内容（`AC-001: 命令行退出码为 0 视为通过` / `` Verify: [A] `node -e "process.exit(0)"` ``），重跑 `finalize` 通过。这份修好的 fixture 后来变成 `session.test.mjs` 里真实的 `listC` fixture。

## 问了几轮、每轮问了什么

**Round 1（1-interview）：** 3 条默认区（分组维度 = `manifest.stage`；`--stage` 传非法值要报错而不是静默忽略；分组内顺序 = slug 顺序）+ 3 条提问区：(1) "in_progress" 筛选的是顶层 `manifest.status` 还是逐阶段 gate 状态 → 用户选了推荐项 A；(2) 有没有仓库外的东西依赖 `list` 目前的文本格式 → 用户透露了自己那个解析固定列宽的本地 PowerShell 脚本；(3) 不带 flag 时的默认输出是否必须保持字节级不变 → 用户选 A，明确是为了保护那个脚本。

**Round 2（2-prototype，两轮）：** v1 draft 给用户看 → 提了两条意见（分组标题要带 stage 名字和条数；零命中的筛选要打印明确提示，不能沉默）→ 改出 v2 → 用户确认，无新意见。

**Round 3（3-contract）：** 不需要再开一轮提问——用户此前已经说过"跟着现有测试惯例走，你推荐什么就是什么"，5 条 AC 直接按仓库现有 `session.test.mjs` 黑盒测试风格全部落到 `[A]` 档。

## 体验评估

顺畅。真实 issue 流程中没有卡死的闸门拦截，没有重复重试循环。唯一一次拒收发生在一次性测试 fixture 搭建阶段，一次修正就解决。五条 AC 全部到达 `[A]` 档（没有遗留无法自动化验证的 AC），`finalize` 的交接可执行性闸门没有产生任何 WARNING。
