# workflow-interview-web 设计依据

## 意图与触发场景

本技能为 `workflow-interview` 提供本地 Web 双向交互入口和完整决策档案，让用户在同一浏览器
单页完成三阶段问题回答、原型质疑与 Goal Contract 确认；同一页面静态导出后，仍能独立说明
任务原文、候选、决策、代价、证据、确认过程与最终契约。家族技能的阶段门禁和过程文件保持
权威真源，Web 账本提供可校验的交互证据。

仅在用户显式调用 `$workflow-interview-web` 或明确选择 Web 入口时使用。普通需求访谈继续由
`workflow-interview` 处理，避免 Web server、后台等待和浏览器交互被意外启动。

## 设计取舍

- 保持薄编排：复用 `workflow-interview` 与三个阶段子技能，不复制访谈、原型或契约规则。
- 保持权威层级：Web submission 是待吸收输入，家族 `rounds.jsonl` 是吸收后的过程真源，最终
  Goal Contract 是交付契约；页面是这些事实的确定性投影，不另造结论。
- 使用 loopback、会话 key、同源校验和原子落盘，使本地便利性不牺牲提交完整性。
- 把 server 当可恢复的交互入口，不把它当 Agent 生命周期；跨会话恢复只依赖盘上状态。
- 主路径依赖宿主后台任务退出通知；能力不足时显式降级，不用轮询或非标准 resume 模拟唤醒。
- 页面和 runtime 使用 Node.js 内置能力与静态资源，保持零第三方运行时依赖。

### 单页设计约束

页面由 `scripts/web/index.html`、`style.css`、`app.mjs` 组成，零第三方依赖。结构对照来自该 issue
确认版 `2-prototype/mock.html`，不是像素规范。

#### 固定信息结构

- 顶栏：技能身份、三阶段面包屑、访谈/完整轨迹/契约视图切换、静态导出、开放歧义数、连接状态。
- 访谈主列：只读任务陈述、按 round 一次展开的紧凑问题列表、默认区、确认区、附件 iframe、提交/锁定态。
- 顶栏下方：横向 sticky 的已锁定结论摘要；不占固定右栏，长页面滚动时保持上下文。
- 契约视图：分节正文、依据溯源、确认与需修改自由文本。
- 完整轨迹：任务原文、每轮全部候选及优劣势、canonical 决策、Goal Contract、来源/附件、
  摘要链 ledger 和导出 manifest。它不依赖 localStorage 才能成立。

ask 选项以可换行 pill 一次平铺多个问题，默认只显示选项正文与 pct/推荐标记；覆盖、好处、代价
紧贴在每道题自己的固定详情槽中。详情槽把该题所有 choice、Other 输入态叠在同一 CSS Grid
单元中，由最高状态参与首次布局，之后只切换可见性；因此内容完整、位置就近，选择前后后续
问题的纵坐标保持不变。每道已答题的详情持续可见，不会被新选择替换；成功提交后本机保留
本轮答案用于只读回看。Other 与普通选项互斥。默认项不操作即 accept；confirm 必须明确确认
或翻掉。

多选使用原生 checkbox 语义；每个候选的解释在固定表格行中同时可见，选择只切换行的选中态。
互斥选项由 schema 的 `exclusive_keys` 声明并由服务端再次校验。文本、数值、日期、排序和证据
都有独立结构，不把不同语义压进一个 `custom` 字符串。

#### 本地恢复与断线

未提交答案以 slug+round 为键写 localStorage；刷新继续编辑，成功提交后删除草稿。网络失败时
把整轮 payload 写本机离线队列，WS 重连后顺序补发；409 视为已被首次提交吸收。WS 重连从
500ms 指数退避，上限 30s。

附件 iframe 使用空 sandbox，不能执行附件脚本。server 同时给附件收紧 CSP；附件只用于查看
确认版对照物。

#### 中文与视觉

普通 UI 文案使用中文，Provider/Prompt/Skill、路径、命令、字段与技术标识保留原样。视觉采用
暖纸背景、深墨文本、陶橙动作色与鼠尾草绿确认色；衬线标题和无衬线正文构成层级。移动端把
紧凑问卷保持单列阅读宽度；顶栏在常规窄窗口分行，pill 自动换行，不能隐藏问题、代价、
已锁定结论或契约确认。

#### 来源与许可证

WS 基础形态与本地视觉 companion 的早期参考来自 Jesse Vincent 的 Superpowers 项目；许可
文本见 [SUPERPOWERS-LICENSE.txt](SUPERPOWERS-LICENSE.txt)。当前 runtime 已改写为 `.mjs`、
声明式 state 与双向 submission 协议；来源声明不表示运行时依赖或要求安装 Superpowers。

## 验收条件

| 编号 | 验收条件 |
| --- | --- |
| AC-1 | 仅显式调用本技能时进入 Web 路径；三阶段规则仍读取并遵守家族技能。 |
| AC-2 | submission 先原子写入 `web/submissions/`；只有全部家族 round 写入成功后才生成 consumed marker，失败可重试且不丢输入。 |
| AC-3 | server 只绑定 loopback；HTTP、WS 与附件访问均鉴权，会话 key 不写入日志或 git。 |
| AC-4 | 单页完整呈现 ask/default/confirm、附件和契约确认；刷新、断线与重复提交均有确定行为。 |
| AC-5 | 缺少后台任务、Node 或浏览器时按文档降级，且不改变三阶段范围与门禁。 |
| AC-6 | 技能根部 `run-tests.mjs` 可一次执行 runtime 黑盒回归，覆盖启动、鉴权、发布、提交、恢复、附件隔离和关闭。 |
| AC-7 | 最终确认吸收后调用家族 `finalize`，报告契约与交接证据并显式停止 server。 |
| AC-8 | 在 pending round 中止本次 Web 交互时，可显式关闭 server，保留 state 与关闭标记，并清理会话凭据和 server-info。 |
| AC-9 | 每道题在选项下方永久保留自己的详情槽；连续选择 choice、Other 或 veto 时，后续问题不发生纵向位移，已答题的覆盖、好处和代价仍同时可见。 |
| AC-10 | ask 支持 single-select、multi-select、boolean、short/long text、number、date/time、ranking、evidence；多选互斥/min/max 同时由 UI 与 server 校验。 |
| AC-11 | 已提交答案、发布 revision/digest、吸收状态与 ledger 都由服务器文件重建；刷新或跨会话时不依赖 localStorage 作为权威来源。 |
| AC-12 | `/export` 与 `export-static.mjs` 生成单文件决策档案，包含任务原文、全部候选及优劣势、全部决定、Goal Contract、来源/附件索引、事件链、追溯与 digest，断开 server 后仍可阅读。 |
| AC-13 | 决策档案投影实现随家族分发（`workflow-interview/scripts/lib/dossier.mjs`），本技能 runtime 复用同一投影，不复制第二份实现；家族写入器（session/校验器）不进 runtime。 |

## 迭代记录

| 日期 | 改动 | 与上轮比较 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-08-23 | 补齐标准 frontmatter、根部自测入口、设计依据与 AC 追溯锚点。 | 严格评测待运行 | 保持 Web 薄编排层，不进一步拆分。 |
| 2026-08-23 | 完成 12 项 runtime 回归、真实打包、三 gate 输出评测与真实浏览器提交验收。 | 首次沉淀，无上轮可比；三 gate 均 5/5 | 建议评估抽取共享 Web transport；仅建议，用户未裁定。 |
| 2026-08-23 | 参考用户提供的 Claude Design 截图，把卡片式双栏重构为一次展开多问题的紧凑 pill 问卷，并加入 sticky 锁定摘要与按需详情。 | runtime 契约不变；多尺寸视觉 QA 通过 | 不改变技能拆分建议。 |
| 2026-08-23 | 把选中详情、Other 和 veto 输入统一迁入固定底部 Dock，消除选择造成的文档流跳动。 | 待连续选择坐标回归与浏览器 QA | 不改变技能拆分建议。 |
| 2026-08-23 | 完成 Dock 严格回归：1220×900 下 choice、Other、veto 切换前后 4 道题的 documentTop/height 最大偏差小于 0.001px；920×800 下无横向溢出，Dock 固定 116px，完整提交后开放歧义为 0。 | AC-9 从待验证变为真实浏览器通过；runtime 契约不变 | 不改变技能拆分建议。 |
| 2026-08-23 | 根据用户实测否决底部 Dock：改为逐题固定详情槽，并让所有已选题的解释同时留在原位；详情槽由该题最高状态参与布局，避免写死高度或截断。 | 修复“选项与解释距离过远、旧选择解释被替换”的可用性回归；待重新跑坐标与多尺寸 QA | 不改变技能拆分建议。 |
| 2026-08-23 | 完成逐题详情槽严格回归：1280px/920px 下 choice、Other、veto 切换零位移；提交和刷新后仍可回看 3 个选择及 9 项优劣势事实。 | AC-9 重新通过真实浏览器；修复上一版 Dock 的 P1 回归 | 不改变技能拆分建议。 |
| 2026-08-23 | 把页面提升为 Goal Contract 全流程决策档案：新增九类结构化回答、多选固定解释表、canonical server 投影、摘要链 ledger、完整轨迹视图与自包含静态导出。 | 从“交互结束后只剩摘要”升级为可独立审计的需求轨迹；协议 schema v2 保持 v1 单选兼容 | 共享 dossier 投影已抽到 `scripts/lib/dossier.mjs`；仍属本技能内部，不拆新技能。 |
| 2026-08-23 | 修复 issue #1/#2：pct 只对 single_select 强制；multi_select 接受文档 `min`/`max` 并在发布时正规化为 `min_selections`；boolean 支持 `true_label`/`false_label` 无 options 形态；sticky 端口迁入 `<issue>/web/.last-port`，不再向 issue 目录外写 `.aes-workflow`。 | 回归 16/16；按协议文档构造的 round 发布、边界强制、提交、导出全链复测通过 | 不改变。 |
| 2026-08-24 | 首跑触发评测并沉淀题库与成绩：21 条 query（10 正 11 负，负例以 near-miss 为主）× 3 探针，同宿主 GLM-5.3 独立单轮会话；train/test 均 1.00 触发、0.00 误触发，description 无需迭代。 | 触发面首次有据；结构审查信号 4（误触发集中）由无数据变为不命中——零误触发 | 拆 transport 建议维持仅建议、用户未裁定；触发题库已定稿不再改。 |
| 2026-08-29 | 按 #146 对齐裁决：`response` 结构化类型与 pct 规则（仅 single_select 强制）下沉家族 `rounds.jsonl` schema；决策档案投影库迁至家族 `workflow-interview/scripts/lib/dossier.mjs`，本技能 export-static/GET /export 复用同一投影，账本写入器留 web（`lib/ledger.mjs`）。 | runtime 回归 16/16；两载体档案同构由单一投影实现保证 | 不改变——投影库归家族后本技能更薄。 |
