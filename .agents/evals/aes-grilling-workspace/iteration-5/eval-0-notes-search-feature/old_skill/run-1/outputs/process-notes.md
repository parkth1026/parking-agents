# 过程记录（skill-snapshot-v4 / aes-grilling）

执行的 SKILL：`G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\skill-snapshot-v4\SKILL.md`
目标仓库根：`...\old_skill\run-1\workdir`
未调用其它 skill，未读取仓库根 AGENTS.md / CLAUDE.md 的工作流规则。

## 走过的步骤

**第 1 步 调查事实（执行）**
- 目标仓库只有 `fixtures/notes-cli/notes.py` + `README.md`，全文读完（109 行，纯标准库）。
- 固定查清「验证基建」：无 tests / 无 pytest / 无 unittest / 无 CI 配置 / 无覆盖率工具 / 无 fixture 约定 / 无依赖声明文件 → `[A]` 档默认不可用，「怎么算过」按 SKILL 升级为用户决定。
- 固定判定「对照物分类」：`search` 是新增子命令，没有既有可观察行为可对照，也没有图形界面；但输出格式与 `list` 强耦合，落在哪一类读不出来 → 按 SKILL 归为 `User decision`，进第 1 轮提问（Q7）。
- 归类：Fact = 现有子命令/表格渲染/退出码惯例/无测试基建；User decision = Q1–Q8；Agent-owned = 内部函数组织、lower 还是 casefold、参数内部命名；Blocked = 无。
- **未派遣 subagent**：仓库只有两个文件、总量不足 150 行，宿主一次读完即可，不存在两个以上互不依赖的事实问题，并行调查纯属开销。

**第 2 步 批量问清歧义（执行，1 轮）**
- 先给完整推荐候选（Goal 一句话 + In/Out 各一句 + AC 大致方向）当靶子，再一次列出 8 个独立歧义。
- 独立歧义 8 个 > 4，按 SKILL 用**编号文本**一次全列，**未调用 AskUserQuestion**（工具上限 4 题不是拆轮次的理由；且本次为模拟用户，按 PERSONA 代答）。
- 每题都带证据摘要、2–4 个互斥选项、推荐答案和真实代价。
- 逐维度自评：Intent / Outcome / Boundary / Constraints / Context 全部「已定」；收口审计通过（剩余问题只改实现不改执行）→ **未追加第二轮**。

**第 3 步 对齐对照物（执行，选行为对照表）**
- 用户在 Q7 选了「出 CLI 行为对照表」，故产出行为对照表而非 mock HTML（CLI 无图形界面，mock HTML 价值低）。
- 草案先落在临时目录（scratchpad/behavior-draft.md），不占用 `docs/goal-contracts/` 路径；用户确认无修改后才落盘为确认版
  `workdir/docs/goal-contracts/2026-08-07-notes-cli-search-behavior.md`。
- 对照表含：6 条示例数据集、4 个场景（含 2 个边界场景：正则元字符字面量、无命中）的具体命令与逐字期望输出、10 行不变清单。
- 期望输出不是手写猜的：用一段脚本复算了 `notes.py` 里 `f"{id:<4} {title:<24} {tags:<16} {date}"` 的填充结果，保证 fixture 可逐字节比对。该脚本只在临时目录运行，未接触 workdir 产品代码，也未生成 `notes.json`。

**第 4 步 对齐验收标准（执行）**
- 一次列出 6 条 AC 交用户逐条裁决（接受/改措辞/删/补），并说明可以一次回复完；用户全部接受。
- 对照表的确认例子行直接转成 Verify：4 个场景 → 4 条 `[B]` 黄金用例（输入与期望输出取自对照表，未另行发明）；不变清单 → Constraints + 一条 `[C]`；文档 → 一条 `[D]`。
- `[B]` 档所需 fixture 列入 Deliverables（D-01 输入数据集、D-02 期望输出集）。
- Verify 行由我起草，只有「无基建怎么算过」这个升级点交了用户裁决（Q8），符合 SKILL 的升级条件（仓库无现成基建、`[A]` 不可用）。

**第 5 步 形成并确认 Contract（执行）**
- 进入本步才读 `references/goal-contract-template.md` 并严格按其生成；未读 example（信息密度无需校准）。
- 落盘 `workdir/docs/goal-contracts/2026-08-07-notes-cli-search.md`，Status = Ready。
- 可选节：Read First（对照表 + notes.py + README）、Deliverables（D-01/D-02）、Iteration Strategy（一句话）均使用。
- 对照表进 Read First 而非 Deliverables，并在 Agent Mandate 的 Must not 中写明不得修改确认版对照表与已落盘的期望值。

**第 6 步 校验与交接（执行）**
- 运行 skill 自带 `scripts/validate-goal-contract.ps1`：`VALID / STATUS: Ready / AC_COUNT: 6 / LINE_COUNT: 75`，退出码 0，**零 WARNING**。完整输出见 `validation.txt`。

## 跳过的步骤及原因

- **subagent 并行调查**：仓库规模过小，不存在两个以上互不依赖的事实问题（SKILL 的并行前提未成立）。
- **界面 mock HTML**：本次对照物形态由用户裁决为行为对照表；CLI 无用户可见图形界面，mock HTML 不适用。
- **追加提问轮次**：第 1 轮回答未解锁任何会改变执行的新歧义，收口判据已满足；SKILL 明确「默认就一轮」。
- **AskUserQuestion 工具**：独立歧义 8 个超过工具 4 题上限，SKILL 指定改用编号文本一次全列。
- **读 goal-contract-example.md**：SKILL 规定「仅在需要校准信息密度时读取」，本次不需要。
- **实现代码 / 修改 workdir 产品代码**：本 Skill 不实现 Contract 中的目标，用户也明确「先不要写代码」。D-01 / D-02 是执行 Agent 的交付物，本次不预先落盘。
- **发出启动指令**：Contract 为 Ready，`references/handoff-prompt.md` 的会话式变体启动指令已在最终报告中给出，但未真正启动实现。
