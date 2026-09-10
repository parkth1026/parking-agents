# Context Snapshot: 2026-09-11-local-mr-squash

- 创建：2026-09-11
- 分片来源：无，宿主直接调查（本会话完整实证 + 技能库/仓库证据）

## 任务陈述

用户原话：「我们开始 正规访谈来锁定所有需求 local-mr-squash 这个 skill的 所有需求，除了提到之前的之外，这里面应该跟 GitLab 没关系，本质上就是 local 的 Git 管理，还有就是，在 merge 过程当中，一定要用 "G:\GIT\AI_WorkFlow\parking-agents\skills\matt-skills\engineering\resolving-merge-conflicts\SKILL.md" 这里的核心思想。 确保 merge 内容是严格有历史追溯的不是 只是执行一个 git 命令。 他是真的是要 llm 驱动的 功能合并。」

## 用户提出的方案

前几轮已演化并部分拍板的形态：`git merge --squash` 单笔提交 + 验收管线（code-review 双轴/simplify 三轴/aes-qa 循环轮）+ 合并台账（入库、带规则版本戳）+ policy 外置契约文件 + 分支生命周期处置（删/前滚分流为 policy 条目）+ pre-push hook 延后为 phase 2。steelman 裁决的核心价值锚：**流程规则改不改由用户说了算（规则主权）**。

## 意图假设

把本会话手工走通一次的「本地 PR squash 全流程」工业化为可复用技能。表面任务是「写个技能」，真实意图是三件事的固化：① LLM 语义级合并（不是跑 git 命令，是理解双方意图后裁决）；② 合并全程留痕可追溯（谁/为何/怎么合的/原提交是什么）；③ 规则主权自持（流程规则外置可改，不绑任何平台）。与任务陈述的差：用户点名「严格历史追溯」与「真的 LLM 驱动」，意味着追溯粒度与语义合并深度可能超出此前设计的 MR 级台账——待问。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| resolving-merge-conflicts 五步核心：看现场→溯源一手资料（commit message/PR/issue）→逐 hunk 保双方意图、不相容按合并目标裁决并记取舍、不发明行为、永不 --abort→跑自动检查→收尾 | matt-skills 版与 .agents 版内容一致（本会话双读比对） | Fact |
| 用户技能库 89 个技能在 C:\Users\parking\.agents\skills（跨项目全局），parking-skill-creator 提供六步铸造流水线（脚手架/quick-validate/run-tests.mjs 回归/触发评测） | `parking-skill-creator/SKILL.md` | Fact |
| 本仓验证基建：./run 契约（check/lint/test.frontend/test.rust/test.e2e.cdp/gate/gate.quick/gate.mid…），`./run show <id>` 可读行为契约 | AGENTS.md + 本会话实测 | Fact |
| 用户既有标准合并验收管线：merge 解冲突→code-review→修复→simplify→aes-qa→全修后 commit（记忆编码，多次复用） | 记忆 merge-acceptance-pipeline | Fact |
| squash 簿记坑：merge-base 不感知、`branch --merged` 失效、解法=删除或前滚（branch -f 优先/worktree 内 merge） | 本会话实证（8722165 合并轮） | Fact |
| 台账/档案入库有先例：.aes-workflow/grilling/ 过程档案按提交原样保留；文档同步三律是仓库对「过程文档漂移」的制度化防线 | AGENTS.md、git 历史 | Fact |
| 本会话实证：语义合并中 issue 原文是 load-bearing（读 #122/#63/#141 才正确裁决了三处自动合并的语义正确性与验收） | 本会话 8722165 合并轮 | Fact |

## 验证基建候选池

- 技能自身验收：parking-skill-creator 的 quick-validate + run-tests.mjs 结构回归 + 触发评测（评测产物落 skills 祖先父级 evals/<技能名>-workspace/）——现成，零先建成本
- 技能执行产物的验收（在目标仓跑）：目标仓 ./run 契约全家 + 用户标准管线三技能——现成
- 真实冲突场景演练：需造 fixture 仓（含两侧改动、冲突、语义冲突用例），代价=先建 fixture，但这是唯一能验「LLM 语义合并」真实深度的途径

## 术语冲突

- 「功能合并」：用户指 LLM 语义级合并（理解意图后裁决），非 git merge 的机械含义——按用户义走
- 「MR」：本技能语境指本地台账概念（merge record），与 GitLab Merge Request 无关——技能文案须避免混用
- 「一手资料」：resolving-merge-conflicts 第 2 步原文含 "check the PRs, check original issues/tickets"，与「跟 GitLab 没关系」存在张力——数据源边界待用户裁决（Q1）

## 四分类（R2 终态）

- **Fact**：五步核心思想内容（含第 4 步自动检查、第 5 步检查后才 commit）；技能库/铸造流水线；本仓验证基建；squash 簿记语义；issue 原文对语义合并的实证价值
- **User decision**（全部已裁决）：Q1=local 优先 + tracker 可选增强（经 policy 声明 tracker 命令，缺省无）；Q2=按 resolving-merge-conflicts 自身表达范围（语义层仅冲突介入；零冲突不强制全合并面审阅）；Q3=通用技能 + per-repo policy（无 policy 拒跑）；Q4=冲突裁决逐条入台账；**台账不入库**（local-only，缺省被管仓 `.git/merge-ledger/`，policy 可改；接受跨机/删仓后追溯只剩 commit message）；**重验收管线不内嵌**（调用方自选强度与时机，SQUASHED 态为天然 hold 点）；五步第 4 步自动检查（policy 声明命令）绿 = COMMITTED 前置必经
- **Agent-owned**：SKILL.md 行文与结构、台账字段细节、policy schema 与路径、tracker 增强命令模板、状态机措辞、fixture 造法、分支生命周期（默认区：删/前滚 policy 条目 BOOKKEPT 必答）、squash-only 范围、触发话术（触发评测兜底）
- **Blocked**：无

## 决定边界未知项

- 无（R2 全部落定）

## 未知项

- 无跨仓库边界未查项（本会话即第一手现场）
