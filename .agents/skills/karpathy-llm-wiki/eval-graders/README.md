# eval-graders — 输出评测判罚口径（版本化冻结）

## 为什么存在

题面（output-evals.json）与语料（fixtures-realraw/）都已哈希冻结，但客观评分逻辑若每轮在
workspace 手工派生，跨月跨机无人保证判罚口径不变——**尺子变了，pass 布尔的历史可比性就断**。
本目录把评分器按场景族冻结进技能目录，与题库同级、随包分发。

## 版本

- **v3（2026-08-23）**：① 脚本/配置路径改 `import.meta.url` 相对解析（换机/clone 可跑）；② honesty 三条 manual 断言（如实声明/不编造/建议 ingest）与 oversize「拆分不丢知识」manual 断言**脚本化**（判据=近五轮人评固定口径：如实声明 = 答复含未覆盖声明 且 内容页 mamba 关键词 0 命中——log/index 除外，查询记录本身会写 Mamba；不丢知识 = 种子页要点行〔去标题、去 `- Note N:` 填充行〕在新结构逐字可寻）；③ honesty「答复引用既有页面」删 Transformer/Attention Mechanism 主题词兜底（判别力为零），改命中真实种子页名集合（canonical 目录）或 wikilink；④ grade-realraw logGrew 由「>8 行」硬编码改为与 `fixtures-realraw/wiki-seed/log.md`（manifest 哈希锁定）行数比对；⑤ 场景目录动态发现（兼容 iter9/10 旧命名与 iter11+ `-localraw` 命名）。**一致性实证：对 iter9~13 全量重跑，240 条断言判罚逐条一致、零翻转**（脚本化断言与历史人评全 PASS 相符）；merge-grading 同名断言只保留 objective 判罚，历史轮 manual 重跑不双计。历史成绩可比性不变。
- **v2（2026-08-21）**：grade-bank-v2 消歧引用判定放宽——作品全名 wikilink/frontmatter 引用亦计入（iter13 with_skill 以全名消歧触发）；单向扩充，向后兼容已在 iter9~11 实证（判罚逐字节一致）。merge-grading 修目录遍历 bug（非判罚变更）。另（2026-08-23 随 v3 批次）：merge-grading 增对账警告——题库含 manual 断言但缺 grading-manual.json 显式警告、manual 与 objective 同名断言去重（流程加固，非判罚变更）。
- **v1（2026-08-21 冻结）**：与 iteration-8~12 的 workspace 评分脚本判罚逻辑**逐字同源**
  （仅把硬编码 iteration 路径参数化为 argv），冻结后对 iteration-11/12 重跑做过逐字节
  零漂移验证（10 份 grading-objective 完全一致）。

## 用法（评测轮的评分步骤）

```bash
# 客观断言（script 型）：按轮内跑的场景族选用
node eval-graders/grade-bank-v3.mjs <workspace>/iteration-N   # 题库四场景（localraw×2 + honesty + oversize；场景目录自动发现）
node eval-graders/grade-realraw.mjs  <workspace>/iteration-N   # eval-realraw-ingest（真实语料）
node eval-graders/grade-conflictbatch.mjs <workspace>/iteration-N   # eval-conflict-batch-ingest（多素材冲突批次，2026-08-23 题库区分度改造新增；fixtures-conflictbatch 冻结语料）

# manual 断言：由评审（agent 按 grader 纪律逐条对照产物）写 grading-manual.json 后合并
node eval-graders/merge-grading.mjs <workspace>/iteration-N
```

评分尺子（scripts/validate-wiki.mjs + 技能 config.json）对 with/without_skill 一视同仁。

## 变更政策（与题库换代同口径）

判罚口径改动 = **新版本**：升版本号、在 design.md 迭代记录登记断代说明（哪条断言怎么改了、
旧成绩是否仍可比），不与技能本体改动混进同一轮评测。跑历史轮复现时，用当轮纪元的评分器版本。
