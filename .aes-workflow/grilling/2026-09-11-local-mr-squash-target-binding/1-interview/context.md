# Context Snapshot: 2026-09-11-local-mr-squash-target-binding

- 创建：2026-09-11
- 分片来源：无，宿主直接调查（temp fixture 实证）

## 任务陈述

用户原话（发起）：

> 「[$workflow-interview] 我们 走正规流程」

其针对的修订议题来自此前 steelman 裁决的下一步（用户认可走正规流程将其契约化）：

> 「1. prose 治根：SKILL.md 第 1 步显式化目标……正文两处「主干」改「目标分支（dev/main 等）」……2. 门禁加一条前置校验（动锁定契约，需你拍板）……3. run-tests 补双 worktree 演练」

用户在 steelman crux 问题上的回答（定义真实工作形态）：

> 「两个 worktree 同时开 seesion 要求 合并到 dev」

## 用户提出的方案

steelman 裁决给出的三步（如上）；用户以「走正规流程」整体纳入本轮访谈，未另行提出新方案。

## 意图假设

让 local-mr-squash 适配用户的真实工作形态：双 worktree 各占一个 session、合并目标是 dev（非 main）。表面议题是「目标显式化」，事实调查揭示更重的根：在该拓扑下锁定的收口设计结构性走不绿——修订必须同时处理收口路径，否则技能在其日常场景里永远靠 --keep 逃生门收场。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| A. 合并前在源 worktree（检出=源分支）跑门禁：四项同义反复全绿（exit 0 假绿） | 本日 temp fixture 实测（wt2 检出 feature，未合并即门禁全绿） | Fact |
| B. 源分支被别处 worktree 检出时 `git branch -f <src> HEAD` 被拒（exit 128） | 同上实测 | Fact |
| C. `git merge --squash` 合并「他处检出的分支」本身可行（git 只禁同分支双检出，不禁读侧合并） | 同上实测 | Fact |
| D. 收口「彼处 `git merge <target>`」产生 merge commit（squash 使源与目标成同树不同提交的兄弟，非 fast-forward），源 tip ≠ HEAD 恒成立 → 门禁第 4 项永远红。含主干独立提交的真实形态复测同样成立 | 同上实测（两轮，含 b0+f1+m1+squash 形态，merge commit「Merge branch 'main' into feature」） | Fact |
| E. 收口「彼处 `git reset --hard <target>`」：源 tip == HEAD，门禁四项全绿（exit 0） | 同上实测 | Fact |
| F. `git branch -D` 在源被 worktree 检出时同样被拒（cannot delete branch used by worktree） | 本日 temp fixture 实测（脚本错误信息直接复现） | Fact |
| G. 分支删除后门禁第 3 项红（`git diff HEAD...<missing>` 报错→FAIL）——上一轮交付已发现并上报的锁定契约内部矛盾 | 代码走读 verify-squash-merge.mjs 第 3 项 + git 语义 | Fact |
| H. B1 漂移（squash 后源前进）被门禁第 3 项捕获——已实测且有回归断言 | 初铸 run-tests 四态·漂移 | Fact |
| I. 综合 B/D/F/G：双 worktree 拓扑下，锁定设计的常规收口（branch -f / 彼处 merge / branch -D）无一路径能全绿；唯一实测可行 = 彼处 reset --hard（E）或先拆源 worktree 再 branch -f/-D | B~G 推演，B/D/E/F 均实证 | Fact |
| J. 验证基建：run-tests.mjs（43 断言，回归门）、quick-validate.mjs（结构门）、触发评测管线（同宿主 subagent 探针，本轮 60 探针已跑通）、temp fixture 实证法 | 初铸交付 + 本日两轮实证 | Fact |
| K. SKILL.md 现状：正文 17 行（门槛 ≤45）、步骤 7 条（≤8）、43/43 绿；description 为触发评测定稿资产（trigger-evals.json 定稿不改，改 description = 新一轮探针） | 初铸交付物 + trigger-eval.md 纪律 | Fact |
| L. 锁定契约（旧 issue 2026-09-11-local-mr-squash/3-contract）强约束：prototype 三件为不可修改规格源；门禁四项检查语义表锁定 | 旧 contract.md 强约束节 | Fact |

## 验证基建候选池

- run-tests.mjs 回归门：改动后必跑，可加双 worktree/前置校验/收口路径断言（代价：低，自主边界内）
- quick-validate.mjs：结构合法性（代价：低）
- temp fixture 实证：本轮已两次用于锁定 git 行为事实，可固化为 run-tests 用例（代价：低）
- 触发评测管线：仅当 description 措辞改动时需要重跑（代价：~60 探针一轮）

## 四分类

- **Fact**：A~L（全部实证或代码走读可答）
- **User decision**：
  1. 收口路径修复方案（prose 改 reset --hard / 门禁第 4 项判定放宽 / 双管 / 不修走 --keep）——改变锁定契约或收口语义，成本结构不同的成熟路径
  2. 门禁前置校验（检出==源 → 拒）的档位：用法错类 / 第五项检查 / 不加——动锁定契约的方式与程度
  3. description「合入本地主干」泛化：只改正文 / description+重跑评测 / 不动——措辞准确性 vs 评测成本
- **Agent-owned**：prose 具体措辞（量级门槛内）、run-tests 双 worktree 用例与断言写法、前置校验实现细节、fixture 造法
- **Blocked**：无

## 决定边界未知项

无——三个 User decision 均已成型为可选项。

## 未知项

无（跨仓库边界的事实已由 temp fixture 实证覆盖）。
