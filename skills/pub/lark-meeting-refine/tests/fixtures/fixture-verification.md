# Fixture 冻结核验记录（D-03）

冻结日期：2026-09-18。对应契约：`.aes-workflow/grilling/2026-09-18-feishu-minutes-refine/3-contract/contract.md`（D-01/D-02/D-03 条目、AC-002）。

## 冻结产物与 sha256

| 产物 | 路径（相对 skill 根） | sha256 |
| --- | --- | --- |
| D-01 纪要正文 XML | `tests/fixtures/minutes-content.xml` | `e55d22ef22dbce070907c8b389a3ff8d7c77afa3a023587c98fd5fe814c82b31` |
| D-02 期望输出 MD | `tests/fixtures/minutes-body.expected.md` | `bf80ff18e58fb3cae7c519f4ce49bb27e152f0972eb59f692957837855079bd1` |
| 冻结生成器（原型原样复制件） | `tests/fixtures/xml-to-md.frozen.mjs` | `5ecceefc514257073373f1124456d465bea215fc448f4d833d244cf3ac146634` |

## D-01 来源

- 2026-09-18 重拉：`lark-cli docs +fetch --doc OcivdY4hboE99KxwERVcdLqlnoE --doc-format xml --as user`，取 `data.document.content`（revision_id 5，与 golden sample 镜像同版）。
- 6,736 字符。与生成 golden 镜像时的正文一致性由 D-02 交叉验证兜底（见下）。

## D-02 生成与防自指

- 生成器 = `2-prototype/scripts/xml-to-md.mjs` 的**原样复制件**（`tests/fixtures/xml-to-md.frozen.mjs`，sha256 与原型逐字节一致），**不是** skill 内被测转换器（`scripts/xml-to-md.mjs`）。
- 生成命令：`node xml-to-md.frozen.mjs --xml minutes-content.xml --out minutes-body.expected.md --assets-rel "2026-09-17-WDP6-discussion-assets"`。
- **交叉验证**：D-02 与 golden sample 镜像 `agent/evidence/2026-09-17-WDP6-discussion-smart-minutes.md` 去 frontmatter 后的正文**逐字节一致**（仅差 frontmatter 闭合后的一个空行）。即：重拉的 D-01 经冻结原型得到的输出 = 9-17 实跑落盘的镜像正文，形成双源互证。
- `verify-fixture.mjs` 只读 D-02 做 diff，不重新生成 D-02。

## behavior.md 变化行 4-5 逐条人工核验（冻结前完成）

变化行 4（cite → `@人名`；相邻 cite 用「、」分隔）：

| 检查项 | XML 侧（D-01） | 期望输出侧（D-02） | 结论 |
| --- | --- | --- | --- |
| 相邻 cite | 参会人行 4 个无分隔文本的连续 `<cite>`（朴桐虎/罗文斌/马冠杰/彭博） | `@朴桐虎、@罗文斌、@马冠杰、@彭博` | ✅ |
| 行内 cite | 3 个 checkbox 待办尾部的 `<cite user-name="马冠杰">` | 各行尾 ` @马冠杰` | ✅ |
| cite 计数 | 7 | 7 处 `@人名` 渲染（参会人 4 + 待办 3） | ✅ 无丢失 |

变化行 5（grid/column 解包保内容；readonly-block 丢弃；文字逐字忠实）：

| 检查项 | XML 侧（D-01） | 期望输出侧（D-02） | 结论 |
| --- | --- | --- | --- |
| grid 解包 | 1 个 grid / 3 column：左右两列为空 `<p>`，中列嵌 `<img src="VNOvbdyV9oUoLBxdBPYcOrFHnTb" caption="已排除路线对比说明">` | `![已排除路线对比说明](2026-09-17-WDP6-discussion-assets/VNOvbdyV9oUoLBxdBPYcOrFHnTb.png)`（列表项内缩进跟随） | ✅ 内容保真、空列自然消解 |
| 顶层/嵌套 img | 2 个 `<img>`（VNOvbdy…、ZaoabJGv…） | 2 处 `![caption](assets-rel/<token>.png)` 相对路径引用 | ✅ |
| whiteboard | 1 个 `<whiteboard token="LSd7watquhO6FKbbv53crm4tn7d">` | `> 🧩 白板（token …）：[缩略图快照](…whiteboard-….jpg)（静态快照，交互版见飞书文档内嵌画板）` | ✅ |
| readonly-block 丢弃 | 2 个，内容均为空字符串 | 不出现，且无内容损失 | ✅ |
| 逐字忠实 | 2 个 ≥40 字符的 `<p>` 长文本片段 | 解码实体后逐字节出现在 D-02（2/2 通过） | ✅ 抽查通过 |

## D-01 边界形态清单（含/不含）

**含**：

- 媒体：`img` ×2（1 个在 grid 内、1 个嵌套于 li 内）、`whiteboard` ×1。
- cite：共 7，含 4 连相邻 cite（顿号分隔路径）与行内 cite（跟随文字路径）。
- 容器：grid ×1 / column ×3；readonly-block ×2（均为空，**未覆盖带内容的 readonly-block**）。
- 列表：ul ×10 / li ×80（含嵌套媒体块）；checkbox ×3（含 done 属性两侧形态）。
- 标题：title ×1、h1 ×3；blockquote ×2；粗体 `b` ×61；链接 `a` ×1。

**不含（留待后续合成 fixture 或实战样本覆盖）**：

- `table`（0 个）、`ol`（0 个）——表格与有序列表渲染路径未被本 fixture 覆盖。
- 带实际内容的 readonly-block（本 fixture 两个均为空）。
- 媒体下载失败/403 降级、说话人 N、逐字稿前 N 分钟缺失、会议无 note_id——这四类属流水线边界（behavior.md 边界值表），不在纪要正文 XML 单元内，由端到端实战与后续 fixture 覆盖。
- `i/em`、`br`、`code` 等行内标签（0 个）。

## 重冻结条件

behavior.md 转换规则变更时（契约「必须停下来问」项），D-01 不动、D-02 由冻结生成器重新生成并重核验本记录，sha256 同步更新。
