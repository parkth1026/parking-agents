---
name: clone-to-worktree
description: 把与当前仓库同 remote 的独立 git clone 原地转换成 linked worktree：路径、分支、ignored 构建产物、submodule 全部保留，回收冗余对象库。用户说「把某个目录的 clone 转成 worktree」「这两个目录是同一个仓库的、太浪费」「合并重复 clone」或想省掉双份 fetch/双份磁盘时使用；输入只需目标 clone 路径。
---

# Clone 转 Worktree

把一个同源独立 clone 转换为当前仓库的 linked worktree。三个脚本各司其职：`preflight.mjs` 只读核验、`inventory.mjs` 盘点要搬的资产、`convert.mjs` 缺省 dry-run、`--apply` 才动手。全部输出 JSON，直接解析后再向用户汇报。

## 工作流

### 第 1 步：核验（只读，随时可跑）

```bash
node scripts/preflight.mjs --target <目标clone路径>   # 主仓缺省取当前目录所在仓，可用 --main 指定
```

退出码 0 才继续。任何 `E_*` 错误码都是可行动的：脏树先提交、未推送先 push、origin 不同直接告诉用户这不是同一个仓库、分支被占用先商量换名。`W_LSREMOTE_FALLBACK` 警告表示离线判定，结论可能过期，向用户说明。

### 第 2 步：审阅计划（dry-run，缺省行为）

```bash
node scripts/convert.mjs --target <目标clone路径> --main <主仓路径>
```

读输出里的 `artifacts`（要暂存搬走的 ignored 资产 + submodule 清单）与 `refsPreserved`。发现体积异常或用户没预期的条目（如几十 G 的数据目录），先跟用户确认搬移清单再执行——同卷搬移是瞬时 rename，但清单本身就是给用户的审阅材料。

### 第 3 步：执行

```bash
node scripts/convert.mjs --target <目标clone路径> --main <主仓路径> --apply
# 需要保留旧对象库备份时加 --keep-backup
```

执行是原子的分阶段过程：独有 refs 并入主仓 → 资产暂存 → 旧 `.git` 挪到 `<目标>.bak.git` → 清空目录（顶层目录被进程当 CWD 锁住也能走，内容照删、目录壳保留）→ 检出到空目录 → 资产搬回 → submodule 指针手术 → 验证 → 删备份。成功返回 `ok: true` 与资产清点；失败返回 `phase` 与处置状态。

### 第 4 步：善后

成功后向用户交代三件事：

1. **worktree 语义**：同一分支不能同时检出在两个 worktree；以后移除用 `git worktree remove <路径>`，别直接删文件夹。
2. **仓库自有门禁**：跑一遍该仓库自己的依赖/构建门禁（如原生依赖合同）。若报「过期」，先在主仓跑同一条对照——主仓也挂是机器级漂移；主仓过、新 worktree 挂，多半是该分支的 tracked 声明文件在录合同之后变过，属转换前既有问题，按仓库自己的初始化入口重录即可，不要归因于转换。
3. **构建缓存**：目录绝对路径未变，绝对路径指纹的缓存（cargo target 等）继续有效，不用重建。

## 失败时

- 报告含 `rolledBack: true`：clone 已还原，处理失败原因后重试；`rollbackLeftovers` 非空按清单手工收尾。
- 报告含 `rolledBack: false`：worktree 已建但中间态未收尾，**不要盲目重跑 `--apply`**，按 `references/recovery.md` 的恢复矩阵对号入座。
- submodule 报 `not a git repository` 或状态前缀 `-`：同样见 recovery.md，三步手术（迁 gitdir、写 `.git` 文件、改 `core.worktree`）有对照说明。

## 测试

技能自带端到端回归测试（临时 fixture 仓起真实 git，覆盖 design.md 的 AC-1..AC-9，含 CWD 锁与回滚场景）。每次升级、改动后必跑：

    node run-tests.mjs

## Resources

- `scripts/preflight.mjs` / `scripts/inventory.mjs` / `scripts/convert.mjs` — 核验 / 盘点 / 转换（dry-run 缺省）
- `references/design.md` — 设计取舍与验收条件（AC-1..AC-9）
- `references/recovery.md` — 失败恢复矩阵与已知限制（执行失败时读）
