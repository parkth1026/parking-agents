<!-- draft v2 | published 2026-08-15T16:32:00Z
     用户意见：v1 撞出 Q3（本地 wiki 迁否），用户选 A：整目录拷到 NAS 继续用
     状态：待确认 -->

# 行为对照表: 2026-08-16-jenkins-learning-nas-scope（草稿 v2）

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | 调用 jenkins-log-auto-learning，触发扫描（scan-pairs.mjs） | 扫 7 个 enabled job：twe-ue5.5、twe-ue5.5-linux-ci、aes6-ue-runtime-ci、twe-ue5.5-installed、wdp5-ue5.5-runtime-ci、wdp5-runtime-ue5.5-linux-ci、wdp5-plugins-ue5.5 | 只扫 3 个：aes6-ue-runtime-ci、twe-ue5.5-installed、twe-ue5.5-linux-ci；其余 4 个 enabled:false 跳过 |
| 2 | 一对 FAILURE→SUCCESS 分析完成，评分 5-7 | 知识文件写 `C:/Users/Administrator/memory/jenkins-learnings-raw/scratch/` | 写 `//nas.51vr.local/PaaS/UE5/ue-llm-wiki/raw/scratch/`（评分 ≥8 同理写 details/） |
| 3 | 技能读取学习进度 | 读本地 analyzed-builds.json（含 twe-ue5.5 #1–115 共 115 条） | 读 NAS `raw/analyzed-builds.json`，**从空账本开始** |
| 4 | 边界：日后重新启用 twe-ue5.5 并扫描 | #1–115 已在账本，全部跳过 | 账本为空，#1–115 的可用构建对**会被重新领取分析一遍**（用户已知情接受） |
| 5 | 下载构建日志做分析 | 日志落在本地 tmp（现存量约 11MB） | 日志落 NAS `raw/tmp/ue-error/`，下载与解压走网络盘 |
| 6 | ue-error-solver 诊断单次构建并产出知识 | 写本地 rawDir/details/ | 写 NAS `raw/details/`（共享配置自动跟随） |
| 7 | karpathy-llm-wiki 摄取原料 / 产出 wiki 页 | 读本地 rawDir / 写本地 wikiDir | 读 NAS raw / 写 NAS wiki |
| 8 | 本地 workflow.json、pending-pairs.json | 被续跑逻辑读取（现存一个已完结的 twe-ue5.5#114 会话） | 不再被读取，原地封存为档案；NAS 上由下次扫描重新生成 |
| 9 | 一次性迁移动作（改配置时执行） | — | ①本地 raw/scratch 的 2 份知识文件拷到 NAS raw/scratch；②本地 wiki 整目录内容拷到 NAS wiki（SCHEMA.md、index.md、entities/ 等全部，本地原件保留） |

## 不变清单

- `jenkins.baseUrl` 仍为 `http://10.66.12.40`，对 Jenkins 的 API 请求构造逐字节不变。
- `gitRepos` 仍为 `D:/Git`，修复提交 diff 的获取方式不变。
- 3 个目标 job 的 name/path 条目原样保留，不重写。
- 范围外 4 个 job 条目保留在配置中（仅 enabled:false），日后翻回即恢复。
- 本地 `C:/Users/Administrator/memory/jenkins-learnings-raw` 与 `C:/Users/Administrator/memory/jenkins-learnings` 整目录原样保留作档案，不删除、不改动。
- 技能仓库代码零改动，只动环境层 `~/.claude/skill-env.json`（改前备份 .bak）。
- 每次调用只处理一个构建对的节奏控制不变。

## 配置差异（~/.claude/skill-env.json）

| 字段 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| `knowledgeBase.rawDir` | `C:/Users/Administrator/memory/jenkins-learnings-raw` | `//nas.51vr.local/PaaS/UE5/ue-llm-wiki/raw` | 拷 2 份 scratch 知识文件 |
| `knowledgeBase.wikiDir` | `C:/Users/Administrator/memory/jenkins-learnings` | `//nas.51vr.local/PaaS/UE5/ue-llm-wiki/wiki` | 整目录内容拷贝（Q3=A） |
| `trackFile` | `C:/Users/Administrator/memory/jenkins-learnings-raw/analyzed-builds.json` | `//nas.51vr.local/PaaS/UE5/ue-llm-wiki/raw/analyzed-builds.json` | 空账本起步，115 条历史不迁 |
| `workflowFile` | `C:/Users/Administrator/memory/jenkins-learnings-raw/workflow.json` | `//nas.51vr.local/PaaS/UE5/ue-llm-wiki/raw/workflow.json` | 不迁，重新生成 |
| `tmpDir` | `C:/Users/Administrator/memory/jenkins-learnings-raw/tmp/ue-error` | `//nas.51vr.local/PaaS/UE5/ue-llm-wiki/raw/tmp/ue-error` | 不迁 |
| `jobs[]` | 7 个 enabled | 3 个 enabled + 4 个 enabled:false | — |

旧配置 `skill-env.json.bak` 保留；整体回退即恢复本地路径行为（已写入 NAS 的新文件不自动回收）。
