# Goal Contract: 修复评分体系全部实锤缺陷——语义统一、验证信号、落账纪律、盲评信度

- Status: Ready
- Target: `D:\GIT_dev\parking-agents\.claude\skills\jenkins-pair-analyze\references\`（scoring/analyze/knowledge-format/blind-review）+ `.claude/skills/jenkins-log-auto-learning/`（references/config.md、scripts/validate-raw.mjs）+ `D:\GIT_dev\parking-agents\scoring-audit-2026-08-16\blind-review\`
- Updated: 2026-08-16

## 原始请求

> 针对之前实锤的调研，所有问题都要修复的话，输出改进 goal-contract。

（需求底稿：`scoring-audit-2026-08-16/verdict.md` 的 9 项存活缺陷与 3 个改进方向；第 1 轮访谈裁决 Q1=A 全修+仪表、Q2=B 向后兼容存量不动、Q3=A 独立验证信号、Q4=B 本轮就盲评。）

## 目标

把 jenkins-pair-analyze 评分体系从「语义三处矛盾、验证信号闲置、去重指针零落账、信度无测量」升级为语义唯一定义（含等效强归因链与 Commit 修复侧证据语义）、Warning Trend 独立验证信号、:see= 强制落账、校准触发条件明文、盲评工具与信度基线落地——权重数字与 8/5 阈值本轮不动，存量 14 份零改动。

## Why

- 对抗审查实锤：diff 语义三处互斥（scoring.md:15 vs :38 vs config.md:42/44）已产出 aes6-329 式争议案例；:see= 落账 0/98 使效用反馈不存在；警告计数 12/12 采集却无人消费；评分信度从未测量。
- 权重与阈值硬定于小样本是伪科学（Q1=A 知情裁定）：本轮接仪表、写触发条件，数据够后再校准。

## 范围

做：
- scoring.md：Reuse 第 1 分唯一定义（真实 diff 或等效强归因链三条件）；Commit 三分重定义为修复侧证据（代码提交/job 配置 diff/流水线参数/操作记录；infra 凭书面证据可获第 1、3 分）；校准触发条件节（:see= ≥30 或 ≥6 个月或盲评一致率 <0.8）；<5 分支说明。
- analyze.md / learning references/config.md：删除与 scoring.md 冲突的表述，改为一处引用；analyze.md 检查清单加 :see= 强制项与 Warning Trend 项。
- knowledge-format.md：自例文件名补 ShortDesc 段；Warning Trend 必填节规范（recorded_at ≥ 生效时刻）；Recurrences/:see= 纪律强化。
- validate-raw.mjs：生效分界校验（recorded_at ≥ 生效时刻的文件必须有 Warning Trend 节；存量放行）。
- 盲评包与流程：`docs/reports/scoring-audit-2026-08-16/blind-review/{set/,scoring-sheet.md,procedure.md}`（对当前库全量生成去分副本）+ `jenkins-pair-analyze/references/blind-review.md`（可复用流程）；用户盲评后指标落 `blind-review/results.md`。

不做：
- 不改四维权重数值与 8/5 阈值；不改结论串 grammar 与 frontmatter schema 字段集；不改文件命名规则。
- 不动存量 14 份知识文件与既有账本条目（新规则重算不得改变任何现有分档）。
- 不动 NAS wiki、skill-env.json、Jenkins 交互；不写新的常驻脚本（盲评包现场生成，流程文档沉淀）。
- 权重校准的执行（触发条件满足后的复审）不在本轮。

## 强约束

- 确认版对照物 `../2-prototype/behavior.md`、`../2-prototype/example-run.md` 不可修改。
- **向后兼容判据**：对存量 14 份按新规则重算，分档（details/scratch）与结论串必须逐一不变——aes6-329 合法化为 8、EnvironmentStateLag 保持 7 是两条验收锚点。
- 10 分制四维权重数值、8/5 阈值、结论串 grammar 本轮冻结。
- 存量文件、既有账本条目、NAS wiki 零写入；盲评去分副本只落在 `docs/reports/scoring-audit-2026-08-16/blind-review/`。
- 外部驱动无法暂停：规则文档必须原子落地（一次提交），validate-raw 的生效时刻取该提交时刻，容忍下一轮自动用新规。
- 文本 UTF-8 without BOM；脚本（若触）一律 .mjs。

## 自主边界

不用问，直接定：
- 各定义的具体措辞（保住行为行 1/2/3 的判定边界即可）；等效强归因链在知识文件中的标注格式。
- validate-raw 生效分界的实现方式（recorded_at 比较）；盲评包编号匿名方式与指标计算公式细节（|Δ总分|、|Δ|≤1 占比、四维差异表）。
- git 提交切分与信息；grep 验收命令的具体写法。

必须停下来问：
- 要改权重数字或 8/5 阈值；要改结论串 grammar 或 frontmatter schema。
- 发现任何存量文件在新规则下会变档（向后兼容破裂——这是设计错误，不是迁移任务）。
- 盲评发现系统性分差（如某维度普遍 ≥2 分偏差）且需要本轮回改规则；要动 scoring-audit 之外的目录。

## 读什么

- `../2-prototype/behavior.md` — 9 行变化行与不变清单（本契约全部行为来源）。
- `../2-prototype/example-run.md` — 7 场景与关键断言（[C] 档照此复现）。
- `D:/GIT_dev/parking-agents/docs/reports/scoring-audit-2026-08-16/verdict.md` — 需求底稿（缺陷清单与证据出处）。

## 验收条件

- AC-001: 语义统一落地：scoring.md 成为唯一定义点——含「等效强归因链」三条件定义；config.md 旧矛盾句（"Diff 评分维度计 0 分"、"而非推断"）删除改为引用；scoring.md 旧注 "This is acceptable" 删除或改写一致；knowledge-format.md 三段式自例（twe-linux-114-DiskSpaceExhausted.md）修正为四段命名。
  - Verify: [A] `node -e "const fs=require('fs');const S=fs.readFileSync('D:/GIT_dev/parking-agents/.claude/skills/jenkins-pair-analyze/references/scoring.md','utf8');const C=fs.readFileSync('D:/GIT_dev/parking-agents/.claude/skills/jenkins-log-auto-learning/references/config.md','utf8');const K=fs.readFileSync('D:/GIT_dev/parking-agents/.claude/skills/jenkins-pair-analyze/references/knowledge-format.md','utf8');process.exit(S.includes('等效强归因链')&&S.includes('校准触发')&&!S.includes('This is acceptable')&&!C.includes('Diff 评分维度计 0 分')&&!C.includes('而非推断')&&!K.includes('twe-linux-114-DiskSpaceExhausted.md')?0:1)"` → 退出码 0
- AC-002: Commit 维度语义重定义落地：scoring.md 含「修复侧」证据语义与 infra 配置变更证据条款（行为行 3 的三分结构）。
  - Verify: [A] `node -e "const s=require('fs').readFileSync('D:/GIT_dev/parking-agents/.claude/skills/jenkins-pair-analyze/references/scoring.md','utf8');process.exit(s.includes('修复侧')&&s.includes('配置变更')?0:1)"` → 退出码 0
- AC-003: 向后兼容锚点成立：aes6-329 在新口径下重算仍 8 分进 details/（等效强归因链合法化，frontmatter 不变）、EnvironmentStateLag 仍 7 分 scratch/（failure:infra 结论不变）——两条锚点文件零改动即证明存量分档不受新规则影响。
  - Verify: [A] `node -e "const fs=require('fs');const N='//nas.51vr.local/x.public/UE5/ue-llm-wiki/raw/';const a=fs.readFileSync(N+'details/aes6-329-StageFileMissing-runtimeversion-not-in-repo.md','utf8');const b=fs.readFileSync(N+'scratch/aes6-56-EnvironmentStateLag-datapath-split-build-race.md','utf8');const m=t=>t.match(/^score:\s*(\d+)/m),r=t=>t.match(/^result:\s*(\S+)/m);process.exit(m(a)&&+m(a)[1]===8&&r(a)&&r(a)[1].startsWith('failure:score=8')&&m(b)&&+m(b)[1]===7&&r(b)&&r(b)[1].startsWith('failure:infra')?0:1)"` → 退出码 0
- AC-004: Warning Trend 机制生效：validate-raw 增生效分界校验（recorded_at ≥ 生效时刻的文件必须有 Warning Trend 节；存量放行），全库 0 ERROR；knowledge-format.md 写入必填规范（与 analyze.md 既有条件式警告节并存不矛盾：必填节收录计数，条件式规则决定何时展开分析）。
  - Verify: [A] `node D:/GIT_dev/parking-agents/.claude/skills/jenkins-log-auto-learning/scripts/validate-raw.mjs` → 退出码 0；[C] 负例按 example-run 场景 1 手工复现（构造生效后缺节文件报 ERROR，验后删除）
- AC-005: :see= 强制纪律与校准触发条件成文：analyze.md 检查清单新增 :see= 强制项（当前 0 处）；knowledge-format.md 含 Warning Trend 必填规范（当前为无条件式规范）。
  - Verify: [A] `node -e "const fs=require('fs');const A=fs.readFileSync('D:/GIT_dev/parking-agents/.claude/skills/jenkins-pair-analyze/references/analyze.md','utf8');const K=fs.readFileSync('D:/GIT_dev/parking-agents/.claude/skills/jenkins-pair-analyze/references/knowledge-format.md','utf8');process.exit(/- \[ \].*see=/.test(A)&&K.includes('Warning Trend')&&K.includes('必填')?0:1)"` → 退出码 0
- AC-006: 盲评包就绪：`docs/reports/scoring-audit-2026-08-16/blind-review/{set/,key.md,scoring-sheet.md,procedure.md}` 存在；set/ 去分副本数量 = key.md 快照映射行数（生成时刻语料全量，外部驱动后续新增不计）；副本不含分值泄露（score:/Score/Scoring 标记）；`references/blind-review.md` 流程文档存在。
  - Verify: [A] `node -e "const fs=require('fs'),path=require('path');const B='D:/GIT_dev/parking-agents/docs/reports/scoring-audit-2026-08-16/blind-review/';if(!fs.existsSync(B+'set')||!fs.existsSync(B+'scoring-sheet.md')||!fs.existsSync(B+'procedure.md')||!fs.existsSync(B+'key.md')||!fs.existsSync('D:/GIT_dev/parking-agents/.claude/skills/jenkins-pair-analyze/references/blind-review.md'))process.exit(1);const set=fs.readdirSync(B+'set').filter(f=>f.endsWith('.md'));const keyRows=(fs.readFileSync(B+'key.md','utf8').match(/^\| BR-/gm)||[]).length;const leaked=set.some(f=>/(^score:|\*\*Score\*\*|\*\*Scoring\*\*)/m.test(fs.readFileSync(path.join(B+'set',f),'utf8')));console.log('set:',set.length,'| key rows:',keyRows,'| leaked:',leaked);process.exit(set.length===keyRows&&keyRows>0&&!leaked?0:1)"` → 退出码 0（2026-08-17 更正：数量对齐基准从活语料改为 key.md 快照行数——外部驱动每小时新增文件，原判据存在永不可过的竞态；意图不变）
- AC-007: 盲评执行与信度基线落盘：用户按 procedure.md 完成盲评，results.md 含逐文件 |Δ总分|、|Δ|≤1 占比、四维差异表。
  - Verify: [C] 照 example-run 场景 6 操作（操作者=用户，约半天；执行 Agent 负责包生成与指标计算，不代填）

## 挡着的事

- None.

## 访谈记录

### 第 1 轮

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 修复落地方式 | A 全修+仪表 55% / B 只修 7 项 30% / C 连校准 15% | A | A |
| Q2 存量重评否 | A 重评改档 40% / B 向后兼容不动 45% / C 冻结 15% | B | B |
| Q3 警告计数接入 | A 独立验证信号 45% / B 并入总分 25% / C 只记录 30% | A | A |
| Q4 盲评投入 | A 只搭工具 55% / B 本轮就盲评 35% / C 不做 10% | A | **B（翻推荐）** |

走默认区定下的：verdict.md 为需求底稿；diff 语义一处定义三处引用；小项随手修；dev 分支提交、不动 NAS wiki；规则原子落地（外部驱动不可停，本工作区无 cron）。

### 对照物轮

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 等效强归因链三条件（唯一 pin+同名对应+错误消失） | 确认 | verdict Top1 方向 + aes6-329 实践合法化 | 确认锁定 |
| Commit 修复侧证据三分（infra 凭配置变更证据可拿 1/3 分） | 确认 | 缺陷⑦⑧根因是语义未定义 | 确认锁定 |
| Warning Trend 必填节 + details 恶化须解释 | 确认 | Q3=A 裁决的落地形态 | 确认锁定 |
| 校准触发三数字（30 条 / 6 个月 / 0.8） | 确认 | 宿主拟定，用户未翻 | 确认锁定 |
| 盲评指标口径（\|Δ\|≤1 占比 + 四维差异表） | 确认 | 宿主拟定 | 确认锁定 |

## 设计取舍

### D-1 数据依赖类缺陷（权重校准/信度测量）本轮怎么处理

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 本轮硬做校准 | n=98/14 重定权重与阈值 | 统计效力弱，数字是换皮拍脑袋 | 伪科学 |
| B（选定）修仪表+触发条件，盲评本轮做 | 语义/纪律/信号全修；校准留触发条件 | 8 分边界效应（42/82）留存至触发 | 无 |
| 只修 7 项 | 数据类另开 | 仪表不建，校准永无起点 | 效用数据继续零积累 |

### D-2 存量语料处置

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 重评改档 | 全库按新规重算挪档 | 动已入库文件+与外部驱动并发 | 风险大收益小 |
| B（选定）向后兼容设计 | 规则合法化既有实践，重算不改档 | 个别文件新旧口径解释不同（档位不变） | 无 |
| 冻结 | 旧文件永不重算 | Recurrences 跨口径追加 | 长期并存 |

### D-3 盲评工具形态

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| 写常驻脚本 make-blind-set.mjs | 可复用生成器 | 为一次性任务加维护面 | 流程文档+现场生成即可 |
| B（选定）流程文档沉淀 + 包现场生成 | references/blind-review.md + audit 目录 | 复用时需按文档手工重生成 | 无 |
| 不做工具 | 只出说明 | 无一致口径 | Q4=B 已否决 |
