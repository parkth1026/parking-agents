# #98 Resolution 草稿（GitHub 账号恢复后发出）

状态：本地管线全部完成（2026-08-28）。积压动作见文末。

## Resolution（拟发至 #98 并 close）

证伪段完成：#69 走完 v7 全管线端到端（契约补齐 → runner init → claim → worker（独立 subagent）→ candidate `cf6b12a` → QA 最终轮 + 复核轮 → 独立 review PASS → gate 六门全绿 AUTO_MERGE → merge `9004b5f` → post-merge verify 10 域 PASS → registry close 被 GitHub 阻断积压）。**管线可走通**；协议偏差清单如下。

### 偏差清单（最终版）

**环境/现场类**
1. slot allowlist 陈旧现场（指向已删 worktree + 废弃 integration）无过期自检，靠人发现。
2. v4 registry 遗留 running 旧 Goal，master 无「上次现场未收口」启动警告。

**文档/约定类**
3. claim 的 issue-file 需要 `repo` 字段（`BAD_JOB_IDENTITY`），`gh --json` 默认不产出；字段契约无文档。
4. worker 侧 `AES_WORKTREE_BOARD_REPO_ROOT` 绑定靠约定（`job-store.mjs` env||cwd）：不设则在 worker worktree 静默孵化平行 registry；prose 三处 master.mjs 调用均未写该 env（与 #96 同域）。且该 env **不能**泄漏进 selftest 调用（破坏 fixture 场景）——两个方向的边界都无文档。
5. `master.mjs` 无 per-subcommand help，参数形状要读源码。
6. run-tests 的 flaky 域（fixture/server 聚合时序、board-ui SHA 漂移）无「known-flaky」文档，worker 与 QA 各自独立重查一遍。

**协议结构类**
7. 【重大】**分支 ref 层缺「意图 vs 事实」对账**：8-27 23:30 两次 reset 抛弃 dev 下午线，24 commits / 8 张已关票交付（#62/#64/#65/#72/#73/#76/#78/#81 + 统一 v2 schema）丢失，关票记录与 map 记载失实（#70 裁定曾据此引用）。「registry 记意图、Git 记事实」在 job/merge 层有 reconcile，分支层没有——merge 记录自称 merge(dev) 无机械核验。**已恢复**：用户裁决整段 re-merge，dev `23217e1`，特征代码 grep 齐全，恢复后 10 域回归全绿。
8. **low 档机械门无人工出口**：GATE-qa `unexecuted` 非空一律 FAIL，waiver 只挂「机械全绿 + high 档」的 AWAITING_HUMAN_GATE 分支——预存在 flaky 域造成的债在 low 档无协议内出口，只能 QA 复核重出 receipt（域级如实 FAIL(pre-existing-baseline) + base 逐字节同签名对照 + zero-intersection 论证 + 顶层汇总 PASS）。缺「基线红」表达位（与 #90 同族）。
9. `master.mjs close` 把 registry close 与 `gh issue comment` 耦合在同一命令：GitHub 故障（本次：账号 suspended）时 close fail closed，job 卡 merged、slot 不释放，无降级路径（momo「GitHub 不稳定」类失败的本仓对应物）。
10. orchestration 域隐式假设 cwd=仓库根（读 `cwd/.gitignore`），错 cwd ENOENT 假红无提示。

**行为观测类（#35 证据）**
11. worker stall 实测第一例：worker 自报「等后台编排测试完成」并停机，Git 事实显示实现已写完未 commit——**「不采信自报、以 thread/commit 事实判定、编排侧推醒恢复 lane」在真实宿主验证有效**（#70 裁定的检测信号方向正确）。诱因 = 过度全量测试倾向 + 包装 exit 0 掩盖 ok:false。
12. 包装脚本 exit 0 但输出 `ok:false`（selftest 后台跑）再次实证——必须读输出 JSON。

**正面验证（零偏差项）**
13. WorkOrder/QaReceipt/terminal 的 schema 文档与 master.mjs 实际校验**精确一致**（contractDigest 逐字绑定、CANDIDATE_MISMATCH 守卫）；「诚实记录 unexecuted → 机械门如实拦截」闭环有效；merge 真实双父校验、verify 脚本实测执行、job 层 reconcile 语义全部按契约工作。

### #94 的设计输入（本票血统下游）

- close 与 GitHub 解耦（或降级队列）——偏差 9；
- merge-worker prose 须写明 REPO_ROOT env 的设置与不泄漏边界——偏差 4；
- 预存在基线红的表达位（qa receipt 或 gate 侧豁免机制）——偏差 8；
- 分支 ref 层对账（close/merge 记录宣称的目标分支 vs `git merge-base --is-ancestor` 事实）——偏差 7，建议独立建票。

### 成本锚点（#70 裁定要求的自采数据）

#69（高机械度小修复，含全部试错）：worker ≈212k+219k tokens（两段）、QA 复核 ≈100k、review ≈100k、编排侧（含事故审计与恢复）另计。首个锚点样本，n=1。

## 积压 GitHub 动作（账号恢复后按序执行）

1. `gh auth status` 验证恢复；
2. `master.mjs close --job job-69-111801` 重试（发 comment + 关 #69）+ `release --job job-69-111801 --slot worker-1`；
3. #98：发本 resolution + close + 摘 assignee；
4. map #5：Decisions so far 追加 #98 一行 + #69 一行；fog 视情况更新；
5. #75：补 51world 遗留 identity 实测证据 comment（草稿在 8-28 会话记录）；
6. 新票：mock.html 未走 build-portrait 流程 SHA 锁失效（0aa0ba0，挂 map #5，草稿在会话记录）；
7. #35：追加 stall 实测第一例 comment（偏差 11）。
