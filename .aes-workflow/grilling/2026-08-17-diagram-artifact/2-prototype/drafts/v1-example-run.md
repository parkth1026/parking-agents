<!-- draft v1 | published 2026-08-16T17:52:50Z
     用户意见：整体放行（「请继续」），未逐条点名
     状态：confirmed（转正为 2-prototype/example-run.md） -->
# 可执行示例: 2026-08-17-diagram-artifact

**草稿 v1。** 定端到端跑起来的样子：怎么调用、人看到什么。写死的示例输出，不连真实系统。

## 场景 1：七面闸门拦你（新增行为）

```text
$ node .claude/skills/workflow-interview/scripts/session.mjs stage <issue-dir> 2-prototype done --artifacts "behavior"
gate: impact-surface.md 没提到影响面「架构与依赖」。七面逐面扫，判「无」也要写下来。
session: 2-prototype 的阶段闸门没过，done 没有写入。挡的是结构不是质量，逐条补齐再来。
（退出码 1，manifest 未写。在 impact-surface.md 补一行「架构与依赖：无」后，同一命令放行）
```

## 场景 2：新产物走旧闸门（零代码改动的证明）

```text
$ node .claude/skills/workflow-interview/scripts/session.mjs stage <issue-dir> 2-prototype done \
    --artifacts "diagram,behavior" --next "进 3-contract"
2-prototype → done；当前阶段 3-contract
（diagram.html 落 2-prototype/ 根下即可——开放命名按 .md / .html / 原名三候选原样接纳）
```

## 场景 3：测试全绿（改完必须照旧能跑）

```text
$ node .claude/skills/workflow-interview/scripts/session.test.mjs
（既有全部用例通过；新增三条：fixture 七面、skipped needle 七面、--artifacts diagram 命中 .html 候选）
```

## 必须保持不变的现有用法（单独成场景）

- `init`（幂等）/ `round`（schema 校验拒收坏行）/ `list` / `rebuild` / `verify` / `finalize` 六个命令的调用方式与退出码——这条现在能跑，改完之后必须逐字节一样能跑。
- 唯一的用户可见文字变化是 die/gate 文案里两处「六面」→「七面」，已在 behavior.md 变化行 1/2 申报；除此之外终端输出不变。
