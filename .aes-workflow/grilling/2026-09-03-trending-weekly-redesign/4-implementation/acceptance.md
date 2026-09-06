# 实施与验收记录

状态：实现完成；自动验收全部通过；人工验收待用户。Goal 尚未完成。

实际产品：`D:/GIT_dev/github-trading/report/index.html`（同目录 data.js）。预览服务：`http://127.0.0.1:51975/`。首份分析：`D:/GIT_dev/github-trading/data/weeks/2026-W36.analysis.md`，覆盖全部20仓。修改前的 W36 JSON、分析与报告备份在本目录 `before-live/`。

## 验收矩阵

| 条件 | 证据 | 状态 |
| --- | --- | --- |
| AC-001 单列、计数、TLDR、规格、移动端 | assert-browser layout/tokens/mobile，真实 report 上执行；1152居中、288×162、320/390/640宽均通过 | A PASS；整体视觉待用户看页 |
| AC-002 SURGE | 黄金W36恰5仓；archify ×21.7 vs W28；TLDR速度前三；浏览器20%闭边界 | A PASS |
| AC-003 载荷与兼容 | T12；旧周与旧data.js方向均在浏览器加载；readme≤2400；缺省无stale | A PASS |
| AC-004 图片 | 相对路径、GitHub附件、徽章/logo/计数器过滤；真实load/error事件三级回落；file://离线20个首字母且console零错误 | A PASS；C 用户断网双击待确认 |
| AC-005 四字段与展开 | detail检查定位、爆因、可信度、标签与竞品行；鼠标开合/键盘展开；卡内无图片；元数据折叠 | A PASS |
| AC-006 stale与五信源 | T13/T14；重分类→黄条、同分析重跑不解除、正文润色不解除、重写且分类吻合解除；单源403不整仓失败 | A PASS |
| AC-007 当期分析内容质量 | W36首份20仓样本：事实/作者自述/推断分明；晚于榜单的发布不倒推因果；具体竞品及差异 | C PENDING_USER |

`regression.txt`：88 passed, 0 failed；原T1–T10断言语义未修改，仅新增T11–T14。
`browser-final/{layout,tokens,detail,mobile}.json`：实际交付report的退出码0及逐项检查结果；同名PNG记录浏览器画面。
`verification.json`：汇总机器结果与人工待验收状态。

在线实查：20行均渲染；README图片、Social Preview正常显示。OpenLogi的Social Preview本次加载失败，正确保留首字母色块；浏览器网络失败日志不作JS异常。离线验收使用浏览器断网状态打开本地文件，未请求图片、零console error及pageerror。该自动检查不能替代契约C档的用户实际双击。

## 强约束核对

1. 五份确认版未修改，实施前后SHA256吻合，见 locked-hashes.json。
2. CSS源来自已确认mock的规格；未重新实测或替换trendshift规格源；tokens对每个匹配元素逐项检查。
3. assets/viewer.html 路径与 script src=data.js 保持。
4. week/history schema标识和旧字段保持；新信源字段可选；数据管线纯Node内置模块；配置链未修改；serve.mjs逐字节不变，listWeekFiles/weekSummary函数未改变，故相同底层数据的/api响应序列化路径不变。例行enrich自然更新数据值，不将其声称为原数据字节不变。
5. --page-max:1152px 保持。
6. SURGE >=20% 保持。
7. 既有测试不删减；D01/D02及历史黄金输入由sha256.json锁定，回归验证。

## 产品影响与取舍

- 用户可在同一Top20列表发现新晋/回锅与高速增长，再就地阅读四字段。图、分析与旧周均有缺省降级，历史分析仍完整可读。
- 成本是富化由每仓2次增为元数据加5信源、约120次/20仓；提交限制为90天最多100条，并记录capped，避免把抽样误称全量。
- 常驻和回锅也完整注释，写作成本增加；否则用户点这些行仍只有README复述，不能完成产品判断。
- 维护新增受控标签与浏览器规格断言；没有引入应用依赖或新配置。扩展词表不改变本期界面，但会影响后续生态位聚合的一致性。

## 用户验收焦点

自动结果支持交付，反面的核心风险仍是内容虽格式正确但没有帮助用户判断。以下三项任一不符合，应打回实际analysis重写（保持黄金fixture不变）：

1. 定位是否让你明确每个项目的领域、解决的问题和真实交互入口？
2. 为什么爆是否提供可核查的因果线索，并将无法证实的触发标为推断？
3. 可信度与具体竞品差异是否足以支持你决定投入时间，而非重复作者宣传？

此外请断网双击实际report/index.html确认图片色块、周切换和展开；通过后才可将AC-004(C)与AC-007及整体视觉记为用户验收通过、完成Goal。

## 2026-09-07 复验

交付后次日全量复跑，状态未漂移：

- `run-tests.mjs`：88 passed, 0 failed（含 T11–T14）。
- `assert-browser.mjs` layout/tokens/detail/mobile 四项：fixtures 与真实 report（`--workspace D:\GIT_dev\github-trading`，file:// + 离线上下文）双路全部退出码 0；layout 证据含 20 行单列、1152 居中、20 个离线首字母、20% 闭边界、三级图片回落、零 console 错误。
- 强约束复核：locked-hashes.json 全部 10 文件 SHA256 吻合；golden sha256.json 三件锁吻合；run-tests.mjs 相对 4deb160 仅 2 行新增（T1–T10 零删改）；viewer.html `--page-max:1152px`、`vel>=.2`、`<script src="data.js">` 均在位；serve.mjs/config.mjs 字节不变。
- AC-002 数值直验：黄金快照恰 5 仓 vel≥20%（archify 53.1%、claude-plugins-community 58.7%、cursor/plugins 22.7%、awesome-gpt-image-2 43.5%、maka 38.4%）；archify 周增比 22095/1019=21.7（基线 2026-W28，周增而非总星）。
- AC-007 预检：通读 W36 全 20 仓分析，定位均为 2–4 句含领域×解决什么×核心入口，为什么爆均为因果叙事并明示推断边界、未复述行内星数，生态位均含具体竞品名（Mermaid/LiteLLM/v0/Catch2/Mem0 等），nicheTags 均为受控小写连字符数组。口径符合 analysis-guide；最终定夺仍归用户（C 档）。

仍待用户的两项 C 档动作不变：断网物理双击 report/index.html；读当期 analysis.md 定内容质量。
