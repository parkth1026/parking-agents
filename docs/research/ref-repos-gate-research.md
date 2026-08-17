# TOP 5 门禁最佳工程调研报告

> 调研范围：`G:\GIT\AI_WorkFlow_ref` 下全部 40 个工程
> 调研日期：2026-08-16
> 调研方法：5 组并行子代理逐仓库扫描 CI/CD 配置、本地 hooks、AGENTS.md/CLAUDE.md 强制流程、测试基建，关键证据由主调研者抽查核实
> 核查状态：**已核查（v2）**——5 个独立核查代理逐条验证了 70 条事实断言：54 条完全属实、15 条部分属实（数字/口径偏差，已就地修正）、1 条不实（已重写）。详见文末「核查附录」。

---

## TL;DR

| 排名 | 工程 | 总分 | 一句话理由 |
|---|---|---|---|
| 🥇 1 | **orca** | 9.3 | 门禁工程深度全场第一：棘轮基线 + 可靠性门禁清单 + 性能预算 + 真实二进制兼容契约测试 |
| 🥈 2 | **codex** (OpenAI) | 9.2 | 门禁治理最规范：required checks 清单版本化进代码、快慢分层 CI、架构适应度函数 |
| 🥉 3 | **codebase-memory-mcp** | 8.9 | 强制链最完整：branch protection 实锤 + 全场最重本地 pre-commit + "门禁自身被测试" |
| 4 | **claude-code-haha** | 8.7 | 测试与覆盖率门禁最精细：变更影响面路由 + 改动行覆盖率 90% 硬阈值 + 覆盖率棘轮 |
| 5 | **gstack** | 8.3 | AI 原生门禁最强：唯一把 LLM 评测做成 PR 阻断 check（eval-as-gate）+ PreToolUse 实时拦截钩子 |

> 说明：open-design（8.7）在纯 CI 工程上与第 4 名打平，因 AI 原生门禁维度较弱列入惜败者；选择 gstack 进前五是因调研要求覆盖 AI coding 领域的方法论。

---

## 评分方法（全部对应业界公认标准，非自创）

| 维度 | 权重 | 依据的行业标准 |
|---|---|---|
| 阻断强制性 | 30% | GitHub Required Checks / Branch Protection / Merge Queue（DORA《Accelerate》验证的 CI 实践与交付绩效正相关）；"真门禁"= 机器阻断合并，"纸面门禁"= 仅文档建议 |
| 门禁覆盖广度 | 20% | 现代 CI 标准面：lint / typecheck / test / e2e / 安全 / **架构适应度函数**（《Building Evolutionary Architectures》, Ford & Parsons, O'Reilly）/ 性能预算 |
| 分层与反馈速度 | 15% | **Shift-left**（Boehm 缺陷成本曲线：越晚发现越贵）+ 测试经济学（按变更范围选择性执行测试，《Software Engineering at Google》的 Test Selection 实践） |
| 有效性证据 | 20% | 门禁是否"真的在起作用"：测试规模、棘轮基线是否在收紧、门禁脚本自身是否有测试、注释是否引用真实事故编号 |
| AI-coding 门禁 | 15% | AI 领域新兴公认实践：**evals-as-gates**（LLM-as-judge + 确定性后置校验）、verification loop（superpowers 的 "Iron Law"：无新鲜验证证据不得声称完成）、anti-slop 信任门禁、防绕过钩子 |

---

## 主评分表

| 工程 | 阻断强制性 (30%) | 覆盖广度 (20%) | 分层反馈 (15%) | 有效性证据 (20%) | AI 门禁 (15%) | **加权总分** |
|---|---|---|---|---|---|---|
| orca | 10 | 10 | 9 | 10 | 6.5 | **9.3** |
| codex | 10 | 9 | 9 | 9 | 8 | **9.2** |
| codebase-memory-mcp | 10 | 9 | 9 | 10 | 5 | **8.9** |
| claude-code-haha | 9 | 9 | 9 | 9 | 7 | **8.7** |
| gstack | 8 | 8 | 8 | 8 | 10 | **8.3** |
| （参考）open-design | 9 | 9 | 9 | 9 | 7 | 8.7 |
| （参考）hermes-webui | 10 | 8 | 8 | 9 | 6 | 8.5 |

---

## TOP 5 详细理由

### 🥇 1. orca — 9.3 分（Electron AI 终端，约 5094 个测试文件）

**为什么第一：它是唯一一个把"门禁本身当作被治理对象"的工程。**

- **棘轮机制（ratchet）**：`config/scripts/check-max-lines-ratchet.mjs` + 基线文件 `config/max-lines-baseline.txt`——冻结现存超限文件，**只许缩小不许新增**，想用 `eslint-disable max-lines` 绕过直接 CI 失败。这是技术债渐进治理的教科书做法（同 SonarQube "new code" 泄漏期策略、《Clean Code》Boy Scout Rule 的工程化）。
- **可靠性门禁清单**：`config/reliability-gates.jsonc`（69 个 gate）登记每个门禁的红绿状态（missing/partial/complete/not-required）、flake 状态（not-started/unknown/soaking/stable/flaky 五档）、保护级别（none/partial/active）、证据运行（local/ci/soak/manual）——这是 SRE 式"保护措施本身被追踪"，对应 Google 关于 flaky test 摧毁 CI 信任的治理经验。
- **教科书级 required check 汇总**：`pr.yml` 的 `verify` 聚合 job 显式枚举 8 个 `needs` 必须 `success`。
- **诚实降级**：e2e 因 main 上是红的而**知情地**移出聚合（注释写明原因和恢复路径）——这是显式风险管理，不是纸面门禁。
- **兼容性契约测试**：真实编译 Git 2.25.5 源码 + 拉取 2.38/2.49 官方镜像组成矩阵跑契约测试；shell contracts 用真实 zsh/node-pty。
- **性能预算门禁**：终端性能预算 + Zustand selector fan-out 检查（shift-left on performance）。
- **门禁自测试**：两个 gate 脚本都带 `.test.mjs`。
- **架构门禁**：`.d.ts` 禁令（仅限 `src/preload` 与 `src/shared`；注释引用事故 #1186——注意其引用的 `docs/preload-typecheck-hole.md` 本身已不存在，属悬空引用）、`root_directory_guard` 拒绝 PR 新增根目录条目、type-aware lint `--deny-warnings`、React Doctor 只审 changed lines。
- `.github/CODEOWNERS` 本地化目录强制归属审查；测试 `node 24/26 × 16 shards`；husky pre-commit → lint-staged。

**方法论**：技术债棘轮 + SRE 可靠性证据追踪 + 兼容性契约测试 + 性能预算 + CODEOWNERS。这是 Google SRE / 大型 monorepo 实践的缩影。

### 🥈 2. codex（OpenAI 官方）— 9.2 分（Rust monorepo，997 个测试相关 .rs 文件）

**为什么第二：门禁治理最规范，required checks 被当作代码来管理。**

- **required 清单版本化**：`.github/workflows/blocking-ci.yml` 头部注释原话——*"The `required` job below is the version-controlled list that the main-branch ruleset should require"*。用聚合 job + 脚本 `check_ci_results.py` 汇总 7 个子 workflow（bazel / blob-size-policy / cargo-deny / codespell / repo-checks / rust-ci / sdk），这是应对 GitHub required check 与 matrix 重命名死锁问题的官方推荐模式。
- **快慢分层**：pre-merge 路径感知快检（`rust-ci.yml`：cargo fmt --check、cargo-shear、argument-comment-lint、bench-smoke——**不含 clippy 与 nextest**）+ post-merge main 全量（`postmerge-ci.yml`：clippy `-D warnings`、五平台 nextest 矩阵、v8 canary）——典型的"快速 PR 反馈 + 全量兜底"分层。注意这是有意取舍：clippy 与全量测试矩阵只跑 post-merge，PR 门禁以格式/静态检查为主（Bazel/SDK lane 的具体覆盖未深查）。
- **架构适应度函数**：`repo-checks.yml` 里 `verify_tui_core_boundary.py` 脚本级强制 `codex-tui` 不得直接 import `codex-core`——正是《Building Evolutionary Architectures》定义的 fitness function。
- **生成物漂移防线**：每个 job 后跑 `check-clean-worktree`，防止生成物与源码脱节。
- **AI 协作指令门禁**：22KB 的 `AGENTS.md` 明确 *"Features that change the agent logic MUST add an integration test"*、禁止直接 `cargo test` 必须用 `just test`。
- **自研 lint**：argument-comment-lint（Dylint 自定义规则）+ cargo-deny（许可证/安全）+ codespell + CLA 签署门禁。

**方法论**：Google 风格 monorepo（Bazel）+ trunk-based + required checks 治理 + 架构适应度函数 + 自定义静态分析。

### 🥉 3. codebase-memory-mcp — 8.9 分（纯 C 的 MCP server，约 2040 个测试用例）

**为什么第三：从本地 commit 到合并的强制链最完整，且证据最硬。**

- **branch protection 字面实锤**：`pr.yml` 头部注释——*"Branch protection requires `dco` + `ci-ok` — a single stable summary context that fails unless every PR stage succeeded"*。（branch protection / required check 的 workflow 注释陈述全场至少见于 12 家工程——codex、open-design、hermes 系、claude-plugins-official、paperclip、Archon、oh-my-pi 等；cbm 的独到之处是把 required 收敛为**单一稳定汇总上下文 ci-ok** 并在头部注释写明设计意图。本地 clone 无法连 GitHub 验证实际设置，注释是最强可得证据。）
- **全场最重的本地门禁**：`scripts/hooks/pre-commit` 每次 commit 并行跑**全部 linter + 8 层安全审计 + 构建 + 全部测试**——shift-left 推到极致。
- **"门禁测试门禁"**：license gate 带 selftest（**故意植入违规许可证，必须被检出才放行**）——验证安全门禁自身有效性的元测试，全场独此一家。
- **No-skips 政策**：`check-no-test-skips.sh`——测试要么过要么挂，禁止 SKIP（对抗 flaky 测试侵蚀 CI 信任）。
- **sanitizer 矩阵**：ASan+UBSan+TSan × 多平台（PR 默认 CORE 集：ubuntu x64/arm、macos-14/15-intel、windows CLANG64；windows CLANGARM64 属 release dry-run 才启用的 BROAD 集）——系统级软件的标准实践。
- **分层诚实**：soak 测试明确标注 NON-GATING，与 gating 检查分离；每 commit DCO 签核（Linux 内核式来源证明，`scripts/check-dco.sh`）。
- **分片完整性 job**：每次运行重新证明分片并集完整，防 matrix 改名导致合并死锁。
- 测试规模：`tests/` 下 177 个 .c 测试文件（CONTRIBUTING 自述约 2040 用例）；工作流家族含 codeql、scorecard（OpenSSF）、dry-run、nightly-soak、bug-repro。

**方法论**：shift-left 极致化 + required check 单一稳定上下文 + DCO + sanitizer 矩阵 + 供应链安全（CodeQL/OpenSSF Scorecard/许可证 gate）。

### 4. claude-code-haha — 8.7 分（Claude Code 重实现，416 个 *.test.ts / 全口径 513 个测试文件）

**为什么第四：测试选择与覆盖率门禁做到了 Microsoft/Google 研究级的精细度。**

- **测试影响分析（Test Impact Analysis）**：`scripts/pr/change-policy.ts` 按变更文件确定性计算 scope-plan，只触发 10 条受影响 lane（desktop/server/provider 契约/chat 契约/adapters/native/persistence/docs/coverage）；末尾 `pr-quality-gate` 聚合 job 还核对"**未选中的 lane 必须是 skipped**"——防止条件跳过被误当通过。这正是《Software Engineering at Google》中 test selection 的实践。
- **全场最精细的覆盖率门禁**：`scripts/quality-gate/coverage-thresholds.json` 逐模块设最低值（如 server-api lines 68.53，目标 75）+ **改动行覆盖率硬阈值 90%**（`changedLines.minimumPercent: 90`）+ **棘轮机制：对照 `coverage-baseline.json` 只允许下降 0.5%**（`ratchet.allowedDropPercent: 0.5`）。"新代码严、存量代码渐进收紧"是覆盖率门禁的行业共识做法。
- **隔离区机制**：`quarantine.json` + `check:quarantine --enforce-review-date`——被隔离的测试必须定期复审否则 CI 失败（flake 隔离的标准治理）。
- **门禁自身被测试**：`check:policy` 跑 16 个脚本测试文件（含 `pr-quality-workflow.test.ts`、`quality-contract.test.ts`）——CI 逻辑本身有回归测试。
- **AI 协作验证协议**：AGENTS.md（根 + .github/adapters/desktop/docs/src 共 6 份）规定 `check:impact`（最小移交）→ `bun run verify`（PR-ready 声明前）的验证链，且报告状态严格区分 passed/failed/skipped/blocked/not run；**真实模型验证只允许维护者跑**（fork 不可信前提下的门禁设计）。
- 本地 pre-push 钩子存在但**有意改为非阻断**（注释："[pre-push] non-blocking: git push no longer runs local quality gates"）——设计决策而非缺失。

**方法论**：测试影响分析 + 覆盖率棘轮 + policy-as-code + 契约测试 + flake 隔离治理。

### 5. gstack — 8.3 分（AI 工程工作流 skills 合集，287 个测试文件）

**为什么第五：AI 原生门禁的唯一"全自动阻断"实现，代表 evals-as-gates 的落地形态。**

- **eval-as-gate 进 CI**：`evals.yml` 以 `EVALS_TIER: gate` 在 **PR 上直接跑 13 个评测套件矩阵**——skill-llm-eval（LLM-as-judge）、8 个真实浏览器 E2E（browse/plan/deploy/design/qa-bugs/qa-workflow/review/workflow）、routing、codex、gemini、甚至**真实 PTY 驱动 claude TUI 的 smoke**——失败即 PR check 失败，并贴含成本明细的 PASS/FAIL 表。这是把"agent 行为回归"当作一等门禁，区别于全场其他只把 AI 当 reviewer（advisory）的仓库。
- **PreToolUse 实时拦截**：`careful/SKILL.md` 用 hook 拦截危险 Bash 命令；`guard/SKILL.md` 另以 Edit/Write matcher 拦截对冻结目录的写入——AI 时代的 shift-left。
- **多角色 spec 审批门**：plan-ceo-review / plan-eng-review / plan-design-review / plan-devex-review——spec-driven development 的多视角审批。
- **slop-scan**：`npm test` 尾部挂 `slop:diff` AI 垃圾代码扫描（`slop-scan.config.json`）——注意为软挂载（`|| true`），扫描失败不会使 test 变红，属信号型而非阻断型。
- **版本队列协调门禁**：`version-gate.yml` 校验 PR 版本号不与队列中其他 PR 冲突；`pr-title-sync.yml` 强制 PR 标题 `v<VERSION>` 前缀。
- **发布流水线门禁**：`ship/SKILL.md` 强制 测试→review→VERSION→CHANGELOG→PR 顺序；`investigate/SKILL.md` "No fixes without investigation"；`qa/SKILL.md` 真浏览器找 bug→修→re-verify 闭环。
- 为评测门禁专门预烘焙 Docker CI 镜像（`ci-image.yml` + `.github/docker/Dockerfile.ci`）；`make-pdf-gate.yml` PDF 输出漂移门禁；`skill-docs.yml` 生成文档新鲜度门禁；`.gitlab-ci.yml` 提供 GitLab 双平台同等保护。

**方法论**：evals-as-gates（LLM-judge + 确定性 E2E 双轨）+ spec-driven 审批 + anti-slop + 防危险操作钩子。扣分：无 branch protection 字面证据，传统 lint/typecheck 相对弱。

---

## 惜败者（第 6–10 名，各有单项绝活）

| 工程 | 分数 | 单项绝活 |
|---|---|---|
| open-design | 8.7 | merge queue（`merge_group` 触发器）+ 51 个 workflow + `pnpm guard` 31 项结构守卫（`scripts/guard.ts`）+ fail-closed 发布门禁（release 分支有未落地 backport 即 fail，分支不存在也 fail） |
| hermes-webui | 8.5 | "REQUIRED status checks in the master ruleset" 注释实锤 + 1.15 万条测试 + diff 作用域前向 lint（存量不阻塞、新增行必管）+ 浏览器 console-error 即失败 |
| superpowers-evals | ~8 | **evals-as-gates 方法论最纯**：81 个行为场景，LLM 裁判（只看验收标准、永远看不到检查脚本）+ 确定性后置断言双重验证，还有 sentinel 快速哨兵 tier 与成本核算；扣分在 live eval 靠维护者手动执行 |
| oh-my-openagent | 8.5 | 证据驱动 QA 的天花板："NO EVIDENCE FILE == NO QA == NO COMMIT"，`.omo/evidence/` 下真实存在 20+ 个日期命名证据目录；用"元审计测试"（解析源码强制架构不变量）把架构规范变成可执行门禁 |
| oh-my-codex | 8.5 | 全场少数硬覆盖率阈值（c8 lines=78/functions=90/branches=70）+ 运行时完成度证据门（agent 声称"完成"前必须附结构化验证证据——superpowers "Iron Law" 的产品化实现） |

---

## 全场共性问题（40 个工程的盲区）

1. **覆盖率硬阈值几乎绝迹**：接入 CI 强制的只有三家——claude-code-haha（逐模块+改动行 90%+棘轮）、oh-my-codex（78/90/70/78）、code-review-graph（65%）；everything-claude-code 另配置了 c8 80% 硬阈值但未接入任何 CI（死配置）。
2. **commit message 机器校验稀缺**：AionUi 是唯一有本地 husky commit-msg 钩子（手写正则强制 conventional commits）的工程；CI 侧只有 codebase-memory-mcp 的 DCO 硬校验（缺 Signed-off-by 即 exit 1）和 opencode 的 PR 标题软校验（打 `needs:title` 标签但不红 check）；everything-claude-code 的 commitlint 配置未接线。
3. **branch protection 证据比预想普遍**：workflow 注释中直接陈述 required check / ruleset / merge queue 的至少有 12 家（codebase-memory-mcp、hermes-agent、hermes-webui、codex、claude-plugins-official、open-design、oh-my-pi、orca、oh-my-openagent、paperclip、Archon 等）；opencodex 则诚实写明"branch protection 尚未配置，靠约定"（AGENTS.md:132-133，devlog 记录 rulesets 查询返回空）。**初版报告中"仅 cbm 与 hermes 系"的表述有误，已修正。**
4. **AI 门禁三档光谱**清晰可循：**advisory**（AI 只做 review 评论）→ **evidence**（人工/流程强制证据）→ **gating**（eval 进 CI 自动阻断，只有 gstack 做到）。

---

## 给 parking-agents 的最短路径建议

抄 codex 的聚合 required check 模式（一条稳定 check 名）+ claude-code-haha 的改动行覆盖率棘轮 + orca 的"门禁脚本自带测试" + gstack 的 eval-as-gate（哪怕是 sentinel 小套件）——这四件组合起来就已经超过全场 95% 的工程。

---

## 核查附录（v2）

**核查方法**：5 个独立核查代理（与原调研代理不同实例）对本文档全部可验证断言逐条打开实际文件核对，覆盖 TOP 5 全部细节断言、惜败者关键断言、以及 5 条横断性结论；测试计数独立重算（排除 node_modules/dist/target/vendor 等第三方目录）。

**总体结果**：70 条断言 → **54 条完全属实**（含多条逐字/精确数字匹配）、**15 条部分属实**（数字/口径/范围偏差，已就地修正）、**1 条不实**（已重写）。

### 已修正的断言清单

| # | 位置 | 原表述 | 核查结果 | 处理 |
|---|---|---|---|---|
| 1 | orca | 测试文件 5042 个 | 实测 5094（偏差 1%） | 已修正 |
| 2 | orca | flake 状态（soaking/stable/flaky） | 枚举实为 5 值，含 not-started/unknown | 已补全 |
| 3 | orca | `.d.ts` 禁令（暗示全仓） | 仅限 `src/preload` 与 `src/shared`；被引的 `docs/preload-typecheck-hole.md` 文件本身不存在（悬空引用） | 已注明 |
| 4 | codex | PR 快检含 clippy、nextest | `rust-ci.yml` 实为 fmt/shear/argument-comment-lint/bench-smoke；clippy `-D warnings` 与 nextest 矩阵在 post-merge 全量套件 | 已改写并注明取舍 |
| 5 | codex | 997 个测试文件 | 997 = 文件名含 test 的 .rs；按 `#[cfg(test)]` 口径约 1022 | 已注明口径 |
| 6 | cbm | sanitizer 矩阵"含 Windows CLANGARM64" | CLANGARM64 属 release dry-run 的 BROAD 集，PR 默认 CORE 集无它 | 已修正 |
| 7 | cbm/共性3 | "全场仅 cbm 和 hermes 系留下 required check 注释" | **不实**：至少 12 家有此类陈述（codex、claude-plugins-official、open-design、oh-my-pi、orca、oh-my-openagent、paperclip、Archon、hermes×2、cbm 等） | 已重写（本次核查最大修正） |
| 8 | claude-code-haha | check:policy 跑 18 个测试文件 | 实为 16 个 | 已修正 |
| 9 | claude-code-haha | 416 个测试文件 | 416 仅 `*.test.ts`；全口径（含 96 个 `.test.tsx`）为 513 | 已注明 |
| 10 | claude-code-haha | AGENTS.md "src/desktop 等嵌套" | 实为根 + .github/adapters/desktop/docs/src 共 6 份 | 已修正 |
| 11 | gstack | 7 个真实浏览器 E2E | 实为 8 个（qa 拆为 qa-bugs 与 qa-workflow 两个 suite） | 已修正 |
| 12 | gstack | slop:diff 自动扫描（暗示阻断） | 软挂载（`\|\| true`），失败不红 check | 已注明为信号型 |
| 13 | gstack | careful/guard "Bash/Edit 拦截危险命令" | careful 仅 Bash 危险命令；Edit/Write matcher 属 guard 的冻结目录拦截 | 已修正 |
| 14 | gstack | 282 个测试文件 | 实测 287（顶层 278 + 子目录 9） | 已修正 |
| 15 | 共性1 | 覆盖率阈值"只有三家" | CI 强制确为三家；everything-claude-code 另有未接线的 c8 80% 配置（package.json:250） | 已补充 |
| 16 | 共性2 | "只有 AionUi 强制 commit message" | 需限定口径：cbm 有 CI 级 DCO 硬校验、opencode 有 PR 标题软校验、ecc 有死配置 | 已改写 |
| 17 | open-design | "20+ 结构守卫 / 50 个 workflow / 注释引用事故编号" | 实为 31 项守卫、51 个 workflow；"注释引用事故编号"未逐条验证 | 数字已精确化，未验证表述已删除 |

### 核查确认的关键事实（抽样，逐字属实）

- codex `blocking-ci.yml` 第 11-12 行注释、7 个子 workflow 聚合、`required` job + `check_ci_results.py`；`verify_tui_core_boundary.py` 架构边界检查；AGENTS.md 第 66 行 "Do not run `cargo test` directly"、第 116 行 "MUST add an integration test"。
- orca ratchet 脚本设计注释与基线头注释 *"This is a RATCHET: the list may only SHRINK"*；`verify` job 恰好 8 个 needs；e2e 排除注释原文；Git 2.25.5 源码编译 + alpine/git 2.38.1/2.49.1 镜像矩阵；`.test.mjs` 门禁自测试均存在。
- cbm `pr.yml` 头部 *"Branch protection requires `dco` + `ci-ok`"*；license gate selftest 步骤名 *"Gate self-test (a planted violation must be detected)"*；pre-commit 全量链（lint -j3 → security-audit → build+test）；`-Wall -Wextra -Werror`；No-skips 政策；soak NON-GATING 注释；tests/ 177 个 .c 文件精确匹配。
- claude-code-haha `coverage-thresholds.json` 字段级精确：`changedLines.minimumPercent: 90`、`ratchet.allowedDropPercent: 0.5`、server-api lines 68.53；pr-quality-gate 的"未选中必须 skipped"核对逻辑；pre-push 非阻断注释；CONTRIBUTING.md 中文 + fork PR 不要求真实模型验证。
- gstack `EVALS_TIER: gate`（evals.yml:13）+ 13 suite 矩阵 + PR 成本评论表；`.gitlab-ci.yml` 同等保护注释；version-gate 队列冲突检查；**且确认为全场唯一**把真 LLM eval 以 PR 阻断形式接入 CI 的工程（code-review-graph 周报带 `\|\| true`、paperclip 的 promptfoo 未接 CI、pi/i-have-adhd 的 eval 未接 CI，均不构成反例）。
- open-design `merge_group` 触发器；release-gate fail-closed 注释原文；`guard.ts` 31 项守卫；AGENTS.md 双表面规则、Co-authored-by 禁令、mocks 会话回放验证；1585 个测试文件精确匹配。
- hermes-webui *"REQUIRED status checks in the master ruleset"* 注释（tests.yml:11、browser-smoke.yml）；TESTING.md 自述 ~11,500 tests、tests/ 1309 个 .py 精确匹配；ruff `--diff` 前向门禁文档原文；console error 即失败。
- superpowers-evals 81 个场景三件套（story.md/setup.sh/checks.sh）齐全；裁判看不到 checks.sh（docs/scenario-authoring.md:27）；final=pass 双重判定（composer.ts:92-97）；sentinel/full/adhoc tier；带日期基线报告。
- oh-my-openagent *"NO EVIDENCE FILE == NO QA == NO COMMIT == NO PUSH."*（AGENTS.md:37）；`.omo/evidence/` 恰好 20 个日期命名目录；test-discipline.md 的 FLAKY=FAILING；block-master-pr job；元审计测试（`*audit*.test.ts`）实为 10 个（本文档惜败者表中未标具体数量，无需修改）。
- oh-my-codex 覆盖率阈值 78/90/70/78（package.json:39 + ci.yml:547 精确匹配）；`verifier.ts` 的 `hasStructuredVerificationEvidence()` 及其 *"runtime completion gating"* 文档注释；分类器 fail-closed 注释原文。

### 测试计数重算（核查口径：`*.test.*` / `*.spec.*` / `*_test.*` / `test_*.py`，排除 node_modules/dist/target/vendor 等）

| 工程 | 初版值 | 核查实测 | 结论 |
|---|---|---|---|
| orca | 5042 | 5094 | 已修正 |
| codex（codex-rs） | 997 | 997（文件名口径）/ 1022（`#[cfg(test)]` 口径） | 属实，注明口径 |
| codebase-memory-mcp | 177 | 177（精确） | 属实 |
| claude-code-haha | 416 | 416（`*.test.ts`）/ 513（全口径） | 已注明 |
| gstack | 282 | 287 | 已修正 |
| open-design | 1585 | 1585-1588 | 属实 |
| hermes-webui | 1309 | 1309（tests/ 下 .py，精确） | 属实 |
| oh-my-openagent | 1792 | 1796-1890（口径差异） | 量级属实 |
| oh-my-codex | 410 | 415 | 属实 |

### 核查结论

TOP 5 排名与评分**不受修正影响**：被修正的均为数字、统计口径或范围偏差，未发现任何支撑排名的核心机制断言（聚合 required check、棘轮机制、覆盖率阈值、eval-as-gate、验证协议、branch protection 证据）不实。唯一被推翻的横断性结论（branch protection 证据的普遍性）使全场图景比初版更乐观，但不改变任何工程的相对位置。

