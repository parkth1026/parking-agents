# design: clone-to-worktree

## 意图与触发场景

用户有一个与当前仓库同 remote 的独立 clone（典型动机：两份完整 `.git` 对象库浪费磁盘、fetch 双份、分支管理割裂），想把它**原地**转换成当前仓库的 linked worktree：路径不变、分支不变、ignored 本地产物（`.env`、`target/`、`node_modules/`、`vcpkg_installed/`、submodule 检出等）原样保留。

触发语例如：「把 D:\X\repo-dev 这个 clone 转成当前仓库的 worktree」「这两个 clone 是同一个仓的，合成 worktree 吧」「repo-dev 是单独 clone 的，有点浪费」。输入就是一个目标 git 路径；产出是转换报告（JSON）+ 可用的 worktree。

真实蓝本：2026-09-04 SuperTools-dev 转换实战（顶层目录被进程 CWD 锁住、gitfile 型 submodule 手术、`refs/t3/*` 独有 refs 搬运、45G `target/` 构建缓存因路径不变而指纹有效）。

## 设计取舍

| 决定 | 为什么没选别的 |
| --- | --- |
| 单一 in-place 路径（暂存→清空→空目录检出），不做 rename-aside 双路径 | Windows 下顶层目录被进程当 CWD 锁住极常见（实战首日即触发），子项永远可移动；单路径 = 可测、无分支。代价是丢弃旧工作区文件重新检出——本就与远端冗余 |
| 路径保持原样（在空目录里检出） | 绝对路径写进构建指纹（cargo target、vcpkg_installed 元数据），路径不变 → 缓存继续有效；换路径 = 几十分钟到几小时重建 |
| 旧 `.git` 挪到 `<target>.bak.git` 当安全网，验证通过后自动删 | 直接删 `.git` 不可逆；留备份的代价只是转换期间多占一份对象库 |
| phase 1–4/5 失败自动回滚，phase 5 起失败保留现场 | 前段回滚无信息损失；后段半转换状态千奇百怪，即兴重跑更危险——报告精确状态交给 recovery.md |
| 独有 refs 按「二级命名空间」整组 fetch（`refs/t3/*`） | 逐条 fetch 需要枚举规则；heads/remotes/tags 之外的命名空间天然成组。tags 只搬主仓缺失的，避免覆盖 |
| submodule gitdir 手术：迁到 `git -C worktree rev-parse --git-path modules/<p>` 给出的 per-worktree 位置，`.git` 文件写绝对 posix 路径，`core.worktree` **直接改 config 文件** | 与主仓共用 `.git/modules` 会两个工作区抢一个 `core.worktree`；经 `git config` 改会因旧相对路径 chdir 失败（鸡生蛋，实战踩过） |
| dry-run 缺省，`--apply` 才动手 | 转换是重度破坏性操作；先看计划再执行是最低成本的审阅门 |
| 全部输出 JSON | 本技能面向 AI 消费，JSON 比散文可解析、可比对 |
| 测试用临时 fixture 仓运行时生成，不进 `fixtures/` 存黄金文件 | 被测对象是 git 状态机（worktree/submodule/refs），静态黄金文件无法表达；生成式 fixture 每次覆盖真实 git 行为 |

自由度分级：preflight / inventory / convert 三个脚本是低自由度护栏（脆弱操作锁死顺序与参数）；SKILL.md 的编排（何时跑、如何向用户汇报、善后跑哪些仓库自有门禁）是高自由度文字判断。

## 验收条件

| 编号 | 条件 | 类型 |
| --- | --- | --- |
| AC-1 | preflight 拒绝不安全输入：脏树、未推送、origin 不同、分支被占用、已是 worktree，各自给出可行动的错误码 | script |
| AC-2 | `--apply` 后目标路径成为主仓 linked worktree，检出原分支、HEAD 与转换前一致、`status --porcelain` 干净 | script |
| AC-3 | ignored 资产（含嵌套路径如 `apps/server/data`）原样保留在原路径 | script |
| AC-4 | gitfile 型 submodule 转换后 `submodule status` 停在记录的 commit（前缀为空格） | script |
| AC-5 | 独有 refs（如 `refs/t3/*`）与主仓缺失的 tag 转换后出现在主仓 | script |
| AC-6 | 顶层目录被进程 CWD 锁住时转换仍成功（in-place 路径） | script |
| AC-7 | 验证通过后旧 `.git` 备份与暂存区被清理；`--keep-backup` 时保留 | script |
| AC-8 | 缺省 dry-run 不改任何东西（`.git` 仍是目录、无暂存区、worktree 列表不变） | script |
| AC-9 | 执行早期（phase ≤ clear）失败时自动回滚，目标回到可用的 clone 状态 | script |

## 迭代记录
<!-- 行格式: | 日期 | 改了什么一句 | 本轮 vs 上轮 won/lost/tie | 拆分建议结论(如有) |；只追加不回改 -->
| 日期 | 改了什么 | 轮次结果 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-09-04 | 首版：preflight/inventory/convert 三脚本 + 临时仓 fixture 端到端测试（AC-1..9） | 首轮 | 无 |
