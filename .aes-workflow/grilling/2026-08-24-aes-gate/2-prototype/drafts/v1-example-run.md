<!-- draft v1 | published 2026-08-24
     用户意见：（待质疑）
     状态：draft -->

# 可执行示例: /aes-gate 对 parking-agents 自身跑一轮（写死示例数据，不连真实系统）

## 场景 A：显式体检

```text
> /aes-gate

[aes-gate] Phase 1 调查（只读）……
  CI：无 .github/workflows ✓记录
  hooks：无自定义 git hooks ✓记录
  测试命令：npm test（package.json:13，七连）✓记录
  AGENTS.md 约定：.mjs 零依赖、.agents/skills 真源 ✓记录
  平台矩阵：win32 为主 ✓记录
  托管权限：GitHub（可开 branch protection，未开）✓记录
  红绿状态：npm test 未在本次判定中执行（检测只读不跑门禁本体，红绿由证据引用）
  已有 gate 资产：无 gate.toml / twe-gate ✓记录

[aes-gate] Phase 2 体检：总分 18.5/110，档位=纸面门禁（断言置顶）
[aes-gate] Phase 3 分诊：4 缺口（P0×1 G1 无 CI；P1×1 G2 无结构守卫；P2×2 G3 棘轮/G4 AI 门禁）
  → G4 归通用 gate-builder（出界）；G1–G3 可组装
[aes-gate] 报告落盘：.aes-gate/report-20260824-1530.md
[aes-gate] 组装入口：对 G1–G3 说「组装」，或显式 /aes-gate --assemble G1,G2,G3
```

## 场景 B：组装（确认门流程）

```text
> 组装 G1,G2,G3

[aes-gate] Phase 4 生成草稿（.aes-gate/drafts/，未触碰仓库文件）：
  G1 → .github/workflows/gate.yml        # 模式：codex 聚合 required check｜适配：本仓 npm test 七连为唯一聚合面
  G2 → scripts/gate/guard-structure.mjs  # 模式：haha change-policy｜适配：断言 .agents/skills/<name>/SKILL.md 存在且 scripts/*.mjs
  G3 → scripts/gate/ratchet-lines.mjs + scripts/gate/ratchet-baseline.json
                                          # 模式：orca check-max-lines-ratchet｜适配：基线=当前全仓 .mjs 行数，只许缩小
[aes-gate] Phase 5 自举：每件植入已知违规→全部被检出→selftest 3/3 绿
[aes-gate] 确认门：以上 5 个文件将写入仓库，diff 已展示。确认落地？(y/n)
> y
[aes-gate] 已写入 5 文件；建议提交信息：gate: 落地聚合 check+结构守卫+棘轮（模式出处见文件头两行）
[aes-gate] 提示：branch protection 未开——阻断强制性仍是纸面，开 protection 的步骤已写进报告残余节
```

## 场景 C：被 aes-qa 调用（精简路径，#19 落地后）

```text
[aes-qa] 第一步：调用 aes-gate 检测……
[aes-gate] （只执行 Phase 1–3，不落盘）
[aes-gate] 回传：盘点表 3 行｜总分 18.5（纸面门禁）｜缺口 4（P0×1 P1×1 P2×2，可组装 3）
[aes-qa] 缺口并入报告移交单；继续静态快检与真实使用（不被组装打断）
```

## 不变的现有用法（必须逐字节一样能跑）

- `npm test` 七连在新增技能目录后原样通过（discovery/no-tool-names 检查吃新目录，不改检查本身）。
- 既有技能目录零改动；`gh`、worktree 等其它技能工作流零感知。
