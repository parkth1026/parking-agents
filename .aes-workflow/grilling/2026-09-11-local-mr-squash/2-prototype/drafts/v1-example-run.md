<!-- draft v1 | published 2026-09-11
     用户意见：待质疑
     状态：superseded by v2（R3 总反思推翻机制版） -->

# 可执行示例: 2026-09-11-local-mr-squash

三个场景 + 一个必须保持场景。示例数据取材本会话与 09-08 真实合并，输出为写死样例，不连真实系统。

---

## 场景 A：含冲突的完整流程（09-08 轮改写）

**用户**：把 dev-parking squash 合并过来

```text
[local-mr-squash] OPEN · 台账建档 #2
  预检：policy ✓（sha256:ab12cd34）· target dev==origin/dev ✓ · 工作树净 ✓ · 源 tip 0b12cf5 ✓

[local-mr-squash] SQUASHED · git merge --squash dev-parking
  冲突 4 处：AGENTS.md / run.toml / package.json / tests/e2e-cdp/run.mjs

[local-mr-squash] RESOLVING · 五步裁决（逐 hunk）
  ▶ run.toml @@dev.desktop desc@@
    ours   = dev 侧 desc 已扩窗口标识段（git show <sha>：ANT_DEV_WINDOW_TITLE 注入链）
    theirs = dev-parking 加 CLI sidecar 物化说明（git show <sha> + glab #115 ✓enhanced）
    裁决   = both（两段语义正交，拼接共存）
  ▶ scripts/run/lib/dev-runner.mjs @@旗标解析@@
    ours   = 旧旗标形态 / theirs = 动作注册表重构（git log 双侧溯源）
    裁决   = theirs + tradeoff「脚本行为随功能分支，dev 侧后补事实全保留」
  ▶ …（共 4 条，全部入台账 rulings）

[local-mr-squash] CHECKED · policy 自动检查
  ./run check            PASS
  ./run test.frontend    PASS（397/397）

[local-mr-squash] COMMITTED · 8d59c15
[local-mr-squash] BOOKKEPT · 台账 #2 落盘（rulings=4）
  生命周期：dev-* → forward · 未被检出 · git branch -f dev-parking 8d59c15 ✓
收口：merge #2 完成。原分支 5 提交 hash 清单与全部裁决见台账。
```

**产出的 commit message（节选）**：

```text
merge: squash 并入 dev-parking——dev/prod 共用 release app 契约落地 - #34 #115

（正文用户可读说明……）

squash 溯源块（local-mr-squash 台账 #2）：
- 原分支提交：<hash1> <hash2> …
- 冲突裁决 4 条摘要：run.toml=both / dev-runner.mjs=theirs(行为随分支) / …
- 已跑检查：./run check · ./run test.frontend
- policy: sha256:ab12cd34
```

---

## 场景 B：零冲突快速通道 + hold 点插话（09-10 轮改写）

**用户**：把 dev-parking squash 合并过来

```text
[local-mr-squash] OPEN · 台账建档 #3
  预检四查 ✓ · 源 tip 2c32cc4 · base dddc750（dev 领先 7 提交，源领先 5）

[local-mr-squash] SQUASHED · 零冲突自动合并（54 文件）
  语义裁决层跳过（零冲突，Q2 口径）→ 进 CHECKED
```

**用户**（插话）：**先别 commit，跑一遍 code-review 双轴和 e2e-cdp 再说**

```text
[local-mr-squash] HOLD · 调用方验收挂起（不内嵌，强度你定）
  code-review 双轴：0 硬违例，2 处 judgement call（已修复进暂存区）
  ./run test.e2e.cdp：12/12 PASS（runId 20260910141117）
  → 验收结论只留痕不裁决，是否 commit 由你

**用户**：可以 commit 了

[local-mr-squash] CHECKED → COMMITTED · 8722165
[local-mr-squash] BOOKKEPT · 台账 #3（rulings=0 · checks 含插话指定命令+note）
  生命周期：dev-* → forward · 被 worktree 检出且树净 tip 未前进 → 彼处 git merge dev ✓
```

---

## 场景 C：拒跑、fail closed 与续跑

**C1 无 policy**：

```text
[local-mr-squash] 拒跑：本仓无 .merge-policy.toml（零写入）
（附 policy 样例全文）
```

**C2 检查红停**：

```text
[local-mr-squash] CHECKED · FAIL
  cargo test -p ant-hub-cli --test cli_contract：1 failed
  → 修复合并引入的破坏后重跑（record.state=CHECKED 为断点）
```

**C3 中断后换会话续跑**：

```text
[local-mr-squash] 重入：台账 #4 state=RESOLVING（断点续跑，不重来）
  台账/实态一致性：源 tip 未漂移 ✓ → 从未完成 hunk 继续
```

**C4 源 tip 漂移**：

```text
[local-mr-squash] FAIL-CLOSED：source_tip_drift
  台账记录 tip=2c32cc4 ≠ 实际 9a8b7c6。确认新提交去留后重跑，record 保留。
```

---

## 必须保持场景（改完之后必须原样能跑）

**不用技能、直接手动 git**：在任意仓（含有 policy 的仓）执行
`git merge --squash dev-foo && git commit -m "manual"`——行为与今天逐字节一致；
技能不拦截、不警告、不留任何文件（台账只在被技能调用时写）。

**裸用 resolving-merge-conflicts**：普通 merge/rebase 冲突场景照常走该技能；
local-mr-squash 不注册这些触发面（squash-only）。
