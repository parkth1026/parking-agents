# Goal Contract: jenkins-log-auto-learning 迁 NAS 知识库、收窄扫描范围，技能环境配置迁 XDG 并去 PS 双胞胎

- Status: Ready
- Target: `D:\GIT_dev\parking-agents`（.claude/skills 下 jenkins-log-auto-learning、ue-error-solver、karpathy-llm-wiki 三技能）+ 本机用户配置 + NAS `\\nas.51vr.local\PaaS\UE5\ue-llm-wiki`
- Updated: 2026-08-16

## 原始请求

> 我期望 jenkins-log-auto-learning 输出配置 \\nas.51vr.local\PaaS\UE5\ue-llm-wiki\raw，学习 jenkins 范围，http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/ 、http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-installed/ 、http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-linux-ci/

> （第 4 轮补充）配置文件肯定是要放在本地的，但是是否还继续用 ~/.claude 我保留意见。技能不一定会放 claude 目录，每个人自己安装。……把 NAS 配置默认配置，如果访问不到就直接告诉用户现状。这样是否是最佳实践？……这种带地址的 skill 行业最佳实践是什么你可以去深度调研一下。

> （对照物质疑补充）重点是你在用 skill 的时候，如果没有这个 config，应该告知用户去配置。然后，我的 example 里面指向的是这个 NAS 地址，所以那个配置的默认选项里面，第一步是这个 NAS 地址。……当然用户想改的话，也可以自己改。

> （对照物质疑补充）脚本必须用 mjs 写，不要有 psm1 吧，这样更符合 parking-skill-creator 的设计。

## 目标

本机 jenkins-log-auto-learning 及共享其配置的两个技能把知识库与运行时状态整体落到 NAS ue-llm-wiki（raw/wiki/账本/tmp 全上 NAS、空账本起步、既有 wiki 内容随迁），扫描范围收窄到 Earth 下 3 个 job；技能环境配置迁到工具中立的 `~/.config/parking-agents/skill-env.json`（SKILL_ENV 覆盖 + 旧路径回退 + 无配置引导 + NAS 不可达现状报告），仓库模板默认指向 NAS，受影响技能的 PowerShell 双胞胎删除。

## Why

- 学到的知识此前锁在单机 C 盘，llm-wiki 链路和团队都够不着；落 NAS 后换机即用、人人可摄取。
- `~/.claude/skill-env.json` 绑死 Claude 目录体系，与「每人自己安装、多主机」的现实不匹配；工具中立位置 + 仓库模板（默认 NAS 值）让新成员拷贝即用。
- 新机器无配置时裸报错、NAS 掉线时抛裸堆栈，排障成本高；引导与现状报告把它变成一眼可行动的信息。
- PS 双入口与仓库标准（parking-skill-creator SKILL.md:269：脚本一律 .mjs）相悖，双份维护是持续税。

## 范围

做：
- 一次性数据迁移：本地 raw/scratch 的 2 份知识文件拷到 NAS raw/scratch；本地 wiki 整目录内容拷到 NAS wiki（本地原件全保留）。
- 新建本机配置 `~/.config/parking-agents/skill-env.json`：五路径字段指 NAS、jobs 3 enabled + 4 disabled、baseUrl/gitRepos 不变；旧 `~/.claude/skill-env.json` 原地保留作回退层。
- 代码（仅 2 个 .mjs）：`jenkins-log-auto-learning/scripts/config.mjs` 与 `ue-error-solver/scripts/UeErrorSolver.mjs` 的环境层解析改为 SKILL_ENV > 新路径 > 旧路径回退；status 类输出增加配置来源行；三层无配置时打印配置引导后 exit 1；配置加载成功后对 NAS 路径做连通检查，不可达时打印现状报告（不可达路径/受影响操作/建议检查）后 exit 1。
- 仓库模板 `config.example.json`：默认值即真实 NAS 地址、baseUrl 与 3 job 范围（gitRepos 留示例值并注明按机器改）。
- 文档：3 处 SKILL.md/references 的配置路径说明改为新路径与回退链；删除 PS 入口引用。
- 删除：UeErrorSolver.psm1、scan-pairs.ps1、karpathy-llm-wiki/scripts/validate-wiki.ps1、jenkins-log-auto-learning/tmp/（含 get-changesets.ps1）。

不做：
- 不改写 NAS 上 wiki/raw 的任何既有内容（只新增拷贝文件）。
- 不删不改本地 `C:/Users/Administrator/memory/jenkins-learnings-raw/` 与 `jenkins-learnings/`（档案 + 回退）。
- 不迁 115 条 twe-ue5.5 账本历史（NAS 空账本起步；重启用旧 job 会重复分析，已知情接受）。
- 不动本任务 3 个技能之外的任何技能（cpu-monitor、epic-ue-assistant、aes-grilling-web 等的 PS 脚本原样保留）。
- 不配置其他机器（靠仓库模板自助）；不改 Jenkins job 本身；不改技能的分析方法论/评分逻辑。

## 强约束

- 确认版对照物 `../2-prototype/behavior.md`、`../2-prototype/example-run.md` 不可修改——执行 Agent 改的是产品，不是对照物。
- 配置解析链固定：`SKILL_ENV` > `~/.config/parking-agents/skill-env.json` > `~/.claude/skill-env.json`（回退）；技能固有 config.json ⊕ 环境层的深合并语义与优先级不变。
- 配置读取不得依赖网络：fail-fast 连通检查是配置加载成功后的首步动作，不是解析链的一环。
- NAS 账本空起步：迁移动作不得在 NAS 创建 analyzed-builds.json（由技能首次运行自建）。
- `jenkins.baseUrl` 与 `gitRepos` 值与语义不变；对 Jenkins 的 API 请求构造不变。
- 每次调用只处理一个构建对的节奏控制不变。
- 只用 Node 内置模块，零 npm 依赖；脚本 `.mjs` + kebab-case（仓库标准）。
- 所有新增/修改的文本文件 UTF-8 without BOM。

## 自主边界

不用问，直接定：
- UNC 路径统一正斜杠写法（`//nas.51vr.local/...`）；备份文件命名；拷贝用 cp 还是 robocopy。
- status 来源行的具体措辞（含路径与 `(fallback)`/`(SKILL_ENV)` 标注即可）。
- fail-fast 检查的具体实现位置（配置加载后首步内）与重试/超时参数。
- 无配置引导与现状报告的文案细节（保住「已查路径/三步引导」「路径/影响/建议」三要素）。
- 文档措辞、模板注释、tmp/ 清除方式、git 提交切分。

必须停下来问：
- NAS 地址或目录结构要变；要动 3 个技能之外的文件；要删本地档案或旧配置文件。
- 要把 115 条账本历史迁去 NAS（推翻 Q2）；要改 SKILL_ENV 覆盖语义或深合并优先级。
- 要给 cpu-monitor/epic-ue-assistant/aes-grilling-web 也做 PS 清理（另开契约）。

## 读什么

- `../2-prototype/behavior.md` — 16 行变化行、不变清单、配置差异表（本契约的全部行为来源）。
- `../2-prototype/example-run.md` — 9 个场景与关键断言（[C] 档验收照此复现）。
- `.claude/skills/parking-skill-creator/SKILL.md` — 仓库脚本规范（.mjs/kebab-case/零依赖）。

## 验收条件

- AC-001: 配置落位正确：本机 `C:/Users/Administrator/.config/parking-agents/skill-env.json` 五路径字段全指 `//nas.51vr.local/PaaS/UE5/ue-llm-wiki/...`，enabled job 恰为 3 个目标、disabled 恰 4 个，baseUrl/gitRepos 不变，旧 `~/.claude/skill-env.json` 仍在；仓库模板 `config.example.json` 含 NAS raw 路径、真实 baseUrl 与 3 个目标 job 名。
  - Verify: [A] `node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('C:/Users/Administrator/.config/parking-agents/skill-env.json','utf8'));const N='//nas.51vr.local/PaaS/UE5/ue-llm-wiki/';let ok=c.jenkins.baseUrl==='http://10.66.12.40'&&c.gitRepos==='D:/Git'&&c.knowledgeBase.rawDir===N+'raw'&&c.knowledgeBase.wikiDir===N+'wiki'&&c.trackFile===N+'raw/analyzed-builds.json'&&c.workflowFile===N+'raw/workflow.json'&&c.tmpDir===N+'raw/tmp/ue-error';const en=c.jobs.filter(j=>j.enabled===true).map(j=>j.name).sort().join(',');ok=ok&&en==='aes6-ue-runtime-ci,twe-ue5.5-installed,twe-ue5.5-linux-ci'&&c.jobs.filter(j=>j.enabled!==true).length===4;ok=ok&&fs.existsSync('C:/Users/Administrator/.claude/skill-env.json');const t=fs.readFileSync('D:/GIT_dev/parking-agents/.claude/skills/jenkins-log-auto-learning/config.example.json','utf8');ok=ok&&t.includes(N+'raw')&&t.includes('http://10.66.12.40')&&t.includes('aes6-ue-runtime-ci')&&t.includes('twe-ue5.5-installed')&&t.includes('twe-ue5.5-linux-ci');process.exit(ok?0:1)"` → 退出码 0
- AC-002: 配置解析链三态正确：新路径生效（来源行显示新路径）；移走新文件后回退旧路径（来源行标注 fallback 且功能完整）；设 SKILL_ENV 时优先；三层全无时打印含已查路径与三步引导的配置引导后 exit 1。learning 与 ue-error-solver 两个入口都验。
  - Verify: [C] 照 example-run 场景 1/2/3/9 操作，观察来源行、fallback 标注、引导三要素与退出码
- AC-003: NAS 不可达时 fail-fast：SKILL_ENV 指向 rawDir 为不可达 UNC 的副本配置跑 status，输出含现状报告三要素（不可达路径/受影响操作/建议检查），退出码 1，无裸堆栈。
  - Verify: [A] `node -e "const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');const f=path.join(os.tmpdir(),'nas-failfast-env.json');fs.writeFileSync(f,JSON.stringify({jenkins:{baseUrl:'http://10.66.12.40'},gitRepos:'D:/Git',knowledgeBase:{rawDir:'//nas.invalid.invalid/x/raw',wikiDir:'//nas.invalid.invalid/x/wiki'},trackFile:'//nas.invalid.invalid/x/raw/t.json',tmpDir:'//nas.invalid.invalid/x/tmp',jobs:[{enabled:true,name:'t',path:'job/t/job/t'}]}));const r=cp.spawnSync(process.execPath,['D:/GIT_dev/parking-agents/.claude/skills/jenkins-log-auto-learning/scripts/session.mjs','status'],{env:Object.assign({},process.env,{SKILL_ENV:f}),encoding:'utf8'});const out=(r.stdout||'')+(r.stderr||'');console.log(out);process.exit(r.status!==0&&/不可达/.test(out)&&/建议/.test(out)?0:1)"` → 退出码 0
- AC-004: 既有知识迁移到位：NAS raw/scratch 有 2 份旧知识文件；NAS wiki 有 SCHEMA.md、index.md、entities/、concepts/ 及既有知识页。
  - Verify: [A] `node -e "const fs=require('fs');const R='//nas.51vr.local/PaaS/UE5/ue-llm-wiki/';const files=[R+'raw/scratch/twe-114-DiskSpaceExhausted.md',R+'raw/scratch/twe-40-UAT-PluginDirNotFound.md',R+'wiki/SCHEMA.md',R+'wiki/index.md',R+'wiki/linux-ld-duplicate-symbol-FAesEditorToolTypeIdGenerator.md',R+'wiki/ue55-iwyu-fpaths-fapp-fassetdata.md'];const dirs=[R+'wiki/entities',R+'wiki/concepts'];process.exit(files.every(f=>fs.existsSync(f))&&dirs.every(d=>fs.existsSync(d))?0:1)"` → 退出码 0
- AC-005: 本地档案原样且 NAS 空账本：本地账本仍含 twe-ue5.5#115 条目、本地 2 份 scratch 仍在；NAS 上 analyzed-builds.json 不存在。
  - Verify: [A] `node -e "const fs=require('fs');const L='C:/Users/Administrator/memory/jenkins-learnings-raw/';const t=JSON.parse(fs.readFileSync(L+'analyzed-builds.json','utf8'));process.exit(Object.keys(t.analyzed).some(k=>k==='job/wdp-ue/job/Earth/job/twe-ue5.5#115')&&fs.existsSync(L+'scratch/twe-114-DiskSpaceExhausted.md')&&fs.existsSync(L+'scratch/twe-40-UAT-PluginDirNotFound.md')&&!fs.existsSync('//nas.51vr.local/PaaS/UE5/ue-llm-wiki/raw/analyzed-builds.json')?0:1)"` → 退出码 0
- AC-006: PS 双胞胎清除：3 个受影响技能目录递归无 .ps1/.psm1，learning 技能目录无 tmp/，mjs 入口齐全。
  - Verify: [A] `node -e "const fs=require('fs'),path=require('path');const roots=['D:/GIT_dev/parking-agents/.claude/skills/jenkins-log-auto-learning','D:/GIT_dev/parking-agents/.claude/skills/ue-error-solver','D:/GIT_dev/parking-agents/.claude/skills/karpathy-llm-wiki'];let bad=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(ps1|psm1)$/i.test(e.name))bad.push(p);}})('D:/GIT_dev/parking-agents/.claude/skills/jenkins-log-auto-learning/scripts');(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(ps1|psm1)$/i.test(e.name))bad.push(p);}})('D:/GIT_dev/parking-agents/.claude/skills/ue-error-solver/scripts');(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(ps1|psm1)$/i.test(e.name))bad.push(p);}})('D:/GIT_dev/parking-agents/.claude/skills/karpathy-llm-wiki/scripts');process.exit(bad.length===0&&!fs.existsSync('D:/GIT_dev/parking-agents/.claude/skills/jenkins-log-auto-learning/tmp')&&fs.existsSync('D:/GIT_dev/parking-agents/.claude/skills/jenkins-log-auto-learning/scripts/scan-pairs.mjs')?0:1)"` → 退出码 0
- AC-007: 真实扫描范围收窄：跑 scan-pairs 后 NAS raw/pending-pairs.json 存在且每个构建对的 jobPath 属于 3 个目标之一。
  - Verify: [C] 照 example-run 场景 4/5 操作，检查 NAS pending-pairs 内容（依据 scan-pairs.mjs 只迭代 enabled，AC-001 已机械锁定配置层）

> 注：7 条为用户 Q5 裁定「并入本次」所致的扩大范围（>6 条的拆分建议已在第 5 轮提问中被否决），分两个交付簇：AC-001/004/005/007 为数据迁移与范围，AC-002/003/006 为配置机制与清理。

## 挡着的事

- None.

## 访谈记录

### 第 1 轮（需求歧义）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 账本/tmp 随 rawDir 迁 NAS 吗 | A 账本留本地 48% / B 账本迁 NAS·tmp 本地 37% / C 全部上 NAS 15% | A，NTFS 原子写最稳 | C。补充：接受 SMB 原子性弱与网络延迟，换机即用 |
| wikiDir 指 NAS 吗 | 指向 NAS wiki ~90% / 维持本地 ~10% | 指向 | 确认按推荐 |
| 旧 2 份 scratch 拷 NAS 吗 | 拷 ~75% / 不拷 ~25% | 拷 | 确认按推荐 |

### 第 2 轮

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q2 115 条 twe-ue5.5 账本历史迁否 | A 拷贝随行 70% / B 空账本 30% | A，重启用旧 job 不重分析 | B。补充：NAS 从零开始，重分析已知情接受 |

### 第 3 轮（prototype 草稿 v1 撞出）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q3 本地既有 wiki 迁否 | A 整目录拷 NAS 75% / B NAS 空 wiki 25% | A，schema/索引直接可用 | A |

### 第 4 轮（契约摘要撞出）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q4 skill-env.json 位置 | A 留本地仅路径值指 NAS 70% / B 配置文件上 NAS 20% / C 重议 Q1 10% | A | A 的方向（配置必须本地）+ 对 ~/.claude 保留意见，要求调研行业实践（转 Q5） |

### 第 5 轮（调研后）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q5 B' 方案（XDG+模板+fail-fast）怎么落 | A 拆两步 55% / B 并入本次 35% / C 维持 ~/.claude 10% | A，本契约不膨胀 | B。补充：一次到位 |

### 第 6 轮（对照物质疑补充，均为用户提出）

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 三层无配置→打印配置引导（模板/路径/改 gitRepos）后 exit 1 | 确认 | 用户：没有 config 应告知去配置 | 用户提出 |
| 模板默认值即 NAS 地址（开箱默认可覆盖） | 确认 | 用户：默认选项第一步是 NAS 地址 | 用户提出 |
| 删受影响 3 技能全部 PS 双胞胎与 tmp/；其他技能不碰 | 确认 | 仓库标准脚本一律 .mjs（parking-skill-creator SKILL.md:269） | 用户提出 |

未占提问、走默认区定下的：范围外 4 job 置 enabled:false 保留条目；ue-error-solver 知识输出随 rawDir 迁 NAS；UNC 正斜杠写法；改前备份；workflow.json/pending-pairs 不拷重新生成；只改环境层不动仓库 config.json（后被 Q5 部分推翻）。被翻掉的默认/推荐三处（Q1 账本上 NAS、Q2 空账本、Q5 并入本次）均在上方各表按轮留痕，含当时给出的百分比。

## 设计取舍

### D-1 环境配置文件位置

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 维持 ~/.claude/skill-env.json | 零代码改动 | 绑死 Claude 目录体系，多主机别扭 | 与「每人自己安装」不匹配 |
| B（选定）~/.config/parking-agents/skill-env.json + 旧路径回退 + SKILL_ENV | 改 2 个 .mjs 的解析默认值 | 一次性代码与文档改动 | 无 |
| C 配置文件放 NAS，SKILL_ENV 指向 | 一份配置多机共享 | 配置读取依赖网络：NAS 掉线连 baseUrl 都拿不到；gitRepos 等机器差异被强行统一 | 违反配置解析不依赖网络的行业共识（12-Factor Config；kubectl/git/npm/ssh 均为用户主目录模式） |

选定 B。落进契约的形态：`强约束` 写「解析链 SKILL_ENV > 新路径 > 旧路径回退；配置读取不得依赖网络」。

### D-2 配置机制改造并入 vs 拆分

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 拆两步（先迁移后机制） | 本契约零代码改动 | 两次交接；~/.claude 别扭期延长 | 用户明确要一次到位 |
| B（选定）并入本次 | 8 条 AC、2 个 .mjs+3 文档+1 模板 | 契约面扩大（>6 条 AC） | 无 |
| 什么都不做 | 只迁数据 | 配置机制问题原样保留 | 用户点名要解决 |

### D-3 PS 双胞胎

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 删除（选定） | 3 技能 PS 文件+tmp/ 清掉，文档同步 | 习惯 PS 入口的用户改走 mjs | 无 |
| B 保留并继续双入口维护 | 本次只改 mjs | 双份维护税，违反仓库 .mjs 标准 | 与 parking-skill-creator 设计相悖 |
| 什么都不做 | 只删文档引用 | 死代码+误导 | 同 B |
