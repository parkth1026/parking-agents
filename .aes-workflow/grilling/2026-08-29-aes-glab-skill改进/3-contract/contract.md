# Goal Contract: aes-glab 扩成「安装+配置+使用」全覆盖教程型技能并经输出评测验收

- Status: Ready
- Target: `D:\GIT_dev\parking-agents\.agents\skills\aes-glab\`（SKILL.md、references\design.md、新增 references\evidence-usage.md）
- Updated: 2026-08-29

## 原始请求

> 「总结一下你的经验 现在 glab skill 改名叫 aes-glab 了 他包含了 对 glab 的 安装 配置 还有使用的 全部教程 。你可以参考 gh 这个技能 对 github 的使用。看下我们对 glab 做什么改动比较好？」

> 补充（问答中裁定）：使用面同步扩到 gh 广度（Q1=B）；「配置」边界=一次性配置；验收走完整输出评测循环（Q2=B）；使用面优先组=label/milestone、release/pipeline、snippet/多账号/api（Q3 未选 search）；评测门槛 6/6（Q5=A）；实测记录落盘（Q6=A）。

## 目标

把 2026-08-29 引导纯小白装 glab 的会话实测经验固化进 aes-glab：新增安装节与一次性配置事实节、使用面逐条实测后扩到 gh 级广度，使「零基础安装指引」评测六断言 6/6 全过。

## Why

- 现状：SKILL.md 只有认证/命令怪癖/免费档三节，「帮我装 glab」请求不触发或触发后无内容；config 位置、gitlab.com 噪音块、agent bash PATH 三个实测坑每次都靠现场重查。
- 做到之后：新机器从零装机有可照做的引导，配置类疑问秒答有据，使用面命令范式有实测证据背书。

## 范围

做：SKILL.md 新增「安装」「配置事实」两节（Windows 为主）、description 补触发词、使用面按证据规则扩充（B/C/D 优先组实测，A 组最小条目或裁决）、design.md 增补、iteration-2 评测+history 沉淀、新增 references/evidence-usage.md 实测记录。

不做：非 Windows 安装教程展开（只留一句指向官方文档）、日常偏好管理类配置、现有三节任何文字改动、六断言定义改动、真机卸载重装验证、为使用面新增独立 eval。

## 强约束

- 现有三节逐字保留，锚点行必须原样存在：`glab auth login --hostname git.51vr.local --api-protocol http --git-protocol http --stdin`、`✓ Stored your credentials in the operating system keyring.`、「SSH hostname:」「API hostname:」留空回车避坑、`No token found` 故障行、`relates_to` 免费可用结论。
- 「eval-glab零基础安装指引」六条断言定义不改（iteration-2 按原定义跑）。
- `history.json` 只追加不覆盖，既有 glab-workflow iteration-1 轨迹保留。
- 双协议参数红线不变：纯 http 实例必须带 `--api-protocol http --git-protocol http`。
- 免费档链接裁决结论不重开（blocks/blocked_by 全版本 Premium）。
- 目标实例不变：git.51vr.local（GitLab 15.0.5-EE 免费档、纯 http）。
- 确认版对照物不可修改：`../2-prototype/behavior.md`、`../2-prototype/example-run.md`、`../2-prototype/diagram.html`。执行 Agent 改的是技能，不是对照物。

## 自主边界

不用问，直接定：
- 安装/配置两节的行文风格与节内排版（沿引导式「一次一步」大白话风格）。
- description 触发词的具体措辞（1024 限额内）。
- 使用面实测的具体命令顺序与探针方式（对 git.51vr.local 跑 glab，用已登录环境）。
- evidence-usage.md 的记录格式（逐条：命令、输出摘要、去留裁决）。
- design.md 新 AC 的措辞与迭代记录写法；提交信息措辞（遵守 parking-agents 仓库规范，中文）。

必须停下来问：
- 实测中若发现需要改六断言定义或 output-evals.json 其他内容。
- 若需要改动现有三节的任何文字。
- 若要新增第二个输出 eval 或触发评测。
- 若 parking-agents 仓库的提交/分发流程与预期不符（如需改 install 脚本）。

## 读什么

- `../2-prototype/behavior.md` — 8 条变化行与不变清单（行为源，含已确认的节序结构）
- `../2-prototype/example-run.md` — 安装指引产出形态与六断言映射
- `D:\GIT_dev\parking-agents\skills\pub\gh\SKILL.md` — 使用面广度参照
- `D:\GIT_dev\parking-agents\.agents\skills\parking-skill-creator\SKILL.md` — 评测循环第 6 步操作
- `D:\GIT_dev\parking-agents\AGENTS.md` — 目标仓库规范

## 要落盘的东西

- D-01: `D:\GIT_dev\parking-agents\.agents\skills\aes-glab\references\evidence-usage.md`：使用面逐条实测记录——每条候选（B 组 label/milestone、C 组 release/pipeline、D 组 snippet/多账号/api 回退、A 组 search）含实测命令、输出摘要、去留裁决（入节/裁决记录/不写）。

## 验收条件

- AC-001: 「eval-glab零基础安装指引」iteration-2 评测六断言 6/6 全过，且经 `aggregate-benchmark.mjs --history` 沉淀进 history.json
  - Verify: [B] 输入 = `D:\GIT_dev\parking-agents\.agents\skills\aes-glab\output-evals.json` 的 eval prompt → 产出的安装指引匹配同文件全部六条断言，门槛 6/6
- AC-002: SKILL.md 新增安装节与配置事实节，七个事实点齐全
  - Verify: [A] `bash -c 'S="/d/GIT_dev/parking-agents/.agents/skills/aes-glab/SKILL.md"; grep -qF "winget install GLab.GLab" "$S" && grep -qF "AppData\Local\Programs\glab" "$S" && grep -qF "AppData\Local\glab-cli\config.yml" "$S" && grep -qE "新开(一个)?终端" "$S" && grep -qE "Uninstall|winget list" "$S" && grep -qF "command not found" "$S" && grep -qE "噪音|模板块" "$S" && grep -qE "GITLAB_TOKEN" "$S"'` → 退出码 0
- AC-003: description 补安装/配置触发词且 quick-validate 通过
  - Verify: [A] `bash -c 'S="/d/GIT_dev/parking-agents/.agents/skills/aes-glab/SKILL.md"; grep -m1 "^description:" "$S" | grep -qE "安装|从零" && node /d/GIT_dev/parking-agents/.agents/skills/parking-skill-creator/scripts/quick-validate.mjs /d/GIT_dev/parking-agents/.agents/skills/aes-glab'` → 退出码 0
- AC-004: 使用面按证据规则扩充，B/C/D 优先组逐条有实测证据或裁决记录，A 组最小条目或裁决记录
  - Verify: [D] `D:\GIT_dev\parking-agents\.agents\skills\aes-glab\references\evidence-usage.md`（D-01）存在且四个组每条候选都有实测命令+输出摘要+去留裁决；SKILL.md 使用面节只含 evidence-usage.md 判「入节」的条目
- AC-005: design.md 增补 AC-6/AC-7 与迭代记录，旧 AC-1~AC-5 不动
  - Verify: [A] `bash -c 'D="/d/GIT_dev/parking-agents/.agents/skills/aes-glab/references/design.md"; grep -qE "AC-6" "$D" && grep -qE "AC-7" "$D" && grep -qF "AC-1" "$D" && grep -qF "relates_to" "$D"'` → 退出码 0

## 挡着的事

- None.（评测探针只产出指引、不依赖内网；使用面实测需 git.51vr.local 可达——当前已登录可用。若执行时内网不可达，解除条件=实例恢复可达，仅阻塞 AC-004 实测部分。）

## 访谈记录

### 第 1 轮（需求）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 使用面要不要扩到 gh 广度 | A 只补安装+配置 60% / B 同步扩到 gh 广度 25% / C 只加安装节 15% | A，证据红线 | B。补充：反问「gh技能是怎么做的」，了解后选全覆盖 |
| Q2 验收方式 | A quick-validate+人工 30% / B 完整输出评测循环 60% / C 只 quick-validate 10% | B | B |
| C1 目标口径 | 确认全覆盖+六断言锚点 | — | 经 Q1=B 升级确认 |
| C2 配置边界 | 一次性配置 | — | 对 |

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 安装教程 Windows 为主 | 默认 | eval prompt 明确 Win10 | 未反对 |
| 改动落 parking-agents aes-glab | 默认 | 软链唯一目标 | 未反对 |
| 现有三节全保留 | 默认 | 实测沉淀 | 未反对 |
| PATH 兜底写法进技能 | 默认 | 本会话实测坑 | 未反对 |
| 噪音块双路径（无视+可选清除） | 默认 | 动配置不宜成默认 | 未反对 |
| description 补安装触发词 | 默认 | 触发面缺口 | 未反对 |
| design.md 同步增补 | 默认 | 仓库惯例 | 未反对 |

### 第 2 轮（对照物）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q3 使用面候选优先组（多选） | A search 15% / B label/milestone 35% / C release/pipeline 30% / D snippet/多账号/api 20% | 全交给用户 | B、C、D（A 未选，降为低优先） |
| Q4 草稿结构与节序 | A 按草稿 85% / B 要改 15% | A | A |

### 第 3 轮（验收）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| C5 五条后果描述 | 确认 / 有要改 | 确认 | 确认无误 |
| Q5 评测门槛 | A 6/6 70% / B ≥5+立票 25% / C 跑完即过 5% | A | A |
| Q6 使用面验证途径 | A 落盘+[D] 65% / B 仅人工 25% / C fixture 10% | A | A |

## 设计取舍

### D-1 使用面内容的证据规则

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 实测过→入节；不支持→裁决记录；无法实测→不写（选定） | 逐条对 git.51vr.local 跑命令，证据落 D-01 | 实测耗时一轮 | 无 |
| B 参照 gh 广度直接写，不实测 | 快，篇幅立涨 | 无证据内容混入，违反仓库「明确证据」红线，误导后续会话 | 红线 |
| C 只写已有怪癖节，不扩 | 零成本 | 用户已裁决扩广度（Q1=B），且 B/C/D 组是工作流真用面 | 违用户裁决 |

选定 A。理由：技能是查阅型契约，无证据的命令范式一旦写错会成批误导；裁决记录让「不支持」也变成资产。
落进契约的形态：`验收条件` AC-004 + D-01。

### D-2 安装/配置内容的位置

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 进 SKILL.md 主文件（选定） | 安装/配置两节排在认证节前后 | 主文件增长约 50% | 无 |
| B 拆 references/install.md | 主文件短 | 装机是高频触发路径，进子文件依赖执行 Agent 主动读，触发即断链 | 断链风险 |
| 什么都不做 | 保持现状 | 装机请求继续无指引 | 用户目标即补齐 |

选定 A。理由：对位 gh 的查阅型主文件形态，安装/配置与认证同属一次性高频路径；design.md 仍是唯一 references 惯例 + 新增 D-01 证据文件。
落进契约的形态：`范围` 与 AC-002 锚点均指向 SKILL.md 主文件。
