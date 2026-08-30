<!-- draft v3 | published 2026-08-30T00:00:00+08:00
     用户意见：P3/P4/WEB-P5/WEB-P7 选择 A，WEB-P6 选择 B；工作台优先、全局主动作 + 安全并行、复杂审阅分级升级；768×1080 采用 Queue-first；固定六阶段并显式表达 Lane N/A
     WEB-P8：拒绝真假混写，要求真实 Issue 样本、明示模拟缺口、真实浏览器旅程与可视化设计
     状态：WEB-P8 rework audited; Web artifact and 2-prototype not yet confirmed -->

# workflow-story-map Web v3 产品设计依据

## 产品任务

用户打开页面后，十秒内必须能回答：

1. 这个 Story 现在怎样？
2. 为什么还没完成？
3. 现在轮到谁做什么？
4. 做完会解锁什么？

需要追责或复核时，再下钻到 RepoLane、Ticket、Attempt、Receipt、Gate 和事件历史。

## 参考物

- AES Workflow Console 当前生成页：固定源仓 `G:\GIT\AI_WorkFlow\aes-workflow`，HEAD `25cc3ce157bace9b7f813bb2642aca516b2b2af4`。
- 第一方实现：`skills/engineering/aes-using-workflow/console/template.html`、`console/export.py`。
- WayFinder 决策视图、工程阶段阅读面、人工核对和代码审查截图。
- 当前 `v2-mock.html` 及 1440×1000 截图。
- 事实分片：`facts/aes-workflow-web-visual-system.md`、`facts/aes-workflow-web-interaction-model.md`、`facts/mock-v2-product-audit.md`。
- Issue #147 真实数据：`../../1-interview/facts/issue-147-real-data.md`。
- WEB-P8 fixture 溯源审计：`../../1-interview/facts/web-prototype-fixture-provenance.md`。
- WEB-P8 真实浏览器逐屏审计：`webp8-product-audit.md` 与 `../evidence/webp8/`。

## 调研结论

AES 的优势不是 Graph 更漂亮，而是稳定的 operator workbench：

```text
Repository shell
  → object navigator
  → current item header + one next action
  → three task-specific views
  → contextual right rail
  → source/evidence drill-down
```

同一组事实在多个尺度重复投影：列表行用于扫视，任务头用于定向，阶段轨建立空间记忆，右栏把动作放在证据旁边，顶栏持续暴露 snapshot 与 stale 风险。

v2 已经把 Map 降为第二层，并建立 Action Center、RepoLane 和 evidence health；但仍是“五张同权 KPI + 多块白卡”的状态示例页，没有形成一条可完成的操作者主线。

## v3 采用哪些表达

| AES 表达 | v3 转译 | 原因 |
| --- | --- | --- |
| 固定 shell + 左侧对象列表 | Story/Lane navigator，可收起 | 先找到谁在等我，再看细节；不先解析 DAG |
| 标题下只有一句“下一步” | 单一 Story Pulse + 第一 CTA | 把 Now/Why/Next 合成一个可行动结论 |
| 稳定阶段 rail | 固定六阶段 Story Spine；Lane/Profile 映射，不适用显式 `N/A` | 建立 Discovery→Closeout 的空间记忆，不照搬九阶段 Artifact，也不把不适用误画成未开始或通过 |
| 总览 / 决策导航 / 工程流程 | 状态总览 / 依赖地图 / 交付与证据 | 三种用户任务使用三种信息形状 |
| 当前决策 / 图 / frontier 三栏 | Map 页：选中对象 / DAG / 当前 frontier | 图用于解释 Why，不成为首屏 |
| 目录 / 正文 / 批注右栏 | Evidence 目录 / Receipt 内容 / Inspector actions | 动作贴近证据，但不复制重型批注工具 |
| stale 与 outcome 分开 | lifecycle、等待、Gate、freshness 分开投影 | 异常不能被总绿吞掉 |
| snapshot time + blind checkout | persistent Source Integrity | 不冒充 LIVE；每个 source 独立显示 freshness |
| 发送前预览 prompt | typed command 预览 → 提交 → receipt | 继承“先看后改”，但不把复制文本冒充 dispatch |
| 恢复上次任务、视图、滚动 | 恢复 Story、Lane、tab、selection | 长周期工作不丢工作记忆；权威状态仍不进 localStorage |

## v3 不照搬什么

- 不复制 AES 的九阶段/十一格 Artifact rail；Story 使用六个业务阶段。
- 不复制 Work Item/Todo 两类对象；改为 Story、RepoLane、Action、Ticket。
- 不复制 WayFinder ticket 作为全部 Story 真源；Map 只解释 Discovery/Delivery 关系。
- 不复制 worktree/Junction/VS Code 专属字段到公共首屏。
- 不复制“复制 prompt 即已发送”；所有写动作都展示 command lifecycle。
- 不复制直接写 `manual-test.md`；人工动作发布授权 Human Receipt。
- 不复制代码评审的重型 split/unified 工具；只复用 Evidence 的双索引和逐层下钻。
- 不复制 AES 的缺口：默认隐藏 Next、窄屏 Graph-first、invalid/unreadable 静默消失。

## v3 首屏结构

```text
Shell: product / story identity / source integrity / snapshot refresh
├─ Story & Lane navigator
└─ Current Story
   ├─ Story title + contract/version facts
   ├─ Story Pulse: one conclusion + one primary action
   ├─ Story Spine: Discovery / Contract / Delivery / QA / Integration / Closeout
   ├─ Views
   │  ├─ 状态总览：Action Center + Lane Rails
   │  ├─ 依赖地图：Selected context + Map + frontier/handoff
   │  └─ 交付与证据：Gate/Receipt index + Evidence reader
   └─ Inspector
      ├─ 概览
      ├─ 证据
      └─ 历史
```

## 四类 Action 的产品闭环

### Decision

`处理决策 → 查看两种方案与影响 → 确认 → command acknowledged → DecisionReceipt → Story 重算`

### Human test

`开始核对 → 逐项 step/expected/evidence → 签发或打回 → HumanTestReceipt → Gate 重算`

### Degraded profile

`查看恢复边界 → allowed/blocked actions → 复制恢复命令或创建替代票 → command receipt → 状态刷新`

### Stale evidence

`查看受影响 Receipt → 选择重验 → dispatch acknowledged → 新 attempt/evidence pending`

每个闭环必须有失败态；完成后焦点回到更新后的 Action Center，并解释为什么下一项成为第一。

## 已锁定的 Web 产品裁决

- **P3：工作台优先。** 状态总览是默认入口，Map 是第二视图；首要任务是十秒内读出当前状态、阻塞、责任人与下一步安全动作。
- **P4：一个全局主动作 + 可并行队列。** Story Pulse 只突出一个最高杠杆安全动作，并显示“为何第一”；与它没有依赖或 policy 冲突的动作进入显式并行队列。不能安全并行的事项仍留在 Action Center，并标出等待的前置条件，不为表现吞吐而制造伪并行。
- **WEB-P5：复杂度分级升级。** 单步、可逆、低证据动作留在 Inspector/Modal；多 testcase、证据、Waiver、quorum、比较或跨会话草稿进入专用 Review Workspace，并恢复 view、selection、Inspector tab、scrollTop、sidebar 与触发焦点。
- **一级宿主视口：Codex 右侧 Web 面板。** 按 1920×1080 的约 40% 横向宽度，把 768×1080 当作主要工作面，而非退化的移动端兼容状态。
- **WEB-P6：Codex 侧栏 Queue-first。** 用户选择 B，推翻均衡密度推荐。只在 601～900px 压缩 Pulse、阶段内部留白与 Action row，优先提高队列容量；唯一主动作、常显排序摘要、可展开完整依据、安全并行项、六阶段、Snapshot 与 Inspector peek 不得折叠。宽屏与手机不随之变成高密度。
- **WEB-P7：固定六个 Story 级公共阶段。** 所有 Story 始终按 Discovery → Contract → Delivery → QA → Integration → Closeout 同序同位展示；RepoLane/Profile 的局部 lifecycle 映射到公共阶段，确实不适用时显示 `N/A`，不得隐藏或重排。`N/A` 不是 PASS、完成、阻塞或未开始。该裁决换取跨 Story 扫读、截图比较、培训与恢复时的稳定空间记忆，并接受局部生命周期被概括的代价；完整局部语义在 Inspector、Map 与 Gate evidence 中下钻。
- **WEB-P8：禁止真假混写。** 用户拒绝把真实 Issue 身份与自造 runtime 混成一个“现场”。默认页必须先展示当前 dossier 状态与 captured Issue 事实；RepoLane/Profile/Gate/Receipt 等没有真实来源时显示 `NOT_CONNECTED`。复杂状态可以用 fixture 补足覆盖，但必须进入独立 `SIMULATED GAP` 数据集，使用 `SIM-*` 身份并持续说明不代表 #147。该要求已实现并完成浏览器审计，但整件 Web artifact 尚未由用户确认。

## Source Integrity

Prototype 不再只有一个含糊的 `SCENARIO SNAPSHOT`。它采用五类互不越界的 provenance：

- `ISSUE`：captured GitHub tracker 事实；
- `DOSSIER`：当前 workflow-interview 的本地持久记录；
- `REPO`：未来 runtime adapter 提供的执行事实，当前为 `NOT_CONNECTED`；
- `DERIVED`：由已确认规则机械投影的有限映射；
- `SIMULATED`：只在独立 coverage scenario 中出现的缺失样本。

真实页先表达 `2-prototype pending / Web NOT_CONFIRMED`，再表达 #147 历史 Map 的 12/12 closure，避免“历史 Issue 已关闭”等于“当前重设计已完成”的错觉。真实成员树只画 #147 → 12 个 native membership edges，并明确 native blocker edges 为 0；三组栏目是 `DERIVED`，不是 tracker 原生依赖类型。

真实产品候选还需要以下 freshness 状态：

- source 与 projection revision；
- 每个 GitHub/GitLab/repo checkout 的最后成功同步时间；
- syncing / fresh / stale / blind / unavailable；
- 刷新结果：changed / no-change / error；
- invalid/unreadable 数据成为 persistent health item，不允许静默过滤。

## 视觉方向

方向名：**控制室编辑风**。

- 暖纸背景、深墨文字、陶土色只用于主要行动焦点；状态色只表示状态。
- Story 标题和结论使用 serif fallback；操作与正文使用 sans；ID/SHA/Receipt 使用 mono。
- 层级靠位置、字号、留白和 sticky，不靠满屏卡片或强阴影。
- 主结论 24–28px；动作标题 15–16px；正文 13–14px；元数据 11–12px。
- 状态第一层用人话，内部枚举降为次级 mono 标签。

## 响应式与可访问性目标

- 宽屏：左导航 + 中工作面 + 右 Inspector。
- Codex 侧栏（601～900px，主验收 768×1080）：采用 Queue-first。左导航是有 backdrop、Esc 与焦点归还的抽屉；固定六阶段全部等宽可见，阶段卡同时区分 Story 状态与 Lane/Profile 映射，紧凑宽度下以明确 `N/A` 表示不适用；Action row 使用三列紧凑投影并保留 Inspector 全文；Inspector 是 64px 底部 peek sheet，展开后内部滚动；状态总览、Map、Delivery 均不得产生页面级横向滚动。
- 窄屏（≤600px）：Story Pulse 与第一 CTA 最先；Action Center 次之；只有 Story Spine 与必要证据比较区允许局部横滑；Inspector 仍为底部 sheet。
- 复杂 Review Workspace 在 768px 使用 `208px testcase rail + minmax(0,1fr) work pane`；小于 600px 才堆叠。
- 使用真实 landmark、heading、tablist、tabpanel、dialog、aria-live。
- Modal 必须 focus trap、Escape 关闭、焦点归还；动态更新只播报摘要。
- 状态不只靠颜色；主要 target ≥44px；支持 reduced motion。
- WCAG 2.2 AA 是目标，未经键盘、读屏、200% zoom、320px reflow 和高对比实测不得宣称通过。

## 仍待整套 prototype 确认的表达面

WEB-P8 已把真实事实、当前 dossier 与模拟覆盖拆开，并用真实 Chrome 旅程验证主要操作；这仍不等于整件 Web artifact 已确认。当前最高杠杆确认点是：

1. 是否接受“当前 dossier pending + captured Issue truth”为默认页，而把复杂运行态放到独立模拟演练；
2. 若接受，是否还要求在 Web 确认前补齐多 actor Waiver/quorum 的完整路径；
3. 若不接受，默认页应改为连接哪一个可审计的真实 runtime 数据源，而不是再用 fixture 冒充现场。
