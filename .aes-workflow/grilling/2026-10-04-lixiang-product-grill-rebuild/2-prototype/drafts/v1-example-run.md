<!-- draft v1 | published 2026-10-04T17:20+08:00
     用户意见：<待用户逐处质疑>
     状态：superseded by v2 -->

# 可执行示例: 2026-10-04-lixiang-product-grill-rebuild

<输出全部为写死示例，不连真实系统。断言组名是设计承诺；组内条数以实现为准>

## 场景 1：结构回归测试

```text
$ node skills/product/lixiang-product-grill/run-tests.mjs

[基线]        name 与目录一致、description 名字触发字款式（中英双语、无场景描述）、无占位
[题库]        14 维度各含：核心问题/追问/红旗/合理答案的样子 + 标准句含讲次标注
[层序]        产品战略 → 从0到1 → 从1到10 严格递增；SKILL 含「禁止反向」
[断裂点]      五断点齐全：总纲/战略→0到1/战略内链/0到1→1到10/商业闭环
[协议]        一次一问/证据三级/裁定四档/层间依赖检查/拆开逐问/示例回合/引用你的思考/
              不使用 AskUserQuestion/合理答案判据/校准式认可/复述成
[报告模板]    符合度矩阵/层间断裂点/前三差距/推翻/你是怎么思考这个产品的/依据/影响/推荐强度
[web-prompt]  14 维度全覆盖、一次一问、自包含三要素
[附注护栏]    lixiang-ceo-article.md 头部含「非本技能尺子」声明；
              question-bank 与 SKILL.md 不含旧九模块名与「三层九模块」
[wiki 结构]   SCHEMA/index/log 在位；sources=19；concepts/cases≥12/12；
              index [[]] 覆盖全部内容页；frontmatter 硬门字段齐全
[出厂门禁]    全技能 .md/.mjs 无机器绝对路径（G:\、C:\Users）
[design]      AC-1..AC-8 标记齐全

=== 46 checks passed, 0 failed ===   (组名锁定，条数示意)
exit 0
```

## 场景 2：wiki 校验

```text
$ node skills/ue/karpathy-llm-wiki/scripts/validate-wiki.mjs \
    --wiki skills/product/lixiang-product-grill/references/wiki

Wiki Validation Report
  Broken Links        10/10   (0 broken)
  Self References     10/10
  Orphan Pages        10/10
  Index Completeness  10/10
  Frontmatter         10/10
  Page Size           10/10   (max 200 lines)
  Outbound Links      10/10   (min 2/page)
  Tag Compliance      10/10
  ------------------------------------
  TOTAL SCORE: 10.0   PASS (minScore 9.0)
  Pages: 56 | organic orphans: 0 | ambiguous names: 0
exit 0
```

## 场景 3：评测沉淀（本轮真跑）

```text
$ npm run evals -- --skill lixiang-product-grill
  trigger  20/20  正例命中（显式点名：中文名/英文名/「李想产品复盘」等价点名）
                  邻域负例不误触（ceo-copilot/b2b-product-review/product-adverse-review 语域题 6 条）
  output   3 evals × 断言全过（人工断言由评测通道评分）

→ skills/product/lixiang-product-grill/trigger-benchmark.json
  { "skill": "lixiang-product-grill", "date": "2026-10-04",
    "trigger": { "pass_rate": 1.0, "probes": 20 },
    "neighbor_confusions": 0 }
→ history.json 追加 runs[1]：bank_epoch 2、with_skill 双臂成绩、vs_previous=null（尺子换代，不比）
```

## 场景 4：复盘开场回合（对话产物样子）

```text
用户：用 lixiang-product-grill 盘一下「园区 3D 编辑器」

> 本次复盘范围：全量 14 维度（完整走完通常 15-25 轮），还是只盘一个模块
> （产品战略：定位/品牌/文化/产品标准/团队标准；从0到1：体验/用户/技术/定价；
> 从1到10：复盘/节奏/流程/门店/利润）？也可以只点单个维度（如「只盘定价」）。
> 顺序固定：产品战略 → 从0到1 → 从1到10，禁止反向——李想的依赖方向是
> 战略决定产品、产品验证进规模，反着盘会让前面结论被后面推翻。

用户：只盘产品战略模块，五讲全走

> **【维度 1/5：定位（02 讲）】**
> 李想的标准（02 讲）：「不要只看细分市场的规模，更要看到趋势的变化，优先去找正在
> 上升的细分市场，远比找到眼前规模最大的细分市场更加重要。」
> 你在 `agent/proposals/方向.md` 里写过：「帮园区做 3D 场景，快 10 倍。」
> 对照：有产品动作，但没落到「哪一波人群、什么趋势位」——按 02 讲的尺子，
> 「快 10 倍」是解决方案，不是定位。
> 你们定位的是哪一波园区客户？这一波处在上升期还是存量期，依据是什么？

用户：长三角做文旅夜游的园区，这两年政策在推，数量在涨。

> 这是合理答案：具体名词（长三角/文旅夜游）＋趋势主张（政策推、数量涨）。
> 但趋势主张目前是口头断言——追一个数：这波园区年增量或项目招标量，你亲眼见过
> 哪笔账？（对照 02 讲「看趋势不看存量规模」：下一问我会拿它对你们的实际数字。）
```

<开场菜单与首回合即 behavior.md 变化行 3/4/5 的运行样子；报告矩阵即变化行 8>

## 场景 5：既有用法必须不变（回归守护）

```text
$ npm test
  test:aes-qa-screenshot-evidence … ok
  test-skill-discovery … ok          ← 自动发现 lixiang-product-grill（新名），无硬编码旧名
  test-install-skills / test-no-tool-names / hooks / pi / harnesses / bump-version … ok
  check:repo … ok                    ← 不含 product/，不受影响

$ node skills/product/ceo-copilot/run-tests.mjs
  === 117 passed, 0 failed ===       ← 规范名同步后必须逐条仍绿
```

「这条现在能跑，改完之后必须一样能跑」：npm test 全链、ceo-copilot run-tests、
validator v7.2 对既有 ceo-copilot wiki 的校验结果（不因本次改动漂移）。
