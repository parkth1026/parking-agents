<!-- draft v2 | published 2026-08-25
     用户意见：registry JSON 定为机器数据标准、技能间回传维持 markdown；补 run.toml 引用关系
     状态：draft -->

# 接口与数据契约: 2026-08-24-aes-gate

两层：**人可读回传**（markdown，aes-qa 调用时）与**机器数据标准**（`gate-registry.json`，看板与工具消费）。注册真源在 `run.toml`，registry 只存运行时事实。

## 一、gate-registry.json（数据标准，v1 schema）

```json
{
  "version": 1,
  "project": "parkth1026/parking-agents",
  "collectedAt": "2026-08-25T12:40:00+08:00",
  "gates": [
    {
      "id": "test",
      "runAction": "test",
      "source": "run.toml",
      "kind": "local",
      "command": "npm test",
      "evidence": "run.toml [[actions]] / package.json:13",
      "status": "green",
      "protection": "manual",
      "lastRun": { "at": "2026-08-25T12:40:00+08:00", "exitCode": 0 },
      "note": "七连约 10 个断言点"
    },
    {
      "id": "gate.check-ps1-bom",
      "runAction": "gate.check-ps1-bom",
      "source": "run.toml",
      "kind": "local",
      "command": "node scripts/gate/check-ps1-bom.mjs",
      "evidence": "run.toml [[actions]] kind=gate",
      "status": "missing",
      "protection": "none",
      "lastRun": null,
      "note": "单条沉淀示例行"
    }
  ],
  "conventions": [
    { "id": "conv.mjs-zero-dep", "text": "脚本一律 .mjs 零依赖（AGENTS.md）", "machineEnforced": false }
  ],
  "gaps": [
    { "id": "G1", "risk": "P0", "owner": "aes-gate:assemble", "assemblable": true, "pattern": "aggregate-check", "linkedRunAction": null },
    { "id": "G4", "risk": "P2", "owner": "gate-builder(出界)", "assemblable": false, "pattern": null, "linkedRunAction": null }
  ],
  "score": { "total": 18.5, "tier": "paper", "dims": { "blocking": 0.5, "coverage": 9, "layering": 3, "evidence": 6, "ai": 0, "evolution": 0 } }
}
```

**已锁定约定**：`gates[].id` = run.toml action id（注册真源，不复制 argv）；`status` 枚举 `green | red | missing | stale`（超时/不确定归 `red`；与运行态矛盾归 `stale` 待人审）；`protection` 枚举 `none | manual | ci | ci-protected`；`conventions` 为约定级（无机器断言，不计分）；`gaps[].pattern` 只取最小集四件，其余归出界。缺 run.toml 时 `gates` 可含 `source: "scan"` 的未注册行（扫描发现、标「未注册」）。

## 二、aes-qa 调用回传（markdown，三结局）

### 结局 1：正常（示例=本仓 2026-08-25 实测）

```markdown
## gate 盘点表
| 门 id | 类型 | 命令/位置 | 证据 | 状态 |
| --- | --- | --- | --- | --- |
| test | run.toml·本地 | `npm test` | run.toml [[actions]] | 绿（exit=0，12:40 实跑） |
| ci.required | CI | — | .github/workflows 缺 | 缺失 |
| hooks.pre-commit | 本地钩子 | — | .git/hooks 实查 | 缺失 |

## 评分：18.5/110 · 纸面门禁
## 红门置顶：无红门
## 缺口清单（=移交单）：G1 P0 无 CI 可组装｜G2 P1 无结构守卫 可组装｜G3 P2 无棘轮 可组装｜G4 P2 无 AI 门禁 出界
```

### 结局 2：空缺口（表头必须出现，证明扫过）

### 结局 3：异常（BLOCKED：目标不可读/非 git 仓——不产出表格，宁缺半份不造假半份）

## 三、单条沉淀的输入对话（轻路径接口）

用户：「把刚才这个问题记成 gate」→ 技能追问**判例**（什么生产变更会让它红）→ 产出四件：固化脚本（或约定级标记）、run.toml 注册条目、registry 行、看板刷新。判例答不出 → 只进 `conventions`，明示「非机器门」。
