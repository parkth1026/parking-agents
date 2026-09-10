<!-- draft v2 | published 2026-09-11
     用户意见：R3 总反思后瘦身（v1 十二行砍至七行，机制版元素全数移除）
     状态：confirmed（2026-09-11 用户确认「好的 请继续」） -->

# 行为对照表: 2026-09-11-local-mr-squash（v2 最小形态）

## 变化行

| # | 输入 / 前置 | 现在的行为（裸 git / 纯 resolving-merge-conflicts） | 改后的行为 |
| --- | --- | --- | --- |
| 1 | 「把 X 分支 squash 合过来」类指令 | agent 自由发挥，commit message 与收口质量随机 | 技能激活：预检（目标树净、源有领先提交），记源 tip 与 merge-base 待入溯源块 |
| 2 | `git merge --squash <source>` | （同左，但后续无规范） | 同左；零冲突直接进第 4 步检查 |
| 3 | squash 报冲突 | 语义裁决靠 agent 即时发挥，取舍常不留痕 | 内嵌五步：看现场→溯源双侧意图（commit message/分支历史；issue 原文取得到就读）→逐 hunk 保双方意图，不相容按合并目标裁决**并记取舍**→不发明行为→永不 --abort；取舍摘要进 commit message |
| 4 | 检查 | 各会话口径不一 | 发现本项目自动检查（typecheck/tests/format 或 ./run 等价）跑绿=commit 硬前置；调用方可插话重验收（review/真测），结论进 message、commit 时机调用方定 |
| 5 | commit | message 随机 | 单笔 + 溯源块：原分支 hash 清单 / 冲突裁决摘要（文件+裁决+取舍一句）/ 已跑检查 |
| 6 | commit 后 | 分支原地不动（不知道自己被合并） | 收口：前滚（branch -f 优先，被 worktree 检出则彼处 merge）或删除；拿不准就问 |
| 7 | 完成判定 | 「commit 了就算完成」 | 门禁脚本四项全绿才算：树净/单笔非 merge commit/`git diff HEAD...src` 空（全包含）/分支已收口（--keep 显式逃生门且须写进报告） |

### 边界值行

| # | 输入 / 前置 | 行为 |
| --- | --- | --- |
| B1 | squash 后源分支又前进步 | 门禁第 3 项（全包含）变红——漂移被机械捕获，不会静默漏合并 |
| B2 | 中断（会话断/agent 换代） | git 自身态（MERGE 状态/暂存区/reflog）即现场；语义决策重推（接受残余风险，R3 裁决） |
| B3 | 源分支零提交领先 | 预检拒：「nothing to merge」 |
| B4 | 门禁 FAIL 但想先报告 | 不许称完成；--keep 只跳第 4 项且必须显形于报告 |

## 不变清单

| # | 不变项 | 谁依赖 |
| --- | --- | --- |
| U1 | git 底层语义零改变（squash/branch -f/reflog） | 全部工具链 |
| U2 | resolving-merge-conflicts 技能文件不被修改（思想文本内嵌非依赖） | 该技能独立场景 |
| U3 | **不落任何仓内文件**：无 policy、无台账、无 .git 下自建目录（v1 台账已随 R3 出局） | 仓内洁净 |
| U4 | 不用技能的手动合并完全不受影响 | 用户手动权 |
| U5 | 既有历史零改写 | 全下游 |
| U6 | parking-skill-creator 铸造流水线照常适用 | 技能库治理 |

## 配置差异

无——零配置（v1 的 `.merge-policy.toml` 已随 R3 出局；检查命令由 LLM 按五步第 4 步现场发现）。
