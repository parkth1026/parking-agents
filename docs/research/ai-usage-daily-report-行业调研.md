# 「每日 AI 用量总览报告」行业调研

- 调研日期：2026-08-23
- 需求原点：参考 `G:\GIT\AI_WorkFlow_ref\t3code`（pingdotgg/t3code）的 Usage 页能力，想做一个**每人每天可跑一次**的功能，输出总览报告：当天通过 AI（Claude Code / Codex）做了多少任务、Token 怎么消耗的。
- 调研方法：4 路并行（Claude Code 用量工具生态 / Codex 与多提供商聚合器 / 每日任务报告角度 / 本地数据源与积木），GitHub 页面 + 官方文档 + 本机文件实测交叉验证；星数与活跃度为 2026-08-23 查询值。

---

## 0. TL;DR

1. **「数字层」已是红海**：本地 JSONL 解析 → 日/周/月 token 与成本聚合，已被 ccusage（18.1k★，16 个 CLI）、CodexBar（20.5k★，66 家 provider）、tokscale（5.1k★，50+ 客户端）等充分解决，且全部免费开源。**不要从零造这一层**。
2. **「叙事层」刚刚萌芽**：tokscale 的 `report`（LLM 逐会话起标题 → 聚成任务簇 → 带 token/成本）是全场与需求重合度最高的实现，已验证支持 `--today`，但没有定时调度、没有投递、不是"每人每天一份"的形态。
3. **核心空位 = 「任务级每日个人报告」**：全生态没有任何工具做到「跨 Claude Code + Codex、按日、任务叙事 + 双口径成本（API 等价 / 订阅额度）、定时或一键生成、可推送给个人」。最接近的三个碎片：tokscale report（叙事，无日更投递）、caut `cost`（Claude+Codex 按天成本表，无叙事）、PatentLLM 博客系统（cron 日报形态，但无仓库、不含 Codex）。
4. **技术路径已验证**（本机实测）：直接解析 `~/.claude/projects/**/*.jsonl` 与 `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` 是最便宜稳健的数据路径；两家的陷阱清单（去重 2.4x 虚增、fork 重放、cache 计费语义、时区）都已被 ccusage/t3code 踩平并有公开解法。
5. **一个必须想清楚的口径问题**：订阅制（Claude Max/Pro、Codex Pro/Plus）下，LiteLLM 单价算出的美元是"API 等价成本"不是真实扣费。Codex 的 rollout 里直接带 `rate_limits.used_percent`（周窗口真实额度），Claude 侧本地无权威数字——报告必须双口径标注，否则会误导读者。

---

## 1. 参考对象：t3code 的 Usage 实现（灵感来源）

`apps/server/src/usage/`（共 ~2200 行 TS）：

| 模块 | 做什么 |
|---|---|
| `usageTranscripts.ts` | 纯解析器：Claude 取 `type=assistant` 行的 `message.usage`；Codex 用 `CodexScanState` 状态机处理 `token_count` 事件（model 从 `turn_context` 续航，fork 副本用 1 秒间隔阈值抑制） |
| `dedupeKey` | Claude 按 `messageId:requestId` 去重（注释明言：不去重会 **~2.4x 虚增**） |
| `usagePricing.ts` | 内置价格表算"API 等价成本"；文档明确"订阅计费与这里的原始 token 成本是两回事" |
| 展示 | 24h 小时图 / 7/30/90 天日粒度；成本与 token 双开关；按 provider / model 分解 |

定位是 **Electron App 内的实时仪表盘**——这正好框定了我们与它的差异：t3code 是"看数字的仪表盘"，用户要的是"回顾一天做了什么的报告"。

---

## 2. 生态全景

### 2.1 第一梯队（事实标准 / 高星头部）

| 工具 | 星数 | 形态 | 覆盖 | 与本需求的关系 |
|---|---|---|---|---|
| [CodexBar](https://github.com/steipete/CodexBar) | ~20.5k | macOS 菜单栏 + CLI + 小组件 | 66 家 provider；复用本机 OAuth/cookie/本地文件，不用 OTEL | 实时限额/成本监控标杆；无日报、macOS 专属（有社区 Win/Linux 移植） |
| [ccusage](https://github.com/ccusage/ccusage) | ~18.1k | CLI 表格 + `--json` | 16 个 agent CLI（Claude/Codex/Gemini/Copilot CLI/OpenCode…） | **数字层事实标准**；`daily --last 1` = 今天；5h block、`--instances` 按项目、`--by-agent`；已转 Rust monorepo，npm 包只是二进制分发，**无 markdown 输出、无叙事、无调度** |
| [ccstatusline](https://github.com/sirmalloc/ccstatusline) | ~12.5k | 终端 statusline | Claude Code 为主 | 常驻显示（session cost、5h block、周用量分桶），非回顾报告 |
| [Claude-Code-Usage-Monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor) | ~8.7k | Python Rich 实时 TUI | Claude Code | burn rate、ML 推断个人限额、`--once` + JSON/CSV；官方 `rate_limits` 作 ground truth 的思路值得借鉴 |
| [tokscale](https://github.com/junhoyeo/tokscale) | ~5.1k | Rust CLI + TUI + web | 50+ 客户端（**含 ZCode**） | **与本需求重合度最高**，见 2.4 |
| [opcode（原 claudia）](https://github.com/getAsterisk/claudia) | ~22.4k | Tauri 桌面 GUI | 仅 Claude Code | Usage Analytics 仪表盘，对照项 |

### 2.2 Codex 专用

| 工具 | 说明 |
|---|---|
| [Dimillian/CodexMonitor](https://github.com/Dimillian/CodexMonitor)（4.2k★） | Tauri App；侧栏 usage/credits 来自 app-server 协议的 `account_rate_limits`——少见的直接消费官方配额接口 |
| [CasperKristiansson/codex-usage-tracker](https://github.com/CasperKristiansson/codex-usage-tracker) | rollout JSONL → SQLite 增量导入，daily/weekly/monthly web 仪表盘 |
| Codex 原生 | TUI `/status`；**v0.140.0 起有 `/usage daily / weekly / cumulative`**；网页版 `chatgpt.com/codex/settings/usage` 看 credits；config.toml `[otel]` 块支持 OTLP 导出 |

### 2.3 多提供商聚合器

| 工具 | 覆盖 | 日视图 | 备注 |
|---|---|---|---|
| ccusage | 16 CLI | ✅ | 事实标准；Codex 源标注 experimental（`token_count` 2025-09 起才有、大文件 bug #952） |
| CodexBar / [caut](https://github.com/Dicklesworthstone/coding_agent_usage_tracker)（CodexBar 的跨平台 Rust CLI 化，80★） | 66 家 / 16 家 | ✅（本地 7/30 天估算；`caut cost` 按天列 Claude+Codex） | `caut cost` 是"个人按天成本表"的现成雏形，含 JSON/Markdown robot mode |
| [tokscale](https://github.com/junhoyeo/tokscale) | 50+ | ✅ | Cursor/Trae/Warp 走云端 usage API，其余走本地文件 |
| [openusage](https://github.com/robinebers/openusage)（3.9k★） | 10 家 | Today/Yesterday 卡片 | macOS 菜单栏；本地 HTTP API |
| [VibeUsage](https://github.com/victorGPT/vibeusage) | Codex/Claude/OpenCode/Gemini/OpenClaw | ✅ | `npx` 初始化 + 可分享 web dashboard |
| [TokenTracker](https://github.com/xiufengsun/TokenTracker)（1.4k★） | 34 工具 | ✅（30 分钟桶） | hooks + 被动读文件双机制入 SQLite；声明"绝不读 prompt 内容" |

### 2.4 「任务叙事 / 人读报告」角度（与本需求最直接相关）

| 工具 | 产出 | 摘要方式 | 日/定投 |
|---|---|---|---|
| **tokscale `report`** | 任务簇报告："Tokscale Development — 19 sessions, 4.2B tokens, $22.66" | 两段 LLM：逐会话标题/分类/复杂度 → 聚簇；后端 apple-fm（本机）/claude/codex/gemini…，结果缓存 SQLite；`--no-summarize` 可纯本地 | `--today/--yesterday/--week` ✅；**无定时、无邮件/IM 投递**（调度器只用于往排行榜 submit） |
| [caut `cost`](https://github.com/Dicklesworthstone/coding_agent_usage_tracker) | Claude+Codex 按天成本表 | 无叙事 | 手动 |
| [cc-week-report](https://github.com/awayings/cc-week-report)（中文，0★） | **周报**：12 项流畅度指标 + 每项目 2-3 句自然语言总结 | 读本地 usage-data + LLM | 周期是周、终端输出、无推送 |
| [cchubber](https://github.com/azkhh/cchubber) | 单页 HTML 诊断："效率从 3/17 起降了 3.2x"、CLAUDE.md 每节花了多少钱、8 条省钱建议 | 启发式 + 自然语言模板 | 一次性诊断，非日更 |
| [maleta/claude-sessions](https://github.com/maleta/claude-sessions) | 每项目 `SESSION_SUMMARIES.md`（标题/摘要/分支/状态） | Stop/SessionEnd hook 调 Haiku（`claude -p` 走订阅） | 无日程；仅 Claude Code |
| [cc-wrapped](https://github.com/numman-ali/cc-wrapped) / tokscale `wrapped` | Spotify Wrapped 式年度 PNG 卡 | 统计 + 卡片渲染 | 年度 |
| Claude Code 内置 `/recap` | 单会话内简短回顾（上限 400 字符） | 官方 | **非跨会话日报** |
| Claude Code **Routines**（官方 research preview） | 云端定时 Agent 可发 Slack | 官方 | 跑在云端对 repo 工作，**读不到本地用量文件** |
| PatentLLM 博客系统（无仓库，UNVERIFIED） | cron 每日 04:00：Claude+Gemini 统计 → LLM 摘要 → SQLite | gemini-flash | **形态上就是本需求**，但不含 Codex、代码不可得 |

### 2.5 官方原生能力（一个人的"日耗"现在能看到什么）

| 提供商 | 能力 | 缺口 |
|---|---|---|
| Claude Code | `/usage`（会话成本 + Pro/Max 24h/7d 进度条 + 按 skill/subagent/MCP 归因）；`/insights`（行为模式 HTML）；OTEL（`claude_code.token.usage` / `cost.usage` / `active_time`，默认带 `session.id + user.email`） | 全部是**会话内/实时**视角；claude.ai usage 页只有限额条；OTEL 只覆盖开启之后的用量且需常驻 collector |
| Codex CLI | `/status`；v0.140+ `/usage daily`；chatgpt.com/codex usage 页（credits） | TUI 内查看，无报表导出 |
| Gemini CLI | `/stats` + 内置 OTEL + GCP 预置面板 | — |
| Cursor / Copilot / Anthropic Admin API / OpenAI Usage API | 团队/账单视角（Copilot 有按天按人 metrics API） | **只覆盖各自一家**；Anthropic/OpenAI admin API 不含订阅消耗 |

### 2.6 查证后不存在/与传闻不符的名字

`amm`（steipete 名下无此仓库，他的项目是 CodexBar 与已归档的 VibeMeter）、`yuemori/gemini-cli-usage`（404）、`cc-hours`、`openclaudedb`、`claude-code-usage-webui`——均未找到；`ccdu` 实为 `~/.claude` 磁盘清理工具而非用量工具。

---

## 3. 数据源与机制（本机实测，Windows）

### 3.1 两家本地文件

| | Claude Code | Codex CLI |
|---|---|---|
| 路径 | `~/.claude/projects/<项目编码目录>/<session-uuid>.jsonl`（+ `subagents/agent-*.jsonl`，`isSidechain:true`，**独立计费的真实用量**） | `~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl`（**目录名=本地日期，内容 timestamp=UTC**，分组必须换时区）+ `archived_sessions/`（双计陷阱） |
| 本机规模 | 561 文件 / 351 MB（近 2 天仅 35 个） | 2656 文件 / **2.9 GB**（近 2 天仅 22 个——**按日期目录直取即可跳过全量扫描**） |
| 用量事件 | `type=assistant` 行的 `message.usage`：`input_tokens / cache_read / cache_creation / output`（+ 新 `iterations[]` schema，顶层已聚合） | `event_msg.payload.type=token_count` 的 `info.last_token_usage`（per-request delta；`total_token_usage` 为会话累计，**实测 sum(last)==尾值 total**）；`rate_limits.primary.used_percent / resets_at`（**周窗口真实额度，直接可读**）、`plan_type:"pro"` |
| 模型归属 | `message.model` | `turn_context.payload.model`（续航状态机） |
| costUSD | **JSONL 里没有**（只有 OTEL 事件里有 `cost_usd`） | rollout 不报成本 |

本机特殊性：Claude Code 走多供应商代理（modelUsage 里出现 glm-4.7/deepseek/kimi），模型名会非标准，定价表需要 fallback；`~/.zcode/`（ZCode）与 `~/.copilot/` 存在但不写 Claude 式 transcript。

### 3.2 陷阱清单（ccusage/t3code 已公开解法）

1. **重复 usage 行**：Claude 每个 content block 一行、共享 `(message.id, requestId)` —— 本机实测 673 行 / 307 唯一 = **2.19x 虚增**（社区最高 ~4x）。解法：`hash(message.id, requestId)` 去重 + message.id-only 回退（sidechain 用新 requestId 重放父消息）。
2. **fork/子代理重放**：Codex fork 把父历史重打时间戳写入新文件（ccusage issues #22593/#21025）。解法：头部 rewritten-burst 跳过 + `replayed_prefix` 显式携带已计数量；t3code 用 1 秒间隔阈值。
3. **cache/reasoning 计费语义**：Claude cache_read ~0.1x、cache_creation ~1.25x；Codex `cached_input ⊆ input`、`reasoning ⊆ output`，**切勿再加一遍**。
4. **订阅 vs API 成本**：LiteLLM 单价算出的是等价成本；Codex 直接展示 `rate_limits`；Claude 侧需标注估算。
5. **时区**：两家 timestamp 均 UTC，Codex 目录名却是本地日期；需要 `--timezone` 语义的统一分组。
6. **5h block / 周窗口**：Claude 5h 滚动窗（block 起点=floor_to_hour(首条)，gap>5h 切块）；Codex 周窗 `resets_at`。

### 3.3 可复用积木

- **定价**：LiteLLM `model_prices_and_context_window.json`（MIT，~1.7MB，ccusage 同款）+ models.dev/api.json 备选。
- **ccusage 作对拍基准**：`npx ccusage@latest daily --json`（Codex 源 experimental），适合开发期校验自研解析器，不宜作运行时依赖（Rust 二进制分发）。
- **现成 transcript 解析库基本没有**（`@ccusage/core` npm 404；官方 SDK 不是解析器）——自写逐行 JSON 解析器是最可靠路径，格式简单。
- **OTEL 不作主路径**：需常驻 collector、只覆盖开启后的用量；但若未来做**团队级按人聚合**，Claude Code OTEL 指标自带 `user.email + session.id`，是唯一现成的多人数据通道。

---

## 4. Gap 分析：七项能力矩阵

| 能力 | ccusage | CodexBar | tokscale | caut | cc-week-report | t3code | 官方(/usage、Routines) |
|---|---|---|---|---|---|---|---|
| 读 Claude+Codex 本地数据 | ✅ | ✅ | ✅ | ✅ | ❌(Claude) | ✅ | — |
| 按日 token/成本聚合 | ✅ | ✅ | ✅ | ✅ | 周 | ✅ | 部分 |
| 每会话任务叙事（LLM） | ❌ | ❌ | ✅ | ❌ | ✅(项目级) | ❌ | /recap(单会话) |
| 跨会话聚成"今天做了哪几件事" | ❌ | ❌ | ⚠️(手动 report --today) | ❌ | ⚠️(周) | ❌ | ❌ |
| 每日一键/定时生成 | ❌ | ❌ | ❌(仅排行榜 submit 有调度) | ❌ | ❌ | ❌ | Routines(云端，读不到本地) |
| 投递到个人（markdown/邮件/IM） | ❌(仅 JSON) | ❌ | ❌ | ⚠️(robot mode) | ❌ | ❌ | ❌ |
| 双口径成本（API 等价 + 订阅额度） | ⚠️ | ✅(抓官方面板) | ⚠️ | ✅ | ❌ | ❌(单一等价) | ⚠️ |

**结论：右下三角（定时/投递/任务级日更/双口径）整体空白。** 需求验证信号充分：Wrapped 类叙事、cchubber 诊断、cc-week-report、tokscale report 的存在证明"人读总结"有真实需求，但没人做成"每人每天一份"的低频例行报告。

---

## 5. 对我们的启示（建议形态）

**差异化定位**：不做仪表盘（红海），做**低频、任务级、双口径的每日个人报告**——"今天我通过 AI 做了哪些事、花了多少（等价 API 成本 + 订阅额度）、钱花在哪类任务上"。

**建议架构**（与 parking-agents 约定一致：零依赖 `.mjs`）：

```
数据层   逐行流式解析 ~/.claude/projects/**.jsonl + ~/.codex/sessions/<当日>/**.jsonl
         （字节预过滤 + mtime 预筛 + (message.id, requestId) 去重 + fork 抑制）
聚合层   按日/项目/会话/模型 → token 五元组 + LiteLLM 等价成本 + Codex rate_limits 真实额度
叙事层   可选 LLM：逐会话标题 → 聚任务簇（tokscale 两段式已验证该管线可行；--no-summarize 纯本地降级）
输出层   单文件 Markdown 日报（人读 + 可粘贴）→ 落 docs/reports/<名称>-<日期>/
```

**MVP 切分**：
1. **v1（纯本地，无 LLM）**：数字层 + 会话/项目清单（用首条用户 prompt 或 git 分支当"任务名"代理）→ 已优于 ccusage 的纯表格。
2. **v2**：LLM 叙事层（opt-in，注意 transcripts 含代码的隐私边界）。
3. **v3**：定时（Windows 任务计划/cron）+ Lark 投递（本仓库已有 lark-* 技能族）。

**主要风险**：① Claude 订阅额度无本地权威数字（只能等价估算 + 引导看 claude.ai）；② Codex rollout schema 仍在演进（ccusage 标 experimental）；③ 本机模型名非标准（代理多供应商）→ 定价 fallback 必须有。

---

## 6. 附：本调研的 UNVERIFIED 项

- PatentLLM 日报系统的源码可得性；cc-session-stats 的 GitHub 仓库（仅 npm）；Obsidian "Token Usage" 插件仓库地址。
- ccusage `blocks --live` 标志细节（README 仅写 "active block monitoring"）。
- `@openai/codex-sdk` 是否直接吐 tokenCount 事件。
- 各工具星数为调研时点快照，会漂移。
