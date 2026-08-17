<!-- draft v1 | published 2026-08-17
     用户意见：待质疑
     状态：draft -->

# 可执行示例: 2026-08-17-bpr-skill-improve

> 端到端跑起来的样子。报文结构定义在 api-mock.md，本文件只写"怎么用、看到什么"并指回。

## 场景 1：修订版技能被激活（改后必须成立的行为）

输入（用户消息）：

```text
新项目搭纯 React 前端，我看的教程全都让我 npx create-react-app，这样还行吗？
官方现在推荐怎么起？要有出处的中文建议。
```

跑起来的样子：

1. description 中文触发词命中 → 技能激活（不改名、不加配置，激活方式与现在完全相同）。
2. 分类问题 → 官方推荐 + 版本现状类；本地检索判定"不需要"。
3. 按官方阶梯抓 react.dev 弃用公告原文（fetch-not-snippet）+ npm registry `create-react-app` time 字段。
4. 产出报告（中文，因为用户用中文）：节结构 = 直接建议【置信档位】/ 证据使用（就近 URL）/ 版本-日期上下文（含 AS_OF）/ **冲突与缺口（"教程都让我 CRA"的假设来源被点名标为过时证据）** / 仓库本地上下文（不需要）/ 边界 / 交接（中立表述，不出现 $ 命令名）。
5. 交付即停，不改任何文件。

→ iteration-3 的 CRA 断言 3（过时证据标记）在此形态下应判 PASS；断言 1/2/4 的既有 PASS 不得回归。

## 场景 2：verify-refs.mjs 端到端（新脚本首次可用）

```bash
node .claude/skills/best-practice-research/scripts/verify-refs.mjs \
  .claude/skills/best-practice-research-workspace/iteration-2/eval-CRA脚手架现状/with_skill/run-1/outputs/report.md
```

写死示例输出（真实 URL 结果以运行时为准，结构不变）：

```text
verify-refs: report.md
  checked      7
  [ok]          6
  [ambiguous]   1   (403 — 可能 bot 拦截，人工复核)
  [unreachable] 0
结果：通过（无 unreachable 引用）
```

退出码 0 → 人只复核那 1 条 ambiguous。
若出现 `unreachable`（exit 1）：逐条二选一——补出处或删引用，然后重跑至通过或人工裁定。

## 场景 3：既有用法逐字节不变（改完必须还能跑）

- 用英文提问 "research current best practice for X, cite official docs" → 同样激活本技能（description 英文触发短语全部保留）。
- eval harness 按 `.claude/skills/best-practice-research/SKILL.md` 路径读取技能 → 路径与 frontmatter `name` 均未变，加载行为不变。
- `npm test` 全绿不受影响：静态测试不扫 `.claude/skills` 技能体（事实见 1-interview/context.md），本改动不触碰 `skills/dev|pub`。
