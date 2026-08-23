<!-- draft v5 | published 2026-08-15T17:30:00Z
     用户意见：确认锁定
     状态：confirmed -->

# 行为对照表: 2026-08-16-jenkins-learning-nas-scope（确认版·锁定。执行 Agent 改的是产品，不是这份对照表）

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | 调用 jenkins-log-auto-learning，触发扫描（scan-pairs.mjs） | 扫 7 个 enabled job | 只扫 3 个：aes6-ue-runtime-ci、twe-ue5.5-installed、twe-ue5.5-linux-ci；其余 4 个 enabled:false 跳过 |
| 2 | 一对 FAILURE→SUCCESS 分析完成，评分 5-7 | 知识文件写本地 `C:/Users/Administrator/memory/jenkins-learnings-raw/scratch/` | 写 `//nas.51vr.local/PaaS/UE5/ue-llm-wiki/raw/scratch/`（≥8 写 details/） |
| 3 | 技能读取学习进度 | 读本地账本（twe-ue5.5 #1–115） | 读 NAS `raw/analyzed-builds.json`，**从空账本开始** |
| 4 | 边界：日后重新启用 twe-ue5.5 并扫描 | #1–115 全部跳过 | 会被**重新领取分析一遍**（用户知情接受） |
| 5 | 下载构建日志 | 落本地 tmp（现存量约 11MB） | 落 NAS `raw/tmp/ue-error/`，走网络盘 |
| 6 | ue-error-solver 产出知识 | 写本地 rawDir/details/ | 写 NAS `raw/details/`（共享配置跟随） |
| 7 | karpathy-llm-wiki 摄取/产出 | 读本地 raw / 写本地 wiki | 读 NAS raw / 写 NAS wiki |
| 8 | 本地 workflow.json、pending-pairs.json | 被续跑逻辑读取 | 不再被读取，原地封存；NAS 上重新生成 |
| 9 | 一次性迁移动作（改配置时执行） | — | ①拷 2 份 scratch 知识文件→NAS raw/scratch；②本地 wiki 整目录内容→NAS wiki；③创建新位置配置文件（含 NAS 值与 3 job 范围）；④旧 `~/.claude/skill-env.json` 原地保留 |
| 10 | 技能解析环境层配置 | 只读 `~/.claude/skill-env.json`（SKILL_ENV 可覆盖） | 解析链：**SKILL_ENV > `~/.config/parking-agents/skill-env.json` > 旧 `~/.claude/skill-env.json` 回退**；status 输出增加一行配置来源（新路径/回退旧路径/SKILL_ENV） |
| 11 | 边界：新机器只有旧位置配置文件 | —（不存在此场景） | 回退读旧位置，功能完整可用（历史兼容；status 标注来源为回退） |
| 12 | 新成员安装技能集 | 抄 config.example.json 的占位 schema，手工填值 | 仓库 `config.example.json` **默认值即 NAS 地址与 3 job 范围**（开箱默认，想改可自行覆盖）；拷到 `~/.config/parking-agents/skill-env.json` 按机器改 `gitRepos` 即可用 |
| 13 | NAS 不可达时调用任一技能 | 在读写文件处抛裸路径错误（ENOTFOUND/EACCES 等），难定位 | **配置加载后首步做连通检查**：打印现状报告——哪条 UNC 路径不可达、当前要做什么操作受影响、建议检查什么（网络/VPN/共享权限）——然后 exit 1 |
| 14 | 文档中配置路径说明（3 处） | 写 `~/.claude/skill-env.json` | 写新路径与回退链（jenkins-log-auto-learning SKILL.md+references/config.md、karpathy-llm-wiki SKILL.md、ue-error-solver SKILL.md） |
| 15 | 边界：SKILL_ENV、新路径、旧路径**三层都无配置文件**时调用技能 | 脚本报 config 缺失类错误（裸错误，新用户不知从何下手） | 打印**配置引导**：未找到配置文件 → 模板在 `<repo>/.claude/skills/jenkins-log-auto-learning/config.example.json`（默认已指向 NAS）→ 拷到 `~/.config/parking-agents/skill-env.json` → 按机器改 `gitRepos`；缺必填字段的既有提示同步指向新路径与模板；然后 exit 1 |
| 16 | 受影响技能的 PowerShell 双胞胎 | ue-error-solver 有 UeErrorSolver.psm1、learning 有 scan-pairs.ps1 与 tmp/get-changesets.ps1、llm-wiki 有 validate-wiki.ps1，双入口并行维护 | **删除**（仓库标准 parking-skill-creator SKILL.md:269：脚本一律 .mjs）；文档中 PS 入口引用同步更新；learning 技能目录内 tmp/ 一并清除（技能目录零写入）；其他技能（cpu-monitor、epic-ue-assistant、aes-grilling-web）的 PS 清理**不在本契约** |

## 不变清单

- `jenkins.baseUrl` 仍为 `http://10.66.12.40`；对 Jenkins 的 API 请求构造逐字节不变。
- `gitRepos` 仍为 `D:/Git`（本机值，随配置文件走）。
- **SKILL_ENV 环境变量覆盖行为不变**（始终最高优先）。
- **深合并语义不变**：技能固有 config.json ⊕ 环境层，环境层优先。
- 3 个目标 job 的 name/path 条目原样保留；范围外 4 个条目保留仅 enabled:false。
- 本地 `jenkins-learnings-raw/` 与 `jenkins-learnings/` 整目录原样保留（档案+回退兼容），不删不改。
- 旧 `~/.claude/skill-env.json` 文件本身保留在原地（回退层）。
- UeErrorSolver.psm1（PowerShell 入口）与 jenkins-pair-analyze 行为不变。
- 每次调用只处理一个构建对的节奏控制不变。
- karpathy-llm-wiki 的 validate-wiki.mjs 调用方式（`--wiki` 传参）不变。
- 不碰本任务 3 个技能之外的任何技能（cpu-monitor、epic-ue-assistant、aes-grilling-web 等的 PS 脚本原样保留）。

## 配置差异

| 字段 / 项 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| 环境层文件位置 | `~/.claude/skill-env.json` | `~/.config/parking-agents/skill-env.json`（旧路径保留为回退） | 新建新文件；旧文件不动 |
| `knowledgeBase.rawDir` | 本地 C 盘 | `//nas.51vr.local/PaaS/UE5/ue-llm-wiki/raw` | 拷 2 份 scratch |
| `knowledgeBase.wikiDir` | 本地 C 盘 | `//nas.51vr.local/PaaS/UE5/ue-llm-wiki/wiki` | 整目录内容拷贝 |
| `trackFile` | 本地 | `//nas.../raw/analyzed-builds.json` | 空账本起步 |
| `workflowFile` | 本地 | `//nas.../raw/workflow.json` | 不迁，重新生成 |
| `tmpDir` | 本地 | `//nas.../raw/tmp/ue-error` | 不迁 |
| `jobs[]` | 7 enabled | 3 enabled + 4 disabled | — |
| 仓库 `config.example.json` | 占位 schema | 真实 NAS 值 + 3 job（团队模板） | 仓库内更新 |

回退方式：删除/改名新位置文件即回退旧路径行为；`skill-env.json.bak` 级整体回退仍适用。
