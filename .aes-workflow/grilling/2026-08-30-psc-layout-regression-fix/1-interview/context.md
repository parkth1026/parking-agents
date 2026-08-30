# Context Snapshot: 2026-08-30-psc-layout-regression-fix

- 创建：2026-08-30
- 分片来源：无，宿主直接调查（子探针不可用：宿主模型未配置 builtin:bigmodel-start-plan）

## 任务陈述
「上面问题 解决方案 讨论一下（指 parking-skill-creator 严格测试发现的 2 个大搬移布局回归：snapshot-skill.mjs 缺省 workspace 落进扫描根内、check-shadow-skills.mjs 对分类布局全判影子）」

## 用户提出的方案
上一轮测试报告给了建议方向四条：① snapshot 缺省解析改为向上找 skills 祖先；② check-shadow 按产物特征识别影子；③ run-tests 补分类布局夹具；④ .gitignore 防御性加 skills/evals/。用户未表态，要求走访谈讨论。

## 意图假设
让 creator 工具链在 `skills/<分类>/<技能名>/` 分类布局下恢复两条不变量：评测产物缺省落在扫描根之外、影子检测能真实区分「真技能」与「冒充产物」。而非泛泛的「修 bug」——根因是 7677680 大搬移改了布局，工具的布局假设没跟着改。

## 已查事实
| 事实 | 出处 | 分类 |
| --- | --- | --- |
| snapshot 缺省 workspace = 技能目录上两级；分类布局下落 `skills/evals/<名>-workspace/`（扫描根内），实测证明 | `scripts/snapshot-skill.mjs:38` + 临时镜像实测 | Fact |
| check-shadow 只认扫描根一级目录 SKILL.md；对真实仓库根报 63 影子 0 合法、exit 1 | `scripts/check-shadow-skills.mjs:65` + 实测 | Fact |
| check-shadow 无参数派生 = 技能目录父目录；分类布局下派生出 `skills/workflow`，报 14 合法 0 影子「✓ 无影子」——假阴性，风险区 `skills/evals` 在派生根之外 | `scripts/check-shadow-skills.mjs:17` + 实测 | Fact |
| 两脚本自大搬移 7677680 后零提交（随搬移原样移动，未适配） | `git log 7677680~1..HEAD -- <两脚本>` 仅 7677680 | Fact |
| 其余脚本（aggregate-benchmark/aggregate-trigger/eval-evidence/quality-plan/pilot-replay/generate-review）均无缺省 workspace 推导，显式传参 | grep 全扫描，`dirname(dirname` 仅 snapshot-skill.mjs:38 一处 | Fact |
| init-skill 缺省输出 = 脚本位置上两级（= 源技能同级分类目录），两布局行为均合理，布局无关 | `scripts/init-skill.mjs:246` | Fact |
| 测试夹具只有扁平形态（`join(root, "skills")` 技能直挂根下），无分类夹具；「缺省在扫描根外」断言只对扁平成立 | `run-tests.mjs:276,304-308` | Fact |
| .gitignore 只忽略 `/.agents/evals/`；`skills/evals/` 与仓库根 `/evals/` 均未忽略 | `.gitignore:14` | Fact |
| SKILL.md L128 与 repo-conventions.md L19 的「与 skills 平行/扫描根之外」断言在分类布局下为假 | 两文件 | Fact |
| 安装版扁平布局（~/.agents/skills/<名>/）下两工具行为均正确：缺省落 ~/.agents/evals、无参数派生 ~/.agents/skills | 推导 + 布局对照 | Fact |
| 工作树有 #160 未提交改动，其中含 run-tests.mjs（本轮夹具要改的文件）；snapshot/check-shadow 两脚本工作树干净 | git status | Fact |
| 验证基建：技能自带 run-tests.mjs（check() 计数 + execFileSync 黑盒，node 零依赖，215 项）；quick-validate；package-skill 打包前自动跑校验+自测。无 CI 跑此套件，本地跑为惯例 | `run-tests.mjs` 头注 + 实测 | Fact |

## 验证基建候选池
- run-tests.mjs 扩夹具（主途径）：新增分类布局夹具锁两条不变量；代价=套件增量，改的是有 WIP 的文件
- package-skill 打包门：打包自动跑 run-tests，夹具随包验证；代价=无（顺带覆盖）
- quick-validate：本轮不改 frontmatter，不适用
- 用户真实测试：对真实仓库跑两脚本看退出码；代价=一次性、不能防回归

## 术语冲突
- 「影子技能」：check-shadow 现实现定义为「扫描根下非一级目录的 SKILL.md」（位置判据）；工具名与 SKILL.md 用法暗示的本意是「冒充真技能的评测产物」（来源判据）。按哪个定义走影响修法 → 提问区 Q2。

## 四分类
- **Fact**：上表全部；影响面仅 snapshot-skill.mjs + check-shadow-skills.mjs 两处代码 + 两处文档断言
- **User decision**：Q1 缺省 workspace 语义锚点（找 skills 祖先 vs 废除缺省 vs 文档声明）；Q2 影子定义（产物特征 vs 同名遮蔽 vs 限定安装根）；Q3 与 #160 WIP 的提交分层
- **Agent-owned**：skills 祖先找不到时的回退细节、夹具具体构造、输出文案、gitignore 行的精确写法
- **Blocked**：无

## 已查事实（第二轮补充：用户透露 link 挂载后实测）
| 事实 | 出处 | 分类 |
| --- | --- | --- |
| 用户级 `~/.agents/skills/` 一级全是技能目录（宿主扫描根扁平）；仓库技能为 SYMLINK 直指仓库深层（如 `ask-matt -> skills\matt-skills\engineering\ask-matt`），lark-* 等为用户自建真目录 | `node lstat/readlink` 实测 | Fact |
| Node path 操作不解析符号链接：从 link 路径跑 snapshot，`dirname(dirname)` 基于 link 路径计算 → 落 `~/.agents/evals`（正确）；从仓库真实路径跑 → 落 `skills/evals`（回归）。实际行为随调用路径而变 | Node 语义推导 + 此前实测 | Fact |
| 第三处回归：3 层嵌套技能（matt-skills/engineering/*）在仓库内跑 snapshot，现行上两级落 `skills/matt-skills/evals/`（扫描根内且更深）；嵌套任意深度都会错，不止 2 层 | 推导（`snapshot-skill.mjs:38`） | Fact |
| 「找 skills 祖先取父」方案在三种真实场景全落扫描根外：link 路径→`~/.agents/evals`；仓库 2 层→`<repo>/evals`；仓库 3 层→`<repo>/evals`；自建真目录→`~/.agents/evals` | 逐场景推导 | Fact |
| check-shadow 不跟进符号链接（collectSkillMd 注释）——影子判据改产物特征后，link 技能内部无需扫描，扫描根递归即可覆盖两盘场景 | `scripts/check-shadow-skills.mjs` collectSkillMd | Fact |
| 真实产物目录形态已有实例：`skills/life/shopping-deep-research/eval-fixtures/`（未跟踪）、workspace 约定名 `*-workspace`、快照 `skill-snapshot[-vN]` | git status + SKILL.md | Fact |

## 决定边界未知项（第二轮已消解）
- link/嵌套场景下 workspace 应跟调用路径还是真实路径：按「不 follow（Node 现状语义）」进默认区，产物落调用侧。

## 未知项
- #160 WIP 是否处于可提交状态 → 已问，用户选 A（先提交 #160 再修）
- Q1 缺省语义：原三选项前提失效 → 第二轮确认区重问（找 skills 祖先方案 + 是否 follow realpath）
