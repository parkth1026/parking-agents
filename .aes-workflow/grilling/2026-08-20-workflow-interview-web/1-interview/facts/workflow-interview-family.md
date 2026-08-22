# Fact: workflow-interview 家族逻辑与仓库约定

- 派遣问题：workflow-interview 三阶段编排、asking 方法论、rounds.jsonl/manifest 写入规则、仓库技能结构与验证基建约定是什么？既有 issue 骨架里已有什么？
- 完成：2026-08-20T00:00:00Z（计划阶段探索代理汇总）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| workflow-interview 是纯编排器，自己不产出文件；三阶段 aes-interview → aes-prototype → aes-goal-contract | `.agents/skills/workflow-interview/SKILL.md:12-21` |
| manifest.json 只由 session.mjs 写，任何技能/subagent 不许 Edit/Write 直改 | `SKILL.md:36-37` |
| rounds.jsonl 一行一条、只经 `session.mjs round '<json>'` 写；tier ∈ default/confirm/ask；ask 行 options[].pct 加和 100±2 否则拒收 | `.agents/skills/aes-interview/SKILL.md`（rounds.jsonl 节）；`scripts/session.mjs` |
| 分诊矩阵：置信 ≥80%×可逆=默认区（一行不反对就算定）；≥80%×难逆=确认区（回一个字）；<80%=提问区（完整三段+百分比）；跨仓库边界项一律提问区 | `.agents/skills/workflow-interview/references/asking.md:31-53` |
| 批量问不挤牙膏；提问区 ≤4 项用 AskUserQuestion 一次发全，>4 用编号文本；完整问题块先以文本发出，工具只收选择 | `asking.md:9-20, 90-94, 140-143` |
| 阶段门禁：done 由 `session.mjs stage ... done` 当场结构校验；skipped 仅 2-prototype 可用需 --reason；回退走 needs_reinterview | `workflow-interview/SKILL.md:59-75` |
| 仓库脚本一律 .mjs（Node 内置模块、零 npm 依赖），不新增 PowerShell | `AGENTS.md`（仓库其他约定节） |
| `.agents/skills/` 是开发侧活跃真源；`skills/` 是发布侧，需移植流程同步，不视为同一份 | `AGENTS.md` |
| 仓库根禁止散落带日期目录/报告，门禁 `tests/skills/test-artifact-hygiene.mjs` 会拦 | `AGENTS.md`（产物落盘位置节） |
| 验证基建：`npm test` 七项链（hygiene/discovery/no-tool-names/session-start/pi-extension/harness-manifests/bump-version+check:repo）；技能自带根级 `run-tests.mjs` 黑盒测试是既有惯例（audit-ambiguous-terms、karpathy-llm-wiki、log-error-summary、parking-skill-creator、steelman-analysis 共 5 例）；无覆盖率工具 | `package.json` scripts；find 结果 |
| parking-skill-creator 结构约定：frontmatter 仅 name/description（+可选 license/allowed-tools 等）；evidence 六包（run-tests.mjs / references/design.md(AC-N) / history.json / output-evals.json / trigger-evals.json / trigger-benchmark.json）；agents/openai.yaml 放 UI 元数据；中文行文、机器契约字段留英文 | `.agents/skills/parking-skill-creator/SKILL.md` |
| 既有 issue 骨架 `.aes-workflow/grilling/2026-08-20-workflow-interview-web/`：仅 manifest.json（stage=1-interview、三阶段全 pending、original_request 为 null）+ 空的 1-interview/facts/、2-prototype/、3-contract/；无任何已捕获需求 | 目录实查 + git status |
| aes-interview 阶段产物硬性要求：context.md 必需节齐全、rounds.jsonl 每行合 schema、五维自评（意图/结果/边界/约束/现状）无「未定」 | `aes-interview/SKILL.md`（产物与收尾节） |

## 未知项

- 无（本分片范围内事实均已查清）

## 没查的

- aes-grilling-web 运行时实现细节（另见 aes-grilling-web-runtime.md）
- 外部参考（superpowers/brainstorming、open-design、.dc.html）的交互机制（另见 web-interaction-references.md）
