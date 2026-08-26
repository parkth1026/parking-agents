---
name: aes-gate
description: 熟悉行业惯例的门禁建设者：盘点项目门禁基建（测试命令/CI 检查/checks 脚本/evals 基线）、逐门实跑定红绿、六维评分并产出缺口清单（不做完整/不完整二值判定）。当用户说「把这个问题记成 gate」「给仓库做个门禁体检」「组装 CI/结构守卫/棘轮」，或 aes-qa 开测前需要 gate 盘点与缺口移交单时使用。
---

# aes-gate：门禁建设者

一次检测回答三个问题：这个仓**有哪些门**（注册的+扫描的）、门**红还是绿**（实跑、退出码显式读取）、**缺哪些门**（缺口清单=移交单，完整性不可判定、永不二值）。

铁律：run.toml 是 gate 唯一注册真源（门 id=action id，registry/看板/报告不复制命令定义）；退出码显式读取、超时/不确定归红；无调查不生成；任何生成物未经用户确认不落地。

## 路径一：单条沉淀（主路径·高频）

开发中踩坑后用户说「把刚才这个问题记成 gate」：

1. **追问判例**：什么生产变更会让这个 gate 红？判例须可证伪、有先例。**答不出 → 只记约定级**（追加进 `<repo>/.aes-gate/conventions.json`，`{"id","text","machineEnforced":false}`），明示「非机器门」，判例补齐后可升级——不伪装成机器门。
2. **固化脚本**：`<repo>/scripts/gate/<name>.mjs`（零依赖），带 `--self-test`（正反样例：植入违规必须检出）。正反样例自检通过才继续。
3. **注册**：run.toml 追加 `[[actions]]`——`kind="gate"`，id 进动词域（如 `gate.check-ps1-bom`）；**只追加，不改既有条目**。
4. **刷新**：跑 `node .agents/skills/aes-gate/scripts/collect.mjs` → registry 记一行、看板即时刷新。
5. 提示保护级别：当前若是 manual，告知「要真阻断走组装（路径三）」。

## 路径二：批量检测（显式 `/aes-gate`，默认当前仓）

```bash
node .agents/skills/aes-gate/scripts/collect.mjs [--repo <路径>] [--timeout <秒>]
```

collect 做完机械面（读 run.toml+补扫 CI/hooks/本地链+逐门实跑+六维评分+缺口+落盘 `.aes-gate/` 三件：report-<ts>.md / gate-registry.json / board.html）。**你（agent）在跑完后做两件机械做不到的事**：

- **语义复核**：机械缺口规则见 api.md；复核时可补充语义缺口（如「check:repo 只守发布树、开发侧结构约定无断言」），**每条必须带证据**（文件/命令/退出码）。
- **约定整理**：若 `.aes-gate/conventions.json` 不存在，从 AGENTS.md 整理既有约定写入（首次盘点一次即可）。

报告读法：六节（盘点/实跑红绿/评分/历史对比/缺口/约定与局限）；**红门置顶**——红着的门=没有门。评分规则与依据读 `references/weights.md`（低分≠有风险，档位由保护结构决定、不看总分）。

边界处置（collect 已内建，无需你补）：无 run.toml → G0 置顶、建议先走 aes-standardize-repo，未注册门（npm test 等）仍扫描记录、标「未注册」；门超时 → 红；注册还在但命令实体没了 → stale「疑似过时」待人审；目标不可读/非 git 仓 → BLOCKED 退出码 2、不产出半份报告。

## 路径三：组装（低频·对话触发·硬前提）

用户说「组装 G1–G3」时（**永不自动进入**；组装产物永不在 aes-qa 调用路径内落地）：

1. 读 `references/pattern-library.md` 选模式（aggregate-check / structure-guard / ratchet / eval-wiring 出界）。
2. **分诊三问**：底座（GitHub Actions / 仅注册 / hooks）？阻断强度（advisory→evidence→gating）？用户不答 → 报告记 BLOCKED，**不自动选**。
3. 生成草稿（不触碰仓库）：每件两行头注释（抄的哪个模式+为本仓适配了什么）+ selftest。
4. selftest 全绿（逐件退出码 0）→ 展示全部将写入文件的 diff → **确认门**（用户确认才写）。
5. **硬前提**：G1（聚合 check）的完成判据=required checks+branch protection 接通；只建 workflow 不开保护=本轮结论「**未完成（纸面）**」，不降级为提示。账号级操作（开 Actions/protection）生成步骤给用户执行；完成后登记 `.aes-gate/protection.json`（`{"verified":true,...}`），复跑检测应见 `ci-protected`。

写入范围（强约束）：仅限 `scripts/gate/`、`run.toml`、分诊选定的 CI/hooks 文件、`.aes-gate/` 运行产物——其余一律不动。

## 路径四：被 aes-qa 调用（精简回传）

```bash
node .agents/skills/aes-gate/scripts/collect.mjs --handoff [--repo <路径>]   # stdout 出 markdown
```

跑检测（含红绿）但**不落盘任何文件**；回传=盘点表+评分+红门置顶+缺口清单（结构见 `references/api.md` 二、三结局）。aes-qa 侧把缺口并入报告移交单、gate 结果计入基线层证据，不被组装打断。

## 看板

`.aes-gate/board.html`：collect 从 `assets/board.template.html` 渲染，零 JS、零外链、断网可开；registry 是唯一数据真源，页面只投影不推导状态。单条沉淀后跑一次 collect 即时刷新。

## 四态出口（门状态词汇，锁定）

| 状态 | 含义 | 判定 |
| --- | --- | --- |
| green 绿 | 本轮实跑 exit=0 | 退出码显式读取（spawnSync status / `echo $?`） |
| red 红 | exit≠0、超时、启动失败 | **超时/不确定一律归红**，不无限等待 |
| missing 缺失 | 哨位门（CI/hooks/registry/棘轮/evals）不在场 | 补扫证据 |
| stale 疑似过时 | 注册还在、运行态实体没了（命令 ENOENT/CI 引用缺失） | 运行态证据为准，**待人审归位**，不自动改注册 |

## 参考文件

- `references/weights.md` — 六维权重 30/20/15/20/15/10 与三档（硬门禁/部分/纸面）的依据
- `references/pattern-library.md` — 最小集四模式页（出处/适用条件/代价/反例）+两范例四机制
- `references/api.md` — gate-registry v1 schema、aes-qa 回传三结局、轻路径接口、退出码契约
- `references/design.md` — 意图、设计取舍与验收条件（AC-1…AC-5）
- `scripts/collect.mjs` — 采集与检测入口（`--self-test` 正反样例自测）
- `assets/board.template.html` — 看板投影模板

## 测试

技能自带回归测试，每次升级、改动后必跑：

```bash
node .agents/skills/aes-gate/run-tests.mjs
```
