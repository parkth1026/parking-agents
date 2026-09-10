<!-- draft v1 | published 2026-09-11
     用户意见：待质疑
     状态：superseded by v2（R3 总反思推翻机制版） -->

# 接口契约对照: 2026-09-11-local-mr-squash

技能的两个「报文」面：**输入契约** `.merge-policy.toml`（用户写给技能的规则）与**输出契约**台账 record（技能写给未来的档案）。均为文本文件，无运行时 API。

---

## 一、输入契约：`.merge-policy.toml`（被管仓根目录，入库）

### 成功形态——AntAgent_v2 首版实样

```toml
# local-mr-squash per-repo 规则契约（规则主权面：改这里=改流程，不动技能）
schema_version = 1

[validation]
# 五步第 4 步自动检查：全部退出码 0 才许进 COMMITTED；空/缺节 = 拒跑
commands = [
  "./run check",
  "./run lint",
  "./run test.frontend",
  "cargo test -p ant-core -p ant-download -p ant-resource --quiet",
  "cargo test --manifest-path src-tauri/Cargo.toml --quiet",
]

[tracker]
# 可选溯源增强（Q1 裁决）：{id} 占位替换 issue 号；失败静默降级 local-only
# 缺省整个 [tracker] 节 = 纯 local 数据源
enhance = "glab issue view {id} 2>/dev/null"

[ledger]
# 缺省即此值，可不写
path = ".git/merge-ledger"

[lifecycle]
# 分支 glob → 动作；按序首命中生效；未命中任何规则 = 停问用户
[[lifecycle.rules]]
pattern = "dev-*"        # 长命 worktree 流：前滚复用
action = "forward"

[[lifecycle.rules]]
pattern = "feature/*"    # 短命特性流：squash 后即删（行业主流）
action = "delete"
```

### 用法错形态（拒跑输出，终端）

```text
[local-mr-squash] 拒跑：policy 校验失败
  - [validation].commands 为空：五步第 4 步不可跳过，至少声明一条检查命令
  - 未知字段 "validaton"：疑似拼写错误（schema_version=1 仅接受 validation/tracker/ledger/lifecycle 四节）
已写入：无（零副作用）。修正 .merge-policy.toml 后重跑。
```

### 业务失败形态（无 policy）

```text
[local-mr-squash] 拒跑：本仓无 .merge-policy.toml
技能不猜测检查口径与生命周期规则（规则主权归你）。
落盘一份起点（已附样例全文），按仓实际情况改后重跑本指令。
```

---

## 二、输出契约：台账 record（`<ledger.path>/<id>-<source>-<date>.json` + `index.jsonl`）

### 成功形态 A——含冲突裁决（取材 09-08 真实合并 8d59c15 改写）

```json
{
  "id": 2,
  "state": "BOOKKEPT",
  "date": "2026-09-08",
  "source": {
    "branch": "dev-parking",
    "tip": "0b12cf5",
    "base": "<merge-base-sha>",
    "commits": ["<hash1>", "<hash2>"]
  },
  "target": { "branch": "dev", "before": "<sha>" },
  "commit": "8d59c15",
  "policy_version": "sha256:ab12cd34",
  "tracker_enhanced": true,
  "rulings": [
    {
      "file": "run.toml",
      "hunk": "@@ dev.desktop desc 区 @@",
      "ours_intent": "dev 侧 dev.desktop desc 已扩窗口标识段（ANT_DEV_WINDOW_TITLE 注入链）",
      "theirs_intent": "dev-parking 侧同一 desc 加 CLI sidecar 物化说明（#115）",
      "sources": ["git show <dev-side-sha>", "git show <parking-side-sha>", "glab issue view 115"],
      "ruling": "both",
      "tradeoff": "两段语义正交，拼接共存；无放弃方"
    },
    {
      "file": "scripts/dev-runner.mjs",
      "hunk": "@@ 启动旗标解析 @@",
      "ours_intent": "dev 侧维持旧旗标形态",
      "theirs_intent": "dev-parking 重构为动作注册表",
      "sources": ["git log --oneline dev..dev-parking -- scripts/dev-runner.mjs"],
      "ruling": "theirs",
      "tradeoff": "脚本行为随功能分支，dev 侧后补事实全保留（解法先例，后续同型冲突沿用）"
    }
  ],
  "checks": [
    { "command": "./run check", "verdict": "PASS" },
    { "command": "./run test.frontend", "verdict": "PASS" }
  ],
  "lifecycle": {
    "matched_rule": "dev-* → forward",
    "action": "git branch -f dev-parking 8d59c15",
    "done": true
  }
}
```

### 成功形态 B——零冲突快速通道（取材 09-10 真实合并 8722165 改写）

```json
{
  "id": 3,
  "state": "BOOKKEPT",
  "date": "2026-09-10",
  "source": {
    "branch": "dev-parking",
    "tip": "2c32cc4",
    "base": "dddc750",
    "commits": ["36fb27e", "9ef2e70", "d9c5c6c", "6f4eaa6", "2c32cc4"]
  },
  "target": { "branch": "dev", "before": "c1b7209" },
  "commit": "8722165",
  "policy_version": "sha256:ab12cd34",
  "tracker_enhanced": true,
  "rulings": [],
  "checks": [
    { "command": "./run check", "verdict": "PASS" },
    { "command": "./run test.frontend", "verdict": "PASS" },
    { "command": "./run test.e2e.cdp", "verdict": "PASS", "note": "调用方 hold 点插话指定的重验收" }
  ],
  "lifecycle": {
    "matched_rule": "dev-* → forward",
    "action": "git -C <dev-parking-worktree> merge dev（彼处被检出，tip 未前进，树干净）",
    "done": true
  }
}
```

### 意外错误形态（fail closed，state 停在事发态）

```json
{
  "id": 4,
  "state": "CHECKED",
  "fail": {
    "reason": "source_tip_drift",
    "detail": "台账记录 tip=2c32cc4，实际 tip=9a8b7c6（流程中源分支又前进）",
    "hint": "确认新提交去留后重跑；本 record 保留为断点"
  }
}
```

### `index.jsonl`（每笔一行，机器可查的注册表）

```jsonl
{"id":2,"date":"2026-09-08","source":"dev-parking","target":"dev","commit":"8d59c15","state":"BOOKKEPT","rulings":2}
{"id":3,"date":"2026-09-10","source":"dev-parking","target":"dev","commit":"8722165","state":"BOOKKEPT","rulings":0}
```

---

## 已锁定的约定（字段级裁决 + 出处）

| 约定 | 内容 | 出处 |
| --- | --- | --- |
| policy 必存在且 validation.commands 非空 | 无 policy/空检查 = 拒跑，零副作用 | Q3 裁决（无 policy 拒跑）+ 五步第 4 步不可跳 |
| `[tracker]` 整节可缺省 | 缺省=纯 local；声明即增强，失败静默降级并记 `tracker_enhanced:false` | Q1 裁决（local 优先+可选增强） |
| `rulings` 只在有冲突时非空 | 零冲突不强制语义审阅，rulings=[] | Q2 裁决（按五步技能表达范围） |
| 每条 ruling 六字段必全 | file/hunk/ours_intent/theirs_intent/sources/ruling+tradeoff | Q4 裁决（冲突裁决逐条入台账） |
| 台账在 `.git/merge-ledger/`（policy 可改路径） | 永不入库、git 不可见 | R2 翻案（台账不入库） |
| `policy_version` = 合并时 policy 文件内容 hash | 规则改版后旧 record 仍可解释「当时跑的哪版规则」 | steelman 裁决（规则版本戳） |
| checks 含 hold 点插话指定的命令 | 重验收不内嵌但发生即留痕（note 标注来源） | R2 裁决（管线不内嵌、调用方主权） |
| lifecycle 未命中规则必停问 | 不猜删还是前滚 | R1 默认区（生命周期 policy 条目） |
| ruling ∈ {both, ours, theirs} + tradeoff 必填 | 三值闭集；不相容必记放弃方与理由 | 五步第 3 步（note the trade-off） |
