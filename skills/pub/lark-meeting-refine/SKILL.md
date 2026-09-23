---
name: lark-meeting-refine
description: 飞书会议双文档处理——完整下载（媒体本地化）保真转 markdown 镜像落 agent/evidence/，以逐字稿为唯一事实基准逐条核对智能纪要，产出保留纪要骨架、带时间戳与修正对照表的修正稿。
---

# lark-meeting-refine：飞书会议 → 本地镜像 + 修正稿

飞书智能纪要自带「AI 生成可能不准确」免责声明（9-17 实测：71 条要点中 25 条有问题——19 条无依据、6 条事实错误），不可直接采信。本 skill 端到端处理一场会议：**取数 → 媒体本地化 → 镜像三件套 → 逐条核对 → 修正稿**。

行为基准：`.aes-workflow/grilling/2026-09-18-feishu-minutes-refine/2-prototype/behavior.md`（8 变化行 + 6 边界值 + 不变清单）。修正稿形态 golden 样例：`agent/evidence/2026-09-17-WDP6-discussion-corrected-minutes.md`（**只读对照物，不可修改**）。

## 流程

### 第 1 步：机械流水线（脚本，behavior 变化行 1-6）

```bash
# cwd=仓库根；node + lark-cli（--as user 已认证）
node .agents/skills/lark-meeting-refine/scripts/run.mjs --meeting <会议ID或URL> --slug <YYYY-MM-DD-english-slug>
# 或已知双文档 token 时：
node .agents/skills/lark-meeting-refine/scripts/run.mjs --minutes <token> --transcript <token> --slug <...>
```

脚本产出并报告：

- `agent/evidence/<slug>-smart-minutes.md` / `<slug>-meeting-transcript.md` — 镜像（frontmatter：source/document_id/revision_id/fetched_at/media；正文：cite→@人名、grid 解包、readonly-block 丢弃、文字逐字忠实、媒体相对路径引用）。
- `agent/evidence/<slug>-assets/` — 图片 `<token>.png`、白板 `whiteboard-<token>.<ext>`（缩略图快照）。
- 降级（不阻塞）：媒体 403 时图片剥离仅告警、白板退回 token 标注。
- slug 命名沿系列约定 `YYYY-MM-DD-<英文slug>`；evidence 不可变——镜像已存在且正文有差异时脚本拒绝落盘（`--refresh` 才覆盖）。

异常介入点：认证失效 → 按 CLI 提示 re-auth 后重跑；会议无 note_id → 妙记备选路径（`minutes +detail`，见 lark-workflow-meeting-summary）；纪要含「说话人 N」→ 参会人节如实补未识别说话人，不猜身份。

### 第 2 步：逐条核对与修正稿（Agent 语义工作，behavior 变化行 7-8）

以**逐字稿为唯一事实基准**（智能纪要仅作对照索引，冲突以逐字稿为准并显式标注），对纪要正文每条要点做三分类，产出 `agent/evidence/<slug>-corrected-minutes.md`：

1. **逐条核对**：纪要每个要点在逐字稿检索依据（关键词 + 说话人 + 行号→最近时间戳映射），三分类：
   - **保留**：逐字稿有依据 → 保留原文骨架，补全精度时间戳（HH:MM:SS 或起止区间）；
   - **修正**：表述与口播不符（误写、归因错误、过度承诺）→ 改写并标注「修正」；
   - **删除**：逐字稿零命中（含整节臆造）→ 从正文删除，对照表注明「全文检索无命中」。
2. **四项编辑裁定（用户裁定口径，不可擅改）**：① 无依据即删；② 推论（非会上原话、由上下文推得）保留但显式标注「推论」；③ 修正稿全量补时间戳；④ 删除/修正决策全部进文末对照表。
3. **修正稿结构**（五节，`# 总结` 为标题锚定）：修正说明（blockquote 置顶：基准、核对范围、三分类统计）→ `# 总结`（保留原纪要骨架与节序；补「未决分歧」类内容见下）→ `# 未决分歧`（原稿把挂起/争议写成已定的一律移此，防搁置被误读为共识）→ `# 待办` → `# 修正对照表`（编号表格：# / 位置 / 原稿内容 / 问题 / 修正 / 逐字稿依据；每行至少一条全精度时间戳，零命中删除行写「全文检索无命中」）。frontmatter 含 `correction_stats`（原稿 N 条 → 保留 x / 修正 y / 删除 z）。
4. **质量门槛**（写完后自检）：修正稿出现的每个 HH:MM:SS 必须在逐字稿镜像中真实存在；对照表数据行数 ≤ 全稿不重复全精度时间戳数。
5. 结构与措辞参照 golden 样例（上文路径）；尾段与议题无关的闲聊不臆造为规则/结论，替换为一句说明 + 对照表记录。

### 第 3 步：一页纸摘要（决策导向浓缩层，2026-09-19 用户裁定新增）

```bash
node .agents/skills/lark-meeting-refine/scripts/exec-summary.mjs --slug <slug> --scaffold   # 机械抽取待办/未决分歧/统计
node .agents/skills/lark-meeting-refine/scripts/exec-summary.mjs --slug <slug> --verify     # 质量门
```

scaffold 生成 `agent/evidence/<slug>-executive-summary.md` 骨架（待决策标题+时间戳、待办、统计已机械抽取）；Agent 补两个语义节后跑 verify：

- **已定事项**：5–10 条决策级结论，每条一句话 + 时间戳；只用修正稿中已出现的时间戳。
- **关键数字**：3–6 条量化口径，每条带时间戳。
- 待决策每项补一句话现状（条数必须与修正稿未决分歧一一对应，不许丢项/加项）。

verify 门（全过才算完成）：①必备节齐全（已定事项/待决策/# 待办）；②全精度时间戳必须**同时存在于修正稿与逐字稿**（摘要只允许收录修正稿已核实的断言，不得引入新事实）；③待决策条数 === 修正稿未决分歧数、待办条数 === 修正稿待办 checkbox 数；④无 TODO 占位残留。

### 第 4 步：报告

交付时报告：镜像路径与 revision、媒体清单（含降级）、三分类统计、修正稿与一页纸摘要路径；抽 5 条修正决策（删除/修正/保留三类各 ≥1）回逐字稿逐条展示依据。

## 回归门（转换保真）

```bash
node .agents/skills/lark-meeting-refine/scripts/verify-fixture.mjs
```

冻结的 9-17 纪要 XML（`tests/fixtures/minutes-content.xml`）经被测转换器输出须与期望输出（`tests/fixtures/minutes-body.expected.md`，由冻结原型生成，核验记录见 `tests/fixtures/fixture-verification.md`）逐字节一致。改 `scripts/xml-to-md.mjs` 前必须先跑此门；期望侧由冻结生成器 `tests/fixtures/xml-to-md.frozen.mjs` 生成，**不得用被测转换器重新生成 D-02**。

## 不变清单（硬约束）

- 飞书侧全程只读，零写入。
- `agent/evidence/` 既有镜像正文文字逐字不动；升级仅限媒体本地化与形式转换（同 token 且正文一致时才允许原地更新 frontmatter）。
- 9-17 golden sample 系列（两镜像 + 修正稿 + 提炼稿 + assets，sha256 见契约强约束节）只读守护——**不得对该会议重跑升级或刷新**。
- `agent/tmp-meeting-transcript.txt` 不删除、不修改。
- 修正稿等内部证据不入飞书 wiki（ADR-001）。
- 新依赖仅限 lark-cli 与 node 标准库。
