# Goal Contract: local-mr-squash 技能——本地 squash 合并最小形态（五步语义合并 prose + 零配置硬门禁脚本）

- Status: Ready
- Target: `C:\Users\parking\.agents\skills\local-mr-squash\`（用户全局技能库）
- Updated: 2026-09-11

## 原始请求

> 「我们开始 正规访谈来锁定所有需求 local-mr-squash 这个 skill的 所有需求……这里面应该跟 GitLab 没关系，本质上就是 local 的 Git 管理，还有就是，在 merge 过程当中，一定要用 matt-skills engineering resolving-merge-conflicts 这里的核心思想。确保 merge 内容是严格有历史追溯的不是 只是执行一个 git 命令。他是真的是要 llm 驱动的 功能合并。」
> 「我彻底反思了一下 你做的太复杂了。其实 应该就 说最简单的prompt + 最后脚本检测应该就行了。……应该在 resolve merge conflict 技能基础上 增强一下 squash commit 规则与 最后 结果验收 最简单的脚本。」
> 「最后脚本检测 = 单笔提交/树净/源分支内容已全包含/分支簿记收口提醒，零配置开箱通用。脚本只能做硬检查，就安全门禁。」

## 目标

把本地 squash 合并固化为与 resolving-merge-conflicts 同量级的通用技能：七步 prose（内嵌五步语义合并思想 + squash 规则）+ 零配置硬门禁脚本，让每次合并有语义裁决、有溯源、有机械收口判定。

## Why

- 现状：squash 合并靠会话临场发挥，commit message 与收口质量随机；分支合并后 merge-base 不感知，「不知道自己被合并」
- 价值：规则主权自持的最小流程——语义质量交给 LLM prose 纪律，机械正确性交给门禁脚本，边界清晰；2026-09-10 真实合并（8722165）实证该分工的全部价值产出无需机制版参与

## 范围

做：`SKILL.md`（七步 prose）+ `scripts/verify-squash-merge.mjs`（四项硬检查）+ `run-tests.mjs`（回归：四态断言/内容契约/量级门槛/fixture 演练）。

不做：台账、policy 配置、状态机、生命周期规则引擎（R3 总反思推翻）；GitLab 平台交互（tracker 溯源仅 prose 一句「issue 原文取得到就读」）；true merge / rebase 场景（裸走 resolving-merge-conflicts）；重验收管线内嵌（调用方自选强度与时机）；pre-push hook（出现首例绕过证据再议）。

## 强约束

- 确认版对照物为不可修改规格源：`../2-prototype/skill.md`（SKILL.md 实文）、`../2-prototype/behavior.md`、`../2-prototype/verify-squash-merge.md`（脚本契约）——执行 Agent 改的是产品不是尺子
- 永不：`--abort`、改写已推送历史、门禁非绿宣称合并完成
- 五步思想以文本内嵌；不修改、不 import `resolving-merge-conflicts` 技能文件
- 零配置：不落任何被管仓文件（无 policy、无台账、无 .git 自建目录）
- 门禁树净口径从严：含未跟踪文件（用户拍板）
- `--keep` 逃生门用了必须显形于合并报告
- 脚本仅 Node 内置模块，任意 git 仓通用

## 自主边界

不用问，直接定：
- SKILL.md 行文措辞与步骤拆分（量级门槛内）
- 脚本输出文案、内部结构、错误提示措辞
- run-tests.mjs 断言风格、temp fixture 仓造法
- 触发 description 措辞（评测迭代内自由改）

必须停下来问：
- 技能装到非 `C:\Users\parking\.agents\skills\` 的位置
- 脚本引入 Node 内置以外的依赖
- 突破量级门槛的结构性扩张（新文件、新配置面、新脚本）
- 改动 `resolving-merge-conflicts` 原技能文件

## 读什么

- `../2-prototype/skill.md` —— SKILL.md 实文（产品规格）
- `../2-prototype/verify-squash-merge.md` —— 门禁 CLI 契约与三态实测输出
- `../2-prototype/verify-squash-merge.mjs` —— 参考实现（2026-09-11 已实打 AntAgent_v2 仓三态验证）
- `../2-prototype/behavior.md` —— 行为对照（变化行/边界行/不变清单）
- `C:\Users\parking\.agents\skills\resolving-merge-conflicts\SKILL.md` —— 五步思想源
- `C:\Users\parking\.agents\skills\parking-skill-creator\SKILL.md` —— 铸造流水线（六步主线）

## 验收条件

- AC-001: 技能落位与结构合法（目录、frontmatter、脚本就位）
  - Verify: [A] `test -f C:/Users/parking/.agents/skills/local-mr-squash/SKILL.md && node C:/Users/parking/.agents/skills/parking-skill-creator/scripts/quick-validate.mjs C:/Users/parking/.agents/skills/local-mr-squash` → 退出码 0
- AC-002: 门禁脚本四态行为正确（用法错 exit 1 / FAIL exit 1 / --keep 跳第 4 项 / 全绿 exit 0 / squash 后源前进被捕获变红）
  - Verify: [A] `node C:\Users\parking\.agents\skills\local-mr-squash\run-tests.mjs` → 退出码 0
- AC-003: SKILL.md 内容契约完整：五步要素（保双方意图/不相容按合并目标裁决并记取舍/不发明行为/永不 --abort）、溯源块要求、门禁全绿才算完成、--keep 显形
  - Verify: [A] `node C:\Users\parking\.agents\skills\local-mr-squash\run-tests.mjs` → 退出码 0（断言含上述关键词集）
- AC-004: 量级门槛成立：SKILL.md 正文 ≤45 行、步骤 ≤8 条
  - Verify: [A] `node C:\Users\parking\.agents\skills\local-mr-squash\run-tests.mjs` → 退出码 0（断言含门槛）
- AC-005: fixture 自动演练走通：temp git 仓造双侧改动与冲突 → 按 SKILL.md 流程执行 → 门禁全绿收口
  - Verify: [A] `node C:\Users\parking\.agents\skills\local-mr-squash\run-tests.mjs` → 退出码 0（演练断言含）
- AC-006: 触发准确：跑 parking-skill-creator 触发评测，「把 X 分支 squash 合过来 / 本地 PR 流程合并」类用例命中 local-mr-squash，「解决 merge/rebase 冲突」类用例命中 resolving-merge-conflicts，无误抢
  - Verify: [C] 执行 `run-headless-trigger-probe.mjs` 触发评测，人工判读报告中上述边界用例的归属与命中

## 挡着的事

- None.

## 残留风险

- 中断半程语义决策靠 git 现场 + 重推恢复（R3 接受）— 错了会怎样：重推结论可能与原判断不一致，无载体对证
- 冲突裁决留痕降为 commit message 摘要级（R3 推翻 Q4 的逐条台账）— 错了会怎样：逐 hunk 意图证据链不可查，溯源止于摘要
- 门禁树净从严（含未跟踪文件）— 错了会怎样：真实合并遇正当未跟踪目录（如证据目录）时需先安置才能过门禁
- AC-006 为 [C] 档人工判读 — 错了会怎样：触发边界漂移无机械拦截

## 访谈记录

### 第 1 轮（需求，1-interview）

| 问题 | 候选（带当时百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 溯源数据源边界 | A 纯 local 55% / B local 优先+tracker 可选增强 40% / C 纯 local+强制随附文档 5% | A | **B（推翻推荐）**。补充：最终经 R3 弱化为 prose 一句 |
| Q2 语义合并深度 | A 全深度（零冲突也全合并面审阅）50% / B 仅冲突介入 30% / C 分档 20% | A | 自定义：「按 resolving-merge-conflicts 的表达」≈B |
| Q3 适用域 | A 通用+per-repo policy 60% / B 本仓专用 30% / C 通用+硬编码档 10% | A | A（policy 后随 R3 出局） |
| Q4 追溯粒度 | A 冲突裁决逐条入台账 55% / B 仅 MR 级 30% / C 完整裁决级 15% | A | A（后随 R3 连带推翻，降为 commit message 摘要） |

| 定了什么 | 档 | 为什么 | 用户 |
| --- | --- | --- | --- |
| 与 GitLab 平台零交互 | 默认 | 用户原话 | 未反对 |
| 五步核心写为强约束 | 默认 | 用户点名内嵌 | 未反对 |
| 台账入库 committed | 确认 | steelman 裁决延续 | **翻：不入库**（后随 R3 台账整体出局） |
| 重验收管线不内嵌 | 确认→定 | 用户：「如果需要测试用户自己说就行」 | 定 |
| 生命周期/squash-only/触发话术 | 默认 | 可逆+置信高 | 未反对 |

### 第 2 轮（总反思，prototype 阶段触发）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 技能形态 | A 机制版（状态机+policy+台账）/ B 最小版（prose+门禁脚本）/ C 裸 git | （steelman 双方等强，crux 未定） | **B**：「你做的太复杂了」+ 门禁脚本=零配置纯硬检查 |

v1 机制版四对照物（behavior/api-mock/example-run/diagram）被「太复杂」质疑后整体 superseded；v2 三件（skill/verify/behavior）确认，含树净从严口径确认。

### 第 3 轮（验收，3-contract）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 量级防线（AC-004） | A 数字门槛 55% / B 结构门槛 30% / C 人读 15% | A | A |
| 首演途径（AC-005） | A fixture 自动 50% / B 人工首演 30% / C 双轨 20% | A | A |

## 设计取舍

### D-1 技能形态：机制版 vs 最小版

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 机制版 | 六态状态机、policy TOML、JSON 台账、生命周期规则引擎 | 每块新增同步义务（policy↔行为、台账↔git 实态）；本会话实证其未参与任何真实价值产出 | second-system：git 自身即过程状态持久层（MERGE 态/暂存区/reflog）；五步第 4 步原文即「发现检查」，无需配置面 |
| B 最小版（选定） | 五步内嵌 prose + 零配置门禁脚本 | 语义纪律概率化；证据链降为摘要级 | 无 |
| 什么都不做 | 裸 git + resolving-merge-conflicts | squash 无收口判定、溯源与 message 质量随机 | 簿记坑（merge-base 不感知）实证存在 |

选定 B。理由：机械正确性与语义质量的边界划清后，机制版的每个组件都找到了更轻的等价物（检查发现=五步第 4 步、状态持久=git 自身、溯源=commit message 块）。
落进契约的形态：`强约束` 写「永不三则 / 零配置 / 树净从严 / 文本内嵌不依赖原技能」。

### D-2 门禁树净口径

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 从严（含未跟踪）（选定） | `git status --porcelain` 全空才算过 | 正当未跟踪目录（证据目录）会挡门 | — |
| B 只看已跟踪改动 | 忽略 untracked | 半截现场也算「完成」，门禁语义稀释 | 用户拍板从严 |

选定 A。理由：门禁的语义是「合并完成=现场干净」，口径纯粹性优先。
