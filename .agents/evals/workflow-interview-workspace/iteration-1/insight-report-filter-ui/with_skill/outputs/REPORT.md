# workflow-interview 试跑报告：insight report facet 筛选下拉框

- 任务原话：`.copilot/agents/insight/generate-insight-report.js` 生成的报告现在是一份很长的静态大页面，想加一个按 facet 筛选的下拉框，选了之后只显示对应 facet 的内容，不用整页翻。
- Issue：`.aes-workflow/grilling/2026-08-11-insight-report-facet-filter/`（本报告同目录下 `issue/` 是它的完整拷贝）
- 契约：`issue/2026-08-11-insight-report-facet-filter/3-contract/contract.md`（同拷贝到 `goal-contracts/contract.md`）
- 终态：三阶段全部 `done`，`session.mjs finalize` 结构校验 `VALID`（`AC_COUNT: 5`，0 条 WARNING），manifest `status: ready`。

## 逐项检查

### mock.html 是否存在，是否自包含

存在，`issue/2026-08-11-insight-report-facet-filter/2-prototype/mock.html`（确认版 v2），另有草稿
`2-prototype/drafts/v1-mock.html` 保留未删。检查过全文没有 `http(s)://`、`cdn.`、`<link>`、
`<script src>` 等外部引用（`grep` 结果为空）；CSS 用 `<style>` 内联，JS 用 `<script>` 内联，
零第三方依赖，双击本地文件即可在浏览器直接打开。

### 是否标出改动点并注明新增/不变

是。v1、v2 都用 `.changed` 这个 outline 样式类框出新增结构（v2 里是 `.facet-bar` 筛选条），
并且每份文件末尾都有一段 HTML 注释，逐条列「新增：…」「不变：…」，例如 v2 的注释明确写出：
新增顶部 sticky 筛选条、新增高亮徽标 `.facet-current`、新增 `hidden="until-found"` 隐藏机制、
新增无数据占位文案；不变：header 与各 `.section` 的 DOM 结构/id/内容排布、默认打开显示第一个
facet。draft v1 的头部三行元数据注释里也记了用户给的原始反馈原话。

### 契约「读什么」是否引用了 mock.html 路径

是。契约「读什么」第一条就是 `../2-prototype/mock.html`，并说明下拉框顶部位置、选中态高亮、
无数据占位文案、`hidden="until-found"` 机制均以它为准；同节还引用了 `../2-prototype/behavior.md`
与 `../1-interview/context.md`。校验器（`validate-goal-contract.mjs`）对"引用了 mock.html 但没
「读什么」"这条规则没有报 WARNING，说明指路是完整的。

### 有没有问到「下拉框选项文案用内部 key 名还是人话」

问到了。这是 1-interview 第一轮的确认区（confirm 档）一条：默认给出的方案是"直接复用各区块
现有 h2 人话标题，不新造内部 key"，用户逐字确认："好，就用现有标题；明确不要显示
facet_conv_rate 这种内部 key 名，要人话"。记录见 `1-interview/rounds.jsonl` 对应行，
以及契约「访谈记录」第 1 轮表格最后一行。

### 有没有问到「某个 facet 没数据时下拉框如何表现」

问到了，而且是完整 ask 档三选项带百分比（Q2），推荐项是 A「选项直接不出现」65%，用户
翻掉推荐选了 B「选项常驻 + 选中后显示『这个 facet 暂无数据』」30%，理由原话："选项要一直
都在，不要因为没数据就藏起来或者变灰，选中之后告诉我这个 facet 暂无数据就行，别一片空白
也别弄得不能点"。这是全程唯一一次用户翻掉推荐项的问题，契约「访谈记录」里专门标注了这次
`overturned_recommendation`。落地为契约 AC-004。

### 界面相关 AC 的 Verify 档位标的是哪一档

全部 5 条 AC（AC-001~AC-005，覆盖默认选中/切换显隐、选中态高亮、筛选条顶部位置、无数据
占位、Ctrl+F 可搜）Verify 都标的是 **`[C]`**（可复现的人工操作步骤 + 可观察结果），没有
`[A]`/`[B]`。这不是漏问，是走完了强制 ask 档的一问：3-contract 阶段单独问了一条"这批验收
条件要怎么验"（Q3，因为仓库对这个工具链零测试/零 CI，"仓库没有基建得先建"触发强制提问），
候选给了 A `[C]` 人工复现 70%（推荐）/ B 新建 jsdom 断言 22% / C 新建 Playwright 视觉回归
8%，用户选 A："这是纯前端静态报告，没有自动化视觉回归基建，跟着仓库惯例，你推荐什么就
是什么"，与人设设定完全一致。`session.mjs finalize` 的 `[A]` 档冒烟因此显示"契约里没有
[A] 档 Verify，无可执行项"，属预期结果，不是异常。

## mock 迭代过程摘要

v1（故意做得不够好，用来验证迭代机制）：下拉框做成 header 下方一行朴素文字段落，选中后
只有 `select` 本身变值，没有独立的视觉反馈。用户第一轮提了两条意见：(1) 要放顶部醒目位置，
不要塞成小字说明；(2) 选中态要有明显视觉反馈，比如高亮当前选中的 facet 名字。

v2：改成独立的顶部 sticky 筛选条 `.facet-bar`（回应意见 1），加一个显示当前 facet 名的
高亮徽标 `.facet-current`（回应意见 2）。同时在这一轮里额外撞出一处双方都没想到的技术
冲突并顺手解决：访谈时定的"用 CSS 隐藏保留 Ctrl+F 可搜"如果字面实现成 `display:none`，
浏览器原生 Find in page 根本搜不到隐藏内容——改用 `hidden="until-found"` + `beforematch`
事件才能真正满足这条要求。v2 展示后用户确认通过，无新意见。这处技术决定记进了契约
「设计取舍」D-1，并落成一条「强约束」。

## 需要注意的偏差

1. **Verify [A] 冒烟为空属预期**，不是本次流程的缺陷——已在上文说明原因。
2. mock.html 只演示了 5 个代表性区块（总览/Token/工具/目标分布/异常检测），没有穷举真实
   报告里全部约 25 个 `sec-*` 区块；mock.html 末尾注释里说明了这一点，机制对全部区块一致，
   属于合理简化，不影响契约的可交接性。
3. `manifest.json` 里 `original_request` 字段最初因为 `init` 时没传 `--request` 而是 `null`，
   后来用 `session.mjs stage ... --request` 补上了；这是本次操作流程上的一个小疏漏，已修正，
   不影响契约本身。

## 产物位置

- `outputs/issue/2026-08-11-insight-report-facet-filter/`：完整 issue 目录拷贝（1-interview、
  2-prototype 含 drafts/v1-mock.html 与确认版 mock.html、behavior.md、3-contract/contract.md、
  manifest.json）。
- `outputs/goal-contracts/contract.md`：契约单独一份拷贝。
