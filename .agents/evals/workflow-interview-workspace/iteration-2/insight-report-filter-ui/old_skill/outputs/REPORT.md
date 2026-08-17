# REPORT — insight-report-facet-filter（workflow-interview 全流程执行记录）

## Issue 目录

原始 issue 目录（在 worktree `C:\wt\old` 里）：

```
C:\wt\old\.aes-workflow\grilling\2026-08-13-insight-report-facet-filter
```

已整份复制到：

```
G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\workflow-interview-workspace\iteration-2\insight-report-filter-ui\old_skill\outputs\issue\
```

复制内容（`find` 核对过，含 `2-prototype/mock.html`）：

```
issue/1-interview/context.md
issue/1-interview/rounds.jsonl
issue/2-prototype/drafts/v1-mock.html
issue/2-prototype/impact-surface.md
issue/2-prototype/mock.html
issue/3-contract/contract.md
issue/manifest.json
```

## 最终 manifest 状态

`issue/manifest.json`：

```json
{
  "stage": "3-contract",
  "next_action": "契约就绪，交给执行 Agent 按 contract.md 实现",
  "stage_gates": {
    "1-interview": { "status": "done" },
    "2-prototype": { "status": "done", "artifacts_confirmed": ["mock"] },
    "3-contract": { "status": "done" }
  },
  "validation": {
    "status": "valid",
    "ac_count": 5,
    "warnings": [],
    "verify_tiers": { "A": 0, "B": 0, "C": 5, "D": 0 }
  },
  "blocked": [],
  "residual_risk": null,
  "status": "ready"
}
```

三个阶段全部 `done`，`status: ready`，无阻塞、无残留风险登记。

## finalize 的校验与冒烟结果（原文）

第一次跑 `finalize` 失败，exit code 1，两类错误：

```
ERROR: 留着模板占位符 <...>，填掉再落盘。
ERROR: 引用了过程文件 2-prototype/drafts/，契约就不自包含了。那里的结论要聚进契约本身，不是指回素材。
ERROR: 引用了过程文件 1-interview/，契约就不自包含了。那里的结论要聚进契约本身，不是指回素材。
INVALID: ...\3-contract\contract.md
```

根因排查：
- 「占位符」误报是因为契约正文里写了裸的 `<select>`（HTML 标签字面量），命中校验器
  的占位符正则 `<[A-Za-z][A-Za-z0-9 ,._/|-]{1,80}>`。改成「select 元素」这种非尖括号
  写法后消除。
- 「引用过程文件」是因为契约的「读什么」节和「访谈记录」节点了 `../1-interview/context.md`
  与 `../2-prototype/drafts/v1-mock.html`。按契约自包含的硬规则，这两处过程文件的结论
  改为直接聚进契约正文（新增「术语说明」一节写清 facet 的术语裁决，访谈记录里的 v1
  草稿改成不带路径的文字描述），只保留对确认版 `../2-prototype/mock.html` 的引用。

修正后第二次跑，exit code 0，完整输出：

```
AC_COUNT: 5
VALID: C:\wt\old\.aes-workflow\grilling\2026-08-13-insight-report-facet-filter\3-contract\contract.md

─── [A] 档冒烟 ───
契约里没有 [A] 档 Verify，无可执行项（另有 5 条非 [A] 档，本命令不跑）。

─── 交接可执行性 ───
档位分布：[A] 0 / [B] 0 / [C] 5 / [D] 0
以下 5 条无法自动判定，长时程执行里只有执行 Agent 的自陈：
  AC-001 [C] 打开 `../2-prototype/mock.html`，依次选中下拉框中的每一项（含 "At a Glance 总览""对话
  AC-002 [C] 打开 `../2-prototype/mock.html`，向下滚动到页面中部，确认 `.facet-filter-bar` 始
  AC-003 [C] 在 `../2-prototype/mock.html` 中分别用「下拉框选择」和「点击 nav-toc 链接」两种方式切换 f
  AC-004 [C] 在 `../2-prototype/mock.html` 中选中示例里刻意设为无数据的 "叙事洞察"，确认它仍出现在下拉框选项列
  AC-005 [C] 对照 `../2-prototype/mock.html` 里下拉框（select 元素）的选项文案与 `nav-toc` 现有
  这不是错。但它们不会在 /goal 每轮的完成审计里被反驳，交接时要当面说清哪几条得人来看。
WARNING: 一条 [A] 档都没有。完成判定全部依赖自陈，长时程执行等于没有终止条件。
         回去看有没有哪条能升到 [A]；确实一条都升不了，就跟用户说清这次靠人验收。

─── 交接指令 ───
/goal 完成 C:\wt\old\.aes-workflow\grilling\2026-08-13-insight-report-facet-filter\3-contract\contract.md 定义的目标：打开报告后能用一个下拉框只看某一个 facet（页面区块）的内容，不用再整页滚动翻找。验收以该文档「验收条件」节全部 Verify 通过、「强约束」节全部保持为准。计划外的事按该文档「自主边界」节自行判断。
```

`AC_COUNT: 5`、`VALID`、exit code `0`。`WARNING` 一条（0 个 `[A]` 档），这是预期内的
结构性提示，不是校验失败——这份需求是纯前端静态报告的界面改动，仓库对它没有任何
自动化测试或视觉回归基建（`1-interview/context.md` 的「验证基建候选池」已查清并记录
为 Fact），5 条 AC 全部只能落 `[C]` 档人工核验，已在契约的「访谈记录」第 3 轮和这份
REPORT 里向用户点明。

## mock.html 是否自包含、是否标出改动点

`issue/2-prototype/mock.html`（确认版）：
- **自包含**：单文件内联 CSS + JS，写死示例数据（128 个 mock session、示例 facet 内容），
  未连接任何真实后端或外部资源；已用 `grep -n "http://\|https://\|<link\|src=\"http"`
  核对无外部引用命中。
- **标出改动点**：`.facet-filter-bar` 与顶部当前 facet 高亮徽标都带 `.changed` 类
  （虚线框 + "改动点" 标签），并在文件末尾用 HTML 注释列出「新增什么、不变什么」
  两栏，符合 `aes-prototype` 对界面对照物的格式要求。

草稿 `issue/2-prototype/drafts/v1-mock.html` 也在 issue 目录里保留（未被契约引用，
仅作为过程记录），顶部三行元数据标注了「状态：superseded by v2」与用户当时的两条意见。

## 界面相关验收条件的 Verify 档位

是 `[C]`。5 条验收条件（AC-001 ~ AC-005）全部标注 `Verify: [C]`，均指向
`../2-prototype/mock.html` 给出可复现的人工操作步骤（如"依次选中下拉框每一项，核对
只有对应 section 可见""滚动页面核对筛选栏始终置顶""分别用下拉框和 nav-toc 两种方式
切换，核对三处选中态一致"等），符合仓库现状（无自动化视觉回归基建，`finalize` 交接
可执行性检查也如实报告了「档位分布：[A] 0 / [B] 0 / [C] 5 / [D] 0」与「一条 [A] 档都
没有」的 WARNING）。

## session.mjs 命令执行记录（含异常）

| 命令 | 结果 |
| --- | --- |
| `init` | 正常，新建 issue 目录 |
| `round`（1-interview 阶段，7 条：2 default、2 confirm、2 ask、1 default 补充） | 全部正常追加 |
| `stage 1-interview done` | 正常，五个自评维度全「已定」 |
| `round`（2-prototype 阶段，2 条：v1 展示反馈、v2 确认通过） | 全部正常追加 |
| `stage 2-prototype done --artifacts mock` | 正常 |
| `round`（3-contract 阶段，6 条：5 条 AC 候选确认 + 1 条契约整体确认） | 全部正常追加 |
| `finalize`（第一次） | **异常退出，exit code 1**：模板占位符误报（裸 `<select>` 撞上占位符正则）+ 两处过程文件引用违规（`1-interview/`、`2-prototype/drafts/`）。已在上文「finalize 的校验与冒烟结果」详述根因与修法 |
| 修正 `contract.md` 后 `finalize`（第二次） | 正常，exit code 0，`VALID`，`AC_COUNT: 5` |
| `stage 3-contract done` | 正常 |

除第一次 `finalize` 因契约本身两类问题正常报错（这正是该校验器设计要拦的东西，不是
脚本本身的缺陷）外，没有其它 `session.mjs` 命令报错或异常退出。

## 用户人设关键回答摘录（完整记录见 `issue/1-interview/rounds.jsonl` 与 `issue/3-contract/contract.md` 的「访谈记录」节）

- 下拉框选项文案要人话，不要内部 key → 复用报告已有 `nav-toc` 侧边栏的中文标签。
- 某 facet 无数据时：选项仍在列表里，选中后主区域显示「这个 facet 暂无数据」。
- 不需要记住上次选择，每次打开默认显示第一个 facet。
- mock 第一次评审提两条意见：下拉框要放页面顶部醒目位置；选中态要有明显视觉反馈。
  第二版改完后确认通过。
- 其它未覆盖问题一律选推荐项（如 facet 覆盖范围选了推荐的"全部区块含 Session 列表"）。
- 验收方式：纯前端静态报告、无自动化视觉回归基建，跟着仓库惯例——即全部落 `[C]` 档
  人工核验。
