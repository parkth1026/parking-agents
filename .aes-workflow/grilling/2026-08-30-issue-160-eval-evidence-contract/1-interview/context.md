# Context Snapshot: 2026-08-30-issue-160-eval-evidence-contract

- 创建：2026-08-30T16:14:48+08:00
- 分片来源：无，宿主直接调查

## 任务陈述
基于上面的调研  [$parking-skills:workflow-interview-web](G:\GIT\AI_WorkFlow\parking-agents-manual\skills\workflow\workflow-interview-web\SKILL.md)  我们来进行  采访并最终获得改进goal contract

## 用户提出的方案
在 eval 阶段尽量锁定并回放历史搜索内容，避免高并发 WebSearch；同时不把它只当作 shopping-deep-research 的局部补丁，而是借 writing-for-agents 的设计原则反思并完善由 parking-skill-creator 生产、评测和沉淀技能的整条链路。parking-skill-creator 自身仍必须独立安装、打包和运行，不能依赖另一个 skill。

## 意图假设
用户真正要解决的是 parking-skill-creator 对“外部可变证据”没有一等契约：当前网络调研型技能的回归评测把用户题面、搜索策略、实时外部状态、配额与评测 harness 混在一起，既昂贵又难复现。目标应是形成可泛化的 Creator 能力与可审计 Goal Contract，而不是仅让 Issue #160 的某次购物评测少搜几次。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| parking-skill-creator 的评测管线是本仓技能评测能力的唯一维护点；各技能只携带六件套证据 | `skills/workflow/parking-skill-creator/SKILL.md:272-286`、`references/design.md:16-19` | Fact |
| 当前 `eval_metadata.json` 只建模用户原话 `prompt` 与 `assertions`，没有输入、证据模式、fixture 摘要、新鲜度、miss policy 或联网预算 | `skills/workflow/parking-skill-creator/references/schemas.md:39-58` | Fact |
| `aggregate-benchmark.mjs` 只从 metadata 提取并沉淀 `name/prompt/assertions`；其他字段即使临时加入也不会随 `output-evals.json` 保留 | `skills/workflow/parking-skill-creator/scripts/aggregate-benchmark.mjs:68-79,249-260` | Fact |
| Creator 的 run prompt 声明输入文件，但同时要求只读写当前 run 目录；Issue #160 的 replay 工具和全局 fixture 位于 workspace 根，直接照文档调用会与现有 sandbox 纪律冲突 | `skills/workflow/parking-skill-creator/SKILL.md:142-154`、`G:/GIT/AI_WorkFlow/parking-agents/.agents/evals/shopping-deep-research-workspace/FIXTURE-REPLAY.md:21-27` | Fact |
| `.agents/evals/` 是被忽略的 scratch；持久依据必须进入技能目录或受摘要约束的外部证据存储，不能只活在当前 workspace | `.gitignore:13-14`、`skills/workflow/parking-skill-creator/SKILL.md:126-128` | Fact |
| 现有 fixture 库有 2074 条唯一 query，但 2189 次历史搜索只有 9 次完全重复；自由措辞下精确匹配几乎不能回放，当前也尚无 frozen query 清单 | `G:/GIT/AI_WorkFlow/parking-agents/.agents/evals/shopping-deep-research-workspace/FIXTURE-REPLAY.md:9-18` 与本轮 `fixture-replay.mjs --stats` | Fact |
| shopping-deep-research 的产品契约要求当前在售证据、检索日期与实时价格口径；历史回放不能替代真实购买路径的 live 验收 | `skills/life/shopping-deep-research/SKILL.md:70-108`、`references/design.md:20-30` | Fact |
| 官方 record/replay 模式通常由 harness 拦截外部请求、固定输入、未命中失败；可复现回归与真实条件持续评测承担不同声明 | Bazel Hermeticity、Playwright HAR、OpenAI 2026 harness guidance、OpenAI 2025 contextual eval guidance（上轮调研） | Fact |
| 当前仓库没有发现 CI 配置；验证主入口是目标技能 `run-tests.mjs`、`quick-validate`、`npm run evals -- --skill ...` 与全仓 `npm test`，真实 Agent/live 路径需另留 transcript | `package.json`、`docs/testing.md`、`docs/agents/skill-release.md` | Fact |
| Creator 当前已经有本地 `references/writing-guide.md` 与按需读取指针，不需要新增跨 skill 指针；其 `SKILL.md` 当前为 31,415 UTF-8 bytes/312 行，`SKILL.md + writing-guide.md` 的创建/改写分支为 40,364 bytes/475 行 | 本轮 `Get-Item` / `Get-Content` 实测，`skills/workflow/parking-skill-creator/SKILL.md:295-300` | Fact |

## 验证基建候选池

- `node skills/workflow/parking-skill-creator/run-tests.mjs`：现有 Creator 确定性回归门；新增 schema/provider/聚合能力应在此加入失败关闭和边界夹具。代价：只能证明确定性链，不能证明真实 Agent 会正确使用 live 搜索。
- `node skills/workflow/parking-skill-creator/scripts/quick-validate.mjs skills/workflow/parking-skill-creator`：检查 Skill 文档/frontmatter 契约。代价：不覆盖评测语义。
- `npm run evals -- --skill parking-skill-creator`：按仓库统一入口核对六件套与 `run-tests.mjs`。代价：不是新的真实 WebSearch eval。
- `npm test`：全仓结构、安装、hook 与跨 harness 文档契约。代价：可能包含与目标 diff 无关的基线失败，必须按 focused/full 分开报告。
- 新增 fake search provider 集成夹具：证明 replay 命中、miss 失败、record 显式联网、manifest/digest 校验、同一 eval 各 gate 收到同一 evidence digest，并证明 replay `live_calls=0`。代价：需先建设 provider/harness seam。
- shopping-deep-research 迁移回归：固定 evidence pack 跑 `with_skill/old_skill/without_skill`，并记录 replay hits/misses、evidence digest 与 harness mode。代价：只证明固定证据上的分析能力。
- 低并发 live acceptance：在明确预算/时间窗内验证 query 规划、真实搜索、来源可达性、当前在售与价格口径，并生成下一 evidence epoch。代价：消耗外部配额、结果受时效与网络影响；不可由 replay 绿替代。

## 四分类

- **Fact**：Creator 是统一评测能力落点；现有 schema、聚合和 sandbox 没有外部证据契约；shopping 生产技能必须保留 live 新鲜度；`.agents/evals` 不是持久真源。
- **User decision**：通用能力覆盖范围；replay miss 是否失败关闭；大型 payload 的持久化模型；live lane 的触发与预算；本次 Goal Contract 是否包含 shopping pilot 与首轮 live record；Creator 独立性与上下文预算。
- **Agent-owned**：字段具体命名、Node 模块边界、文件布局细节、摘要算法、测试夹具实现，只要满足已确认公共契约。
- **Blocked**：2026-09-10 前 bigmodel 配额接近耗尽，任何真实高并发 live eval 都不可作为当前契约产出的前置；可以先定义并验证离线链，live acceptance 如未授权则记 `NOT_RUN/BLOCKED`。

## 已锁定决定

- Creator 建立**通用外部可变证据契约**，覆盖 Web、外部 API、数据库/文件快照与其他时变输入；provider 的具体业务语义由实现层扩展。
- `replay` gate **失败关闭**：fixture miss 直接 FAIL/BLOCKED，不允许在同一轮自动联网；补库只进入显式 `record/live` 流程。
- 仓库跟踪按 eval 裁剪、脱敏的最小 evidence pack；`.skill` 分发包只携带 manifest/digest，不携带大 payload。
- 首份 Goal Contract 包含五个交付面：Creator 文档/设计 AC/schema、通用 provider、benchmark/history 审计与断代、shopping pilot、配额重置后的受控 live acceptance；不批量迁移其他联网技能。
- live acceptance 采用人工/过期触发，逐 eval 串行并设置调用上限；预算耗尽或前置不足时如实标记 `BLOCKED`/`NOT_RUN`。
- 生产侧 shopping-deep-research 继续要求 live 新鲜度，不加入 fixture-first；同一 eval 的所有 gate 使用同一 evidence digest。
- 用户任务 prompt 与 harness 配置分离；payload 先脱敏并记录来源、captured_at 与摘要；evidence/harness digest 改变时开启新可比纪元。
- parking-skill-creator 必须独立安装、打包和运行，不读取、调用或要求安装 writing-for-agents；后者只作为本轮设计证据来源。需要保留的原则压缩进 Creator 已有本地 `references/writing-guide.md`，不新增跨 skill 运行依赖。

## 决定边界未知项

只剩一个含数字门槛的边界：Creator 常驻 `SKILL.md` 与创建/改写分支的上下文预算是否锁为“不得超过当前实测基线”。字段命名、Node 模块边界、摘要算法和内部文件布局仍属于执行 Agent 可逆实现选择。

## 未知项

上下文预算的具体数字口径待用户裁决。2026-09-10 前配额限制是已知执行前置，不阻止产出契约；对应 live acceptance 在前置未满足时必须保持 `NOT_RUN/BLOCKED`，不得由 replay 结果代替。
