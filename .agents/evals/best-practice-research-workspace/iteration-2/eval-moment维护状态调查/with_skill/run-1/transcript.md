# 执行过程简记 — best-practice-research / moment.js 维护状态调查

- 日期：2026-08-16
- 技能：`.claude/skills/best-practice-research/SKILL.md`（严格按其 Workflow、Source-Quality Rules、Output Contract、Stop Rules 执行）
- 产物：`outputs/report.md`

## 步骤记录

1. **读取技能文件**
   - 读 `G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\best-practice-research\SKILL.md`（全文）。
   - 按技能第 1 步分类问题：属"已选技术的生命周期规则 + 版本/迁移指导 + 当前官方建议"（mixed lifecycle/migration/usage guidance），核心靠外部官方证据。
   - 说明：本环境无 `explore`/`researcher`/`dependency-expert` 子代理工具，由本代理等价执行其职责并如实记录。

2. **仓库本地事实检查（explore 等价步骤）**
   - `grep -ri "moment" G:/GIT/AI_WorkFlow/parking-agents --include=*.js|*.ts|*.json|*.py`
   - 结果：仅 `.../eval-moment维护状态调查/eval_metadata.json`（评测任务自身的元数据）命中，本仓库无 moment 实际使用；任务声明"输入文件: none"，所指老项目代码未提供 => Repo-Local Context 记为 "not needed"。

3. **官方上游证据收集（researcher 等价步骤，并行抓取）**
   - WebFetch `https://momentjs.com/docs/#/-project-status/` — 官方项目状态页：维护模式定性原文、原因（可变对象/体积/不可 tree-shake/Intl 原生能力）、替代库推荐（Luxon、Day.js、date-fns、js-Joda、原生 Date+Intl）、"存量可继续用 / 新项目 discourage"、安全修复与时区数据更新承诺、Temporal 提案（页面写作时 Stage 3）。
   - WebFetch `https://github.com/moment/moment` — README 原文 "Moment.js is a legacy project, now in maintenance mode. In most cases, you should choose a different library."；47.9k stars。
   - WebFetch `https://registry.npmjs.org/moment` — 页面过大被截断，仅取得 dist-tags latest=2.30.1；改用 npm CLI（第 4 步）。

4. **npm registry 精确数据（官方注册表，经 npm CLI 查询）**
   - `npm view moment time --json` + `dist-tags`：latest=2.30.1（2023-12-27）；2.29.0=2020-09-22；2.29.2=2022-04-03、2.29.3=2022-04-17、2.29.4=2022-07-06。
   - `npm view moment-timezone time --json`：latest=0.6.3（2026-07-19），时区数据仍在更新。
   - WebFetch `https://api.npmjs.org/downloads/point/last-week/moment` — 2026-08-03~09 周下载 35,779,413 次（补充证据）。

5. **冲突/时效核查**
   - WebSearch "moment.js maintenance mode status 2025 2026 last release"：第三方摘要称"最后版本 2.29.x、之后完全冻结"，与 registry 事实（2.30.1 存在）冲突 => 按技能规则标记为陈旧/冲突证据，不入结论，并在报告中明示。
   - WebSearch Temporal 提案现状：已由 moment 文档页面写作时的 Stage 3 推进到 **Stage 4（2026-03，并入 ES2026）**，出处 tc39/proposal-temporal GitHub 仓库及 Igalia 公告 => 更新报告中该点，标注时间上下文。
   - WebFetch `https://github.com/moment/moment/security/advisories` — GHSA-8hfj-j24r-96c4（Moderate，2022-04-03）、GHSA-wc69-rhjr-hc9g（High，2022-07-06）：验证维护模式下关键 CVE 有实际修复记录。

6. **综合与产出**
   - 遵守技能 Stop Rules（证据已足以支撑结论，停止抓取，不过度检索）。
   - 按技能 Output Contract 撰写中文报告（Direct Recommendation / Evidence Used / Version-Date Context / Repo-Local Context / Boundaries-Non-goals / Handoff），保存为 `outputs/report.md`。
   - 技能默认只读；本次写文件仅是任务方明确指定的产物保存行为（写入技能 workspace 的 outputs 目录），未触碰任何仓库实现代码/状态。

## 引用来源清单

官方/上游（结论依据）：
1. https://momentjs.com/docs/#/-project-status/
2. https://github.com/moment/moment
3. npm registry（registry.npmjs.org）moment / moment-timezone 的 dist-tags 与 time 字段（经 `npm view` 查询）
4. https://github.com/moment/moment/security/advisories
5. https://github.com/tc39/proposal-temporal

补充（次要）：
6. https://api.npmjs.org/downloads/point/last-week/moment
7. Reddit r/programming 2020-09 讨论串及第三方搜索摘要（仅用于识别并标记冲突传言，不作依据）

读取的本地文件：
- `.claude/skills/best-practice-research/SKILL.md`
- `.../eval-moment维护状态调查/eval_metadata.json`（grep 命中，未采用内容）
