---
name: parking-skill-creator
description: 本机技能生产流水线：创建、校验、评测、迭代和打包技能。用于用户要新建或修改技能、运行技能评测、检查触发准确率、比较 with_skill/without_skill 结果、优化技能的 description，或生成 .skill 分发包。覆盖确定性脚手架、回归测试、同宿主 subagent 探针评测、浏览器评审和历史成绩沉淀。脚本仅使用 Node 内置模块，不依赖 npm 或 Python。
---

# parking-skill-creator：技能生产流水线

把一个想法变成经过评测验证、可分发的技能：创建 → 校验 → 输出评测与评审迭代 → 触发评测 → 打包，全链路在本机（Windows + Node）可跑，零外部依赖。

**基线**：本技能融合两家官方 skill-creator——claude-skill-creator（输出评测管线与评审循环，2026-08 版）与 codex-skill-creator（脚手架与写作方法论，2026-08 版）。运行时只依赖本技能目录内的脚本、references、agents 和 eval-viewer；所有路径从本技能目录解析，不依赖宿主目录名。

## 你的角色

判断用户在流程的哪一步，直接接手推进：

- 「我想做一个 X 技能」→ 从第 1 步开始走六步主线。
- 「我有个技能草稿，帮我测/改」→ 直接进第 6 步评测循环。
- 「技能触发不准/和别的技能抢」→ 直接进触发评测章节。
- 「把这个技能打包」→ 直接进打包章节。
- 用户只想聊聊不想跑评测？跟着走就是了，流程是骨架不是枷锁。

与用户沟通时按对方熟悉度调整措辞：「评测」「基准」可以直接用；「JSON」「断言」这类词确认对方懂再用，或顺手一句话解释。

## 六步主线总览

1. **理解意图与具体例子** — 问清技能做什么、何时触发、产出什么。
2. **规划三类资源与自由度分级** — 从例子反推 scripts/references/assets 清单。
3. **init 脚手架** — 确定性生成骨架，不徒手写 boilerplate。
4. **写资源再写 SKILL.md** — 先实现可复用资源，再写主文档。
5. **quick-validate + 自带测试** — 规则校验与回归测试，越早发现问题越便宜。
6. **输出评测循环** — gate 问询与并行对照、评分、聚合并沉淀历史（--history）、结构审查、浏览器评审、迭代。

本文所有 `node scripts/…`、`node eval-viewer/…` 命令都在**本技能目录**下执行；下文 `<skill-dir>` 指当前技能目录；init 缺省输出目录按脚本自身位置解析，与当前工作目录无关。

## 副作用分层与确认

- 读取、扫描和生成评测计划默认只读；报告写入 `docs/reports/` 或显式指定的 workspace。
- `init-skill`、评测运行、viewer 启动、快照、history 追加和打包都会写文件；
  执行前先列出绝对输出路径、将创建的文件和预计覆盖项，取得用户确认后再运行。
- 评测产物默认落在 `<skill-dir>/../../evals/<技能名>-workspace/` 或用户指定目录，不得写入技能扫描根；
  发现路径冲突、已有文件或 `SKILL.md` 影子文件时停止并报告，不覆盖、不自动清理。
- 本技能可调用 subagent，但必须把技能路径、输入工件和产物目录显式传入；
  不把评测结论预先注入探针上下文，也不把未完成评测标成通过。

---

## 第 1 步：理解意图与具体例子

当前会话里可能已经有想捕获的工作流（用户说「把刚才这套做成技能」）——先从会话历史提取：用了哪些工具、步骤顺序、用户纠正过什么、观察到的输入输出格式。然后再问缺口，逐条确认：

1. 这个技能让 agent 能做什么？
2. 什么情况下触发？（用户会说什么话、什么上下文）
3. 期望的输出形态？
4. 测试用例：产出客观可验的技能（文件转换、数据抽取、固定流程）**必须**把测试固化进技能（第 4 步写进 `run-tests.mjs`，升级校验全靠它）；产出主观的技能（文风、设计）通常不需要，向用户说明后跳过。

一次别问太多——先问最重要的，逐步补。避免臆想例子：请用户给出真实用法例子（「能举两个你会这么用的说法吗？」），或你生成例子后请用户确认。使用模式已经清楚时（改既有技能且用户说得具体）可跳过本步。

结束标志：技能应支持的功能有了清晰共识。

## 第 2 步：规划三类资源与自由度分级

对每个具体例子做两个分析：

1. **从零执行这个例子会怎么做？**
2. **反复执行时，什么会被重造？**——重造的就是该进技能的资源：

| 分析发现 | 落进 |
| --- | --- |
| 同一段代码每次重写（如 PDF 旋转、格式转换） | `scripts/` |
| 每次重新查 schema/API/领域知识 | `references/` |
| 每次重画同样的 boilerplate/模板/字体 | `assets/` |
| 同一段验证步骤每次手工重跑 | `run-tests.mjs`（技能目录根部） |

同时给每个部分定**自由度分级**（低自由度=具体脚本固定参数，给脆弱操作上护栏；高自由度=文字指令，留给 agent 判断）。详见 `references/writing-guide.md`。

产出：一份「资源清单 + 每项自由度 + 要固化的测试用例」的计划，向用户过一遍再动手。

## 第 3 步：init 脚手架

新技能从模板起步，别徒手写 boilerplate（技能已存在则跳过本步）：

```bash
node scripts/init-skill.mjs <技能名> --structure <workflow|task|reference|capabilities> [--path <输出目录>]
```

- 名字自动归一化 kebab-case（`Log Classifier` → `log-classifier`），超 64 字符退出码 2。
- 默认输出到本技能同级的技能目录；目标已存在且非空时拒绝（退出码 1，不覆盖）。
- 产出：含待办占位与「结构选择指南」节的 SKILL.md + 技能目录根部 `run-tests.mjs` 回归测试骨架 + `references/design.md` 设计文档骨架（四节：意图与触发场景/设计取舍/验收条件 AC-N/迭代记录）+ `agents/openai.yaml`（`display_name` 使用技能名标识，default prompt 引用 `$<技能名>`）+ 按结构生成的 scripts/references/assets 占位 README。模板是**通用**的，不带本仓库假设——本仓库惯例见文末「本仓库使用提示」。

## 第 4 步：写资源再写 SKILL.md

动手前先把 `references/design.md` 的四节骨架填成真实内容（不是留 TODO 的骨架）：这个技能为什么存在、关键取舍是什么、验收条件编号 AC-1…AC-N。SKILL.md 会频繁迭代，设计意图与验收依据固化在 design.md 里不随波逐流——它也是后续评测断言的锚点（断言用 `ac` 字段引用 AC 编号）。

然后实现第 2 步清单里的资源（这步常需要用户提供材料：品牌资产、模板、文档），再写 SKILL.md 把它们串起来。加入的脚本必须真实跑过至少一个代表性用例，不许「应该能跑」；跑通的用例当场固化进技能目录根部的 `run-tests.mjs`（新建技能：init 已生成骨架；既有技能没有该文件时按同结构补建。check() 计数器 + 黑盒执行，fixtures/ 放黄金输入与 expected）——测试随技能分发，是后续反复升级校验的依据。

写 SKILL.md 的完整方法论见 `references/writing-guide.md`，核心：

- **渐进披露**：description 常驻上下文；正文 <500 行；细节进 references 并在正文留「何时读哪个文件」的指针。
- **description 是主触发机制**：做什么+何时用都写进去，主动一点（agent 天生漏触发）；所有「何时使用」信息在 description，不写正文节。
- **风格**：祈使句；解释为什么而不是堆 MUST；从反馈泛化而不是过拟合测试例子；写完初稿用新眼光重读一遍。

frontmatter 只允许 name/description（必需）+ license/allowed-tools/metadata/compatibility（可选）。

### 中文 Prompt 的语言与术语边界

本技能自身以及它生成的 skill 文档，默认使用中文。English 不是“看起来更专业”的装饰，而只用于机器契约或少量真正能减少歧义的核心标签。

- 保留中文的自然句子、动作、判断和普通领域词。不要逐句 bilingualize。
- 保留必须精确匹配的 machine contract：skill `name`、CLI flag、enum、schema field、API、identifier、provider name、path、URL、版本号和脚本命令。这些不是翻译对象。
- 只有同时满足 `Named concept`、`Execution impact`、`English information gain`、`Stable mapping` 四道 gate，才给核心术语加 English。
- 短 prompt 或短 `description` 默认最多 2 个 English terms；普通文章或长文档最多 5 个。上限不是配额，不足不要凑数。
- 优先翻译 semantic nucleus，而不是整句或所有修饰语。例如“钢人分析（steelman）”“分歧核心（crux）”可以保留中文上下文；“问题想清楚”“当前想法”“关键变量”“理由”“下一步行动”通常保持中文。
- 术语候选不等于行业标准。无法确认时标成 `context-dependent` 或 `unverified`，不要用英文替换制造确定感。

详细规则和示例见 `references/writing-guide.md` 的「中文 Prompt 的术语克制」节；创建或改写中文 skill 时先按该节审一遍。

## 第 5 步：quick-validate

```bash
node scripts/quick-validate.mjs <技能目录>
```

官方规则集：name kebab-case ≤64；description ≤1024 且无尖括号；键白名单；compatibility ≤500。合法 → `PASS`（退出码 0）；违规逐条列规则名（退出码 1）；参数缺失出用法（退出码 2）。CRLF 与 LF 同判定。PASS 但缺 `run-tests.mjs` 或 `references/design.md` 时给警告、SKILL.md 仍含待办占位时给提示（都不挡退出码——存量老技能照常工作，升级时补上；新技能必须齐）。修完再跑直到 PASS。PASS 后跑 `node <技能目录>/run-tests.mjs`，自带测试全过才算过本步（主观无测试的技能除外）；此后每次升级改动，先跑它做回归。

## 第 6 步：输出评测循环

评测结果默认放 `<skill-dir>/../../evals/<技能名>-workspace/`——其中 `<skill-dir>` 指本技能目录，`evals/` 与 `skills/` 平行；workspace 在技能扫描根之外，评测产物/夹具里出现再多的 `SKILL.md` 也不会被宿主识别成技能。workspace 是 scratch、不入库（.gitignore 已忽略）——持久评测依据住技能目录，clean 前先把成绩沉淀进去（见「迭代依据的发现约定」）。若显式沿用扫描根内的旧 workspace，跑完 iteration 要用 `check-shadow-skills` 复查产物有没有冒充技能。按迭代组织（`iteration-1/`、`iteration-2/`…），每个测试用例一个 `eval-<描述性名>/` 目录。目录随用随建，不要预先全铺。

### 6.1 起跑前问 gate 集，同一 turn 并行 spawn 全部 run

评测配置叫 **gate**（= 产物目录名，下文统一用 gate 称呼；目录布局模板里的 `<config>` 即 gate 目录名）。起跑前先问用户「**这轮评测跑哪些 gate？**」——默认组合只是建议，用户可增删、可自定义 gate 名：

- 新建技能（建议默认）：`with_skill` + `without_skill`
- 改进既有技能（建议默认）：`with_skill` + `old_skill` + `without_skill`
- 自定义例：`with_skill_no_refs`（不带 references 跑一组）、任意配置目录名——聚合器按目录名动态发现，都能聚合

用户不在场（夜间批跑/自动化流程）或已授权自动时，按默认组合执行并在结果里注明「按默认 gate 集跑」——别卡在问询上。

问完按用户定的 gate 集，对每个测试用例**同一个回合**spawn 各 gate 的 subagent——带技能的与基线的一起。别先跑 with 再回头补 baseline：一起跑完时间对齐、状态一致。

带技能 run 的 prompt 模板：

```
执行这个任务：
- 技能路径: <path-to-skill>
- 任务: <eval prompt>
- 输入文件: <有则列出，无则 "none">
- 产物保存到: <workspace>/iteration-<N>/eval-<名>/<gate>/run-1/outputs/
- 要保存的产物: <用户关心的东西，如 "最终的 .docx 文件">
```

目录布局对齐聚合器口径：`<config>/run-<K>/outputs/`（run 序号从 1 起，同一 eval 重跑多个 run 时递增）——聚合器只认 `run-<数字>` 子目录，产物直接放 `<config>/outputs/` 会收不到。

不带技能的 gate（如 `without_skill`）：同 prompt 去掉「技能路径」一行，产物存对应 gate 目录。改进既有技能的 `old_skill` gate 用改动前快照：`node scripts/snapshot-skill.mjs <技能目录> [<workspace>]`（workspace 缺省为 `<skill-dir>/../../evals/<技能名>-workspace`；快照目录 `skill-snapshot`，已占用自动递增 `-v2`、`-v3`）。脚本会把快照里的 `SKILL.md` 改名 `SKILL.md.bak`——技能扫描器按 `SKILL.md` 文件名认技能，若 workspace 沿用扫描根内的旧同级位置，快照里留活的 `SKILL.md` 会冒出同名双技能、污染触发评测的技能清单；新缺省位置虽在扫描根外，改名仍是双保险。别徒手复制目录造快照。old_skill run 的「技能路径」填快照目录，prompt 注明技能文档读 `SKILL.md.bak`，产物存 `old_skill/run-1/outputs/`。怀疑技能清单混进了快照/评测产物冒充的技能时，运行 `node scripts/check-shadow-skills.mjs <扫描根>` 复查。

每个 eval 目录写 `eval_metadata.json`（断言可先空，见 6.2）：

```json
{
  "prompt": "用户任务原话",
  "assertions": [ { "name": "表格覆盖全部日志文件", "type": "manual", "ac": "AC-1" } ]
}
```

断言的 `ac` 字段**可选**：引用本技能 `references/design.md` 验收条件表的编号（AC-N），建立「评测断言 ↔ 设计验收」的追溯链——SKILL.md 怎么迭代，设计锚点不动，评测始终有据可依。不带 `ac` 的断言照常合法（老技能零迁移），评分器不因缺 `ac` 拒绝。

给 eval 起描述性名字（`eval-日志归类表格`，不是 `eval-0`），目录名同名。本轮改过 prompt 的 eval 都要重新写 metadata，别沿用上轮的。

### 6.2 run 进行中：起草断言

别干等——趁 run 在跑，为每个用例起草可客观验证的断言并向用户解释每条查什么。好断言名字能在评测页上一眼懂；断言只考**任务本质**——计数、归并、正确性、prompt 明确承诺的输出形态；被测技能的私有输出契约（固定列数、私有格式）不进基线断言：对照组没读过技能，按其私有格式判罚会系统性夸大 with_skill 优势（要验契约时单列为 with_skill 的附加检查）。主观技能别硬上断言，走人工评审。**既有技能没有 `references/design.md` 时，先按 init 的四节模板补建骨架、填出本轮能引用的验收条件，再起草断言。**写回 `eval_metadata.json`。断言**引用 design.md 的 AC 编号**：能在 `references/design.md` 验收条件表里找到出处的断言，标上 `ac` 字段（如 `"ac": "AC-1"`）——评分与后续迭代都能追溯「这条断言当初为什么存在」。空断言集合法（grader 会在 eval_feedback 里点名「无区分度」）。

### 6.3 run 完成通知到达：立刻抓 timing

每个 subagent 完成通知里带 `total_tokens` 与 `duration_ms`——这是唯一捕获机会，事后不可恢复。通知一条处理一条，写进该 run 目录的 `timing.json`：

```json
{ "total_tokens": 48213, "duration_ms": 137000 }
```

数值拿不到就写 `null`（聚合器会跳过并计入 skipped，不报错）。

### 6.4 评分与聚合

1. **评分**：spawn grader subagent（读 `agents/grader.md`）逐断言对照产物，把 `grading.json` 写进每个 run 目录（逐断言 `name/text/passed/evidence`，外加对断言集本身的 `eval_feedback`）。可编程验证的断言写脚本判，别肉眼——更快更稳还能跨迭代复用。
2. **聚合**：

   ```bash
   node scripts/aggregate-benchmark.mjs <workspace>/iteration-<N> --skill-name <技能名> [--history <技能目录>]
   ```

   产出 `benchmark.json` + `benchmark.md`：pass_rate/time_ms/tokens 的 mean±stddev（样本方差）+ delta（with − baseline）。配置目录名动态发现（with_skill/without_skill/old_skill/自定义都行）。

   `--history` 是评测数据反向写进技能目录的**唯一通道**（聚合默认不碰技能目录，须显式传参）：把本轮各 gate 指标**追加**一条 run 进 `<技能目录>/history.json`（只追加不覆盖，历史可审计）。**从首轮起每轮聚合都带上它**（用户明说不沉淀除外）——某轮忘带则 history 断档，下一轮的对比会静默跳过断档轮。终端多 3 行趋势摘要。history.json 随 .skill 包分发——workspace 会被 clean，成绩沉淀进技能才留得住；但 `vs_previous` 的逐 eval 对比要**现场重算上一轮 iteration 目录**，所以 clean workspace 前先把该轮聚合并沉淀（跨机/跨会话续跑时旧目录可能已不在，对比会记「不可比」而不是报错）。目标目录不可写时拒绝追加（退出码 1），已产出的 benchmark 不回滚。

   对比与星标口径（防脏数据）：**主 gate** = with_skill，没有 with_skill 时取字典序首个 gate 名。`vs_previous` 与上一条 run 按**同 eval 名**比 won/lost/tie（pass 布尔翻转；本轮新增 eval 计入 total 不计胜负，上轮有本轮没有的 eval 标 dropped）；两轮主 gate 名不同且无共同 with_skill 时记「gate 不连续不可比」，**绝不当失败记 lost**。`current_best` 按主 gate pass_rate 严格更高才推进、平局不推进（防抖）；主 gate 名不同的轮次（纯实验 gate）不参与推进；同一 iteration 重复聚合视为修正——追加一条并在 stdout 提示，星标以该 iteration 最新一条为准（早期半程数据锁不住上限）。`iteration_ref` 存本机绝对路径，仅供本机回溯，跨机时只作轮次标识读。
3. **分析**：读 benchmark 数据做一轮 analyst pass（读 `agents/analyzer.md` 的 Analyzing Benchmark Results 节）——找聚合看不见的模式：两组全过的无区分度断言、高方差疑似 flaky 的 eval、时间/token 代价。观察写入 benchmark.json 的 `notes` 数组，viewer 会展示。

### 6.5 结构审查：拆分建议（只建议，不执行）

聚合完成后、起评审页前，对**被评技能本体**做一轮结构审查——判断它是不是「该拆而没拆」的混合技能。按四信号 checklist 逐条判：

| # | 信号 | 判什么 |
| --- | --- | --- |
| 1 | 原子能力可复用 | 技能内某段例程/知识，别的技能也各自实现了一份（重复劳动信号） |
| 2 | 多类不相干意图 | description 或正文同时招揽不止一类互不相干的请求 |
| 3 | 编排逻辑内嵌 | 主体是「调度多个步骤/子能力」的流程逻辑，却和原子能力混写在同一份 SKILL.md |
| 4 | 触发评测 near-miss 集中 | 触发评测的误触发案例集中在某一类意图上（失败 query 按意图聚类看） |

样板参照：**grill-with-docs 之于 grilling**——前者是薄编排层（带着文档生成去调度访谈流程），后者是原子访谈能力；拆层后各自触发面干净、原子能力可被别的编排复用。本地对照（文件不存在时跳过，上文描述已足够判定）：`G:\GIT\AI_WorkFlow_ref\mattpocock-skills\skills\engineering\grill-with-docs\SKILL.md` 与 `G:\GIT\AI_WorkFlow_ref\mattpocock-skills\skills\productivity\grilling\SKILL.md`。

命中信号（≥1 条有实质证据）时产出拆分建议，铁律：**只建议不执行**——拆不拆由用户裁定，agent 不动手改结构。产出落点按时间线分两步：

- **审查时（本步，起评审页之前）**：① 对话向用户报逐信号结论（✓/✗ + 证据一句）+ 一句建议 + 「是否拆分由你决定，我不动手」；② 把结论写进 `<iteration>/structure-review.json`（schema 见 `references/schemas.md`：signals 逐条 + recommendation + conclusion），viewer 评审页 Benchmark 页上方会渲染建议卡片（带「仅建议 · 未执行」标记；本轮还没聚合 benchmark 时卡片也照常出现）。
- **收尾时（6.7，用户裁定之后）**：把「建议 + 用户裁定」写进被审技能 `references/design.md`「迭代记录」节的拆分建议列（如「建议拆出日志解析原子技能，用户未拆」）——裁定前别预写用户的决定。

信号 4 的输入是触发评测的误触发案例；该轮还没跑触发评测时（首轮常态）如实记 `hit: null`（无数据，viewer 显示「无数据」），evidence 写「触发评测未跑」，别凭空判 ✓/✗。信号全不命中时对话报一句「结构审查信号未命中，无需拆分」，structure-review.json 照写（如实记录），历史轮次可对照。

### 6.6 起服务器评审

```bash
node eval-viewer/generate-review.mjs <workspace>/iteration-<N> [--history <技能目录>]
```

- 默认起 `http://127.0.0.1:3117`，端口被占自动换下一个空闲端口，Windows 下用 start 开浏览器，Ctrl+C 停。
- `--port` 必须是 1~65535 的整数；非法端口退出码 2，避免 NaN 或越界端口把服务器变成未处理异常。
- 迭代 ≥2 加 `--previous-workspace <workspace>/iteration-<N-1>`，页面会出现上轮输出与留言的折叠对照。
- 加 `--history <技能目录>` 读 `history.json`：评审页顶部出现**历史轨迹**折叠区——历次评测 pass_rate/mean_ms/mean_tokens 表 + 本轮 vs 上轮 won/lost/tie + 逐 eval 明细（含 dropped），跨轮对比在评审页直接看。读不到 history.json 时显示「无历史轨迹（首次评测）」，不报错；不带该旗标则整个历史区不出现。标题技能名的优先级：`--skill-name` 显式 > history.json 的 skill 字段 > 目录名推断。
- 本轮做过结构审查（6.5）时，Benchmark 页上方自动出现**结构审查建议卡片**（读 `<iteration>/structure-review.json`，带「仅建议 · 未执行」标记）。
- 无浏览器/远程环境加 `--static <输出.html>`：单文件自包含，反馈改走对话（你按同结构手写 feedback.json）。

然后告诉用户：「浏览器里打开评审页了——Outputs 页逐例看产物留意见，Benchmark 页看量化对比，看完回来说一声。」

### 6.7 读反馈、改进、再来一轮

用户说看完了 → 读 `<iteration>/feedback.json`（`reviews[].{eval, config, run, comment}`；**空 comment = 该例满意**），聚焦有具体意见的用例改进技能。改进哲学：

1. **从反馈泛化**：技能将来要服务无数没见过的 prompt，别为眼前的例子打过拟合补丁；顽固问题换思路比加约束划算。
2. **保持精瘦**：读 transcript 而非只看产物，技能里让模型空转的部分直接砍。
3. **解释为什么**：反馈再简短也去理解用户真正要什么，把这份理解传进指令；满屏 ALWAYS 是黄旗。
4. **识别重复劳动**：几个测试的 subagent 各自写了相似脚本 = 该进 `scripts/` 的最强信号。

改进后先跑 `node <技能目录>/run-tests.mjs` 确认自带测试全过（回归门，主观无测试的技能除外），并在 `references/design.md` 的**迭代记录**节追加一行（只追加不回改，与 history.json 同口径）：日期 / 改了什么一句 / 本轮 vs 上轮 won/lost/tie / 拆分建议结论（如有）。然后跑 `iteration-<N+1>/`（含 baseline），viewer 带 `--previous-workspace` 与 `--history`，循环直到用户满意/反馈全空/不再有实质进展。

---

## 触发评测：优化 description 的触发准确率

description 决定技能会不会被调用。技能做完（或触发不准）时主动提议跑触发评测。**机制：同宿主 subagent 探针**——生产环境用哪个 agent 跑就用哪个 agent 测，同宿主同模型，零无头 CLI 依赖。

### 建评测集

约 20 条 query，存 `<技能目录>/trigger-evals.json`（schema 见 `references/schemas.md`）——题库是定稿资产，随 .skill 包分发；定稿后不改：要改就视为新题库、开新一轮全量重跑，且不与 description 改动混进同一提交（跨轮可比性依赖题库固定）：

```json
{
  "skill": "log-classifier",
  "queries": [
    { "id": "q1", "text": "把 D:/logs/ 下的 Jenkins 失败日志按错误模式归类", "should_trigger": true },
    { "id": "q5", "text": "帮我把这段报错截图里的英文翻译成中文", "should_trigger": false }
  ]
}
```

- 必须像真用户会说的话：具体、带细节（路径、上下文、口语、缩写、错别字都要有），别写成抽象指令。
- **应触发**（8-10 条）：同一意图的多种说法，正式与口语混搭；用户没点名技能但明确需要的场景；和相邻技能竞争但本技能该赢的场景。
- **不应触发**（8-10 条）：最有价值的是 **near-miss**——关键词重叠但意图不同的请求。「写个斐波那契函数」这种明显无关的反例什么也测不出来。
- 触发机制的现实：agent 只对「自己不容易直接搞定」的复杂多步任务咨询技能；「读一下 X 文件」这类简单请求即使 description 完全匹配也不会触发——评测集要足够有分量。

写好后向用户过一遍再跑。

### 并行 spawn 探针

对每条 query spawn 探针 subagent（同宿主、并行、每条默认 3 个探针；宿主支持无工具 agent 类型时探针优先用无工具类型）。探针 prompt 模板：

```
你是一个技能路由判断器。你不需要、也不允许实际执行任务、调用任何工具或浏览任何文件——你只做一件事：从下面的技能清单里选出会用到的技能。

用户向你提出以下请求：

<query 原文>

请先决定你会使用哪个技能来处理它。可用技能清单如下（name + description）：
<逐条列出会话可见的全部技能清单>

回复格式要求（必须严格遵守）：
第一行输出 `SKILL: <技能name>`——你会读取并使用的技能名；若不需要任何技能则输出 `SKILL: none`。
第二行起用不超过 15 个字说明理由。
```

首行的护栏句必保：没有它，任务形状的请求会诱使探针真去执行任务（实测 5~10 倍 token 与耗时）或翻到评测文件。**防泄漏红线**：探针 prompt 不得包含 should_trigger 预期答案、评测意图暗示、「我们在测试 X 技能」等信息；评测集与探针结果就放在 workspace，探针浏览文件即泄漏，护栏句已禁止。探针要知道的只有：请求原文、技能清单、首行协议。

每个探针完成后，**逐条追加**进 `<workspace>/probe-results.jsonl`（原始探针数据，scratch 不入库）：

```jsonl
{"query_id": "q1", "probe": 1, "first_line": "SKILL: log-classifier", "triggered": true, "reason": "日志归类任务"}
```

`first_line` 填探针回复的逐字首行——它是聚合器唯一判定源；不匹配 `SKILL: <名>` 协议的行记 invalid，不猜。

### 聚合

```bash
node scripts/aggregate-trigger.mjs <workspace> --persist <技能目录>
```

先校验 `skill`、query id/text/should_trigger 和正负两类样本；探针协议不完整、JSONL 坏行、未知 query 或含换行的 `first_line` 都记 invalid，不猜答案。全无有效探针时退出码 1 且不写 `trigger-benchmark.json`，避免把 0 分假报告当成证据。

输出 `trigger-benchmark.json`：train/test 60/40 按 should_trigger 分层切分（官方 run_loop 口径），每 query 3 探针取严格多数，各层触发率/误触发率/invalid 计数；多轮（改写 description 后再跑探针，jsonl 行带 `description` 字段）时按 **test 正确数**选 best_description，防过拟合。结果同时记录 `valid_probes`，每轮记录有效探针数，便于审计证据是否充足。

`--persist <技能目录>` 把题库读取与成绩写出缺省切到技能目录（`trigger-evals.json`/`trigger-benchmark.json` 沉淀进技能根，显式 `--eval-set`/`--output` 仍可覆盖）；技能目录缺题库或目标不是目录时拒绝（退出 1），**绝不静默回退**读 workspace 旧副本——那是跨轮漂移的源头。probe-results.jsonl 始终留 workspace。成绩为原子整写（非追加），跨轮内容史由 git 记录。不带 `--persist` 时与旧行为完全一致，外部技能一次性评测照旧。

### 迭代 description

读聚合结果里的失败案例（漏触发/误触发的 query 与理由），**你在会话内**改写 description（参考 writing-guide 的 description 写法），更新 SKILL.md frontmatter，再跑下一轮探针——全程不外呼任何 CLI。收敛或不再改善时，把 best_description 写进 frontmatter，向用户展示前后对比与各轮分数。

---

## 前向测试（复杂技能上线前）

subagent 前向测试是把技能当评测面：验证泛化，不是验证另一个 agent 能否从泄漏上下文重建答案。纪律见 `references/writing-guide.md` 末节：探针不知道自己在测试技能、传原始工件不传结论、每轮重建上下文并清理上轮残留。只有看得见泄漏上下文才通过的前向测试结果不可信。

## 打包（可选出口）

```bash
node scripts/package-skill.mjs <技能目录> [输出目录]
```

打包前自动跑同一校验器，违规目录拒绝打包（退出码 1）；存在 `run-tests.mjs` 时还会自动执行技能自测，失败即拒绝打包（主观无测试的技能可省略该文件）。`run-tests.mjs`、`references/design.md`（设计依据）、`history.json`（输出评测成绩）、`trigger-evals.json`/`trigger-benchmark.json`（触发题库与成绩）都在技能根、随技能进包（评测产物不进），包消费者可追溯设计到验收的完整证据链。产出 `<技能名>.skill`——标准 zip 格式（STORE 不压缩），条目路径含技能目录名前缀，排除 `evals/`（技能目录根下）、`__pycache__/`、`node_modules/`、`*.pyc`、`.DS_Store`。可用任意 zip 工具或标准库核验内容。

## 迭代依据的发现约定

任何技能的迭代依据五件套住技能根，Creator（或任何 agent）按约定路径零配置发现，不需要中央索引：

| 文件 | 角色 |
| --- | --- |
| `run-tests.mjs` | 回归门——升级改动先跑它 |
| `references/design.md` | 验收锚（AC-N）与迭代记录（只追加） |
| `history.json` | 输出评测指标史（`--history` 沉淀，含 vs_previous 对比） |
| `trigger-evals.json` | 触发题库（定稿资产，随包分发） |
| `trigger-benchmark.json` | 触发评测指标史（`--persist` 沉淀） |

git 记内容史（谁改了什么、何时），指标文件记成绩史（机器可读、viewer 可渲染），两者互补不重复。迭代一个陌生技能时，先按这五条路径把依据读齐再动手。

## 本仓库使用提示

（仓库惯例不进 init 模板，建本仓库技能时在此口径下自行接线。）

- **运行时**：本机 Windows + Node v24，Git Bash 终端。技能脚本一律 `.mjs` + kebab-case，放 `scripts/`，共享代码进 `scripts/lib/`；只用 Node 内置模块，零 npm 依赖、零 python 运行时依赖。
- **测试**：固化在技能根 `run-tests.mjs`——`check()` 计数器 + `execFileSync` 黑盒跑子命令，退出码 0=全过/1=有失败；fixtures 进 `fixtures/`，黄金输入配 expected 输出逐字段比对。测试随技能分发、每次升级必跑；评测沙箱默认在 `<skill-dir>/../../evals/<技能名>-workspace/`（与 `skills/` 平行，workspace 里出现 `SKILL.md` 产物也不会冒充技能）。
- **配置**：本技能零配置——不读 config 文件、不依赖 skill-env 命名空间，全部经 CLI 参数与目录约定。
- **git**：本仓库提交信息用中文、面向用户解释「为什么」，关键参数修正与行业知识修改要点名，不写改动流水账。
- **技能目录**：由宿主配置技能扫描根；本技能内部只使用 `<skill-dir>`、`scripts/`、`references/` 等相对路径，不把宿主扫描根名称写进文档或脚本。

## 参考文件

- `references/writing-guide.md` — 技能写作方法论（渐进披露、自由度分级、description 写法、防泄漏纪律）
- `references/schemas.md` — 全部 JSON 契约（eval_metadata 含 ac 字段/grading/timing/benchmark/feedback/history.json/structure-review/触发评测三契约/comparison/analysis）
- `references/design.md` — 本技能的意图、设计取舍和 AC-1…AC-6 验收依据
- `agents/openai.yaml` — 技能列表 UI 元数据，字段值不含宿主路径
- `agents/grader.md` — grader subagent 指令（评分哲学与 grading.json 契约）
- `agents/comparator.md` — 盲比较指令（A/B 不知情评审）
- `agents/analyzer.md` — 基准分析指令（找聚合看不见的模式）
- `scripts/` — init-skill / snapshot-skill / check-shadow-skills / quick-validate / aggregate-benchmark / aggregate-trigger / package-skill + lib/
- `eval-viewer/` — generate-review.mjs（服务器与 --static 模式）+ viewer.html

---

核心循环再念一遍：理解意图 → 规划资源 → 脚手架 → 写作 → 校验 → with/without 评测 → 浏览器评审 → 按反馈改进 → 触发评测收尾 → 打包。每步产物落 workspace，用户看得见、可逐条质疑。
