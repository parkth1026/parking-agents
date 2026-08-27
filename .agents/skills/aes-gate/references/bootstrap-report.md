# 自举试用留档：对本仓的首轮 gate 体检（#42 AC-4 证据）

> 本文件是 `.agents/skills/aes-gate` 落地时对本仓（parkth1026/parking-agents@dc2f675）真实跑一轮检测的留档。
> 生成命令：`node .agents/skills/aes-gate/scripts/collect.mjs`（退出码 0）；运行产物在 `.aes-gate/`（gitignore），
> 本文件为入库的验收证据副本。时间戳等动态字段以生成时点为准。

# gate 体检报告 · parkth1026/parking-agents

- 采集：`C:\Program Files\nodejs\node.exe G:\GIT\AI_WorkFlow\parking-agents-worker\parking-agents-worker-1\.agents\skills\aes-gate\scripts\collect.mjs`（退出码以显式读取为准）｜commit `dc2f675`｜时间 2026-08-26T17:19:39.154Z
- 注册真源：run.toml **缺失**（G0 置顶）

## 1. 盘点
| 门 id | 类型 | 命令/位置 | 证据 | 状态 |
| --- | --- | --- | --- | --- |
| local.npm-test | 本地链·未注册 | `npm test` | package.json scripts.test（未注册进 run.toml） | 绿（exit=0，绿实跑 8s） |
| ci.required | 哨位 | — | CI 配置不存在（.github/workflows 等） | 缺失 |
| hooks.pre-commit | 哨位 | — | .git/hooks 无自定义 / 无 .husky / 无 .pre-commit-config.yaml | 缺失 |
| gate.registry | 哨位 | — | 首轮采集后建立 | 缺失 |
| ratchet.lines | 哨位 | — | 无 ratchet 门/基线文件 | 缺失 |
| evals.wired | 哨位 | — | npm run evals 在场但未接线为门（agent 复核） | 缺失 |

CI：无｜hooks：无｜evals：npm run evals

## 2. 实跑红绿（退出码显式读取，超时/不确定归红）
- `npm test` → exit=0（8s）

## 3. 六维评分
| 维度 | 得分 | 满分 | 依据 |
| --- | --- | --- | --- |
| 阻断强制性 | 0.5 | 30 | 最高保护档=manual |
| 覆盖广度 | 10 | 20 | 测试链+4，结构一致性+3，生成物漂移+3 |
| 分层反馈 | 3 | 15 | 单一全量链+3 |
| 有效性证据 | 7 | 20 | 逐门实跑退出码+3，证据带文件出处+3，BLOCKED/stale 语义可用+1 |
| AI 门禁 | 2 | 15 | eval 命令在场未接线+2（advisory 以下） |
| 持续演进 | 0 | 10 | 无命中 |
| **总分** | **22.5** | **110** | 档位=纸面（由保护结构决定，不看总分） |

## 4. 历史对比
首测无基线——下一轮起此处显示与上次差值。

## 5. 缺口清单（=移交单）
### G0 P0｜无 run 标准（run.toml 缺失）——门禁没有注册真源
- 可组装：否｜归属：aes-standardize-repo
- 处置：建议链路：先走 aes-standardize-repo 登记既有命令，再由 aes-gate 组装补门禁；未注册门禁仍会被扫描记录、标「未注册」
### G1 P0｜无 CI 阻断，红代码可直进默认分支
- 可组装：是（模式 aggregate-check）｜归属：aes-gate:assemble
- 处置：组装模式=aggregate-check（required checks + branch protection 为硬前提）
### G2 P1｜无注册为独立门的结构守卫（目录/约定无机器断言的门）
- 可组装：是（模式 structure-guard）｜归属：aes-gate:assemble
- 处置：链内检查不能替代门禁可见性；组装模式=structure-guard
### G3 P2｜无棘轮（指标无只许收紧机制）
- 可组装：是（模式 ratchet）｜归属：aes-gate:assemble
- 处置：组装模式=ratchet（基线+泄压阀：豁免须记录、只许缩小）
### G4 P2｜无 AI/eval 门禁（eval 命令在场但未接线为门）
- 可组装：否｜归属：gate-builder（出界）
- 处置：归通用 gate-builder，不在本技能组装范围

## 6. 约定级检查与局限
- conv.mjs-zero-dep：仓库脚本一律 .mjs（Node 内置模块、零依赖），不新增 PowerShell 脚本（AGENTS.md）（机器断言：无，不计分）
- conv.dev-side-truth：.agents/skills/ 是开发侧平铺活跃真源；skills/ 是跨平台分类发布树；生成物不得手改（AGENTS.md）（机器断言：无，不计分）
- conv.issue-tracker：Issue 走 GitHub Issues（parkth1026/parking-agents），用 gh CLI 操作（AGENTS.md）（机器断言：无，不计分）

> 局限声明：低分≠有风险，分数是体检参考不是 KPI（防 Goodhart）；branch protection 离线不可核实，ci-protected 以 `.aes-gate/protection.json` 人工登记为准；语义缺口由 agent 复核补充、须带证据。

---

## 语义复核（agent 补充，机械规则之外；每条带证据）

1. **G2 的语义面强化**：机械规则只判「run.toml 无注册的结构守卫门」。语义证据：npm test 七连中的 `check:repo`（package.json scripts.check:repo → `check-skill-repo.mjs --skills skills/engineering|productivity|pub` 三列）只断言**发布树** `skills/`；开发侧 `.agents/skills/` 的两条硬约定——「脚本一律 .mjs 零依赖」「发布树生成物不得手改」——只活在 AGENTS.md 文字里（本报告第 6 节 conv.* 全部 machineEnforced=false），无任何机器断言。链内检查不能替代门禁可见性：G2 成立且证据充分。
2. **G0 与 G1 的关系**：无 run.toml（G0）使全部验证面只存在于 package.json scripts 与 npm test 链中，门不可枚举、不可被 CI 逐门引用——这是 G1（无 CI）之外更根本的注册层缺口，处置链路=先 aes-standardize-repo 再组装，二者不可互换顺序。
3. **红门=0 的解读边界**：npm test 实跑 exit=0（18s）只证明「本地手动链当前绿」，保护级别 manual（0.5/30）——任何人可跳过不跑，与「有门」之间隔着一层保护结构（weights.md 档位规则）。

## 验收对照（#42 五 AC）

| AC | 结果 | 证据 |
| --- | --- | --- |
| AC-1 目录结构完整 | ✓ | SKILL.md + references/{weights,pattern-library,api,design}.md + scripts/collect.mjs（.mjs 零依赖，vendor TOML 随源 MIT 留 LICENSE）+ assets/board.template.html + run-tests.mjs + fixtures/；quick-validate PASS |
| AC-2 缺口清单非二值 | ✓ | 本报告第 5 节：5 条缺口逐条带 P 级/owner/可组装性/模式/处置，无「完整/不完整」判定 |
| AC-3 run.toml 注册真源 | ✓ | G0 置顶（缺 run 标准）；npm test 标「未注册」（source=scan）；registry gates[].runAction 引用 action id 而非复制定义 |
| AC-4 缺口清单非空且可辩护 | ✓ | 第 5 节 5 条 + 语义复核 3 条，逐条有文件/命令/退出码证据 |
| AC-5 parking-skill-creator 校验 | ✓ | quick-validate PASS；run-tests.mjs 24 项全绿；collect --self-test 24 项全绿；npm test 七连不破坏（提交前复跑） |
