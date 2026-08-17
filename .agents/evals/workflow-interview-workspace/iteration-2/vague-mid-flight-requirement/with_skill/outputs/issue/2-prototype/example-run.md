# 可执行示例: 2026-08-13-mid-flight-requirement-change

**确认版·锁定。** 执行 Agent 改的是产品，不是这份对照表。
用户确认：2026-08-13T00:20:00Z

命令都从仓库根跑。示例输出是写死的示范（实现还没做，`session.test.mjs` 里两条新
用例目前还不存在），不是真实抓的日志；用来定义「做完之后长什么样」。

## 场景 1：契约还没 done 时追加一条 AC，走通既有闸门（新支持路径）

```text
$ node .claude/skills/workflow-interview/scripts/session.mjs finalize .aes-workflow/grilling/<slug>
...
VALID: .aes-workflow/grilling/<slug>/3-contract/contract.md
...

$ node .claude/skills/workflow-interview/scripts/session.mjs stage .aes-workflow/grilling/<slug> 3-contract done --next "..."
3-contract → done；当前阶段 3-contract
next: ...

# 用户这时候想起要多验一条边界情况，直接编辑 contract.md 追加 AC-00N 和它的 Verify 行——
# 不跑 needs_reinterview，不新建 issue。

$ node .claude/skills/workflow-interview/scripts/session.mjs finalize .aes-workflow/grilling/<slug>
...
AC_COUNT: <N>
VALID: .aes-workflow/grilling/<slug>/3-contract/contract.md
...

$ node .claude/skills/workflow-interview/scripts/session.mjs stage .aes-workflow/grilling/<slug> 3-contract done --next "..."
3-contract → done；当前阶段 3-contract
next: ...
```

第二次 `finalize` + `stage done` 都是退出码 0——`gateDone` 现场重新读盘上的
`contract.md`，不记得「已经 done 过一次」，所以这条路径不需要任何新命令。

## 场景 2：追加 AC 但没重跑 finalize 就直接 stage done——仍然被拒（回归防线）

```text
# 编辑 contract.md 追加 AC-00N 之后，跳过 finalize 直接想 done：

$ node .claude/skills/workflow-interview/scripts/session.mjs stage .aes-workflow/grilling/<slug> 3-contract done --next "..."
gate: contract.md 在上次 finalize 之后又改过。重跑 finalize，别让改动绕过校验和冒烟。
session: 3-contract 的阶段闸门没过，done 没有写入。挡的是结构不是质量，逐条补齐再来。
$ echo $?
1
```

这条防线是既有的 mtime 检查（`session.mjs:299`），本次零代码改动；`session.test.mjs`
新增的用例只是把它显式覆盖成一条回归断言，防止以后有人「优化」掉这个检查时没人发现。

## 场景 3：追加的内容涉及界面/行为差异——不是这条轻路径能覆盖的

```text
# 想加的 AC 需要新的对照物（比如要改一处输出格式），不是纯文字追加：

$ node .claude/skills/workflow-interview/scripts/session.mjs stage .aes-workflow/grilling/<slug> 3-contract needs_reinterview \
    --reason "追加的 AC 涉及 xxx 的可观察行为差异，需要重新走 aes-prototype 出对照物"
3-contract → needs_reinterview；当前阶段 1-interview
next: 3-contract 撞出新歧义，回 /aes-interview 问清：追加的 AC 涉及 xxx 的可观察行为差异，需要重新走 aes-prototype 出对照物
```

这条路径完全是既有行为（`needs_reinterview` 本来就支持从 `3-contract` 触发），不是
新功能——本次改动只是在文档里把「什么时候该走这条、什么时候该走场景 1 那条」的判据
写清楚。

---

新增什么：`aes-goal-contract/SKILL.md`、`workflow-interview/SKILL.md` 里的说明文字，
和 `session.test.mjs` 里覆盖场景 1、场景 2 的两条回归用例。
不变什么：`session.mjs` 的全部命令行为、参数、退出码文案；`needs_reinterview` 的既有
语义；`validate-goal-contract.mjs` 的全部校验规则。
