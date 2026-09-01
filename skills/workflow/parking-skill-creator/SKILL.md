---
name: parking-skill-creator
description: 本机技能生产流水线：创建、校验、评测、迭代和打包技能。用于用户要新建或修改技能、运行技能评测、检查触发准确率、比较 with_skill/without_skill 结果、优化技能的 description，或生成 .skill 分发包。覆盖确定性脚手架、回归测试、同宿主 subagent 探针评测、浏览器评审和历史成绩沉淀。脚本仅使用 Node 内置模块，不依赖 npm 或 Python。
---

# parking-skill-creator：技能生产流水线

把一个想法变成经过评测验证、可分发的技能：创建 → 校验 → 输出评测与评审迭代 → 触发评测 → 打包，全链路在本机（Windows + Node）可跑，零外部依赖。

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
- 评测产物默认落在 skills 祖先父级的 `evals/<技能名>-workspace/` 或用户指定目录，不得写入技能扫描根；
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

本技能及它生成的 skill 文档默认中文。English 只用于机器契约（skill `name`、CLI flag、schema field、path…），
以及同时通过四道 gate（`Named concept` / `Execution impact` / `English information gain` / `Stable mapping`）的少量核心术语——
短 prompt 与 `description` 最多 2 个 English terms，普通文章或长文档最多 5 个。上限不是配额，不足不凑数。

完整规则、四道 gate 的判据与正反例见 `references/writing-guide.md` 的「中文 Prompt 的术语克制」节；创建或改写中文 skill 前先按该节审一遍。

## 第 5 步：quick-validate

```bash
node scripts/quick-validate.mjs <技能目录>
```

四个退出码：`0` PASS / `1` 违规（逐条列规则名）/ `2` 用法错 / `3` `UNDECIDABLE`——frontmatter 用了解析器支持子集外的构造，
**既不判 PASS 也不判 FAIL**，因为读不到宿主会读到的值，猜一个比没有门禁更危险。
规则集是 name kebab-case ≤64、description ≤1024 且无尖括号、compatibility ≤500，加上未知键的拼写分诊。

支持子集的边界、键分诊的阈值与全仓复扫回归见 `references/gate-rules.md`——改校验器或想知道某个写法为什么被拦时读它。

PASS 但缺 `run-tests.mjs` 或 `references/design.md` 时给警告、SKILL.md 仍含待办占位时给提示（都不挡退出码——存量老技能照常工作，升级时补上；新技能必须齐）。修完再跑直到 PASS。PASS 后跑 `node <技能目录>/run-tests.mjs`，自带测试全过才算过本步（主观无测试的技能除外）；此后每次升级改动，先跑它做回归。

## 第 6 步：输出评测循环

题目依赖 Web、外部 API、快照或实时数据时，先读 `references/evidence.md`，再做 evidence preflight/materialize；创建或改进 skill 时，把文档风险写成质量假设并用相关 gate/runs 验证，静态审查不直接给质量 PASS。

评测结果默认放 skills 祖先父级的 `evals/<技能名>-workspace/`（与 skills 根平行，向上找 skills 祖先，任意嵌套深度）；workspace 在技能扫描根之外，评测产物/夹具里出现再多的 `SKILL.md` 也不会被宿主识别成技能。workspace 是 scratch、不入库（.gitignore 已忽略）——持久评测依据住技能目录，clean 前先把成绩沉淀进去（见「迭代依据的发现约定」）。若显式沿用扫描根内的旧 workspace，跑完 iteration 要用 `check-shadow-skills` 复查产物有没有冒充技能。按迭代组织（`iteration-1/`、`iteration-2/`…），每个测试用例一个 `eval-<描述性名>/` 目录。目录随用随建，不要预先全铺。

### 6.1 解析低成本 profile，分批 spawn run

评测配置叫 **gate**（= 产物目录名）。默认直接运行 `node scripts/resolve-eval-profile.mjs --host <codex|claude> --output <iteration-dir>/eval-profile.resolved.json` 解析随包 `economy`，不询问；只在用户显式覆盖、`strict` 缺模型或低成本候选不可用时询问，禁止静默继承高级模型。完整规则见 references/eval-models.md。gate 默认组合：

- 新建技能（建议默认）：`with_skill` + `without_skill`
- 改进既有技能（建议默认）：`with_skill` + `old_skill` + `without_skill`；自定义例 `with_skill_no_refs`（不带 references 跑一组）——任意配置目录名聚合器都按名动态发现

按解析结果把全部 eval × gate **分批** spawn。同一个 eval 的各 gate 必须同批同 profile；默认每批 2 个 eval，收完 timing 与产物再发下一批，并发受限时降到 1 个。别先跑 with 再补 baseline。

带技能 run 的 prompt 模板：

```
执行这个任务：
- 技能路径: <path-to-skill>
- 任务: <eval prompt>
- 输入文件: <有则列出，无则 "none">
- 产物保存到: <workspace>/iteration-<N>/eval-<名>/<gate>/run-1/outputs/
- 要保存的产物: <用户关心的东西，如 "最终的 .docx 文件">
- 沙箱纪律: 仅可读写本 run 目录，workspace 其余内容（其他轮次产物、评分器、技能快照）禁读禁写
```

沙箱纪律一行不得省略：without_skill 臂一旦读到 workspace 里其他轮次的评分器或技能快照，就等于提前知道判罚口径、借用被测技能的工具——基线被污染，delta 失真（karpathy 技能 iteration-8/13 两次实证）。评分侧对 without 臂 process-log 抽查 `grader|snapshot|评分方式` 关键词，发现借用痕迹该臂判罚标注污染、不计入 won-lost 依据。

目录布局对齐聚合器口径：`<config>/run-<K>/outputs/`（run 序号从 1 起，同一 eval 重跑多个 run 时递增）——聚合器只认 `run-<数字>` 子目录，产物直接放 `<config>/outputs/` 会收不到。重要轮次（发版验收、疑似 flaky 的 eval）可在同一 eval 下同轮追加 `run-2` 再跑一臂，聚合器自动池化多 run 统计——同轮方差不用等跨轮才看见。

不带技能的 gate（如 `without_skill`）：同 prompt 去掉「技能路径」一行，产物存对应 gate 目录。改进既有技能的 `old_skill` gate 用改动前快照：`node scripts/snapshot-skill.mjs <技能目录> [<workspace>]`（workspace 缺省为 skills 祖先父级的 `evals/<技能名>-workspace`；快照目录 `skill-snapshot`，已占用自动递增 `-v2`、`-v3`）。脚本会把快照里的 `SKILL.md` 改名 `SKILL.md.bak`——技能扫描器按 `SKILL.md` 文件名认技能，若 workspace 沿用扫描根内的旧同级位置，快照里留活的 `SKILL.md` 会冒出同名双技能、污染触发评测的技能清单；新缺省位置虽在扫描根外，改名仍是双保险。别徒手复制目录造快照。old_skill run 的「技能路径」填快照目录，prompt 注明技能文档读 `SKILL.md.bak`，产物存 `old_skill/run-1/outputs/`。怀疑技能清单混进了快照/评测产物冒充的技能时，运行 `node scripts/check-shadow-skills.mjs <扫描根>` 复查。

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

数值拿不到就写 `null`（聚合器会跳过并计入 skipped；若本轮某项 timing 全部缺失，会在 `benchmark.json`/终端显著告警，统计保持「未测量」而不是伪造为 0）。

通知到达时同时核对**产物已落盘**——该 run 的 `outputs/` 有文件、任务要求的关键产物存在。空产物是执行臂故障（agent 报完成但没写盘），不是技能回归：先纠偏续跑或重跑该臂补齐，再进评分；纠偏产生的 timing 按各段累计。

### 6.4 评分与聚合

1. **评分**：spawn grader subagent（读 `agents/grader.md`）逐断言对照产物，把 `grading.json` 写进每个 run 目录（逐断言 `name/text/passed/evidence`，外加对断言集本身的 `eval_feedback`）。多个 grader 同样分批发，同批 ≤4 个在飞（口径同 6.1）。可编程验证的断言写脚本判，别肉眼——更快更稳还能跨迭代复用。
2. **聚合**：

   ```bash
   node scripts/aggregate-benchmark.mjs <workspace>/iteration-<N> --skill-name <技能名> [--history <技能目录>]
   ```

   产出 `benchmark.json` + `benchmark.md`：pass_rate/time_ms/tokens 的 mean±stddev（样本方差）+ delta（with − baseline）。配置目录名动态发现（with_skill/without_skill/old_skill/自定义都行）。

   `--history` 是评测数据反向写进技能目录的**唯一通道**（聚合默认不碰技能目录，须显式传参）：把本轮各 gate 指标**追加**一条 run 进 `<技能目录>/history.json`（只追加不覆盖，历史可审计），并同通道**整写** `<技能目录>/output-evals.json`——本轮全部 eval 的题面（prompt）与断言（含 `ac` 引用），接收方 clone 仓库后不依赖 workspace 就能重建同一套评测用例（跨轮题面变化由 git 记录）。**专项轮**（只跑题库子集的探针轮）要加 `--keep-evals`：保留题库中本轮未跑的 eval，防止部分场景轮把题库整写成子集；全量轮换代（有意汰换旧场景）不要带该旗标。**从首轮起每轮聚合都带上它**（用户明说不沉淀除外）——某轮忘带则 history 断档，下一轮的对比会静默跳过断档轮；若当前 `iteration-N` 的同级 `iteration-(N-1)` 目录仍在但 history 没有对应记录，聚合器会在 `benchmark.json` 与终端给出断档警告，但不会伪造或回补丢失历史。终端多 3 行趋势摘要。history.json 随 .skill 包分发——workspace 会被 clean，成绩沉淀进技能才留得住；但 `vs_previous` 的逐 eval 对比要**现场重算上一轮 iteration 目录**，所以 clean workspace 前先把该轮聚合并沉淀（跨机/跨会话续跑时旧目录可能已不在，对比会记「不可比」而不是报错）。目标目录不可写时拒绝追加（退出码 1），已产出的 benchmark 不回滚。

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

## 触发评测（独立入口）

description 是技能的主触发机制。技能做完后主动提议跑一轮；用户说「触发不准 / 和别的技能抢」时直接进这里。

完整流程读 `references/trigger-eval.md`——同宿主 subagent 探针、约 20 条题库的写法（含 near-miss 取材）、
分批并发纪律、防泄漏红线、`aggregate-trigger.mjs` 的分层统计与样本下限、description 迭代收敛，
以及宿主没有嵌套 Agent 工具时的降级路径（`references/headless-trigger-fallback.md`，能力或授权不足就交回主会话直跑）。
## 前向测试（复杂技能上线前）

subagent 前向测试是把技能当评测面：验证泛化，不是验证另一个 agent 能否从泄漏上下文重建答案。纪律见 `references/writing-guide.md` 末节：探针不知道自己在测试技能、传原始工件不传结论、每轮重建上下文并清理上轮残留。只有看得见泄漏上下文才通过的前向测试结果不可信。

## 打包（可选出口）

```bash
node scripts/package-skill.mjs <技能目录> [输出目录]
```

打包前自动跑同一校验器，违规目录拒绝打包（退出码 1）；存在 `run-tests.mjs` 时还会自动执行技能自测，失败即拒绝打包（主观无测试的技能可省略该文件）。`run-tests.mjs`、`references/design.md`（设计依据）、`history.json`（输出评测成绩）、`output-evals.json`（输出评测题面与断言）、`trigger-evals.json`/`trigger-benchmark.json`（触发题库与成绩）都在技能根、随技能进包（评测产物不进），包消费者可追溯设计到验收的完整证据链。产出 `<技能名>.skill`——标准 zip 格式（STORE 不压缩），条目路径含技能目录名前缀，排除 `evals/`（技能目录根下）、`__pycache__/`、`node_modules/`、`*.pyc`、`.DS_Store`。可用任意 zip 工具或标准库核验内容。

## 迭代依据的发现约定

任何技能的迭代依据六件套住技能根，Creator（或任何 agent）按约定路径零配置发现，不需要中央索引：

| 文件 | 角色 |
| --- | --- |
| `run-tests.mjs` | 回归门——升级改动先跑它 |
| `references/design.md` | 验收锚（AC-N）与迭代记录（只追加） |
| `history.json` | 输出评测指标史（`--history` 沉淀，含 vs_previous 对比） |
| `output-evals.json` | 输出评测题面与断言（`--history` 同通道整写，接收方可重建用例） |
| `trigger-evals.json` | 触发题库（定稿资产，随包分发） |
| `trigger-benchmark.json` | 触发评测指标史（`--persist` 沉淀） |
| `eval-graders/`（可选） | 输出评测判罚口径（脚本化评分的场景族；版本化冻结，改动=新版本+断代登记，防尺子漂移破坏 pass 史可比性） |

迭代能力的分布遵循**裁决：能力集中、证据随技能**——评测与迭代管线只在本技能（Creator）维护一份，技能目录不内嵌自迭代流程（防 N 份副本口径漂移、防污染 description 触发面）；技能只携带证据，clone 本仓库即同时拿到 Creator、全部技能与其完整迭代依据。git 记内容史（谁改了什么、何时），指标文件记成绩史（机器可读、viewer 可渲染），两者互补不重复。迭代一个陌生技能时，先按这六条路径把依据读齐再动手。

## 宿主与仓库约定

在本仓库建技能、或技能需要读环境值（路径、凭据）时，读 `references/repo-conventions.md`：
运行时与脚本约定、测试固化口径、评测沙箱位置、git 提交惯例，以及 `$SKILL_ENV` 族级解析链。
零配置技能和别的宿主仓库都用不到这一节。
## 参考文件

**按需读**（正文只留指针，读的时机写在指针那一行）：

- `references/trigger-eval.md` — 触发评测全流程（独立入口：技能做完或触发不准时）
- `references/gate-rules.md` — quick-validate 的支持子集、键分诊阈值与全仓复扫（改校验器或想知道某写法为何被拦时）
- `references/repo-conventions.md` — 本仓库运行时/测试/git 约定与 `$SKILL_ENV` 解析链（在本仓库建技能、或技能要读环境值时）
- `references/writing-guide.md` — 技能写作方法论（渐进披露、自由度分级、description 写法、中文术语克制、防泄漏纪律）
- `references/evidence.md` — 外部证据 replay/record/live、provider seam 与质量假设流程（题目含外部时变输入时读取）
- `references/headless-trigger-fallback.md` — 无嵌套 Agent 工具时的单轮 headless 探针、安全凭据与残留扫描契约
- `references/schemas.md` — 全部 JSON 契约（eval_metadata 含 ac 字段/grading/timing/benchmark/feedback/history.json/structure-review/触发评测三契约）
- `references/design.md` — 本技能的意图、设计取舍和 AC-1…AC-22 验收依据
- `agents/openai.yaml` — 技能列表 UI 元数据，字段值不含宿主路径
- `agents/grader.md` — grader subagent 指令（评分哲学与 grading.json 契约）
- `agents/analyzer.md` — 基准分析指令（analyst pass：找聚合看不见的模式）
- `eval-profiles.json` — 随包分发的零配置 `economy` 默认和显式 `representative`/`strict` profile
- `scripts/` — init-skill / snapshot-skill / resolve-eval-profile / run-headless-eval-arm / check-shadow-skills / quick-validate / aggregate-benchmark / aggregate-trigger / package-skill + lib/
- `eval-viewer/` — generate-review.mjs（服务器与 --static 模式）+ viewer.html
---

核心循环：意图 → 资源 → 脚手架 → 写作 → 校验 → 评测 → 反馈 → 触发 → 打包；每步产物落 workspace，用户可逐条质疑。
