# 执行过程记录：minicli --json 输出 goal contract

## 触发

用户请求：「帮我给 minicli 加个 --json 输出。先别写代码，帮我理清需求、写份 goal contract。」
按 `aes-grilling` skill 的 SKILL.md 流程执行，无外部用户在场，按 `PERSONA.md`
里给出的模拟用户画像（后端 TL）自问自答，全程不写产品代码。

## 第 0 步：读 skill 定义

读取 `.claude/skills/aes-grilling/SKILL.md`、
`references/goal-contract-shape.md`（契约骨架、AC 聚类规则、Verify 四档规则）、
`references/goal-contract-example.md`（一份形态非常相近的参考案例：审计 CLI 加
JSON 输出）、`references/handoff-prompt.md`（交接指令模板，本次任务不需要立即
交接，仅确认格式）。

## 第 1 步：调查事实

目标仓库：
`.../iteration-7/eval-2-cli-json/new_skill/run-1/workdir`

调查动作：
1. 列出仓库文件：`docs/testing.md`、`package.json`、`PERSONA.md`、`README.md`、
   `src/audit.mjs`、`test/run-tests.mjs`——仓库很小，五个文件读完即覆盖全部事实面。
2. 读 `src/audit.mjs`：现状只有一个 `audit(configPath)` 函数 + 一段 CLI 入口逻辑，
   审计两条规则（`has-name` error 级、`no-debug` warn 级），CLI 打印文本行，
   有 error 级 finding 时退出码 1，否则 0。
3. 读 `README.md` / `docs/testing.md`：确认用法说明和测试约定（node 内建 assert，
   `npm test`，新行为先补失败测试，CLI 输出变更需同步文本对比断言）。
4. 读 `test/run-tests.mjs`：现有测试只覆盖 `audit()` 函数返回值，**不**覆盖 CLI 层
   的文本输出或退出码——这是个需要在契约里点出来的现状缺口（强约束部分依据）。
5. 读 `package.json`：确认零 dependency、`type: module`，无现成的 CLI 参数解析库。
6. 实测当前 CLI 行为，而不是靠读代码猜：
   - `node src/audit.mjs`（不带参数）→ 静默退出码 0，无输出。
   - `node src/audit.mjs nonexistent.json` → 未捕获异常，stack trace 到 stderr，
     退出码 1。
   这两条实测结果直接决定了后面 Q1/Q3 两个问题的"已知事实"部分，也是行为对照表
   里"无效输入""未提供路径"两行的现状列的依据。
7. 读 `PERSONA.md`：拿到模拟用户画像（动机、必须兼容的点、字段命名授权、明确
   不做的三项、验收方式授权、"其他未覆盖选推荐项"这条默认规则）。
8. 确认 `docs/goal-contracts/` 目录在目标仓库里尚不存在（需要新建），以及技能自带
   的校验脚本路径 `.claude/skills/aes-grilling/scripts/validate-goal-contract.mjs`
   确实存在。

事实分类：
- `Fact`：现有 CLI 文本输出格式、退出码规则、审计规则内容、测试约定、零依赖现状、
  无效输入/无参数时的真实行为。
- `User decision`：无效输入在 `--json` 下要不要结构化、要不要独立退出码、无参数时
  `--json` 该怎么表现——三者都会改变可观察行为和验收条件，仓库事实答不出来。
- `Agent-owned`：JSON 字段的具体命名（已被画像显式授权给执行侧，但为了让验收条件
  可判定，本次访谈仍给出了具体候选并落成 fixture，避免"字段命名你定"变成一句
  没有着落的空话）。

对照物分类判定：本次请求改变现有可观察行为（新增 CLI 分支，且触及无效输入这类
既有行为的处理方式），不涉及用户可见界面 → 走「行为对照表」，跳过 mock。

## 第 2 步：批量问清歧义（第 1 轮）

画像已经预先回答了大部分材料歧义（动机、兼容性、字段范畴、不做的三项、验收方式
授权）。调查阶段进一步发现三个画像没有直接覆盖、但确实会改变验收条件和实现范围
的问题，一次性列出（本机没有 `AskUserQuestion` 工具，退化为编号文本一次性列全，
均给了 2-3 个互斥候选、已知事实、推荐项和真实代价）：

1. 无效输入在 `--json` 下要不要也结构化？
2. 要不要给无效输入单独一个退出码？
3. 不带配置路径直接 `--json` 该怎么表现？

三个问题按画像"其他任何未覆盖的问题：选推荐项"规则代入答案，均选 A（结构化、
不新增退出码、按无效输入统一处理）。选择理由都落回画像本身给出的动机（"CI 要
机器读结果""退出码也不能变"），不是凭空发挥。

收口自评：意图/结果/边界/约束/现状五个维度在这一轮后全部转为"已定"，没有维度
停在"未定"，判定通过，进入第 3 步。这一步只走了一轮——三个问题彼此独立、画像
给的信息已经足够回答，没有出现"回答暴露新歧义"需要追加轮次的情况。

## 第 3 步：对齐对照物（行为对照表）

产出一张行为对照表，覆盖：
- 两条现状路径（clean / 有 finding，不带 `--json`）标"不变"；
- 两条新增路径（clean / 有 finding，带 `--json`）；
- 三条无效输入/边界路径（文件不存在、JSON 非法、未提供路径）标"变化行"，直接对应
  第 2 步 Q1/Q3 的答案；
- 现有审计规则本身标"不变"。
附不变清单（文本输出格式、审计规则、依赖列表）。

按画像"其他未覆盖选推荐项"，对照表逐行按推荐版本确认，无需二次修改迭代——这与
真实场景里"迭代到用户满意"通常要来回几版不同，是因为这里的"用户"是画像代入，
画像已经把决策权限授权给执行侧，一次给出的候选就是会被接受的候选。

## 第 4 步：对齐验收条件（4a + 4b）

4a：例子直接来自第 3 步的行为对照表，没有走"跳过第 3 步临时补例子"的分支。
聚类结果：4 条 AC（stdout 合法性、字段完整性、三类场景的退出码与结构、README
说明），加一条不变量并入「强约束」（不进 AC 编号，按 goal-contract-shape.md
"每个任务都一样的质量门/必须保持不变的现有行为不进 AC"的规则处理）。

4b：给每条 AC 的 Verify 候选主轴是"这条错了会怎样，就那么验"：
- stdout 合法性错了 → CI 管道直接炸，选 [A] 用 Node 内建能力校验单文档合法性，
  不引入 `jq` 这类新依赖（仓库零依赖，尊重现状）。
- 字段内容错了 → CI 读错字段，静默出错更难查，选 [B] 黄金用例，input/expected
  两份 fixture 现场给出并落盘（合成数据，不涉及真实/敏感数据，不需要额外走"数据
  从哪来、能否脱敏"这条阻塞流程）。
- 三类场景的退出码/结构错了 → 选 [A] `npm test`，如实指出这是当前仓库唯一的验证
  基建，没有更高档位可选（没有端到端/CI 集成环境），不是"选了低档位"而是"仓库此刻
  只有这个"。
- README 说明缺了 → 选 [D] 文件内容检查，成本最低，后果也最轻（用户体验层面的
  可发现性问题，不影响功能正确性）。

全部按推荐项收口，一轮完成，没有出现"起草时暴露新材料歧义需要回第 2 步"的情况。

## 第 5 步：落盘

契约写入 `workdir/docs/goal-contracts/2026-08-07-minicli-json-output.md`，
命名遵循 `<date>-<任务词组>.md`。因为本次判定走"行为对照表"分支（不是界面 mock），
按规则整张对照表写进契约「访谈记录」一节，没有另外产出 `-mock.html` 文件。

黄金用例 fixture 落盘到 `workdir/test/fixtures/audit-json/`：
`input.json`（`{"debug": true}`，同时触发两条规则，比单一 finding 覆盖面更足）
和 `expected-report.json`，字段顺序取自 `src/audit.mjs` 现有 finding 收集顺序，
不是另行发明。

按 `docs/goal-contracts/<task>-mock.html` 的姐妹路径判断：由于本次没有 mock，
任务目录下 `docs/goal-contracts/` 只有契约本体一个文件，符合"除了契约本身只放
一个 html"的规则（本次连那一个 html 都没有）。

## 第 6 步：校验

运行：

```
node .claude/skills/aes-grilling/scripts/validate-goal-contract.mjs \
  workdir/docs/goal-contracts/2026-08-07-minicli-json-output.md
```

输出 `AC_COUNT: 4`、`VALID: <路径>`，退出码 0（完整输出见 `outputs/validation.txt`）。
一次性通过，没有出现需要回去修正记录的情况。

## 轮次小结

全程 1 轮批量提问（材料歧义）+ 1 轮对照物确认 + 1 轮验收候选提问，均按画像给出的
回答一次收口，没有反复。三个"轮次"实际发生在同一次交互里，因为画像已经预先把
大部分决策权交出，且逐个问题之间没有相互依赖导致的连锁重算。这与真实用户场景
不同——真实用户的回答可能推翻前一轮假设、触发重新调查；本次模拟中画像回答的
边界是提前设定好的，收口速度因此较快，但访谈记录仍按真实流程的粒度完整保留了
候选、代价和否决理由，而不是只留最终结论。
