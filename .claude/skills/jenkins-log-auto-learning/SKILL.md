---
name: jenkins-log-auto-learning
description: |
  批量扫描 Jenkins CI 任务，寻找 FAILURE→SUCCESS 构建对，提取错误模式，
  通过 git 提交验证修复，并生成带评分的知识文件。

  **在以下场景使用此技能：**
  (1) 批量扫描或从 Jenkins 日志自动学习
  (2) 检查知识库进度、剩余未分析构建或跟踪状态
  (3) 查找 FAILURE→SUCCESS 构建对或构建知识库

  **不适用于单次构建诊断** —— 请使用 `ue-error-solver`。
---

# Jenkins 日志自动学习技能 v6.0（编排器）

在 Jenkins 中寻找 FAILURE→SUCCESS 构建对，提取错误模式和修复方法，写入知识文件。

本技能是**编排器**：它决定处理哪个构建对、卡住时退回哪里、什么时候向用户报告，
**自己不产出任何分析文件**。每个阶段的产物长什么样，写在产出它的那个执行者那里。

## 配置

配置分两层（深合并，环境层覆盖技能层）：

1. **技能固有默认** `config.json`（与 SKILL.md 同目录，随仓库版本化）：本技能当前无固有项。
2. **环境层** `~/.config/parking-agents/jenkins-log-auto-learning.json`（一域一文件：文件名即归属，工具中立位置，不进任何仓库）：`jenkins.baseUrl`、`gitRepos`、`tmpDir`、`trackFile`、`jobs[]`、`knowledgeBase.{rawDir,wikiDir}` 的真实值都在这里（本机指向 NAS 知识库 `//nas.51vr.local/x.public/UE5/ue-llm-wiki/`）。解析链：`$SKILL_ENV`（目录；指向文件则该文件即本域配置）> 该路径 > 旧单文件 `skill-env.json`（`~/.config/parking-agents/` 与 `~/.claude/`，整文件即本技能配置，兼容回退）；技能固有默认可用 `--config` 参数指定。

若合并后缺必要字段，脚本会报错并停止；不要用临时值硬编码。schema 示例见 `config.example.json`，详见 [references/config.md](references/config.md)。

## 阶段表

| 阶段 | 执行者 | 交出什么 |
|------|--------|----------|
| 0 取对 | 编排器自身（`session.mjs status/next`，需要时先跑 `scan-pairs.mjs`） | workflow.json 中被领取的构建对 |
| 1 分析 | 子技能 `../jenkins-pair-analyze`（相对本技能目录解析） | 知识文件（details/scratch）或终态结论（`stage 1-analyze done --result ...`） |
| 2 记账 | `session.mjs finish` | analyzed{} 与 runHistory 落账 |
| 3 报告 | 编排器 | 用户摘要 |

每次用户调用此技能，只处理**一个**构建对，处理完成后停止；如需处理更多，用户需再次调用（节奏控制，定时任务驱动）。

## 怎么流转

1. **status 入口**：`node {skill-dir}/scripts/session.mjs status` —— 有进行中的会话就从它的 `next:` 指针续跑，不从头再来。
2. **没有会话则取对**：`session.mjs next`。它从 pending-pairs.json 领取第一个未分析的对并原子写入 workflow.json。
   - pending-pairs.json 不存在、超过 1 小时（status 会提示）、或领取时报告没有新对 → 先跑 `node {skill-dir}/scripts/scan-pairs.mjs` 再 `next`。
   - 扫描后仍无可用构建对 → 向用户报告"所有启用任务中未找到 FAILURE→SUCCESS 构建对"并停止。
   - `next` 拒绝执行（已有进行中的会话）= 单实例锁生效：按 status 的续跑指针继续，确认僵死后 `session.mjs abandon --reason "..."`。
3. **进入子技能**：分析工作交给 `../jenkins-pair-analyze`——进入该技能并按其 SKILL.md 执行。给它的上下文就是 `session.mjs status` 的输出（当前对 + 生效配置），不需要转抄。
4. **子技能收尾后记账**：子技能以 `stage 1-analyze done|skipped|error` 写回门禁；编排器读一次 status，若 1-analyze 已收尾则跑 `session.mjs finish` 把结论落账 analyzed{} 与 runHistory。
5. **报告后停止**（阶段 3）：向用户简要总结——本轮结论与评分、知识文件路径、剩余待分析对数、遇到的问题。不自动领取下一对。

### 门禁

- 1-analyze 的门禁不是 done/skipped/error 时，不得跑 `finish`——手上没有结论就落账是在猜。
- 中断（用户中断、上下文耗尽）不需要善后：workflow.json 里留着断点，下次调用从 `status` 直接接上。
- **Agent 不得用 Edit/Write 直接改 workflow.json 与 {trackFile}**——二者唯一写入者是 session.mjs。

### 回退

子技能报 `error`（日志下载或 API 调用失败）时，它的 `--reason` 已随结论落账为 `failure:error:{reason}`。编排器 `finish` 后在阶段 3 报告里点名原因，然后停止；用户再次调用即领取下一对。**不要让子技能就地把失败糊过去**——error 是正常终态，不是流程失败。

## 跟踪账本

`{trackFile}`（analyzed-builds.json）是长期账本，与 `ue-error-solver` 技能共享，其结构、状态值 grammar（`failure:score=...` / `success:w=...` / `skip:...`）见 [references/tracking.md](references/tracking.md)。本技能只经 session.mjs 写入。

## 参考文件

| 主题 | 文件 |
|------|------|
| 配置与环境 | [references/config.md](references/config.md) |
| 阶段 0 扫描与领取 | [references/phase0-scan.md](references/phase0-scan.md) |
| 跟踪账本结构 | [references/tracking.md](references/tracking.md) |
| 阶段 1 分析方法论 | `../jenkins-pair-analyze/SKILL.md` |
| RAW 知识文件 v2 验收 | `scripts/validate-raw.mjs` 与 `../jenkins-pair-analyze/references/knowledge-format.md` |

## 核心约束

1. **每次调用处理一个构建对**：处理完成或出错后停止，用户再次调用处理下一个
2. **单实例**：由 `session.mjs next` 的领取锁机械保证——已有进行中的会话时拒绝领取，不得绕过
3. **只写 rawDir**：绝不修改 wikiDir。评分公式与落点：≥8 → `details/`；5-7 → `scratch/`；<5 → 仅跟踪（详见子技能 references/scoring.md）
4. **知识文件 v2 验收**：文件名用 `{jobCode}-{fail}[-{end}]-{ErrorCode}-{ShortDesc}.md`（jobCode 唯一合法来源是本技能 config.json 的 `jobCodes` 注册表，防三任务串台）；文件头必须有 frontmatter（base_url + job_path + 构建号三重身份锚）。`scripts/validate-raw.mjs` 随时可独立全库验收，`stage done` 门禁逐文件强制
5. **配置驱动**：所有路径和 URL 来自合并后的配置（`config.json` + `skill-env.json`），不硬编码
6. **技能目录零写入**：所有运行时产物（pending-pairs.json、workflow.json、下载日志、知识文件）只写入配置指定的 rawDir/tmpDir，两个技能目录保持纯静态文件
7. **UTF-8 without BOM**：所有输出文件
