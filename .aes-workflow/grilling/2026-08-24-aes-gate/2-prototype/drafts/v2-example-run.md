<!-- draft v2 | published 2026-08-25
     用户意见：五裁决全按推荐；主路径=单条沉淀；组装入口=对话
     状态：draft -->

# 可执行示例: aes-gate 三种用法（写死示例数据，不连真实系统；npm test 结果为 2026-08-25 实测）

## 场景 D：单条沉淀（主路径·高频）

```text
> 刚才那个 ps1 无 BOM 的坑，把它记成 gate

[aes-gate] 判例追问：什么生产变更会让这个 gate 红？
> 新增/修改的 .ps1 无 BOM 且含非 ASCII 注释时（PS5 按 ANSI 解析会静默失效）
[aes-gate] 判例成立（可证伪、有先例：windows-console 教训）
[aes-gate] 固化：scripts/gate/check-ps1-bom.mjs（正反样例自检通过）
[aes-gate] 注册：run.toml 追加 [[actions]] id="gate.check-ps1-bom" kind="gate" run=["node","scripts/gate/check-ps1-bom.mjs"]
[aes-gate] registry：gates +1（status=green，lastRun=刚自检）；看板已刷新
[aes-gate] 提示：目前保护级别 manual——要真阻断，说「组装」时勾选 CI 接线
```

## 场景 A：批量检测（低频·显式 /aes-gate）

```text
> /aes-gate

[aes-gate] 读 run.toml：6 门（含刚沉淀的 check-ps1-bom）；.github/workflows 无；hooks 无
[aes-gate] 逐门跑 kind=gate：test → exit=0 绿（七连，40s）｜gate.check-ps1-bom → 绿｜其余缺失
[aes-gate] 六维评分：18.5/110 → 档位=纸面门禁（阻断强制性 0.5/30）
[aes-gate] 分诊：G1 无 CI（P0·可组装）/ G2 结构守卫（P1）/ G3 棘轮（P2）/ G4 AI 门禁（P2·出界）
[aes-gate] 落盘 .aes-gate/report-20260825-1300.md + registry/看板刷新
```

## 场景 B：批量组装（低频·对话触发）

```text
> 组装 G1,G2,G3

[aes-gate] 分诊三问：底座（GitHub Actions / 仅注册 / hooks）？阻断强度（advisory→evidence→gating）？> Actions + gating
[aes-gate] Phase 4 生成草稿（未触碰仓库）：
  G1 → .github/workflows/gate.yml + run.toml 注册 gate.ci
       # 模式：codex 聚合 required check｜适配：聚合面=run.toml 全部 kind=gate 动作
  G2 → scripts/gate/guard-structure.mjs + 注册
       # 模式：haha change-policy｜适配：断言 .agents/skills/<name>/SKILL.md 存在且 scripts/*.mjs
  G3 → scripts/gate/ratchet-lines.mjs + ratchet-baseline.json + 注册
       # 模式：orca check-max-lines-ratchet｜适配：基线=当前全仓 .mjs 行数快照，只许缩小
[aes-gate] Phase 5 自举：三件植入违规全部被检出，selftest 3/3 绿
[aes-gate] 确认门：7 个文件将写入（3 脚本+1 基线+1 workflow+run.toml 修改），diff 已展示。确认？> y
[aes-gate] 已写入并注册；残余提示：branch protection 未开——聚合 check 存在≠阻断生效，仍是纸面（已进报告残余节）
```

## 场景 C：被 aes-qa 调用（精简路径，#19 落地后）

```text
[aes-qa] 第一步：调用 aes-gate 检测
[aes-gate] 跑检测（含逐门红绿），不落盘
[aes-gate] 回传：盘点 6 门（绿×2·缺×4）｜18.5 纸面｜缺口 4（可组装 3）
[aes-qa] 缺口并入报告移交单；gate 结果计入基线层证据；继续静态快检与真实使用（不被组装打断）
```

## 不变的现有用法（必须逐字节一样能跑）

- `npm test` 七连在新增技能/脚本后原样通过。
- 既有技能与 `.\run` 接口（若目标仓已有）零改动——aes-gate 只追加 `[[actions]]`，不改既有条目。
