# 评测模型、强度与成本控制

模型与 `reasoning effort (推理强度)` 是评测 harness (执行环境) 的一部分。Creator 随包携带 `eval-profiles.json`，新机器默认解析 `economy`，不要求用户配置；每轮把结果写成 `eval-profile.resolved.json`。任何解析失败都停止，不静默继承高级模型。

## 推荐策略

默认 profile 等价于：

```json
{
  "execution": { "model": "<低成本模型>", "effort": "low" },
  "trigger": { "model": "<低成本模型>", "effort": "low" },
  "grader": { "model": "<平衡模型>", "effort": "medium" }
}
```

- 同一 eval 的 `with_skill`、`old_skill`、`without_skill` 必须使用完全相同的 host/model/effort；否则 delta 同时包含模型差异，不能归因给 skill。
- 回归轮用 `economy`；需要复现当前用户模型时显式用 `representative`；`strict` 必须给目标模型，不自动选择昂贵模型。
- grader 可以比执行臂高一档，但 grader 配置不参与执行臂 delta；固定同一 grader profile 才能跨轮比较。
- 先限制并发，再限制每个 run 的 turns/budget；并发只缩短墙钟时间，不降低总 token。

## Codex Desktop / CLI

### Desktop 原生通道（首选）

Codex Desktop 的 `spawn_agent` 可在每次调用直接传 `model` 与 `reasoning_effort`。因此无需像 zcode 那样预建 agent 文件，也无需重启宿主。每个 eval × gate 都用同一组参数：

```text
spawn_agent(task=..., model=<model>, reasoning_effort=<effort>)
```

模型必须从当前宿主公开的可用列表选择，不硬编码历史快照。完成通知仍用于记录 timing/token；run 目录另写 `run-meta.json`，记录请求的 host/model/effort。请求值是编排证据，不等于 provider-side attestation (服务端证明)；模型不可用时必须失败，不得静默 fallback。

### Codex CLI fallback

需要完全独立、可批量重放的进程时：

```powershell
node scripts/run-headless-eval-arm.mjs --host codex --model gpt-5.6-luna --effort low `
  --prompt-file <prompt.txt> --run-dir <run-dir>
```

launcher 使用 `codex exec --ephemeral --model ... --config model_reasoning_effort=...`。Codex CLI 0.151.0 本机 `--help` 已确认这两个入口；实际模型可用性由当前账号/组织策略决定，首轮先跑一个最小冒烟。

零配置解析：`economy` 的 execution/trigger/grader 均为 `gpt-5.6-luna` high。模型退役或账号不可用时失败关闭并给出显式 override，不回退 Sol。

## Claude Desktop / Claude Code

### 原生 Agent 通道（首选）

Claude Code 的 Agent 调用支持 per-invocation `model`，subagent 定义支持 `model` 与 `effort`。优先级中环境变量 `CLAUDE_CODE_SUBAGENT_MODEL` 高于逐次参数，因此起跑前检查它没有意外覆写本轮配置。适合两种做法：

1. 宿主允许 Agent 逐次传参时，直接为每个 run 传 model，并用 subagent frontmatter 固定 effort。
2. 需要可审计的固定 profile 时，用 `.claude/agents/<name>.md` 定义 model/effort；它比 zcode 更完整，但仍需要宿主发现该定义。

Claude 官方明确建议简单 subagent 使用 Haiku 降成本；具体 alias/full model ID 以当前组织 allowlist 为准。注意 blocked family alias 在部分版本/策略下可能替换或继承主模型，因此“进程成功”不等于“请求模型已被严格执行”，重要轮次应从事件/账单/宿主元数据核对 effective model (有效模型)。

### Claude CLI fallback

```powershell
node scripts/run-headless-eval-arm.mjs --host claude --model haiku --effort low `
  --prompt-file <prompt.txt> --run-dir <run-dir>
```

launcher 使用 `claude --print --model ... --effort ... --no-session-persistence`。若直接调用 CLI，还可在外层加 `--max-budget-usd`；当前通用 launcher 暂不代替用户设置美元预算，因为订阅、API key 与第三方 provider 的计费语义不同。

零配置解析：`economy` 的 execution/trigger/grader 均为 `sonnet` medium。alias 的有效版本由当前 provider 决定，因此正式比较同时记录 requested alias 与结果 JSON 的 canonical model。

## zcode 兼容通道

已有 `~/.zcode/agents/*.md` 的 model/thoughtLevel 做法继续可用，但只属于 zcode。headless 兼容通道要求环境提供 `ZCODE_API_KEY`，模型改由统一的 `--model` 参数传入并映射为子进程 `ZCODE_MODEL`。

## 可比性与记录门禁

每个 `run-meta.json` 至少记录：

```json
{
  "channel": "native|headless",
  "host": "codex|claude|zcode",
  "model_requested": "...",
  "effort_requested": "low",
  "host_version": "..."
}
```

- 同一 eval 各 gate 的 host/model/effort 不一致：该 eval 标 `INCOMPARABLE_HARNESS`，不计算 skill delta。
- 跨轮 profile 不一致：不进入 `vs_previous` won/lost；history 保留原始成绩但标 incomparable。
- 发生 fallback、alias substitution 或 effective model 无法核对：记录 `effective_model_status: unknown|substituted`，不得写成“指定模型已验证”。
- 证据等级分开：Claude `modelUsage.canonicalModel` 为 `provider_reported`；Codex runtime header 为 `host_reported`；未回显的 effort 保持 `requested_only`。
- 模型/强度相同但 prompt、tool pool、sandbox、skill 注入方式不同，也属于 harness 变化，同样断代。

## 2026-09-01 证据边界

- Codex Desktop 当前 Agent 工具契约可逐次传 model/reasoning_effort；Codex CLI 0.151.0 本机帮助与官方配置参考确认 `--model`、`model_reasoning_effort`。
- Claude Code 2.1.250 本机帮助确认 `--model`、`--effort`、`--max-budget-usd`、`--agents`；Claude 官方文档确认 subagent 的 per-invocation model、frontmatter model/effort 与优先级。
- 本轮只验证了 CLI 参数面和失败前置，不消耗真实模型 token 跑成功臂；各账号的模型 availability (可用性)、计费和并发上限仍需首轮冒烟确认。
