# Context Snapshot: 2026-08-16-jenkins-learning-nas-scope

- 创建：2026-08-15T16:14:13Z
- 分片来源：无，宿主直接调查

## 任务陈述

我期望 jenkins-log-auto-learning 输出配置 \\nas.51vr.local\PaaS\UE5\ue-llm-wiki\raw，学习 jenkins 范围：
- http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/
- http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-installed/
- http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-linux-ci/

## 用户提出的方案

把 jenkins-log-auto-learning 的知识输出目录改到 NAS 的 `ue-llm-wiki/raw`，扫描范围收窄到 Earth 文件夹下 3 个 job。

## 意图假设

让自动学到的知识脱离单机 C 盘，落到 NAS 上 ue-llm-wiki 体系的 raw 层，供 karpathy-llm-wiki 摄取入 wiki（对应 2026-08-15 决策：保留 v6.0 orchestrator→pair-analyze→llm-wiki 链）。范围收窄到 Earth 下 3 个 job，是聚焦当前要喂知识的目标流水线。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| NAS `//nas.51vr.local/PaaS/UE5/ue-llm-wiki` 可达，含 `raw/` 与 `wiki/` 两个子目录，当前均为空 | `ls //nas.51vr.local/PaaS/UE5/ue-llm-wiki{,/raw,/wiki}` | Fact |
| 现环境层配置：rawDir/wikiDir 在 `C:/Users/Administrator/memory/...`，7 个 job 全部 enabled | `~/.claude/skill-env.json` | Fact |
| `knowledgeBase` 命名空间被 karpathy-llm-wiki 共享，两个技能指向同一物理 raw/wiki 目录，值只定义一处 | `karpathy-llm-wiki/SKILL.md:27-33` | Fact |
| trackFile（analyzed-builds.json）与 ue-error-solver 共享同一账本；ue-error-solver 的知识条目也写 `{rawDir}/details/` | `jenkins-log-auto-learning/SKILL.md:65`、`ue-error-solver/SKILL.md:249` | Fact |
| 路径处理：`expandHome` 只展开 `~/`；绝对路径原样使用，Node 在 Windows 支持 `//server/share/...` 正斜杠 UNC 写法 | `jenkins-log-auto-learning/scripts/config.mjs:47-50` | Fact |
| 原子写 = writeFileSync(tmp) + renameSync，NTFS 上可靠；SMB 上 rename 可用但原子性/延迟有折损 | `scripts/config.mjs:87`、`scripts/session.mjs:77` | Fact |
| 用户点名的 3 个 job 已在配置中且 enabled（name/path 完全对应）；范围外另有 4 个 enabled：twe-ue5.5、wdp5-ue5.5-runtime-ci、wdp5-runtime-ue5.5-linux-ci、wdp5-plugins-ue5.5 | `~/.claude/skill-env.json` | Fact |
| 本地 raw 现有产物：`scratch/` 2 份知识文件（twe-114-DiskSpaceExhausted.md、twe-40-UAT-PluginDirNotFound.md）、analyzed-builds.json（twe-ue5.5 #1–115 已分析）、workflow.json、pending-pairs.json、tmp/（约 11MB）；无 details/ | `ls C:/Users/Administrator/memory/jenkins-learnings-raw` | Fact |
| 本地 wikiDir 非空：SCHEMA.md、index.md（19KB）、log.md、entities/concepts/patterns/comparisons/details/sources 等目录与多个知识页，最后更新 2026-05-24（访谈收口后由 prototype 草稿撞出，Q3 補问） | `ls C:/Users/Administrator/memory/jenkins-learnings` | Fact |
| pending-pairs.json 生成在 trackFile 同目录；workflowFile 缺省也在 trackFile 同目录——三个状态文件的位置由 trackFile/workflowFile 字段独立决定，不绑 rawDir | `jenkins-log-auto-learning/references/config.md:21-22` | Fact |

## 验证基建候选池

- `node <skill>/scripts/session.mjs status` — 打印生效配置摘要 + pending-pairs 新鲜度。代价：低，纯读。
- `node <skill>/scripts/scan-pairs.mjs` — 只扫 enabled job，实测范围收窄是否生效。代价：低，产生一次真实扫描（写 pending-pairs.json）。
- `node <skill>/scripts/session.mjs next` + `abandon --reason` — 领取一对再丢弃，实测状态文件与知识输出在新路径真实可写。代价：中，会在账本留一条 failure:error 记录。
- `node <ue-error-solver>/scripts/*.mjs config` — 输出合并解析后的配置。代价：低。
- 仓库无针对该配置的单元测试基建。

## 术语冲突

无。

## 四分类

- **Fact**：NAS 可达性与现状、配置分层与共享关系、脚本路径能力、现有本地产物、3 个目标 job 已存在、本地 wiki 有既有内容。
- **User decision**（五轮已全部裁决，见 rounds.jsonl）：
  - ① 账本与 tmpDir **全部上 NAS**（Q1 选 C，15%，推翻 48% 推荐）；
  - ② wikiDir 一并指向 NAS wiki（确认按推荐）；
  - ③ 本地 2 份 scratch 知识文件拷贝到 NAS raw/scratch（确认按推荐）；
  - ④ NAS 账本**从空开始**（Q2 选 B，30%，推翻 70% 推荐）；
  - ⑤ 本地 wiki **整目录内容拷到 NAS**（Q3 选 A，75%，从推荐）；
  - ⑥ **配置文件必须本地**（Q4）；`~/.claude` 位置保留意见，经行业调研（12-Factor Config；git/npm/ssh/kubectl 用户主目录惯例；Claude Code 五层 settings）后裁定 **B' 方案并入本次**（Q5 选 B，35%，推翻 55% 拆分推荐）：配置迁 `~/.config/parking-agents/skill-env.json`（XDG、工具中立），保留 `SKILL_ENV` 覆盖；仓库 config.example.json 更新为真实 NAS 值作团队模板；NAS fail-fast 诊断（不可达时打印现状与排查建议后 exit 1）。
- **Agent-owned**：UNC 正斜杠写法、备份文件名、拷贝命令选择、旧位置回退读的实现方式、fail-fast 检查的具体放行点（配置加载后首步）、文档措辞。
- **Blocked**：无。

### Q5 并入带来的影响面事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| 读 `~/.claude/skill-env.json` 的产品代码仅 2 处：`jenkins-log-auto-learning/scripts/config.mjs:57`、`ue-error-solver/scripts/UeErrorSolver.mjs:44-46` | `grep -r skill-env --include=*.mjs` | Fact |
| 引用该路径的文档 3 处：jenkins-log-auto-learning SKILL.md:27 与 references/config.md、karpathy-llm-wiki SKILL.md:27、ue-error-solver SKILL.md:27 | grep | Fact |
| jenkins-pair-analyze 无 scripts（纯方法论，复用编排器上下文）；UeErrorSolver.psm1 不读该文件——二者无需改 | `ls`/grep | Fact |
| karpathy-llm-wiki 脚本不自行读环境层（validate-wiki 接 `--wiki` 参数，由 Agent 按文档合并后传入）——其"迁移"只是文档改一行默认路径 | karpathy-llm-wiki/scripts | Fact |
| 原「技能仓库零改动」约束被 Q5=B 推翻：本契约现含代码改动（2 个 .mjs 的默认路径+回退+fail-fast）与文档/模板更新 | Q5 裁决 | Fact |

## 决定边界未知项

（无——Q2/Q4/Q5 均已裁决。）

## 未知项

（无。本任务改动范围：本机配置文件（新位置）、仓库内 2 个技能代码文件 + 3 处文档 + 1 个模板、NAS 数据拷贝。其他机器不在范围，靠仓库模板自助。）
