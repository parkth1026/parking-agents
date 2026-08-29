# 知识文件格式（v2）

## 设计目标：唯一性与机器可验证

RAW 知识文件的唯一使命是被将来检索到且**绝不认错对象**。v2 的每份文件携带三重身份锚
（服务器地址 + 完整 job 路径 + 构建号），文件名、frontmatter、跟踪账本键三方互验，
由 `jenkins-log-auto-learning/scripts/validate-raw.mjs` 机械验收——不合规文件在
`stage done` 门禁即被拒绝，进不了知识库。

## 机械门禁（session.mjs 收尾时强制）

写完知识文件后以 `stage done --knowledge <路径>` 交出时，session.mjs 依次校验，
不满足即拒绝收尾（exit 1，按报错修文件后重新收尾，不算流程失败）：

1. 文件必须真实存在且位于 `{knowledgeBase.rawDir}` 内（details/ 或 scratch/）
2. 必须有一级标题（`# {ErrorCode}: {简述}`）
3. 内容必须包含结论串里的错误码 token（score 型 = ErrorCode，infra 型 = reason）
4. **v2 新增**：文件名符合命名语法、frontmatter 完整且与文件名一致（见下）

独立验收随时可跑：`node <orchestrator>/scripts/validate-raw.mjs`（扫 rawDir 全部知识文件）。

## 文件命名（v2）

格式：`{jobCode}-{failBuild}[-{failEnd}]-{ErrorCode}-{ShortDesc}.md`

- `jobCode`：**唯一合法来源是编排器技能 config.json 的 `jobCodes` 注册表**
  （aes6 / twe-inst / twe-linux / twe / wdp5-rt / wdp5-linux / wdp5-plug）。
  一个码只对应一个 Jenkins jobPath——这是防串台的第一道墙。缺码即 die 引导补注册表，绝不猜。
  **历史前缀（autoci- / aes6-runtime- / twe-ue55-linux-）一律废弃**，不得再用于新文件。
- `failBuild`（及连续组的 `failEnd`）：FAILURE 构建号是主标识符，不用自增序号。
- `ErrorCode`：与结论串 `failure:score={N}:{ErrorCode}:...` 中的 token 完全一致；
  字符集 `[A-Za-z][A-Za-z0-9_]*`，不得含 `:` `#` 和连字符（连字符是文件名段分隔符，
  含它会导致机器解析歧义，复合词用下划线：`UHT_TArraySpecifier`）。
- **token 铸造纪律（防词表漂移，逐条执行）**：
  1. 日志中有规范错误码（`C\d+` / `CS\d+` / `LNK\d+` / `MSB\d+` 等）→ 原样使用，如 `C2061`、`LNK1120`；
  2. 无规范码的工具/流水线错误 → 从错误主句铸造 PascalCase 语义标签（如 `MissingPlugin`），
     且正文 Error Message 节必须保留错误原句（保证按原句 grep 也能命中）；
  3. **铸造前必须先在 rawDir 与 wikiDir 全文 grep 错误签名**（错误原句的关键片段），
     已有同签名知识文件则**复用其现有 token**，绝不另铸同义词——宁可复用不完美的
     旧词也不裂变词表。可用 `node <orchestrator>/scripts/validate-raw.mjs --list-codes`
     查看在用 token 清单。
- `ShortDesc`：小写字母/数字/连字符，简短且可读。

示例：
- `twe-inst-898-903-LNK1120-TiffJpegUnresolved.md`（连续失败组 #898~#903）
- `aes6-3746-CookFail-UassetVersionTooNew.md`
- `twe-linux-114-DiskSpaceExhausted-agent-disk-full.md`（infra 型，ErrorCode = reason，四段齐全）

`recurrence-` 前缀专属 wikiDir 重复模式文件（见下文），除此不得使用任何其他前缀。

## frontmatter（v2 必需，紧跟文件起始）

扁平 `key: value` 标量（无嵌套无列表，便于无依赖解析）：

```yaml
---
schema: raw-knowledge/2
base_url: http://10.66.12.40
job: twe-ue5.5-installed
job_code: twe-inst
job_path: job/wdp-ue/job/Earth/job/twe-ue5.5-installed
fail_builds: 898-903
fix_build: 904
error_code: LNK1120
score: 8
result: failure:score=8:LNK1120:fix=#904
primary_fix_commit: 3f2a1c9
recorded_at: 2026-08-16T15:04:00
---
```

字段规则：
- `schema` 恒为 `raw-knowledge/2`
- `base_url` + `job_path` + 构建号 = 三重身份锚，必须与领取该对的 session status 输出一致
- `job_code` 必须等于 jobCodes 注册表中 `job` 对应的码
- `fail_builds`：单值 `3784` 或区间 `898-903`（连续组），与文件名一致
- `error_code` 与文件名、result 串三处一致；infra 型填 reason
- `result`：完整结论串（含 `:see=` 时也要写全）
- `primary_fix_commit`：主修复提交短 SHA（多提交时正文 Fix 节列全，此处只放主提交）
- `recorded_at`：本地时间 `YYYY-MM-DDTHH:mm:ss`

## 文件位置

- 评分 >= 8 → `{knowledgeBase.rawDir}/details/{filename}`
- 评分 5-7 → `{knowledgeBase.rawDir}/scratch/{filename}`
- 评分 < 5 → 不写入（仅在跟踪中记录）

## `## Warning Trend` 节（新文件必填）

`recorded_at` ≥ 生效时刻（**2026-08-17T01:30**，规则原子落地的提交时刻）的知识文件，
正文**必须**包含 `## Warning Trend` 节（节名固定；它是正文节，不是 frontmatter 字段）。
`validate-raw.mjs` 机械校验：生效后的文件缺该节即 ERROR，生效前的存量文件放行（向后兼容）。

```markdown
## Warning Trend

| Build | Warnings |
|-------|----------|
| #328 (fail) | 41 |
| #330 (fix)  | 12 |
趋势：改善（-29）。
```

- 内容下限：fail 构建与 fix 构建各自的警告计数 + 趋势一句话（改善/恶化/持平，带差值）。
- **必填节只收录计数**，是独立验证信号，**不进 10 分总分**；何时展开分析（增幅 >30%
  写集中文件、降幅 >50% 记正面趋势）由 analyze.md「SUCCESS 构建警告检查」的条件式规则
  决定——必填与条件式并存不矛盾。
- **details/ 档（≥8）趋势恶化（fix 警告数 > fail）必须在节内附解释段，否则降 `scratch/`**。

## 写入前检查已有文件

在 `{knowledgeBase.wikiDir}/details/` 和 `{rawDir}/details/`（以及它们的 `scratch/` 对应目录）中搜索包含相同构建号或错误模式的文件。如果在 rawDir 中找到，更新现有文件而不是创建新文件。如果在 wikiDir 中找到，按重复模式处理（见下文）——绝不直接修改 wikiDir 文件。

## 重复出现的错误模式

如果你发现一个已有的知识文件（在 wikiDir 或 rawDir 中）具有**相同的错误代码和相同的根因**：

1. **不要创建新的占位文件**仅说"参见其他文件"
2. 如果已有文件在 **rawDir** 中：直接在该文件中追加 `## Recurrences` 章节（如果已存在则更新）：
   ```markdown
   ## Recurrences
   | Date | Builds | Trigger | Notes |
   |------|--------|---------|-------|
   | 2026-04-09 | #3877 → #3878 | WBP_DomManager.uasset saved with UE5.4 | Same root cause, different asset file |
   ```
   如果已有文件在 **wikiDir** 中（只读）：在 `{rawDir}/details/` 中创建新文件 `recurrence-{existingFileName}`，frontmatter 照常填写（job/builds/error_code 以**本轮实际分析的对**为准），正文包含 Recurrences 表格和指向 wikiDir 原始文件的引用。绝不修改 wikiDir 文件。
3. 在跟踪中记录新构建为 `"failure:score={N}:{ErrorCode}:fix=#{successBuild}:see={existingFile}"` —— `:see=` 后缀告诉读者哪个知识文件涵盖了此问题

**强制落账纪律**：命中重复模式（同错误码 + 同根因）时，`:see=` 指针与 Recurrences 追加
是**必做动作**，不是可选项——第 2 步与第 3 步必须都发生。session.mjs 的机械门禁只能兜底
「:see= 指向的文件必须存在」，落不落 :see= 本身靠本纪律：知道是重复却不落指针 = 效用反馈
归零，权重校准永远没有数据起点。
4. 对重复模式跳过 Epic 查询——原始文件已包含此错误类型的 Epic 指导

## details/ 的必需内容（评分 >= 8）

知识库的全部意义在于帮助将来遇到相同错误的人。frontmatter 之后是正文，章节模板：

```markdown
# {ErrorCode}: {Brief description}

(frontmatter 之后的第一行；H1 必须含 ErrorCode token)

## Error Message
(paste the actual error lines from the log — 1 to 5 lines)

## Root Cause
(what went wrong and why — not "possibly" or "may have", give a definite analysis)

## Fix
(the concrete code change that fixed it, based on the commit)
- **Commit**: {hash} by {author}
- **Message**: "{commit message}"
- **What changed**: (describe the specific code change)

## How to Reproduce / Detect
(how would someone know they have this same problem;给出 grep 关键词)

## Epic Official Guidance
(response from Epic's UE5 AI assistant — provides the engine-level explanation)
- **Query**: "{the question sent to Epic}"
- **Answer**: (paste the key parts of Epic's response — focus on the explanation, not boilerplate)
- **References**: (list any official Epic doc/learning links returned)

If the Epic query failed or returned no useful information, write: "Epic query unavailable — analysis based on project context only."

## Prevention
(how to avoid this in future — 1-3 bullet points)

## Warning Trend
(recorded_at ≥ 生效时刻的新文件必填：fail/fix 构建警告计数 + 趋势一句话，见上节规范)

## Group Context（可选，节名固定：同对其它失败模式）

连续失败组内若含多种失败模式（主错误之外还有 Cook 失败 / infra 故障等），一律用本节
记录，不再自创节名：每种子模式给出构建号、日志签名（原句）、归因强度（强 / 引 / infra）。
正文其余章节只写主错误；若整组只有一种模式则省略本节。
```

如果你无法有信心地确定根因，请明确说明——但仍需提供错误详情和提交信息。

## scratch/ 的内容（评分 5-7）

可以使用更简短的正文，但 frontmatter 与 H1 要求与 details/ 完全相同，且必须包含：错误消息、构建号以及任何可用的部分分析。

## 编码

所有知识文件 UTF-8 无 BOM，行尾 LF 或 CRLF 均可（验收脚本两种都收）。
