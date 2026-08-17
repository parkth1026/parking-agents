# Fact: eval对比能力现状

- 派遣问题: parking-skill-creator 现有的「对比/历史比较」能力到底有什么、缺什么（--previous-workspace 语义、聚合范围、schema 清单实现度、触发多轮对比模式、跨 workspace 对比落点、成绩是否沉淀进技能自身）
- 完成时间: 2026-08-17
- 调查对象: `G:\GIT\AI_WorkFlow\parking-agents-dev\.claude\skills\parking-skill-creator\`（generate-review.mjs / viewer.html / aggregate-benchmark.mjs / schemas.md / aggregate-trigger.mjs / SKILL.md / agents/ / package-skill.mjs / snapshot-skill.mjs）。只读调查，未改任何文件，未碰 manifest.json。

## 查到的

### A. --previous-workspace 的确切语义

| 事实 | 证据出处 |
| --- | --- |
| 参数名叫 `--previous-workspace` 但语义是「上一轮 **iteration 目录**」，不是 workspace 根：帮助文本写「上一轮 iteration（显示上轮输出与留言）」 | eval-viewer/generate-review.mjs:30 |
| SKILL.md 用法同样传 iteration 路径：`--previous-workspace <workspace>/iteration-<N-1>`（迭代 ≥2 时加） | SKILL.md:170, 184 |
| `loadPrevious(prevDir)` 对传入目录做两件事：读 `<prevDir>/feedback.json` 的 `reviews[].comment`；再用 `scanIteration(prevDir)` 扫 `eval-*/<config>/run-*` 收集输出文件，两份都按键 `"eval\|config\|run"` 打平成字典 | eval-viewer/generate-review.mjs:106-123 |
| **不校验传入目录与本 iteration 是否同一 workspace**——只要求目录内有 `feedback.json`（可缺）和 `eval-*` 布局。传一个不同 workspace 的 iteration 目录在机制上完全可行 | eval-viewer/generate-review.mjs:106-123（无任何路径关系检查） |
| 匹配是**字符串键精确匹配**：viewer 按 `run.id`（`eval\|config\|run`）查 `previous_outputs[run.id]` 与 `previous_feedback[run.id]`；eval 目录名/config 名/run 序号任一不同就静默不显示（无提示、无部分匹配） | viewer.html:782-789（留言）、viewer.html:975-983（上轮输出）、键构造 viewer.html:678 |

### B. viewer 页面展示的对比面

| 事实 | 证据出处 |
| --- | --- |
| 页面两个 tab：Outputs（定性逐例评审）+ Benchmark（量化），benchmark 数据存在时才显示 tabs | viewer.html:571-575, 1132-1133 |
| 产物对照：当前 run 输出下方有可折叠「Previous Output」区，渲染上轮同键输出（复用同一 renderOutputFile） | viewer.html:599-608, 974-998 |
| 留言对照：当前留言框下方显示「Previous feedback」上轮对该例的 comment | viewer.html:631-634, 782-789 |
| benchmark 对照：**只有当前 iteration 单份 benchmark**（`EMBEDDED_DATA.benchmark`），做 config1−config2 的 delta 表 + 逐 eval×config×run 分解 + 逐断言 ✓/✗ 矩阵 + Analysis Notes | viewer.html:1128-1313（notes 渲染 1303-1311） |
| benchmark 视图**没有任何 vs 上轮 iteration 的对比**——`previous_*` 数据只在 Outputs 页用，benchmark 页不消费 | viewer.html:1128-1313（全文无 previous 引用） |
| config 徽章启发式区分主/基线：`/without\|old\|baseline/.test(run.config)` 或非首个 config 即基线 | viewer.html:764-769 |

### C. with/without 对照各环节覆盖

| 环节 | 覆盖情况 | 证据出处 |
| --- | --- | --- |
| run 并行 | 有：SKILL.md 6.1 强制「同一回合 spawn 带技能与基线两个 subagent」，目录 `<config>/run-<K>/outputs/`，config 目录名动态（with_skill/without_skill/old_skill 均可） | SKILL.md:104-124 |
| 评分 | 有：grader 逐断言写 `grading.json`（name/text/passed/evidence + eval_feedback），断言集来自 eval_metadata.json | SKILL.md:151-153；agents/grader.md；契约 references/schemas.md:86-119 |
| 聚合 | 有：`aggregate-benchmark.mjs` 对**单个 iteration 目录**扫描，产出 configs 统计（mean/stddev/min/max + skipped）+ `delta`（字母序第一个 config − 第二个 config，注释明言字母序使 with_skill 在前） | scripts/aggregate-benchmark.mjs:44-96（loadIteration 单目录）、105-147（delta）、127-134 |
| viewer 展示 | 有：benchmark tab 渲染 delta 表（方向感知染色：pass_rate 升好、time/tokens 降好）+ 逐例分解 | viewer.html:1168-1200, 1212-1298 |
| 盲比较（A/B 不知情） | 仅 agent 指令文档 + comparison.json schema，主流程（SKILL.md 第 6 步）不引用，无脚本/viewer 消费 | agents/comparator.md:1-7, 87-89；SKILL.md 全文无 comparator 引用 |

### D. 聚合器范围与跨轮趋势

| 事实 | 证据出处 |
| --- | --- |
| `aggregate-benchmark.mjs` 聚合范围 = 单个 iteration 目录（支持 eval-* 直下或 runs/ 下两种布局），**不跨 iteration、不跨 workspace** | scripts/aggregate-benchmark.mjs:3, 44-96；用法注释 :7 |
| benchmark.json 无任何跨轮/趋势字段：输出仅 `iteration/skill_name/configs/delta/evals/warnings` | scripts/aggregate-benchmark.mjs:136-144 |
| 聚合器**不写 `notes` 字段**；notes 是 analyst 事后手工写进 benchmark.json 的（SKILL.md 6.4 第 3 步），viewer 读 `data.notes` 渲染 Analysis Notes | scripts/aggregate-benchmark.mjs:136-144（无 notes）；SKILL.md:161；viewer.html:1138, 1303-1311 |
| 全技能目录 grep `trend/趋势/跨iteration/跨轮` 零命中 | grep 结果（SKILL.md/references/scripts/eval-viewer/agents/ 全无） |

### E. schemas.md 契约清单：实现 vs 纸面

| 契约 | 状态 | 证据出处 |
| --- | --- | --- |
| grading.json | **已实现**：grader 写、aggregate 读（`results[].passed` 算 pass_rate）、viewer 读（Formal Grades） | references/schemas.md:86-119；scripts/aggregate-benchmark.mjs:22-30；viewer.html:906-965 |
| timing.json | **已实现**：run 目录落盘、aggregate 统计（null 跳过计 skipped）、viewer 内联展示 | references/schemas.md:157-174；scripts/aggregate-benchmark.mjs:32-39, 116-124；viewer.html:752-758 |
| benchmark.json | **已实现**：aggregate 写、viewer benchmark 页读 | references/schemas.md:178-218；scripts/aggregate-benchmark.mjs:202-204；viewer.html:1128-1313 |
| feedback.json | **已实现**：viewer POST /api/feedback 落盘、loadPrevious 读上轮 | references/schemas.md:297-318；eval-viewer/generate-review.mjs:211-228, 109-114 |
| trigger-evals.json / probe-results.jsonl / trigger-benchmark.json | **已实现**：aggregate-trigger 三契约读写 | references/schemas.md:222-293；scripts/aggregate-trigger.mjs:209-234 |
| comparison.json | **纸面 + agent 指令**：schema 与 comparator.md 都有，无任何脚本/viewer 消费，SKILL.md 主流程不引用 | references/schemas.md:322-393；agents/comparator.md:89；grep 无脚本消费 |
| analysis.json | **纸面 + agent 指令**：analyzer.md 产出结构含 comparison_summary/improvement_suggestions，无脚本/viewer 消费 | references/schemas.md:397-443；agents/analyzer.md:87-153 |
| history.json | **纯纸面**：定义了 Improve 模式版本推进（iterations[].expectation_pass_rate + grading_result won/lost/tie + current_best），**无脚本实现、SKILL.md 流程不提**。这是全部契约里唯一接近「跨轮成绩趋势」的东西 | references/schemas.md:39-83；grep 全目录仅此一处出现 |
| evals.json（技能目录 evals/evals.json） | **纯纸面**（官方遗留）：无脚本读取（aggregate-trigger 读的是 trigger-evals.json，不是它） | references/schemas.md:7-35；grep scripts/ 仅命中 trigger-evals.json |
| metrics.json | **半纸面**：契约定义了（executor 产出），generate-review 仅把它从 outputs 清单里排除（METADATA_FILES），无任何脚本/页面消费其内容 | references/schemas.md:123-153；eval-viewer/generate-review.mjs:20 |
| eval_metadata.json | **实现但 schema 缺文档**：generate-review 与 aggregate 都读它（prompt/assertions），但 schemas.md 没有它的章节（SKILL.md:281 宣称 schemas.md 覆盖 eval_metadata，与实际不符） | eval-viewer/generate-review.mjs:76；scripts/aggregate-benchmark.mjs:67；grep schemas.md 仅 :112 提及一次；SKILL.md:281 |
| comparison/analysis/trend 之外的「趋势」schema | **不存在**：无 trend 类契约 | references/schemas.md 全文 |

### F. aggregate-trigger 的多轮对比模式（可借鉴）

| 事实 | 证据出处 |
| --- | --- |
| 多轮 = 同一 workspace 的 probe-results.jsonl 里行带 `description` 字段，聚合器按 description **分组归轮**（保序记录首次出现顺序），每轮独立算 train/test 指标 | scripts/aggregate-trigger.mjs:102-111；schemas.md:261（description 字段说明） |
| 每轮指标：trigger_rate_on_should / false_trigger_rate_on_should_not / correct / invalid_queries，train/test 双列 | scripts/aggregate-trigger.mjs:129-165 |
| `best_description` 按优者胜函数选轮（test correct ↓ → 应触发率 ↓ → 误触发率 ↑，全平取先出现轮），防过拟合——这就是现成的「历史轮对比并选优」模式 | scripts/aggregate-trigger.mjs:167-191 |
| 但 rounds 也只在**单 workspace 单 jsonl** 内，不跨 workspace、不跨技能版本沉淀 | scripts/aggregate-trigger.mjs:96-192（数据源仅 probeRows 一个文件） |
| SKILL.md 触发评测迭代循环：改 description → 更新 frontmatter → 再跑探针，收敛后「向用户展示前后对比与各轮分数」（对比由会话内 agent 口头做，无脚本产物） | SKILL.md:250-252 |

### G. 跨 workspace 对比现状与最自然挂载点

| 事实 | 证据出处 |
| --- | --- |
| 「跟历史跑的 workspace 对比」现状 = **仅 viewer 的 --previous-workspace 一条通道**，且只比产物与留言，不比 benchmark | 见 A、B 节 |
| viewer 传不同 workspace 的 iteration：**机制上可行**（loadPrevious 无 workspace 归属校验），但 eval 目录名/config 名/run 序号必须逐字对齐才显示，错位即静默消失 | eval-viewer/generate-review.mjs:106-123；viewer.html:782, 978 |
| 聚合器跨 workspace 出趋势：**不能**。单目录输入、无历史读取、无趋势输出字段 | scripts/aggregate-benchmark.mjs:44-96, 136-144 |
| 挂载点评估 1——generate-review.mjs：已有 `loadPrevious()` 与 `--benchmark` 参数（benchmark 路径可显式指定），扩展点最小：可顺带读 previous iteration 的 benchmark.json 加一张「vs 上轮」表；`--benchmark` 已支持任意路径传入 | eval-viewer/generate-review.mjs:106-123（loadPrevious）、169-171（--benchmark） |
| 挂载点评估 2——aggregate-benchmark.mjs：`loadIteration`/`buildBenchmark` 是纯函数（export），接收 iterDir；跨轮趋势需要新输入（多个 iterDir 或历史 benchmark.json 路径），当前 CLI 只收一个位置参数；`--output` 已允许把结果写到任意位置（含 workspace 之外） | scripts/aggregate-benchmark.mjs:44（export loadIteration）、106（export buildBenchmark）、7, 192-204（CLI 单目录 + --output） |
| 挂载点评估 3——aggregate-trigger.mjs 的 rounds 模式：多轮数据先**追加进一个 jsonl 再聚合分组**，是仓库里唯一已被验证的「历史轮对比」实现范式，可平移到输出评测（例如按 iteration 追加一条含分数的记录再聚合） | scripts/aggregate-trigger.mjs:102-191 |
| 挂载点评估 4——history.json：纸面契约就是为跨版本成绩趋势设计的（version/parent/pass_rate/grading_result/is_current_best），实现了它就补上「趋势沉淀」，但当前零实现零引用 | references/schemas.md:39-83 |

### H. 成绩是否沉淀在技能自身

| 事实 | 证据出处 |
| --- | --- |
| **没有任何机制把历次评测成绩写进技能目录**：benchmark.json/trigger-benchmark.json/feedback.json 全部只落 workspace（iteration 目录或 workspace 根） | references/schemas.md:180（benchmark 在 iteration-dir）、:267（trigger-benchmark 在 workspace 根）、:299（feedback 在 iteration-dir） |
| 打包明确把评测挡在技能外：package-skill 排除技能根下 `evals/` 目录，SKILL.md 明言「评测产物不进」包 | scripts/package-skill.mjs:15, 20-24；SKILL.md:266 |
| 技能自身唯一的「随技能分发的历史资产」是 run-tests.mjs 回归测试（固化黄金用例，不是成绩数据） | SKILL.md:82, 266 |
| 方向相反的沉淀存在：snapshot-skill 把技能快照进 workspace（技能→workspace），没有 workspace→技能的回写 | scripts/snapshot-skill.mjs:3, 36-38 |
| 最接近「成绩沉淀」的纸面设计是 history.json（workspace 根，非技能内），未实现 | references/schemas.md:39-41 |

## 未知项

- 官方原版（`ref/skill-creator/`，SKILL.md:10 提到的 fork 基线，位于本仓库但未在本次调查范围内）里 generate_review.py / improve 循环对 history.json 的真实用法——history.json schema 疑似从官方 Improve 模式移植的纸面残留，但未核对官方实现是否消费它。
- 本机是否已有真实 workspace 实例可验证跨 workspace 传参的实际效果：`parking-agents-dev/.claude/` 下只有 `evals/` 与 `skills/`，无 `skill-workspaces/`（未实际跑过 viewer 验证）。
- grader subagent（agents/grader.md）是否顺带消费 metrics.json——本次只确认了脚本/viewer 不消费，未逐行核 grader 指令全文。

## 没查的

- `ref/skill-creator/`（官方 fork 基线目录）的内容与差异。
- references/writing-guide.md 全文（只用到其与对比无关的部分结论）。
- scripts/lib/stats.mjs、jsonio.mjs、zip.mjs、frontmatter.mjs 内部实现（与对比能力无关）。
- parking-agents（非 dev）主仓库里同名技能是否有差异版本（调查对象限定 parking-agents-dev）。
- 仓库内其他 .aes-workflow/grilling 材料（不在派遣范围）。
