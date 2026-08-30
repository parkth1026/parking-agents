<!-- draft v1 | published 2026-08-30T14:20:00Z
     用户意见：先重新确认 Web 与业务是否对齐，再决定是否确认 v5
     状态：audit complete · v5 rework required · not confirmed -->

# Product / Business Alignment Audit · Story Work Graph v5

## Audit scope

- Surface: `drafts/v5-story-work-graph.html`
- User goal: 在约 768×1080 的 Codex 右侧工作面中，理解一个 Story 从 Discovery 到 Delivery 的全闭环，并可信判断当前状态、阻塞、证据和下一安全动作。
- Capture: 本轮重新启动页面并按 `Delivery default → Evidence → Discovery → selected node → source boundary → cross-Graph return` 操作，不复用旧截图作为本轮视觉证据。
- Business source: `1-interview/facts/web-v5-business-alignment-audit.md`。

## Overall verdict

**REWORK_REQUIRED。** 双 Tab、真实/模拟隔离、Map-first 与只读 Web 方向正确；当前不应确认 v5。阻塞确认的主要原因是业务对象语义，而非视觉风格。

## Flow steps

### Step 1 — Delivery default · Health: structurally good, semantically incomplete

Evidence: `evidence/webp12-business-alignment/01-delivery-default.png`

- Strength: Story header、truth boundary、Story Pulse、双 Tab、Graph 和当前主动作在 768px 内形成清晰层级。
- Risk: `WEB/CORE RepoLane` 未证明是 repo/integration unit；`Delivery 0 verified` 与下方大量 passed/running 模拟节点需要持续阅读 truth boundary 才不会误解。
- Risk: Lane Gate 没有 integration SHA/full-suite subject，Story reducer 只展示两个 Lane Gate。

### Step 2 — Evidence modal · Health: trustworthy freshness story, incomplete policy story

Evidence: `evidence/webp12-business-alignment/02-evidence-modal.png`

- Strength: FRESH / STALE / MISSING / LOCKED 的关系非常直观；stale 明确 audit-only。
- Risk: `profile digest match` 没有具体 digest、policy revision、required predicate 或 actor authorization，因此只能是说明性模拟。
- Accessibility: Modal 有标题、关闭按钮、焦点进入和 Escape 关闭；截图不能证明真实 screen reader reading order。

### Step 3 — Discovery default · Health: real graph, wrong current-version emphasis

Evidence: `evidence/webp12-business-alignment/03-discovery-default.png`

- Strength: 12 membership、7 dependency 和 root 0/0 边界正确，历史真实数据没有被模拟 Delivery 污染。
- High risk: 页面标题写 `current projection`，主 Graph 却只有旧 #147/#148–#159 revision。本轮重访谈的新决定只被压成 `LOCAL 2-PROTOTYPE PENDING`，当前 Discovery revision 本身不可见。
- Visual risk: dependency 线交叉较多，成员边与 dependency 的视觉权重接近，未聚焦时难以扫描真实阻塞链。

### Step 4 — Select #153 · Health: selection works, feedback is off-screen

Evidence: `evidence/webp12-business-alignment/04-discovery-selected.png`、`05-discovery-inspector.png`

- Strength: selected node 边框变化明确，Inspector 能回答 Now/Why/Owner/Next/Source。
- High UX risk: 点击后页面不把 Inspector 带入视野。用户必须手动滚过整张图，才看到选中结果；在默认视口中动作看起来几乎没有产生业务反馈。
- Business risk: Inspector 只有一个 state/owner，缺 lifecycle/control/gate、Profile、Role/Carrier 与 subject provenance。

### Step 5 — Source boundary · Health: strong trust mechanism, priority incomplete

Evidence: `evidence/webp12-business-alignment/06-source-boundary.png`

- Strength: ISSUE FACT / DOSSIER FACT / SIMULATED GAP 分层是 v5 最可信的部分。
- Risk: 未明确旧 spec/ADR 与本轮 rounds/context 冲突时的优先级；“真实设计依据”容易被理解为当前规范。

### Step 6 — Delivery → Discovery return · Health: concept clear, trace recovery incomplete

Evidence: `evidence/webp12-business-alignment/07-cross-graph-return.png`

- Strength: finding → decision → contract revision → Receipt stale 的闭环解释清楚。
- Risk: 当前只是说明 Modal，不是连接 source finding、target decision、contract revision 和 new wave 的可追踪 projection；也没有回到原 Delivery selection/scroll 的恢复动作。

## Highest-impact findings

1. 把 historical Discovery 与 current dossier revision 做成版本化 Discovery projection，而不是“旧图 + pending badge”。
2. RepoLane 必须是真正 repo/integration unit；否则 WEB/CORE 改称 Workstream。
3. Inspector 恢复 lifecycle/control/gate、Profile、Role/Carrier、subject/integration provenance。
4. Story terminal 展示 exact integration SHA、final full suite、Human/Waiver 和完整 why-not-done。
5. 点击节点时让 selected context 在同一视口可见；跨 Tab 回流需要 source/target trace 与返回位置。

## Accessibility risks and evidence limits

- 本轮截图确认 768px 无明显横向溢出，文本状态不是仅靠颜色表达。
- 真实 screen reader、200% zoom、Windows high contrast、320px reflow 仍为 `NOT_RUN`。
- 本轮浏览器唯一 console error 是本地临时 HTTP 服务缺少 `favicon.ico`，不影响页面业务交互。
- 截图无法证明十秒理解，也不能证明模拟 Profile/Gate/Receipt 的运行正确性。

