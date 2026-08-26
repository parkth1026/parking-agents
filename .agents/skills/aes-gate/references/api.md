# 接口与数据契约（api）

> 两层：**人可读回传**（markdown，aes-qa 调用时）与**机器数据标准**（`gate-registry.json`，看板与工具消费）。
> 注册真源在 `run.toml`（run/v1 标准），registry 只存运行时事实——不复制命令定义，门 id 引用 run action id。
> 设计定稿对照物：`.aes-workflow/grilling/2026-08-24-aes-gate/2-prototype/api-mock.md`（确认版·锁定）。

## 一、gate-registry.json（数据标准，v1 schema）

落点：`<repo>/.aes-gate/gate-registry.json`（collect.mjs 原子重写，history 追加保留）。schema 自校验：
写前校验（`validateRegistry`）、写后重读再校验，坏数据不落地。

```json
{
  "version": 1,
  "project": "parkth1026/parking-agents",
  "collectedAt": "2026-08-25T12:40:00.000Z",
  "gates": [
    {
      "id": "test",
      "runAction": "test",
      "source": "run.toml",
      "kind": "gate",
      "command": ["npm", "test"],
      "evidence": "run.toml [[actions]] id=test",
      "status": "green",
      "protection": "manual",
      "lastRun": { "at": "…", "exitCode": 0, "durationMs": 40123 },
      "note": ""
    }
  ],
  "conventions": [
    { "id": "conv.mjs-zero-dep", "text": "脚本一律 .mjs 零依赖（AGENTS.md）", "machineEnforced": false }
  ],
  "gaps": [
    { "id": "G1", "risk": "P0", "owner": "aes-gate:assemble", "assemblable": true, "pattern": "aggregate-check", "linkedRunAction": null, "what": "…", "advice": "…" }
  ],
  "score": { "total": 22.5, "tier": "paper", "dims": { "blocking": 0.5, "coverage": 10, "layering": 3, "evidence": 7, "ai": 2, "evolution": 0 } },
  "history": [
    { "at": "…", "total": 22.5, "tier": "paper", "gateCount": 7, "gapCount": 5 }
  ]
}
```

**锁定约定**（与 api-mock 逐条对齐）：

- `gates[].id` = run.toml action id（注册真源，不复制 argv）；扫描门（npm test 等未注册链）`source: "scan"`、id 形如 `local.npm-test`；哨位门（期待在场的门位）`source: "sentinel"`。
- `status` 枚举 `green | red | missing | stale`：**超时/不确定归 red**；**与运行态矛盾归 stale** 待人审（机械面=注册还在但命令实体消失 ENOENT、CI 引用的 action id 不在 run.toml）。
- `protection` 枚举 `none | manual | ci | ci-protected`；`ci-protected` 只认 `.aes-gate/protection.json` 人工登记（branch protection 离线不可核实）。
- `conventions` 为约定级（无机器断言，不计分）；来源=`.aes-gate/conventions.json`（agent 按 SKILL.md 流程维护，collect 只读）。
- `gaps[].pattern` 只取最小集四件（aggregate-check / structure-guard / ratchet / eval-wiring），其余归出界。
- `history[]` 追加式保留历次总分/档位/门数/缺口数快照——无生态基线，历史序列即自我基线；报告必须对比最近一次并明示首测。

## 二、aes-qa 调用回传（markdown，三结局）

调用方式：`node .agents/skills/aes-gate/scripts/collect.mjs --handoff [--repo <路径>]`——跑检测（含逐门红绿）但**不落盘任何文件**，stdout 出 markdown。`--handoff --json` 组合出 registry JSON（机器可读）。

### 结局 1：正常

```markdown
## gate 盘点表
| 门 id | 类型 | 命令/位置 | 证据 | 状态 |
| --- | --- | --- | --- | --- |
| test | run.toml·gate | `npm test` | run.toml [[actions]] id=test | 绿（exit=0，绿实跑 40s） |
| ci.required | 哨位 | — | CI 配置不存在（.github/workflows 等） | 缺失 |

## 评分：22.5/110 · 纸面（首测无历史基线）
## 红门置顶：无红门
## 缺口清单（=移交单）：…
- **G1 P0** 无 CI 阻断…｜可组装·aggregate-check｜归属：aes-gate:assemble
```

### 结局 2：空缺口

表头 `## 缺口清单（=移交单）：（空——表头仍在，证明扫过）` 必须出现——空清单≠没扫。

### 结局 3：异常（BLOCKED）

目标不可读/非 git 仓：退出码 2，stderr 一行 `[aes-gate] BLOCKED：<原因>——不产出半份报告`，stdout 无表格。宁缺半份不造假半份。

## 三、单条沉淀的输入对话（轻路径接口）

用户：「把刚才这个问题记成 gate」→ 技能追问**判例**（什么生产变更会让它红；可证伪、有先例）→
产出四件：固化脚本 `scripts/gate/<name>.mjs`（正反样例 selftest，`--self-test` 退出码 0）→ run.toml 注册
（追加 `[[actions]]`，id 进动词域如 `gate.check-ps1-bom`，**只追加不改既有条目**）→ registry 行（跑一次采集即有）
→ 看板刷新。判例答不出 → 只进 `conventions`（`.aes-gate/conventions.json` 追加一条，明示「非机器门」），
判例补齐后可升级。

## 四、退出码契约（collect.mjs）

| 码 | 含义 |
| --- | --- |
| 0 | 检测完成（红门不改退出码——红门进报告置顶；这是与「门自身退出码」的分层） |
| 1 | 内部错误 / registry schema 校验失败（不写盘） |
| 2 | BLOCKED：目标不可读、非 git 仓 |
| 64 | 用法错误（`--help` 出用法） |

门自身的红绿=门命令的退出码，由 registry `lastRun.exitCode` 显式承载（`echo $?`/spawnSync status 语义；管道与后台包装不吃码）。
