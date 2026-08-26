# Fact: Session 证据与发布完整度

- 派遣问题：评估“用完整历史 session 进化技能”目前能读到什么、缺什么，以及 repo/发布树已经保存了哪些证据。
- 完成：2026-08-25T08:02:33Z

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| `cwd=G:/GIT/AI_WorkFlow/parking-agents` 的 2026 历史索引可发现 55 个 session ID、105 个 JSONL 文件；最新根 session 是 `01a03540-...`，由两个分片组成。 | `C:/Users/parking/.codex/sessions/2026/**/rollout-*.jsonl` 的 `session_meta.cwd/session_id` |
| 最新根 session 可逐行解析，记录 root 用户/assistant、工具调用、工具输出、compaction、turn abort 和 task complete；Goal 在 `2026-08-25T05:50:38Z` 完成，之后同一 chat 又继续做 usage 统计。Goal complete 不等于 chat 文件立即封存。 | 最新根两个 JSONL；runtime `registry.json.goal` |
| `create_thread` 的 worker/reviewer 各有独立 session；根日志里的 `wait_threads/read_thread` 只是返回快照，可能受 `turnLimit/maxOutputCharsPerItem` 截断。内部 `subAgentActivity` 不一定有独立顶层 rollout 文件。因此“根 session 完整”不能推出“分布式全轨迹完整”。 | 根 JSONL 中 `codex_app__create_thread/read_thread/wait_threads` 输出；子 session `01a03720-...` 等 |
| `C:/Users/parking/.codex/sessions` 与 `E:/Users/parking/.codex/sessions` 对抽样文件给出同长度/同 SHA-256，是同一数据的双路径/镜像，不能算两份独立备份。 | 两路径文件 hash 抽样结果 |
| 精确名称 `codex_start_thread` 未在目标仓和目标历史中成为文件/技能/工具；实际宿主操作是 `create_thread`，raw telemetry 名称为 `codex_app__create_thread`。 | 目标仓与目标 session 精确字符串检索；`SKILL.md:3,8,85-110` |
| repo 内已有一份 2026-08-24 复盘，显式引用 raw rollout 作为原始证据；但最新 2026-08-25 五小时 Goal 的完整问题轨迹、14 个新 Task、usage 汇总尚未形成受版本控制的复盘/语料 manifest。 | `G:/GIT/AI_WorkFlow/parking-agents/docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md:36,707`；最新 root session |
| memories/rollout summaries 在调查时没有 `01a03540-...` 的最新摘要；memory 是派生索引，不是 raw transcript 替代品。 | `C:/Users/parking/.codex/memories/MEMORY.md` 与 `rollout_summaries/` 精确 session-id 检索 |
| 当前唯一专用统计脚本位于被忽略的 runtime，硬编码 repo、session 日期和 E 路径，只读 token_count；它没有存储稳定 manifest、hash、转录、问题标签或回归场景。 | `G:/GIT/AI_WorkFlow/parking-agents/.aes-worktree-board/runtime/summarize-worker-usage.mjs`；`.gitignore:20` |
| 仓库有完整离线 Issue fixture、host-shaped orchestration selftests 和一般 eval 研究文档，但没有 raw Codex session → 脱敏 trajectory/problem fixture 的转换脚本。 | `.agents/skills/aes-worktree-board/fixtures/`、`scripts/selftest.mjs`、`docs/eval-gates-best-practices.md:98-148`；全仓文件/内容检索 |
| `aes-worktree-board` 仍是 `.agents/skills/` 开发真源；frontmatter 没有 `category`，`skills/engineering|productivity|pub/` 没有发布副本，评测五件套只有 run-tests。 | `SKILL.md:1-4`；`docs/agents/skill-release.md:3-42`；技能目录清单 |

## 未知项

- Codex session 的保留/轮转期限、是否允许把完整 raw 对话复制进 Git、敏感字段分类和删除权，仓库没有政策。
- 用户所说“全部记录”是要 raw 原文可回放，还是只要可审计索引 + 脱敏问题切片 + eval fixture；两者成本和隐私风险完全不同。
- 正式发布的目标宿主范围（只 Codex，还是分类发布树支持的全部 harness）尚未确认。

## 没查的

- 没有把 230MB 级 session 数据复制进访谈目录；只保留路径、计数和证据引用。
- 没有尝试恢复内部 subagent 的私有推理；只把可见消息、工具轨迹和输出视为可审计证据。
