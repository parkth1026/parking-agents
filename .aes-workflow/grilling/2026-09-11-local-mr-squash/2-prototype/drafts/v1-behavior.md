<!-- draft v1 | published 2026-09-11
     用户意见：待质疑
     状态：superseded by v2（R3 总反思推翻机制版） -->

# 行为对照表: 2026-09-11-local-mr-squash

## 变化行

| # | 输入 / 前置 | 现在的行为（裸 git） | 改后的行为（local-mr-squash） |
| --- | --- | --- | --- |
| 1 | 用户/agent 说「把 dev-parking squash 合过来」「本地 PR 流程合并 X」 | agent 凭记忆自由发挥，步骤因会话而异 | 技能激活，进入状态机 OPEN：台账分配下一号，预检四查（policy 存在/target 与 origin 同步/工作树干净/源分支 tip 记录入台账） |
| 2 | 被管仓无 `.merge-policy.toml` | （无此概念） | **拒跑**，输出 policy 样例全文供用户落盘；拒跑前零写入、零 git 操作 |
| 3 | policy 存在但 `[validation].commands` 为空或缺节 | — | **拒跑**：没有自动检查底座不许合并（五步第 4 步不可跳过） |
| 4 | 预检过 → `git merge --squash <source>` 零冲突 | agent 直接 commit，自动合并结果未经语义核对 | 跳过语义裁决层（Q2 裁决：零冲突不强制全合并面审阅），直接进 CHECKED 跑 policy 声明的自动检查 |
| 5 | squash 报冲突（如 09-08 轮的 run.toml） | agent 凭直觉解，取舍不留结构化痕迹 | 五步语义裁决：逐 hunk 读双方提交溯源意图（local：git log/show、分支名、既有台账；tracker 增强见行 6）→ 裁决优先保双方意图，不相容时按本次合并目标选边并记取舍 → **每条裁决写入台账 rulings**（文件/hunk/双方意图/裁决/取舍/证据出处） |
| 6 | 裁决需要意图还原，源分支 commit message 带 issue 号（如 `#141`） | agent 可能自行调 glab，也可能不调 | 若 policy `[tracker].enhance` 声明了命令模板 → 执行取原文作增强输入；**失败（断网/命令缺失）静默降级 local-only**，台账记 `enhanced:false`；policy 缺省该节 = 纯 local（Q1 裁决） |
| 7 | 冲突 hunk 双方意图真的不相容且溯源无法判定取舍 | agent 可能瞎选或 --abort | **停问用户**：呈现双方意图与证据，等裁决；永不 `--abort`、不发明第三种行为（五步硬约束） |
| 8 | CHECKED 态：跑 policy `[validation].commands` | 无固定检查口径 | 全绿才许进 COMMITTED；红则修复「合并弄坏的东西」（五步第 4 步原义）后重跑；修复不了停 CHECKED 态 fail，留断点 |
| 9 | 用户在 SQUASHED/CHECKED 态插话：「先跑 code-review/aes-qa 再 commit」「先别 commit」 | 无此概念 | hold 点：挂起状态机执行调用方指定的验收，**验收结果不自动决定 commit**（重管线不内嵌，强度与时机调用方主权） |
| 10 | 检查绿（+可选验收毕）→ 单笔 commit | commit message 质量随机 | 固定模板：标题（源分支+主题+issue 号）+ 正文（原分支 hash 清单 / 冲突裁决摘要 / 已跑检查命令 / policy 版本戳） |
| 11 | commit 后 | 分支原地不动，「不知道自己被合并了」 | 台账写全量 record（含 rulings、policy 版本戳）→ 生命周期按 `[lifecycle].rules` 判类执行：`delete`（git branch -D）/ `forward`（未被检出时 `git branch -f <src> <commit>`；被 worktree 检出且彼处干净、tip 未前进时彼处 `git merge`；条件不满足停问）→ **未命中任何规则 = 停问用户** |
| 12 | 任意时刻会话中断/agent 换代 | 现场丢失，从头再来或烂尾 | 台账 state 即断点：重入从该态续跑不重来；台账与 git 实态不符（如源 tip 又前进了）→ **fail closed 停给人** |

### 边界值行

| # | 输入 / 前置 | 行为 |
| --- | --- | --- |
| B1 | 源分支在流程中 tip 前进（有人又在 worktree 提交） | fail closed：台账记录的 tip ≠ 实际 tip 即停，提示用户处理新提交后重跑 |
| B2 | 源分支零提交领先（diff 为空） | 拒跑：「nothing to merge」，台账不留 OPEN 记录 |
| B3 | 冲突数为 0 但自动检查红 | 同行 8：修的是合并引入的破坏，不是源分支既有问题（既有问题如实报告不改） |
| B4 | 台账目录被用户手删 | 视为无历史：index 重建从 1 号起，旧 commit message 仍是溯源兜底（台账不入库的已接受代价） |
| B5 | 同名源分支第二次进入技能 | 正常：读台账确认上次已 BOOKKEPT，本次 base=上次 commit，增量合并 |

## 不变清单

<与变化行同等重要——这些必须保持原样，谁在依赖它们>

| # | 不变项 | 谁依赖 |
| --- | --- | --- |
| U1 | git 底层语义（merge --squash 三方合并/reflog/对象模型/branch -f）零改变 | 一切 git 工具链与既有历史 |
| U2 | resolving-merge-conflicts 技能文件本身不被修改、不被依赖（思想内嵌为文本，非 import） | 该技能的独立使用场景 |
| U3 | `.git/merge-ledger/` 不被任何 git 命令读取或写入——对 git 完全不可见 | git 行为确定性 |
| U4 | 不用技能时的人工合并流程完全不受影响 | 用户手动操作权 |
| U5 | 既有 commit 历史零改写（技能只新增 commit，永不 rebase/ amend 已推送历史） | 全部下游消费者 |
| U6 | 无 policy 的仓：拒跑且零写入零改动 | 陌生仓安全 |
| U7 | parking-skill-creator 铸造流水线照常适用（本技能是它产出的普通技能） | 技能库治理 |

## 配置差异

| 字段 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| `.merge-policy.toml` | 不存在 | 新增 per-repo 契约（schema 见 api-mock.md） | 无旧配置，零迁移；AntAgent_v2 首版 policy 内容见 api-mock.md 示例 |
| `.git/merge-ledger/` | 不存在 | 技能运行时自建（不入库） | 无 |

<除以上两处外无任何配置变化；不注入环境变量、不改任何现有设置项>
