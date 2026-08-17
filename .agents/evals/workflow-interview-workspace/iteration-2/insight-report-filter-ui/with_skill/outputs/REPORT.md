# REPORT — insight report facet 筛选下拉框（workflow-interview 三阶段流程） / with_skill

## 任务
> .copilot/agents/insight/generate-insight-report.js 生成的报告现在是一份很长的静态大页面，想加一个按 facet 筛选的下拉框，选了之后只显示对应 facet 的内容，不用整页翻。

按 `workflow-interview` 编排走完 `1-interview`→`2-prototype`→`3-contract`，全程用「用户人设」自答。目标文件 `.copilot/agents/insight/generate-insight-report.js` 在 `C:\wt\new` 里真实存在（3210 行），不是假设产物。

## issue 目录
- 原始位置：`C:\wt\new\.aes-workflow\grilling\2026-08-13-insight-report-filter-ui`
- 已整份复制到：`G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\workflow-interview-workspace\iteration-2\insight-report-filter-ui\with_skill\outputs\issue\`（含 `manifest.json`、`1-interview/context.md`、`1-interview/rounds.jsonl`、`2-prototype/impact-surface.md`、`2-prototype/mock.html`、`2-prototype/drafts/v1-mock.html`、`3-contract/contract.md`、`3-contract/verify.txt`）

## 最终 manifest 状态
```json
{
  "stage": "3-contract",
  "status": "ready",
  "stage_gates": {
    "1-interview": { "status": "done" },
    "2-prototype": { "status": "done", "artifacts_confirmed": ["mock"] },
    "3-contract":  { "status": "done" }
  },
  "validation": { "status": "valid", "ac_count": 6, "verify_tiers": { "A": 3, "B": 0, "C": 3, "D": 0 } }
}
```

## finalize 的校验与冒烟结果（原文，第二次成功）
```
WARNING: 正文句子里出现 TODO、TBD 或 FIXME，确认它是内容本身，不是没做完的标记。
AC_COUNT: 6
VALID: C:\wt\new\.aes-workflow\grilling\2026-08-13-insight-report-filter-ui\3-contract\contract.md

─── [A] 档冒烟 ───
[FAIL] AC-001  exit=1  $ node -e "...facet-select...sec-...option..."
[FAIL] AC-003  exit=1  $ node -e "...content-?[Vv]isibility...display:none..."
[FAIL] AC-006  exit=1  $ node -e "...facet-select...localStorage|sessionStorage..."
绿 0 / 红 3 / 跑不起来 0
另有 3 条非 [A] 档没跑：AC-002 [C]、AC-004 [C]、AC-005 [C]

─── 交接可执行性 ───
档位分布：[A] 3 / [B] 0 / [C] 3 / [D] 0
(AC-002/004/005 无法自动判定，人工核对)

─── 交接指令 ───
/goal 完成 .../3-contract/contract.md 定义的目标：generate-insight-report.js 生成的 HTML 报告新增一个页面顶部的 facet 筛选下拉框，选中某个。验收以「验收条件」节全部 Verify 通过、「强约束」节全部保持为准。计划外的事按「自主边界」节自行判断。
EXIT=0
```
冒烟全红（`FAIL`，0 个 `UNRUNNABLE`）是预期状态。唯一 WARNING（TODO/TBD/FIXME）经排查是契约里通用占位写法 `sec-xxx` 的 `xxx` 触发了大小写不敏感的 `\b(TODO|TBD|FIXME|XXX)\b`，是内容本身，非未完成标记，符合校验器自身注释的预期行为。

## 闸门拒收记录

`round`、`stage ... done` 命令全部**一次通过**。`finalize` 有**一次**非 0 退出。

### 拒收：`finalize` 首次运行，退出码 1
```
ERROR: 留着模板占位符 <...>，填掉再落盘。
ERROR: 验收条件的每条顶层 bullet 都要写成 "- AC-001: <可判定的结果>"。
ERROR: AC 编号要连续，这里应该是 AC-003。
ERROR: AC-002 要恰好挂一行缩进的 Verify，现在有 3 行。
ERROR: 引用了过程文件 impact-surface.md，契约就不自包含了。
ERROR: 引用了过程文件 2-prototype/drafts/，契约就不自包含了。
INVALID: ...\3-contract\contract.md
```

改法：
1. `AC-003a`/`AC-003b` 后缀不匹配校验器的 `AC-\d{3}` 正则，被漏计且拖乱了 Verify 归属 → 重新编号为严格连续 `AC-001`…`AC-006`。
2. 「读什么」路径写成 `2-prototype/mock.html`，应为相对 `3-contract/` 的 `../2-prototype/mock.html` → 修正相对路径。
3. 引用了过程文件 `impact-surface.md`（扫描记录非确认版对照物）与 `drafts/v1-mock.html`（草稿目录）→ 从「读什么」删除 impact-surface.md，访谈记录改为不带路径的「v1（首版草稿）」。
4. 正文里裸露的 `<style>` `<script>` `<select>` `<h2>` `<option>` 落入模板占位符正则 `<[A-Za-z][A-Za-z0-9 ,._/|-]{1,80}>` 被误判 → 改写为「`style` 标签」「`select` 元素」「`h2` 标题元素」「option 选项」等不带尖括号的说法。

修正后重跑通过。

## mock.html 自包含性与改动点标注
- 自包含：单文件内联全部 CSS/JS，正则核对 `cdn|googleapis|unpkg|jsdelivr` 及任何 `http(s)://` 外链均零命中。
- 改动点标注：`.facet-bar.changed` 虚线框标出相对 v1 的改动位置，文件末尾 HTML 注释列出「新增什么/不变什么」。
- v1 草稿保留在 `2-prototype/drafts/v1-mock.html`，标注 `superseded by v2`，末尾记录用户两条意见（位置、选中态高亮）。

## 界面相关验收条件的 Verify 档位
3 条纯界面呈现类 AC（AC-002 无数据提示、AC-004 Ctrl+F 实测、AC-005 顶部位置+高亮）全部落在 **[C]**，没有一条标 [A]——依据仓库确认无截图 diff/视觉回归基建，不虚标 [A]。另 3 条（AC-001/AC-003/AC-006）标 [A] 验证的是「源码里有没有写对应实现约定的字符串标记」，属纯文本静态断言，与视觉呈现无关，契约「设计取舍」D-1 记录了该判断的代价权衡。

## 关键决定摘要
- 下拉框选项用人话标题，不暴露内部 key；无数据 facet 选项照常出现+提示文案，不隐藏不置灰不留空白；不记忆选择，默认第一项；隐藏机制用 `content-visibility:hidden` 保留 Ctrl+F 跨 facet 搜索；下拉框放页面顶部独立 sticky 区域（v1 塞进区块内部被否）；选中态明显高亮；`sec-header`/`sec-glance`/`nav-toc` 不受影响；另外两个报告脚本不在范围内。
