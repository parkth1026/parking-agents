# 可执行示例: 2026-10-04-lixiang-product-grill-rebuild

**确认版·锁定。** 执行 Agent 改的是产品，不是这份示例。
用户确认：2026-10-04T18:30+08:00

<输出全部为写死示例；断言组名是设计承诺，组内条数以实现为准>

## 场景 1：结构回归测试

```text
$ node skills/product/lixiang-product-grill/run-tests.mjs

[基线]        name 与目录一致；description 名字触发字款式（剔除 name 后 ≤16 字符、
              无场景条款）；无占位
[题库]        文件头目录在位（>100 行）；14 维度各含核心问题/追问/红旗/合理答案的样子
              ＋标准句含讲次标注；每维度块含 S-页指针；每维度块自包含
[层序]        产品战略 → 从0到1 → 从1到10 严格递增；SKILL 含「禁止反向」
[断点]        五断点各附课程逐字锚点或「自构检查」标注；锚点句能在 archive 对应讲命中
[协议]        一次一问/证据三级/裁定四档/层间依赖检查/拆开逐问/示例回合/引用你的思考/
              不使用 AskUserQuestion/合理答案判据/校准式认可/复述成/开场菜单倒序/
              smart-skip 激进措辞
[报告模板]    符合度矩阵/层间断裂点/前三差距/推翻/你是怎么思考这个产品的/依据/影响/推荐强度
[web-prompt]  14 维度全覆盖、一次一问、自包含三要素
[附注护栏]    lixiang-ceo-article.md 头部含非尺子声明；SKILL 资源加载清单不含旧文章；
              题库/SKILL 不含旧九模块名、不含旧课签名句黑名单
              （认知决定战略，战略决定业务/量变带来质变/独一无二的资质/高保真映射/闭环）
[wiki 结构]   SCHEMA/index/log 在位；sources=19；concepts/cases≥12/12；
              index [[]] 覆盖全部内容页；frontmatter 硬门字段齐全；
              wiki 页不含裁定措辞（合格线/裁定），只含弹药与溯源
[三层一致]    每维度题库标准句 ⊂ 对应 S 页引文 ⊂ archive 对应讲全文（逐字链抽查）
[出厂门禁]    技能 .md/.mjs 无机器绝对路径
[design]      AC-1..AC-9 标记齐全；含「触发模式：名字触发」声明行
[配套同步]    openai.yaml 三字段为新名；history.json 顶层 skill=新名；
              package-skill 排除清单含 references/archive/

=== 46+ checks passed, 0 failed ===   (组名锁定，条数示意)
exit 0
```

## 场景 2：wiki 校验（同 v1，不变）

```text
$ node skills/ue/karpathy-llm-wiki/scripts/validate-wiki.mjs \
    --wiki skills/product/lixiang-product-grill/references/wiki

  8 维计分（断链25%/自引10%/孤儿10%/index完整15%/frontmatter15%/页大小10%/出链10%/标签5%）
  TOTAL SCORE: 10.0   PASS（minScore 9.0，断链 0）
  Pages: ~56 | organic orphans: 0 | ambiguous names: 0
exit 0
```

## 场景 3：触发与输出评测（真实执行链，v2 重写）

```text
$ node skills/workflow/parking-skill-creator/scripts/aggregate-trigger.mjs … \
    --persist --skill lixiang-product-grill
  # 真实流程：trigger-eval.md 探针 spawn，每 query 3 探针（模板含 SKILL: 格式强制句）
  #   正例（约 6-7 题）：点名 lixiang-product-grill／李想产品复盘（中英、口语变体）
  #   负例（约 13-14 题）：旧习惯短语「用李想方法论盘一下 X」（期望不触发）
  #                      旧名 lixiang-ceo-grill 点名（期望不触发）
  #                      ceo-copilot／b2b-product-review／product-adverse-review 语域题（期望各自或 none）
  # 聚合产出 trigger-benchmark.json（真实 schema）：
  { "skill": "lixiang-product-grill", "split": …, "rounds": [...],
    "train": {…}, "test": {…}, "best_description": "lixiang-product-grill / 李想产品复盘",
    "valid_probes": …, "invalid_probes": … }

$ node skills/workflow/parking-skill-creator/scripts/run-output-evals.mjs …   # output 臂
  # 三臂：with_skill ／ with_skill_no_refs（不读 wiki，验证运行时赋能增益）
  #      ／ without_skill（官方 eval 第 3 步要求的基线）
  → history.json 追加 runs[]：bank_epoch 2、三臂 gates、vs_previous=null（尺子换代不比）

# 邻库连带（用户裁定 q8 全量重跑）：
$ node …/aggregate-trigger.mjs --persist --skill ceo-copilot
  # 其题库规范名/路径元数据更新后视为新题库，全量重跑并新纪元 benchmark
```

## 场景 4：复盘开场回合（菜单倒序版）

```text
用户：用 lixiang-product-grill 盘一下「园区 3D 编辑器」

> 本次复盘范围，从轻到重选一个：
> ① 只盘某个维度（1-3 轮）——定价／体验／复盘／节奏／定位……14 个任选；
> ② 盘一个模块——产品战略（定位/品牌/文化/产品标准/团队标准，约 5-15 轮）、
>    从0到1（体验/用户/技术/定价）、从1到10（复盘/节奏/流程/门店/利润）；
> ③ 全量 14 维度（每维度 1-3 轮）。
> 顺序固定：产品战略 → 从0到1 → 从1到10，禁止反向——李想的依赖方向是战略决定产品、
> 产品验证进规模，反着盘会让前面结论被后面推翻。

用户：只盘定价

> **【维度：定价（10 讲）】**（弹药页：S10-定价）
> 李想的标准（10 讲）：……（逐字引文+讲次）
> 事实底座先对照：你在《方向》里写「对标竞品定价打八折」——按 10 讲的三维修度
> （用户理性/用户感性/企业需求），你的定价只落在「竞品锚」一个维度上。
> 这条对照你认不认？认的话我直接给部分符合裁定，只追问缺口；不认请说你的依据。
```

<开场倒序菜单＝变化行 3；smart-skip 激进＝变化行 4；弹药页指针＝变化行 5>

## 场景 5：既有用法必须不变（回归守护）

```text
$ npm test                # 全链仍绿：skill-discovery 自动发现新名、无测试硬编码旧名
$ node skills/product/ceo-copilot/run-tests.mjs
  === 117+ passed, 0 failed ===   # 规范名同步+让渡句措辞更新后逐条仍绿
# validator v7.2 对 ceo-copilot 既有 wiki 的校验结果不因本次改动漂移
```
