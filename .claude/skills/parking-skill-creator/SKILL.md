---
name: parking-skill-creator
description: 本机技能生产流水线：创建、评测、迭代与打包 agent 技能。用于从零创建新技能（确定性脚手架+六步方法论）、评测既有技能（输出评测 with/without 对照、触发评测同宿主 subagent 探针、浏览器逐例评审）、优化 description 触发准确率、打包 .skill 分发包。用户想建技能、改技能、跑技能评测、优化技能触发描述或打包分发时使用。全部脚本零外部依赖，纯 Node 内置模块。
---

# parking-skill-creator：技能生产流水线

把一个想法变成经过评测验证、可分发的技能：创建 → 校验 → 输出评测 → 触发评测 → 评审 → 打包，全链路在本机（Windows + Node）可跑，零外部依赖。

**fork 基线**：本技能融合两家官方 skill-creator——claude-skill-creator（输出评测管线与评审循环，2026-08 版）与 codex-skill-creator（脚手架与写作方法论，2026-08 版）。原版在 `ref/skill-creator/` 下只读对照；官方语义按本机环境重实现（mjs，替代 Python+PyYAML+无头 CLI）。对照官方升级时以 ref/ 为准做手工合并。

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
5. **quick-validate** — 规则校验，越早发现问题越便宜。
6. **输出评测循环** — with/without 并行对照、评分、聚合、浏览器评审、迭代。

---

## 第 1 步：理解意图与具体例子

当前会话里可能已经有想捕获的工作流（用户说「把刚才这套做成技能」）——先从会话历史提取：用了哪些工具、步骤顺序、用户纠正过什么、观察到的输入输出格式。然后再问缺口，逐条确认：

1. 这个技能让 agent 能做什么？
2. 什么情况下触发？（用户会说什么话、什么上下文）
3. 期望的输出形态？
4. 要不要建测试用例？产出客观可验的技能（文件转换、数据抽取、固定流程）收益大；产出主观的技能（文风、设计）通常不需要。给建议，让用户定。

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

同时给每个部分定**自由度分级**（低自由度=具体脚本固定参数，给脆弱操作上护栏；高自由度=文字指令，留给 agent 判断）。详见 `references/writing-guide.md`。

产出：一份「资源清单 + 每项自由度」的计划，向用户过一遍再动手。

## 第 3 步：init 脚手架

新技能从模板起步，别徒手写 boilerplate（技能已存在则跳过本步）：

```bash
node scripts/init-skill.mjs <技能名> --structure <workflow|task|reference|capabilities> [--path <输出目录>]
```

- 名字自动归一化 kebab-case（`Log Classifier` → `log-classifier`），超 64 字符退出码 2。
- 默认输出到本技能同级的技能目录；目标已存在且非空时拒绝（退出码 1，不覆盖）。
- 产出：含待办占位与「结构选择指南」节的 SKILL.md + 按结构生成的 scripts/references/assets 占位 README。模板是**通用**的，不带本仓库假设——本仓库惯例见文末「本仓库使用提示」。

## 第 4 步：写资源再写 SKILL.md

先实现第 2 步清单里的资源（这步常需要用户提供材料：品牌资产、模板、文档），再写 SKILL.md 把它们串起来。加入的脚本必须真实跑过至少一个代表性用例，不许「应该能跑」。

写 SKILL.md 的完整方法论见 `references/writing-guide.md`，核心：

- **渐进披露**：description 常驻上下文；正文 <500 行；细节进 references 并在正文留「何时读哪个文件」的指针。
- **description 是主触发机制**：做什么+何时用都写进去，主动一点（agent 天生漏触发）；所有「何时使用」信息在 description，不写正文节。
- **风格**：祈使句；解释为什么而不是堆 MUST；从反馈泛化而不是过拟合测试例子；写完初稿用新眼光重读一遍。

frontmatter 只允许 name/description（必需）+ license/allowed-tools/metadata/compatibility（可选）。

## 第 5 步：quick-validate

```bash
node scripts/quick-validate.mjs <技能目录>
```

官方规则集：name kebab-case ≤64；description ≤1024 且无尖括号；键白名单；compatibility ≤500。合法 → `PASS`（退出码 0）；违规逐条列规则名（退出码 1）；参数缺失出用法（退出码 2）。CRLF 与 LF 同判定。修完再跑直到 PASS。

## 第 6 步：输出评测循环

评测结果放技能同级的 `<技能名>-workspace/`，按迭代组织（`iteration-1/`、`iteration-2/`…），每个测试用例一个 `eval-<描述性名>/` 目录。目录随用随建，不要预先全铺。

### 6.1 同一 turn 并行 spawn 全部 run（with-skill 与 baseline 一起）

对每个测试用例，**同一个回合**spawn 两个 subagent——带技能的与基线的。别先跑 with 再回头补 baseline：一起跑完时间对齐、状态一致。

带技能 run 的 prompt 模板：

```
执行这个任务：
- 技能路径: <path-to-skill>
- 任务: <eval prompt>
- 输入文件: <有则列出，无则 "none">
- 产物保存到: <workspace>/iteration-<N>/eval-<名>/with_skill/run-1/outputs/
- 要保存的产物: <用户关心的东西，如 "最终的 .docx 文件">
```

目录布局对齐聚合器口径：`<config>/run-<K>/outputs/`（run 序号从 1 起，同一 eval 重跑多个 run 时递增）——聚合器只认 `run-<数字>` 子目录，产物直接放 `<config>/outputs/` 会收不到。

基线 run（同 prompt）：

- **新建技能**：不给技能，存到 `without_skill/run-1/outputs/`。
- **改进既有技能**：改动前先快照：`node scripts/snapshot-skill.mjs <技能目录> [<workspace>]`（workspace 缺省为技能同级 `<技能名>-workspace`；快照目录 `skill-snapshot`，已占用自动递增 `-v2`、`-v3`）。脚本会把快照里的 `SKILL.md` 改名 `SKILL.md.bak`——技能扫描器按 `SKILL.md` 文件名认技能，workspace 就在技能扫描根下，快照里留活的 `SKILL.md` 会冒出同名双技能、污染触发评测的技能清单；别徒手 `cp -r` 造快照。基线 run 的「技能路径」填快照目录，prompt 注明技能文档读 `SKILL.md.bak`，产物存 `old_skill/run-1/outputs/`。怀疑技能清单混进了快照/评测产物冒充的技能时，随时跑 `node scripts/check-shadow-skills.mjs [<技能根>…]` 复查（缺省查当前目录的 .claude/skills 与 .agents/skills）。

每个 eval 目录写 `eval_metadata.json`（断言可先空，见 6.2）：

```json
{
  "prompt": "用户任务原话",
  "assertions": [ { "name": "表格覆盖全部日志文件", "type": "manual" } ]
}
```

给 eval 起描述性名字（`eval-日志归类表格`，不是 `eval-0`），目录名同名。本轮改过 prompt 的 eval 都要重新写 metadata，别沿用上轮的。

### 6.2 run 进行中：起草断言

别干等——趁 run 在跑，为每个用例起草可客观验证的断言并向用户解释每条查什么。好断言名字能在评测页上一眼看懂；主观技能别硬上断言，走人工评审。写回 `eval_metadata.json`。空断言集合法（grader 会在 eval_feedback 里点名「无区分度」）。

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
   node scripts/aggregate-benchmark.mjs <workspace>/iteration-<N> --skill-name <技能名>
   ```

   产出 `benchmark.json` + `benchmark.md`：pass_rate/time_ms/tokens 的 mean±stddev（样本方差）+ delta（with − baseline）。配置目录名动态发现（with_skill/without_skill/old_skill/自定义都行）。
3. **分析**：读 benchmark 数据做一轮 analyst pass（读 `agents/analyzer.md` 的 Analyzing Benchmark Results 节）——找聚合看不见的模式：两组全过的无区分度断言、高方差疑似 flaky 的 eval、时间/token 代价。观察写入 benchmark.json 的 `notes` 数组，viewer 会展示。

### 6.5 起服务器评审

```bash
node eval-viewer/generate-review.mjs <workspace>/iteration-<N>
```

- 默认起 `http://127.0.0.1:3117`，端口被占自动换下一个空闲端口，Windows 下用 start 开浏览器，Ctrl+C 停。
- 迭代 ≥2 加 `--previous-workspace <workspace>/iteration-<N-1>`，页面会出现上轮输出与留言的折叠对照。
- 无浏览器/远程环境加 `--static <输出.html>`：单文件自包含，反馈改走对话（你按同结构手写 feedback.json）。

然后告诉用户：「浏览器里打开评审页了——Outputs 页逐例看产物留意见，Benchmark 页看量化对比，看完回来说一声。」

### 6.6 读反馈、改进、再来一轮

用户说看完了 → 读 `<iteration>/feedback.json`（`reviews[].{eval, config, run, comment}`；**空 comment = 该例满意**），聚焦有具体意见的用例改进技能。改进哲学：

1. **从反馈泛化**：技能将来要服务无数没见过的 prompt，别为眼前的例子打过拟合补丁；顽固问题换思路比加约束划算。
2. **保持精瘦**：读 transcript 而非只看产物，技能里让模型空转的部分直接砍。
3. **解释为什么**：反馈再简短也去理解用户真正要什么，把这份理解传进指令；满屏 ALWAYS 是黄旗。
4. **识别重复劳动**：几个测试的 subagent 各自写了相似脚本 = 该进 `scripts/` 的最强信号。

改进后跑 `iteration-<N+1>/`（含 baseline），viewer 带 `--previous-workspace`，循环直到用户满意/反馈全空/不再有实质进展。

---

## 触发评测：优化 description 的触发准确率

description 决定技能会不会被调用。技能做完（或触发不准）时主动提议跑触发评测。**机制：同宿主 subagent 探针**——生产环境用哪个 agent 跑就用哪个 agent 测，同宿主同模型，零无头 CLI 依赖。

### 建评测集

约 20 条 query，存 `<workspace>/trigger-evals.json`（schema 见 `references/schemas.md`）：

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

每个探针完成后，**逐条追加**进 `<workspace>/probe-results.jsonl`：

```jsonl
{"query_id": "q1", "probe": 1, "first_line": "SKILL: log-classifier", "triggered": true, "reason": "日志归类任务"}
```

`first_line` 填探针回复的逐字首行——它是聚合器唯一判定源；不匹配 `SKILL: <名>` 协议的行记 invalid，不猜。

### 聚合

```bash
node scripts/aggregate-trigger.mjs <workspace>
```

输出 `trigger-benchmark.json`：train/test 60/40 按 should_trigger 分层切分（官方 run_loop 口径），每 query 3 探针取严格多数，各层触发率/误触发率/invalid 计数；多轮（改写 description 后再跑探针，jsonl 行带 `description` 字段）时按 **test 正确数**选 best_description，防过拟合。

### 迭代 description

读聚合结果里的失败案例（漏触发/误触发的 query 与理由），**你在会话内**改写 description（参考 writing-guide 的 description 写法），更新 SKILL.md frontmatter，再跑下一轮探针——全程不外呼任何 CLI。收敛或不再改善时，把 best_description 写进 frontmatter，向用户展示前后对比与各轮分数。

---

## 前向测试（复杂技能上线前）

subagent 前向测试是把技能当评测面：验证泛化，不是验证另一个 agent 能否从泄漏上下文重建答案。纪律见 `references/writing-guide.md` 末节：探针不知道自己在测试技能、传原始工件不传结论、每轮重建上下文并清理上轮残留。只有看得见泄漏上下文才通过的前向测试结果不可信。

## 打包（可选出口）

```bash
node scripts/package-skill.mjs <技能目录> [输出目录]
```

打包前自动跑同一校验器，违规目录拒绝打包（退出码 1）。产出 `<技能名>.skill`——标准 zip 格式（STORE 不压缩），条目路径含技能目录名前缀，排除 `evals/`（技能根下）、`__pycache__/`、`node_modules/`、`*.pyc`、`.DS_Store`。可用任意 zip 工具或标准库核验内容。

## 本仓库使用提示

（仓库惯例不进 init 模板，建本仓库技能时在此口径下自行接线。）

- **运行时**：本机 Windows + Node v24，Git Bash 终端。技能脚本一律 `.mjs` + kebab-case，放 `scripts/`，共享代码进 `scripts/lib/`；只用 Node 内置模块，零 npm 依赖、零 python 运行时依赖。
- **测试**：技能配套 `<技能名>-workspace/` 沙箱，`run-tests.mjs` 用 `check()` 计数器 + `execFileSync` 黑盒跑子命令，退出码 0=全过/1=有失败；fixtures 进 `fixtures/`，黄金输入配 expected 输出逐字段比对。
- **配置**：本技能零配置——不读 config 文件、不依赖 skill-env 命名空间，全部经 CLI 参数与目录约定。
- **git**：本仓库提交信息用中文、面向用户解释「为什么」，关键参数修正与行业知识修改要点名，不写改动流水账。
- **技能目录**：新技能放 `.claude/skills/`（git 跟踪）；`.agents/skills/` 是宿主侧镜像，不要手动改。

## 参考文件

- `references/writing-guide.md` — 技能写作方法论（渐进披露、自由度分级、description 写法、防泄漏纪律）
- `references/schemas.md` — 全部 JSON 契约（eval_metadata/grading/timing/benchmark/feedback/触发评测三契约/comparison/analysis）
- `agents/grader.md` — grader subagent 指令（评分哲学与 grading.json 契约）
- `agents/comparator.md` — 盲比较指令（A/B 不知情评审）
- `agents/analyzer.md` — 基准分析指令（找聚合看不见的模式）
- `scripts/` — init-skill / snapshot-skill / check-shadow-skills / quick-validate / aggregate-benchmark / aggregate-trigger / package-skill + lib/
- `eval-viewer/` — generate-review.mjs（服务器与 --static 模式）+ viewer.html

---

核心循环再念一遍：理解意图 → 规划资源 → 脚手架 → 写作 → 校验 → with/without 评测 → 浏览器评审 → 按反馈改进 → 触发评测收尾 → 打包。每步产物落 workspace，用户看得见、可逐条质疑。
