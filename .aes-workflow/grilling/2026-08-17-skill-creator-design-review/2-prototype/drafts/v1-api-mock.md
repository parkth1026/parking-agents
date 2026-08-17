<!-- draft v1 | published 2026-08-17T17:35:00+08:00
     用户意见：(待质疑)
     状态：draft -->

# 接口报文对: 2026-08-17-skill-creator-design-review

## 1. history.json（新数据契约，落地纸面 schema）

**位置**：`<技能目录>/history.json`，随 .skill 包分发。**写入方**：aggregate-benchmark.mjs（带 --history 时）。**只追加不覆盖**：每轮评测追加一条 run 记录，历史可审计。

### 成功（第二轮聚合，与上轮可比）

```json
{
  "skill": "feishu-doc-qa",
  "runs": [
    {
      "date": "2026-08-17T14:00:00+08:00",
      "iteration_ref": "C:/x/.claude/skill-workspaces/feishu-doc-qa-workspace/iteration-1",
      "gates": {
        "with_skill":     { "pass_rate": 1.00, "mean_ms": 137000, "mean_tokens": 48213 },
        "without_skill":  { "pass_rate": 0.50, "mean_ms": 155000, "mean_tokens": 62000 }
      },
      "vs_previous": null
    },
    {
      "date": "2026-08-17T18:00:00+08:00",
      "iteration_ref": "C:/x/.claude/skill-workspaces/feishu-doc-qa-workspace/iteration-2",
      "gates": {
        "with_skill":     { "pass_rate": 1.00, "mean_ms": 121000, "mean_tokens": 44100 },
        "old_skill":      { "pass_rate": 0.67, "mean_ms": 139000, "mean_tokens": 51800 },
        "without_skill":  { "pass_rate": 0.50, "mean_ms": 158000, "mean_tokens": 63500 }
      },
      "vs_previous": { "evals_total": 3, "won": 2, "lost": 0, "tie": 1,
        "detail": [ { "eval": "eval-贴URL直问", "result": "tie" },
                    { "eval": "eval-例会最新一期", "result": "won" },
                    { "eval": "eval-周报关键词问答", "result": "won" } ] },
      "current_best": true
    }
  ],
  "current_best": "runs[1]"
}
```

### 成功（首次聚合，无上轮）

`vs_previous: null`；`runs` 仅一条；`current_best` 指向该条。（见 B9）

### 业务失败（--history 指向的目录不是技能目录/不可写）

```
拒绝：--history 目标不是可写目录: <路径>（本次不追加历史，聚合结果照常产出）
```
退出码 1（聚合本身已完成的写入不回滚——history 追加失败不得吞掉 benchmark 产出， stdout 明示两者状态）。

### 意外错误（history.json 存在但 JSON 损坏）

```
拒绝：history.json 解析失败: <err.message>——已备份为 history.json.corrupt-<ts> 后重建
```
损坏文件先备份再从本轮重建（丢历史但留证据），不静默覆盖。

### 已锁定的约定

- `runs` 只追加，任何字段不回改（Q6-C「只追加不覆盖、历史可审计」口径，Round1 定）
- `gates` 键 = 配置目录名（gate 名），开放集，不预设 with/without/old 之外的白名单（Q7 gate 可选制，Round1 定）
- `vs_previous` 按与上一 run **同 eval 名**精确匹配比逐 eval 胜负（pass 布尔翻转）；本轮新增 eval 计入 total 不计入 won/lost；上轮存在本轮缺席的 eval 在 detail 标 `dropped`（不静默消失）
- `current_best` 按 with_skill（或 runs 里首个 gate）pass_rate 严格更高才推进，平局不推进（防抖）

## 2. references/design.md（新文档契约，init 生成骨架）

```markdown
# design: demo-flow

## 意图与触发场景
[TODO: 为什么有这个技能;用户会说什么话、什么上下文触发;期望产出形态]

## 设计取舍
[TODO: 关键决定与自由度分级;每条一句话「为什么没选别的」]

## 验收条件
| 编号 | 条件 | 类型 |
| --- | --- | --- |
| AC-1 | [TODO: 可客观验证的一条] | manual/script |

## 迭代记录
| 日期 | 改了什么 | 轮次结果 | 拆分建议 |
| --- | --- | --- | --- |
```

### 已锁定的约定

- 四节固定，节名不改（Round2 默认区 D5 定；Q2-B 精简 + Q6-A 迭代记录调和）
- 验收条件**必须编号 AC-N**；eval_metadata.json 断言以可选字段 `ac: "AC-1"` 引用（追溯链）
- 随 .skill 包分发（Round1 确认区 C1，用户未翻）
- 迭代记录每轮**追加一行**，不回改历史行（与 history.json 同口径）

## 3. eval_metadata.json 断言的 ac 字段（增量）

改前：`{ "name": "表格覆盖全部日志文件", "type": "manual" }`
改后（带追溯）：`{ "name": "表格覆盖全部日志文件", "type": "manual", "ac": "AC-1" }`

约定：`ac` 可选、字符串、值必须是同技能 design.md 里存在的编号；viewer/评分器不因缺 ac 拒绝，缺 ac 时照常评（老技能零迁移）。
