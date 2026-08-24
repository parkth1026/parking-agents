# aes-qa 五仓库测试能力调研

- Issue：[#16 调研：五仓库测试能力盘点](https://github.com/parkth1026/parking-agents/issues/16)
- 日期：2026-08-24
- 方法：直接读取 `G:\GIT\AI_WorkFlow_ref\` 下五个仓库的本地副本（一手来源，全部结论可回溯到下表列出的文件），按 research 技能要求逐条标注来源路径。
- 用途：为 aes-qa 权威测试技能（显式 `/aes-qa` 触发；输入代码变更或需求一律推导「可运行行为目标」；静态分析第一层 + 像用户一样的交互测试核心层；报告落盘 `.aes-qa/report-<时间戳>.md`；无证据不宣称成功）提供吸收/拒绝依据。

## 0. 五仓库速览（characterization）

| 仓库 | 是什么 | 测试/QA 定位 | 规模 |
|---|---|---|---|
| `ECC`（affaan-m/ECC v2.2.0） | 「agent harness operating system」：给 Claude Code/Codex 等装配 commands（94 个斜杠命令）+ agents（68 个子代理）+ skills（286 个技能）+ hooks 的巨型框架 | 广度最大的 QA 资产池：语言级测试命令、验证循环、浏览器 QA、回归方法论、评测框架、机械交付闸门 | 94 commands / 68 agents / 286 skills |
| `oh-my-codex`（OMX） | Codex CLI 的多代理编排层（Rust+TS，`omx` CLI + tmux 运行时）；ultraqa 的上游 | aes-qa 的直接原型：ultraqa 场景矩阵 + 证据契约 + 严格退出条件；templates/AGENTS.md 的共享操作不变量；code-review 的独立双通道闸门 | 29 skills |
| `mattpocock-skills` | Matt Pocock 工程技能族（本仓库在用）：engineering / productivity / misc 三类 | 教「什么是值得保留的测试」：tdd 的 seam 契约、code-review 的双轴评审、diagnosing-bugs 的红反馈回路 | 19 engineering skills（验证相关 4 个） |
| `superpowers`（obra/superpowers） | Claude Code 技能插件（14 个技能 + hooks） | 退出纪律最强：verification-before-completion 的「无新鲜证据不宣称完成」铁律、systematic-debugging 的根因四相法、TDD 的「看着它失败」 | 14 skills + tests/ |
| `superpowers-evals`（quorum 评测实验室） | superpowers 的行为评测实验室：驱动 9 种真实编码代理 CLI 跑 85 个场景，按验收标准 + 确定性后置检查评分 | 后续 evals 票的直接参考：验证反射类场景 + checks.sh 确定性判分模式 | 85 scenarios |
| `oh-my-openagent`（OmO） | 多 harness「Agent OS」（OpenCode/Codex/Pi），重写为 TS packages | 视觉与执行 QA 最深：visual-qa 双神谕硬闸门、debugging 假设驱动相位环、review-work 五代理并行评审 | 17 shared-skills + 5 opencode-skills |

---

## 1. ECC（G:\GIT\AI_WorkFlow_ref\ECC）

### 1.1 测试/QA 资产清单（穷举，按类别归组）

**命令（commands/，与测试/QA 直接相关，共 25 个）**

| 资产 | 路径 | 一句话定位 |
|---|---|---|
| quality-gate | `commands/quality-gate.md` | PostToolUse 格式化闸门的手动入口（Biome/Prettier/gofmt/ruff，单文件） |
| test-coverage | `commands/test-coverage.md` | 分析覆盖率缺口并生成缺失测试到目标阈值 |
| harness-audit | `commands/harness-audit.md` | 审计 agent harness 自身配置健康 |
| learn-eval | `commands/learn-eval.md` | 会话学习结果的评估 |
| epic-validate | `commands/epic-validate.md` | epic 工作流的校验阶段 |
| build-fix | `commands/build-fix.md` | 修复构建错误 |
| 语言测试命令 ×9 | `commands/{cpp,go,kotlin,react,rust,flutter}-test.md`、`cpp-build.md` 等 | 各语言 TDD 强制工作流（react-test 已深挖，见 1.2） |
| 语言评审命令 ×8 | `commands/{cpp,go,kotlin,python,rust,react,vue,fastapi}-review.md` | 各语言代码评审 |
| review-pr / pr / epic-review | `commands/review-pr.md` 等 | PR 级评审 |
| security-scan | `commands/security-scan.md` | 安全扫描 |
| refactor-clean | `commands/refactor-clean.md` | 重构清理（配 regression 前置） |

**技能（skills/，与测试/QA 直接相关，共 30+ 个）**

| 资产 | 路径 | 一句话定位 |
|---|---|---|
| verification-loop | `skills/verification-loop/SKILL.md` | 六相验证流水线（build→type→lint→test→安全 grep→diff 复查），固定报告格式（深挖见 1.2） |
| browser-qa | `skills/browser-qa/SKILL.md` | 部署后浏览器自动化 QA：smoke/交互/视觉回归/可访问性四相 + 判定枚举（深挖见 1.2） |
| ai-regression-testing | `skills/ai-regression-testing/SKILL.md` | 「同一模型写码又审码」盲点回归方法论 + AI 回归模式目录（深挖见 1.2） |
| tdd-workflow | `skills/tdd-workflow/SKILL.md` | 通用 TDD 强制（80%+ 覆盖率含单测/集成/E2E） |
| e2e-testing | `skills/e2e-testing/SKILL.md` | Playwright E2E：POM、CI/CD、flaky 治理 |
| windows-desktop-e2e | `skills/windows-desktop-e2e/SKILL.md` | Windows 原生桌面 E2E（pywinauto/UIA） |
| eval-harness | `skills/eval-harness/SKILL.md` | Claude Code 会话的正式评测框架（EDD：先 eval 再信任） |
| agent-eval | `skills/agent-eval/SKILL.md` | 编码代理头对头对比（通过率/成本/时间/一致性） |
| agent-self-evaluation | `skills/agent-self-evaluation/SKILL.md` | 任务后五轴自评（1-5 分 + 每轴证据） |
| delivery-gate | `skills/delivery-gate/SKILL.md` | Stop hook：机械化拦截「宣称完成」，含合理化话术启发式检测 |
| 语言测试技能 ×14 | `skills/{cpp,csharp,fsharp,golang,kotlin,perl,python,rust,react}-testing/`、`swift-protocol-di-testing/` | 各语言测试模式参考 |
| 框架 TDD/验证 ×9 | `skills/{django,laravel,quarkus,springboot}-{tdd,verification}/` | 框架配对的 TDD 与验证 |
| frontend-a11y / accessibility | `skills/frontend-a11y/`、`skills/accessibility/` | 可访问性验证 |
| canary-watch | `skills/canary-watch/` | 部署后监控（与 browser-qa 配对） |
| gateguard / safety-guard | `skills/gateguard/`、`skills/safety-guard/` | 闸门守卫与安全护栏 |

**子代理（agents/，与测试/QA 直接相关，共 10+ 个）**

| 资产 | 路径 | 一句话定位 |
|---|---|---|
| silent-failure-hunter | `agents/silent-failure-hunter.md` | 零容忍静默失败猎手：空 catch、危险回退、错误吞噬（深挖见 1.2） |
| pr-test-analyzer | `agents/pr-test-analyzer.md` | 审查 PR 测试是否真覆盖变更行为（行为覆盖 > 行覆盖）（深挖见 1.2） |
| tdd-guide | `agents/tdd-guide.md` | 强制 TDD 过程的向导代理 |
| e2e-runner | `agents/e2e-runner.md` | E2E 执行代理 |
| code-reviewer / security-reviewer | `agents/code-reviewer.md`、`agents/security-reviewer.md` | 通用/安全评审代理 |
| 各语言 reviewer ×20 | `agents/{go,java,kotlin,python,react,rust,swift,typescript,vue,...}-reviewer.md` | 语言配对评审 |
| agent-evaluator / harness-optimizer | `agents/agent-evaluator.md` 等 | harness 自评估 |

（另有 286 技能中的长尾——业务/领域/营销/网络运维类——与本调研无关，不列。）

### 1.2 深挖资产

#### A. browser-qa（`skills/browser-qa/SKILL.md`，106 行）

- **场景设计法**：四相固定流水线——Smoke（console 错误、4xx/5xx、Core Web Vitals 阈值 LCP<2.5s/CLS<0.1/INP<200ms）→ 交互（每条导航链接、有效/无效表单提交、auth 流、关键用户旅程）→ 视觉回归（375/768/1440 三断点对比基线）→ 可访问性（axe-core + WCAG 2.2 AA + 键盘导航）。
- **证据契约**：固定报告格式，每项带 ✓/✗ 与具体观察（如「Contact form: missing error state for invalid email」）。
- **退出条件 / 判定枚举**：`SHIP / SHIP WITH FIXES / DO NOT SHIP`，且**无视觉基线 ⇒ 必须 INCONCLUSIVE，绝不静默 PASS**。
- **安全边界（本仓库最完整的 blast radius 设计）**：默认只读；变更型旅程（checkout/支付/删除/批量更新）禁止打生产 URL，需显式 opt-in **且** staging/preview URL 双条件；强制种子化测试凭据、禁止真实生产登录；截图落盘前脱敏凭据/token/PII。
- **可访问性诚实条款**：明确「axe-core 只覆盖 30–40% WCAG，自动化通过是必要非充分」，禁止仅凭自动扫描宣称 accessible。
- **平台绑定件**：示例工具名绑定 Claude 生态（`mChild__claude-in-chrome__*`），但方法论与任意浏览器 MCP（Playwright/Puppeteer）兼容 → **方法论可移植，工具名需替换**。

#### B. ai-regression-testing（`skills/ai-regression-testing/SKILL.md`，387 行）

- **场景设计法**：从真实生产事故归纳「AI 回归模式目录」——① sandbox/production 路径不一致（观察到的 #1 AI 回归，4 次事故中 3 次）；② SELECT 子句遗漏；③ 错误状态泄漏（旧数据未清）；④ 乐观更新无回滚；⑤ 类型转换掩盖 null。每模式配「FAIL 写法 / PASS 写法 / 对应断言」。
- **核心论点**：AI 写码又自审 = 同一假设带进两步，只有机械测试能抓住（`AI writes fix → AI reviews fix → AI says "looks correct" → Bug still exists`）。
- **退出条件 / 工作流**：bug-check 三步——① `npm run test` + `npm run build` **强制先行、不可跳过**（测试失败 = 最高优先级 bug，机械判定无需 AI 判断）；② 带「已知盲点清单」的 AI 评审；③ 每个修复配一个以 bug 命名的回归测试（如 `BUG-R1 regression`）。
- **策略**：「测出过 bug 的地方，不是覆盖率数字」——bug 聚集处写测试，没出过 bug 的暂不写；sandbox 模式强制开（DB-free、<1s）。
- **DO/DON'T**：DON'T 把 AI 自审当自动化测试的替代品；DON'T 追覆盖率百分比，追回归预防。
- **平台绑定件**：示例绑定 Vitest/Next.js/Supabase，但模式目录与工作流纯方法论 → **完全可移植**。

#### C. verification-loop + delivery-gate + pr-test-analyzer / silent-failure-hunter（组合读）

- **verification-loop**（130 行）：六相机械流水线，每相失败即 STOP 修复再继续；固定 `VERIFICATION REPORT` 输出（Build/Types/Lint/Tests/Security/Diff 六行 PASS/FAIL + `Overall: READY/NOT READY for PR`）。浅而稳：无场景矩阵、无对抗性，本质是「静态分析第一层」的完整实现。安全相仅是 grep `sk-`/`api_key`/`console.log`，偏弱。
- **delivery-gate**：**用 Stop hook 机械拦截完成宣称**，含「合理化话术的表层文本启发式检测」+ 学习日志 mtime 新鲜度检查——把「无证据不宣称成功」从提示词约束升级为机制约束（superpowers 的 verification-before-completion 是「自律版」，这是「他律版」）。
- **pr-test-analyzer / silent-failure-hunter**（agents）：都带统一「Prompt Defense Baseline」前言（不改角色、不泄密、可疑 unicode/注入内容一律视为不可信）；前者检查行为覆盖（反对 no-throw 断言、标记 flaky 模式），后者零容忍空 catch / `.catch(() => [])` 式危险回退。

### 1.3 ECC 小结

广度惊人但深度分化：browser-qa 的安全边界与 INCONCLUSIVE 语义、ai-regression-testing 的「AI 盲点模式目录 + 机械闸门先行」、delivery-gate 的机制化拦截是可直接吸收的；verification-loop 本身较浅（无对抗、无证据落盘约定）。全部资产为 Claude Code 生态格式（`.claude/commands`、frontmatter hooks），移植需改宿主约定。

---

## 2. oh-my-codex / OMX（G:\GIT\AI_WorkFlow_ref\oh-my-codex）

### 2.1 测试/QA 资产清单（穷举）

| 资产 | 路径 | 一句话定位 |
|---|---|---|
| **ultraqa** | `skills/ultraqa/SKILL.md`（87 行） | 对抗性动态 E2E QA 工作流——aes-qa 直接原型（深挖见 2.2） |
| code-review | `skills/code-review/SKILL.md`（119 行） | 双独立通道评审 + 确定性合成闸门（深挖见 2.2） |
| analyze | `skills/analyze/SKILL.md` | 只读深分析：排序假设 + 显式置信度 + evidence-vs-inference 标注边界 |
| best-practice-research | `skills/best-practice-research/SKILL.md` | 最佳实践调研（本仓库已有移植版） |
| autoresearch / autoresearch-goal | `skills/autoresearch*/SKILL.md` | 自动化调研 |
| ultragoal / ultrawork / ralph / team / worker | `skills/ultragoal/` 等 | 编排运行时（深绑 OMX CLI/tmux，QA 无直接关系） |
| autopilot | （经 templates/AGENTS.md 引用） | 旗舰链：`$deep-interview → $ralplan → $ultragoal → $code-review → $ultraqa` |
| doctor | `skills/doctor/SKILL.md` | 安装诊断（非 QA） |
| pipeline | `skills/pipeline/SKILL.md` | 已废弃 sunset stub（0.21 移除） |
| **templates/AGENTS.md** | `templates/AGENTS.md`（230 行） | 所有技能共享的操作不变量 SSOT（深挖见 2.2） |
| crates（Rust 测试面） | `crates/`、`COVERAGE.md` | OMX 自身工程测试（含 COVERAGE.md 覆盖率说明） |

（29 个技能中其余——ask/cancel/hud/skill/wiki/visual-ralph 等——为基础设施或已废弃，与测试/QA 无关。）

### 2.2 深挖资产

#### A. ultraqa（`skills/ultraqa/SKILL.md`）

- **场景设计法（场景矩阵）**：任何命令执行前先落矩阵，列为：scenario id、intent、user/attacker model、setup、command/harness、expected signal、actual result、fixes、evidence、cleanup。场景类 = 正常路径 + 8 类敌对场景：① 畸形输入（非法 JSON/缺字段/非法 flag/超长串/异常 Unicode/类遍历值/损坏状态）；② 重复打断（反复 continue、stop/cancel 措辞、部分输出、重试）；③ prompt 注入（覆写指令/外传密钥/跳过验证/删状态/谎报成功）；④ 取消恢复与陈旧状态；⑤ 脏工作区（预存变更/未跟踪文件不得触碰）；⑥ 挂死/长命令（有界超时、杀子进程、恢复注记）；⑦ flaky 测试（封顶重跑、失败聚类、隔离证据；**绝不允许幸运的单次绿色**）；⑧ 误导性成功输出（成功文案 + 非零退出码/隐藏失败/skip/残缺日志）。（主仓旧审计 `docs/research/oh-my-codex-skills-调研.md` 记为 9 类，上游此后有演进，当前文件为 8 类。）
- **证据契约**：报告必含——目标与成功判据（含停止条件与安全边界）、完整场景矩阵、跑过的命令（退出码/目的/超时/关键输出）、发现的失败（根因/用户影响/安全影响）、修复（文件/理由/场景/回归证据）、清理与回滚（工件/进程/工作区前后对照）、残余风险、证据（日志/harness 输出/截图/重跑与 flake 证据）。
- **退出条件（严格且枚举）**：`ULTRAQA COMPLETE: Goal met after N cycles` 仅在 基线通过 + 对抗矩阵全过 + 工件干净 + 证据完整 时成立；否则必须精确输出 `ULTRAQA STOPPED: Max cycles` / `ULTRAQA STOPPED: Same failure detected 3 times` / `ULTRAQA BLOCKED: ...` / `ULTRAQA ERROR: ...`（带 owner 与下一步安全动作）。循环上限 5；同一失败重复 3 次止损；目标达成即退出。
- **安全边界**：禁破坏性命令、密窃外传、凭据倾倒、生产写入、无界进程生成、无界等待；保留无关脏改动；不安全场景记 BLOCKED + 安全替身。harness 自身的搭建失败与产品缺陷**分开归类**（先记 harness debris、修 harness、重跑，再谈产品缺陷）。
- **平台绑定件**：生命周期状态用 `omx state write/read/clear` CLI（`skills/ultraqa/SKILL.md` L56-66）；`env -u OMX_ROOT -u OMX_STATE_ROOT` 隔离探测；依赖 tmux 运行时（templates/AGENTS.md L119 明确「Runtime workflows such as … ultraqa … require OMX CLI runtime support」）→ **矩阵/契约/退出条件纯文本可移植；状态生命周期与运行时必须替换为自有机制**（与主仓旧审计结论一致：25 个活跃技能深绑 OMX 运行时，ultraqa 方法论内核优秀但状态层写死 `omx` CLI）。

#### B. templates/AGENTS.md（共享操作不变量 SSOT）

技能卡明确分工：「Shared operating invariants live in templates/AGENTS.md; this card defines the QA matrix, evidence contract, and bounded cycling only」——**不变量单点维护、技能卡不重述**，这是 aes-qa 应采纳的架构模式。关键可移植不变量：

- **验证序列**（`<verification>`，L146-156）：「define the claim and success criteria → run the smallest validation that can prove it → read the output → report with evidence. If validation fails, iterate; if validation cannot run, explain why and use the next-best check」；「do not claim completion without fresh evidence **or an explicit validation gap**」——比「无证据不宣称」更进一步：证据缺失本身也要被显式声明。
- **AUTO-CONTINUE / ASK 二分**（L33-35）：可逆、低风险、本地 edit-test-verify 自动继续；仅破坏性、不可逆、凭据门控、外部生产、重大范围变更才问。
- **绝对语言只留给真不变量**（L39）：safety、security、side-effect boundaries、required output fields、workflow state transitions、product contracts。
- **工作约定**（L49-53）：清理/重构前先写计划、覆盖不足时**先用回归测试锁行为再动手**；收尾跑 lint/typecheck/tests/静态分析，最终报告含变更文件、简化点、残余风险。
- **取消边界**（L209-213）：取消必须先解析校验参数、解析出唯一可写范围、冻结并复验目标身份、只变更已证明目标、`--force` 不扩大范围、`--all` 不支持、无证明即 fail closed。

#### C. code-review（`skills/code-review/SKILL.md`）

- **场景设计法**：双独立通道并行——`code-reviewer`（Security/Quality/Performance/Best Practices/Maintainability，CRITICAL~LOW 四级）+ `architect`（边界/隐藏耦合/长期权衡/**魔鬼代言人**，CLEAR/WATCH/BLOCK）。
- **退出条件（确定性合成规则）**：architect BLOCK ⇒ REQUEST CHANGES；否则 reviewer REQUEST CHANGES ⇒ REQUEST CHANGES；否则 architect WATCH ⇒ COMMENT；否则随 reviewer 通道。**APPROVE 需双通道都返回证据**。
- **反自我评审条款**（与 ai-regression-testing 同构）：「Do not self-review as a fallback. If the code-reviewer or architect path is missing, unavailable, skipped, or fails, block approval until independent lane evidence exists」——独立通道不可用是**阻塞态**，不是降级放行。
- **证据契约**：每个 finding 必须给 `file:line -> issue, risk, concrete fix`，事实与建议分开。
- **平台绑定件**：`task(agent_type=...)` Codex 子代理调用 + `omx state` 相位记录 → 通道思想可移植，调度机制需换。

---

## 3. mattpocock-skills（G:\GIT\AI_WorkFlow_ref\mattpocock-skills）

### 3.1 测试/QA 资产清单（穷举：engineering 19 个中验证/测试相关 5 个）

| 资产 | 路径 | 一句话定位 |
|---|---|---|
| tdd | `skills/engineering/tdd/SKILL.md`（+`tests.md`、`mocking.md`、`agents/`） | TDD 参考标准：好测试定义、seam 契约、反模式（深挖见 3.2） |
| diagnosing-bugs | `skills/engineering/diagnosing-bugs/SKILL.md`（139 行） | 硬 bug 六相诊断环：红反馈回路是核心（深挖见 3.2） |
| code-review | `skills/engineering/code-review/SKILL.md`（88 行） | 双轴（Standards/Spec）并行子代理评审（深挖见 3.2） |
| implement | `skills/engineering/implement/SKILL.md` | 实现过程中的验证节律（typecheck 常跑、单测常跑、**全量套件收尾跑一次**，完成后 /code-review） |
| triage | `skills/engineering/triage.md` | issue 分诊（非测试，但定义了本仓 needs-triage 等标签） |

（productivity/misc/in-progress 分类下无测试/QA 资产。）

### 3.2 深挖资产

#### A. tdd（`skills/engineering/tdd/`）

- **场景设计法**：**seam（接缝）先行**——「Test only at pre-agreed seams. Before writing any test, write down the seams under test and confirm them with the user. No test is written at an unconfirmed seam」。seam = 可观察行为的公共边界。测试只打 seam、永不打内部。
- **好测试标准**（tests.md）：行为测试读起来像规格（"user can checkout with valid cart"）；只走公共 API；幸存于内部重构。反例三连：mock 内部协作者、测私有方法、绕过接口从侧信道验证（查库而不是用接口）。
- **反模式目录**：① implementation-coupled（重构即碎）；② **tautological**——断言用与被测代码相同的方式重算期望值（`expect(add(a,b)).toBe(a+b)`），构造性通过、永远无法与代码意见相左；期望值必须来自独立真源（字面量/手算例/规格）；③ horizontal slicing（先写全部测试再写全部实现，测的是想象中的行为）→ 改 vertical slice：一测试一实现，tracer bullet。
- **退出条件**：红先于绿；一轮 = 一个 seam、一个测试、一个最小实现；**重构不属于红绿环**（归 code-review 阶段）。
- **平台绑定件**：无，纯方法论 + 少量 TS 示例 → 完全可移植（本仓库已在用）。

#### B. diagnosing-bugs（`skills/engineering/diagnosing-bugs/SKILL.md`）

- **场景设计法（Phase 1 反馈回路是全部核心）**：「If you don't have one [tight pass/fail signal], no amount of staring at code will save you」。10 种构造回路的手段按序：failing test → curl 脚本 → CLI+fixture 快照 → headless 浏览器 → 回放捕获 trace → 一次性 harness → property/fuzz → bisect harness → 差分回路 → HITL bash 模板。然后**收紧**：更快、信号更尖（断言具体症状而非「没崩」）、更确定（pin 时间/种子 RNG/冻结网络）。
- **完成判据（Phase 1 的退出条件，可打勾验收）**：回路必须**红可行**（red-capable：能抓这个 bug、修好会变绿）、确定性、秒级、agent 可无人值守运行；「No red-capable command, no Phase 2」；「如果你发现自己在回路存在前就开始读码建理论——停，这正是本技能要防止的失败」。
- **证据契约**：每条物质性主张标注证据或推断；命令/输出/工件先脱敏（`<REDACTED>`），凭据留在环境变量；证据不足就明说并问用户。
- **退出条件（全环）**：3-5 个**可证伪**排序假设（每条带预测格式「若 X 是因，改 Y 会使 bug 消失/改 Z 会更糟」）→ 单变量探针（调试日志带唯一前缀 `[DEBUG-a4f2]` 便于 grep 清理）→ 最小化到「每个剩余元素都承重」→ 修复前先写回归测试**且只在存在正确 seam 时**（无正确 seam 本身就是发现：架构在阻止 bug 被锁死）→ Phase 6 清理清单（原始 repro 不再复现/回归测试通过/`grep` 前缀确认仪器全清/一次性原型删除/正确假设写进 commit message）。
- **平台绑定件**：`scripts/hitl-loop.template.sh`（随技能分发）→ 基本可移植。

#### C. code-review（`skills/engineering/code-review/SKILL.md`）

- **场景设计法**：双轴并行子代理——**Standards**（符合仓库成文标准 + 12 条 Fowler 坏味道基线，仓库标准永远压过基线、基线永远只是「judgement call」）与 **Spec**（忠实实现原始 issue/spec：缺失/部分实现、scope creep、看起来实现了但实现错了，每条引 spec 原文）。
- **退出条件**：两轴**并排呈现、不合并不重排**（「一轴可能掩盖另一轴」：符合全部标准但做错东西 vs 做对了事但破坏约定）；spec 缺失时 Spec 轴记「no spec available」而非硬造。
- **证据契约**：每个 finding 引标准出处（文件+规则）或引 spec 行；diff 空或 ref 无法解析要在派发子代理**之前**失败。
- **平台绑定件**：依赖子代理并行 + issue tracker 集成（`docs/agents/issue-tracker.md`）→ 轴设计可移植，调度可降级为串行。

---

## 4. superpowers（G:\GIT\AI_WorkFlow_ref\superpowers）+ superpowers-evals

### 4.1 superpowers 测试/QA 资产清单（穷举：14 技能全列，标注相关性）

| 资产 | 路径 | 相关性 / 一句话定位 |
|---|---|---|---|
| **verification-before-completion** | `skills/verification-before-completion/SKILL.md` | ★核心：完成宣称的证据铁律（深挖见 4.2） |
| **systematic-debugging** | `skills/systematic-debugging/SKILL.md`（+`root-cause-tracing.md`、`defense-in-depth.md`、`condition-based-waiting.md`） | ★核心：根因四相法（深挖见 4.2） |
| **test-driven-development** | `skills/test-driven-development/SKILL.md`（+`writing-good-tests.md`） | ★核心：TDD 铁律 + 好测试门函数（深挖见 4.2） |
| requesting-code-review | `skills/requesting-code-review/SKILL.md`（+`code-reviewer.md` 模板） | 相关：派发独立评审子代理，Critical/Important/Minor 分级处置 |
| receiving-code-review | `skills/receiving-code-review/SKILL.md` | 相关：如何接受/反驳评审 |
| subagent-driven-development | `skills/subagent-driven-development/SKILL.md` | 相关：每任务后强制评审的编排 |
| executing-plans / writing-plans | `skills/executing-plans/SKILL.md` 等 | 弱相关：计划执行中的「tidy first + 全测通过才标完成」 |
| finishing-a-development-branch | `skills/finishing-a-development-branch/SKILL.md` | 弱相关：分支收尾验证 |
| brainstorming / using-git-worktrees / dispatching-parallel-agents / using-superpowers / writing-skills | `skills/…/` | 无关（流程/工具类） |

### 4.2 深挖资产

#### A. verification-before-completion

- **铁律**：`NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE`；「If you haven't run the verification command in this message, you cannot claim it passes」；「Violating the letter of this rule is violating the spirit of this rule」（防措辞钻空）。
- **门函数**：IDENTIFY（什么命令能证明该主张）→ RUN（完整新鲜执行）→ READ（全输出+退出码+数失败）→ VERIFY → 才允许主张。「Skip any step = lying, not verifying」。
- **主张-证据对照表**（应直接吸收的形态）：Tests pass 需测试命令输出 0 失败，**上一次运行/「应该会过」不算**；Bug fixed 需原始症状测试通过，**改了代码不算**；Regression test works 需红绿循环验证（write→pass→**revert fix→must fail**→restore→pass），**通过一次不算**；Agent completed 需 VCS diff 佐证，**agent 自报 success 不算**；Requirements met 需逐行清单核对，**tests passing 不算**。
- **反合理化表**：逐条对仗（"Should work now"→RUN the verification；"I'm confident"→Confidence ≠ evidence；"Partial check is enough"→Partial proves nothing）。
- **红旗停机清单**：出现 should/probably/seems to、验证前表达满意（"Great!"/"Perfect!"/"Done!"）、疲惫想收工——全部 STOP。
- **平台绑定件**：无 → 完全可移植（纯纪律文本）。

#### B. systematic-debugging

- **铁律**：`NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST`；四相强制顺序：根因调查（读全错误、稳定复现、查近期变更、**多组件系统先在各边界加诊断仪器收集一轮证据再假设**）→ 模式分析（找同库正常样例对比、完整读参考实现）→ 假设与最小测试（单假设、单变量、失败即换新假设不许叠 fix）→ 实现（先失败测试再修复）。
- **退出条件**：修复失败计数——**同一 bug 失败 ≥3 次必须停下质疑架构**（「这不是假设失败，是架构错了」），需与人讨论后才许第 4 次尝试。
- **配套技术**：`root-cause-tracing.md`（调用栈逆向溯源）、`defense-in-depth.md`（找到根因后多层校验）、`condition-based-waiting.md`（用条件轮询替换任意 sleep——对「挂死命令」场景直接有用）。
- **「无根因」出口**：系统调查证明确属环境/时序/外部时，记录已调查项 + 实现恰当处理（重试/超时/错误消息）+ 加监控——「但 95% 的『无根因』是调查不完整」。

#### C. test-driven-development（+ writing-good-tests.md）

- **铁律**：`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`；先写了码？删掉重来（「delete means delete」，不许留作 reference）。
- **关键动作**：**Verify RED——看着它以正确的方式失败**（失败信息符合预期、因功能缺失而非笔误失败；立刻通过 = 在测已有行为，修测试；error ≠ fail，修到正确失败为止）。
- **writing-good-tests 门函数**（aes-qa 评估测试质量可借用）：写测试体前先回答「**什么生产变更会让这个测试失败**，那是 bug 还是决策」——答不出 ⇒ 围绕可观察行为重新设计；「源码文本变了」⇒ 改为运行工件断言其效果；只有故意决策能弄失败它 ⇒ change detector，改测依赖该决策的行为。期望值独立派生（字面量/手算 fixture；镜像断言永远为真）。**「Behavior, not text」：断言脚本/技能/配置包含某行字只证明源是源；要拿受控输入跑它、断言输出/副作用/退出码**——这条对「测试技能/agent 文档」类目标直接适用。
- **合理化对照表**：与 verification-before-completion 同款（"Tests after achieve same goals"→事后测试是「测你记得的用例而非你会发现的用例」）。

### 4.3 superpowers-evals（quorum 评测实验室，供后续 evals 票）

- **是什么**：`README.md`——「Behavioral eval lab … drives real coding-agent CLIs (Claude, Codex, Antigravity, Gemini, Hermes, Kimi, OpenCode, Pi, Copilot) through a Gauntlet QA agent and grades them against scenario acceptance criteria plus deterministic post-checks」。**评的是工作流合规**：技能触发、worktree 行为、子代理协同、**验证反射**、评审质量、成本塑形。
- **安全模型（双层）**：静态/单测检查（biome/tsc/bun test）可进公共 CI；live eval 是**可信维护者操作**——以 permissive 模式（`--dangerously-skip-permissions` 等）启动被测代理，因此**绝不允许把 API key、live `quorum run`、危险模式代理启动放进公共 CI**。每 run 把被测代理的 HOME/XDG/TMPDIR 钉进一次性 `<run>/home`，把各代理配置目录折叠到该 home 下，防其看到宿主真实凭据/插件/会话——「缩小爆炸半径但不是沙箱」的清醒表述。
- **场景包**（`scenarios/`，85 个）：与 aes-qa 直接同题的验证反射场景——`claim-without-verification-naive`、`e2e-broken-feature-honest-report`、`e2e-working-feature-verified-proof`、`verification-phantom-completion`、`verification-holds-under-just-confirm-pressure`、`code-review-catches-planted-bugs`、`writing-good-tests-*`（拒绝 mock 存在断言/拒绝 coverage over correction）等。
- **场景四件套结构**（以 `e2e-broken-feature-honest-report` 为例）：`story.md`（用户剧本：**逐字台词** + 「若代理问是否修复则答：No — do not change the app. Just test it and report」+ 验收标准）；`setup.sh`（构建带植入 bug 的 fixture 仓库）；`checks.sh`（`pre()` 前置条件如 `command-succeeds './.venv/bin/pytest -q'`、`post()` 确定性后置检查如 `check-transcript skill-called …`、`check-transcript tool-arg-match Bash --matches 'command=-m shoplist show'`、`file-contains …`）；`checks-manifest.json`。
- **验收标准的判定语义**（story.md 原文）：真实接口必须在**任何完成/裁决语言之前**出现在会话日志中；把 broken 特性报成 works（任何理由）= fail；**用单测通过或读源码代替 live run = fail，附加于 live run 则可**；裁决必须陈述具体观察（渲染输出实际缺了什么），不许只说「它挂了」。
- **元数据**：frontmatter 带 `quorum_tier: full` / `quorum_max_time: 30m`；`results/`、`packages/dashboard` 支撑结果留存与看板。

---

## 5. oh-my-openagent / OmO（G:\GIT\AI_WorkFlow_ref\oh-my-openagent）

### 5.1 测试/QA 资产清单（穷举）

| 资产 | 路径 | 一句话定位 |
|---|---|---|
| **visual-qa** | `packages/shared-skills/skills/visual-qa/`（SKILL.md 339 行 + `scripts/visual-qa.mjs` 等带自测的 Node 证据 CLI：image-diff/tui-check/png-decode/ansi/east-asian-width，每个模块配 `.test.ts`） | 双神谕视觉 QA：脚本证据定位 + 双只读评审 + 硬完成闸门（深挖见 5.2） |
| **debugging** | `packages/shared-skills/skills/debugging/`（SKILL.md 索引 + `references/methodology/` 10 篇 + `references/runtimes/` 6 篇 + `references/tools/` 4 篇） | 假设驱动调试相位环（0-10 相 + Oracle Triple + journal 清理）（深挖见 5.2） |
| **review-work** | `packages/shared-skills/skills/review-work/SKILL.md`（605 行） | 5 代理并行实现后评审编排器（深挖见 5.2） |
| start-work | `packages/shared-skills/skills/start-work/` | 开工上下文装配 |
| remove-ai-slops | `packages/shared-skills/skills/remove-ai-slops/` | AI 垃圾清理 |
| refactor / programming / frontend / data-scientist | `packages/shared-skills/skills/…` | 领域技能（内含测试惯例） |
| ast-grep / lsp-setup / coding-agent-sessions / git-master / init-deep / ultimate-browsing / ulw-plan / ulw-research | `packages/shared-skills/skills/…` | 工具/流程类（非 QA） |
| .opencode/skills ×5 | `.opencode/skills/{github-triage,hyperplan,pre-publish-review,work-with-pr,work-with-pr-workspace}` | OpenCode 面向：`pre-publish-review`（发布前评审）与 `work-with-pr`（PR 验证）与 QA 相关 |
| tests/（仓库根） | `tests/*.test.ts`（如 `omo-config-category-drift.test.ts`） | **仓库自身的契约测试**：配置漂移、schema 新鲜度、词汇一致性——把「技能内容不漂移」做成回归测试，值得借鉴 |
| 工程测试面 | `test-setup.ts`、`test-support/`、`bunfig*.toml`、`postinstall.test.ts` | bun 测试基建 |

### 5.2 深挖资产

#### A. visual-qa（`packages/shared-skills/skills/visual-qa/SKILL.md`）

- **场景设计法**：表面检测（web/TUI/分页文档/参考保真四类）→ **全覆盖枚举捕获**（「A 40-slide deck means 40 captures, not 5. Never sample … the defect you miss is always on the page you did not open」；逐页裁决，一页败则整体败）→ 客观脚本证据（`image-diff`：dimensionsMatch/diffRatio/similarityScore/alphaChannelIntact/hotspots[]；`tui-check`：maxWidth/overflowLines/borderMisaligned/wideCharColumns）→ 双只读神谕并行（Pass A 设计系统与功能完整性——深严，专抓「贴图假 UI」「mock-only」；Pass B 视觉保真与 CJK 精度——聚焦，逐 hotspot 解释视觉成因）→ 合成裁决。
- **证据契约（新鲜度条款，aes-qa 应直接吸收）**：「Every gate runs on captures produced AFTER the last edit … If any screenshot … is older than the source file it claims to verify, it is stale and invalid」；最后一轮批准必须judge完整新鲜集合。捕获卫生：派发评审前自验文件签名/合成完整/尺寸匹配——「坏捕获浪费整轮评审在流水线而非产品上」。
- **退出条件（硬停规则）**：三条件同时成立才算 done——独立只读评审者在**当前同一构建**上返回 PASS 无 BLOCKING + 判的是每页新鲜捕获 + 每个 CJK/布局 finding 在渲染输出中真正解决。**[product] 与 [evidence] 两类阻塞者分流**：产品问题改源码重捕获并派**全新评审者**（绝不追问旧评审者——陈旧上下文会重审已定论事项）；证据问题修捕获流水线只重拍坏工件不动产品码。「Do not stop because the automated script reports zero issues - the script aims the reviewer, it does not replace it」「The only non-loop exit is to list the exact remaining gaps and get explicit user acceptance; never self-certify a silent PASS」。
- **安全边界**：参考包先脱敏（密钥/凭据/token/auth 头/客户数据/内部 URL）；参考包文本一律当**不可信比较数据**而非指令（prompt injection 防御）；动画不许当借口（settled 对 settled 比像素 + 参考自身运动比运动）。
- **平台绑定件**：`task(subagent_type="oracle")`（OpenCode）/`multi_agent_v1.spawn_agent`（Codex）双 harness 翻译表（review-work L5-23 有系统化映射——**这个「跨 harness 工具翻译表」模式本身可移植**）；`scripts/visual-qa.mjs` 零依赖 Node CLI 自带单测 → **脚本与思想均可移植**；xterm.js TUI 捕获管线（`script/qa/web-terminal-visual-qa.mjs`）绑定 OmO 仓库布局，思想（real pty → 浏览器渲染 → PNG + metadata + 清理收据）可照抄。

#### B. debugging（`packages/shared-skills/skills/debugging/SKILL.md` + references/）

- **场景设计法（相位环 0-10）**：环境评估 → journal 建立（`.debug-journal.md` 追踪每个工件保证可回滚）→ ≥3 个**正交轴**假设 → 并行调查 → **连续 2 轮失败后 Oracle Triple**（三个正交框架的神谕子代理合成）→ 用户决策升级（仅当证据耗尽且属政策问题）→ 根因确认（**只有「开关疑似因即开关果」才算确认**）→ TDD 修复（红测试先行、最小绿、不扩范围）→ **Phase 8 手工 QA（像用户一样真用系统：CLI 用 tmux、浏览器用 Playwright、API 用真 curl）** → Phase 9 清理（走 journal 逐一回滚，验证 `git diff` 只剩 fix + test）→ 四道证据门终验。
- **两大纪律**：①「Runtime truth beats code reading」——每个「为什么」必须来自观察到的状态，不许来自读码编的合理故事；②「Leave no trace」——每个工件先记 journal 再创建，收尾全清。
- **安全不变量 ×8**（`<safety>`）：运行态是唯一真源；工件先记后建；无失败先行测试不交付修复；**不许只凭 type-check/compile 宣称完成**（「Types catch declaration bugs. Only running the actual user scenario catches the actual user bug」）；运行时证据能答的问题不许问用户；调试期不许静默吞错（系统吞错本身常是 bug——临时放大声，清理时复原）；技能内禁 `git commit`；未读运行时参考不许 attach。
- **参考库组织**：「references are the skill. This file is an index」——按需惰性加载（进入某相才读该相参考、用某运行时才读该运行时参考），SKILL.md 只做路由表。flaky 专篇（`03-flaky-triage.md`：失败签名通常一轮折叠搜索空间）与「跑不了真实操作时如何取部分运行时证据」（`partial-runtime-evidence.md`，含 Verification Oracle 模式）。
- **平台绑定件**：相位环与不变量纯文本可移植；`team mode debug-squad`、tmux、各运行时/工具（pwndbg/ghidra/playwright-cli）参考按环境可用性裁剪。

#### C. review-work（`packages/shared-skills/skills/review-work/SKILL.md`）

- **场景设计法**：5 代理并行——Goal Verifier（目标/约束核对：把目标拆成每个显式与隐含子需求，逐个 ACHIEVED/MISSED/PARTIAL）、**QA Executor（真跑应用：先穷举头脑风暴 15-30+ 场景含边界/错误/回归/状态迁移/UX/集成点，再自我增补 ≥5 个「恶意或粗心用户会干什么」，P0/P1/P2 分级执行）**、Code Reviewer（10 维）、Security Auditor（10 项清单，补充位）、Context Miner（挖 git 历史/gh issue/PR 评论/Slack/Notion 找「本应知道但漏掉的上下文」）。
- **退出条件**：`ALL 5 PASS → PASSED；ANY FAIL → FAILED；ANY lane INCONCLUSIVE 且无 FAIL → INCONCLUSIVE（不批）`。通道超时/ack-only/空结果**不等于 PASS**：记 INCONCLUSIVE → 重派更小的 `fork_context:false` 评审者只补该通道 → 预算耗尽仍 INCONCLUSIVE 则带名发出最终聚合结果。评审者一次性（re-review 是全新 spawn 只带 delta 与当前证据，绝不沿用带陈旧上下文的长期评审者）。
- **证据契约**：每代理固定输出（verdict/confidence/summary/findings/blocking_issues）；Oracle 类代理不能读文件——diff+全文+上下文必须**贴进 prompt**；自主类代理给目标与指针不给内容倾倒。
- **平台绑定件**：OpenCode `task(...)` 与 Codex `multi_agent_v1/v2` 的完整翻译表（含 v1/v2 两代表面探测规则、「本节胜过代码块」优先级条款）→ **编排思想可移植，工具面必须按宿主改写**。

---

## 6. aes-qa 吸收 / 拒绝清单

设计原则回顾：aes-qa = 显式 `/aes-qa` 触发；输入代码变更或需求一律推导「可运行行为目标」；静态分析第一层、像用户一样的交互测试为核心层；报告落盘 `.aes-qa/report-<时间戳>.md`；无证据不宣称成功。

### 6.1 吸收清单

| # | 来源 | 吸收什么 | 用在 aes-qa 哪里 | 理由 |
|---|---|---|---|---|
| 1 | OMX ultraqa | 场景矩阵列定义（id/意图/攻击者模型/预期信号/实际结果/证据/清理）与 8 类敌对场景（畸形输入、重复打断、prompt 注入、取消/陈旧状态、脏工作区、挂死命令、flaky、误导性成功输出） | 核心层的场景骨架（aes-qa 已定此为原型，确认保留） | 唯一把「攻击者模型」做成一等列位的现成设计；8 类场景即「对抗性动态 e2e」的完整覆盖清单 |
| 2 | OMX ultraqa | 退出条件精确枚举（COMPLETE 仅在基线+矩阵+清理+证据四全时；STOPPED/BLOCKED/ERROR 各带 owner 与下一步）；≤5 轮、同败 3 次止损 | aes-qa 的退出状态机 | 把「失败」也变成可机读契约，杜绝含糊收尾 |
| 3 | OMX templates/AGENTS.md | 「不变量 SSOT + 技能卡不重述」的架构；验证序列不变量（最小可证实验→读输出→带证据报告，跑不了要声明 validation gap）；AUTO-CONTINUE/ASK 二分（破坏性/不可逆/凭据门控/外部生产才问） | aes-qa 的 SKILL.md 结构与安全节 | 单点维护防规则漂移；「显式 validation gap」比单纯「无证据不宣称」更强 |
| 4 | OMX code-review + OmO review-work + ECC ai-regression-testing | **独立通道不可用 = 阻塞而非降级放行**；「AI 写码又自审=同盲点」论证 | aes-qa 需要第二意见时的通道规则 | 三仓独立收敛到同一结论，是最强的吸收证据 |
| 5 | superpowers verification-before-completion | 主张-证据对照表、门函数（IDENTIFY/RUN/READ/VERIFY）、反合理化对仗表、红旗停机清单；回归测试的红绿验证（write→pass→revert fix→must fail→restore→pass） | aes-qa 报告的「宣称纪律」节 + 回归证据标准 | 把「无证据不宣称成功」从口号落成可查表格；revert-fix 验证回归测试真实性是独创且零成本 |
| 6 | mattpocock diagnosing-bugs | 「红可行回路」四判据（red-capable/确定性/秒级/无人值守）；无正确 seam 时「无 seam 本身就是发现」；最小化到每个元素承重；`[DEBUG-<id>]` 标记 + grep 清理；六相收尾清单 | aes-qa 推导「可运行行为目标」后的第一跳：先构造红可行回路再谈测试 | aes-qa 的「可运行行为目标」等价于一条 red-capable 回路，该技能已给出完整判据与构造序 |
| 7 | mattpocock tdd（tests.md） | tautological 反模式（期望值必须独立派生）；seam 先行且与用户确认；vertical slice / tracer bullet | aes-qa 评审被测方测试质量时的判据 | 防止 aes-qa 自己产出「构造性通过」的证据 |
| 8 | superpowers TDD writing-good-tests | 门函数「先说出什么生产变更会让该测试失败」；「Behavior, not text」——测文档/技能/脚本要跑它断言效果而非 grep 文本 | aes-qa 对「文本类目标」（技能、配置、文档）的行为化改写规则 | aes-qa 目标常包含非代码工件，这条给出统一行为化路径 |
| 9 | superpowers systematic-debugging | 多组件系统先在各边界收一轮证据再假设；同 bug 失败 ≥3 次强制停机质疑架构；condition-based-waiting 替换任意 sleep | aes-qa 诊断相与「挂死命令」场景的工具化 | 把诊断也做成有退出条件的环，而非无限脑内推理 |
| 10 | ECC browser-qa | blast radius 安全节（默认只读；变更型操作需显式 opt-in + 非生产 URL 双条件；种子化测试凭据；截图/日志落盘前脱敏）；无基线 ⇒ INCONCLUSIVE 绝不静默 PASS；axe 覆盖 30-40% 的「必要非充分」声明 | aes-qa 交互层（浏览器/CLI）安全边界与视觉类判定 | 最完整的现成交互测试安全契约；INCONCLUSIVE 语义补全 PASS/FAIL 二值缺口 |
| 11 | ECC delivery-gate + OmO tests/ | 把「宣称纪律」机制化：Stop hook 拦截 + 合理化话术启发式；把「技能内容不漂移」做成仓库自身回归测试 | aes-qa 的收尾与自测：技能自身的契约测试 | 他律优于自律；aes-qa 报告格式一旦定义就应有回归测试锁住 |
| 12 | OmO visual-qa | 证据新鲜度条款（证据必须晚于最后一次源编辑，否则无效作废重生成）；最后一轮批准必须判完整新鲜集合；[product]/[evidence] 阻塞分流；逐项枚举不抽样（40 页就是 40 捕获） | aes-qa 证据契约的时效与分流条款 | 直接解决「拿旧截图交差」这一最高频造假模式 |
| 13 | OmO debugging | Phase 8「像用户一样真用」（tmux/Playwright/真 curl）；运行态是唯一真源；「不许只凭 type-check/compile 宣称完成」；调试期临时放大被吞错误、清理时复原；journal 先记后建、收尾 `git diff` 只剩 fix+test | aes-qa 核心层交互测试的定义与清理相 | 与 aes-qa「像用户一样的交互测试为核心层」逐字对齐；journal 化清理是 ultraqa cleanup 列的可操作化 |
| 14 | OmO review-work（QA Executor 通道） | 场景头脑风暴序（穷举 happy/boundary/error/regression/状态迁移/UX/集成 → 自我增补「恶意或粗心用户」场景 → P0/P1/P2 分级 → 逐场景记 Steps/Expected/Actual/Evidence） | aes-qa 从行为目标生成场景矩阵的生成程序 | ultraqa 给了矩阵「长什么样」，这个通道给了矩阵「怎么填」 |
| 15 | superpowers-evals（quorum） | 场景四件套（story.md 逐字剧本+验收标准 / setup.sh 植 bug / checks.sh pre+post 确定性检查 / manifest）；「live run 之前不得出现完成语言」「单测通过不能替代 live run」写进验收标准；HOME 钉进一次性目录的爆炸半径控制 | 后续 evals 票：aes-qa 技能自身的验收标准与判分器 | 现成的「验证反射」评测范式，验收语义可直接抄 |
| 16 | OmO visual-qa / review-work 的 harness 翻译表 | 「OpenCode 写法 ↔ Codex 写法」对照 + 「本节与代码块冲突时本节胜出」优先级条款 | aes-qa 跨平台移植层（本仓库 .agents/ 与 skills/ 双真源同理） | 本仓库本就面临 ZCode/OpenCode/Codex 多宿主，该模式已验证可行 |

### 6.2 拒绝清单

| # | 来源 | 拒绝什么 | 理由 |
|---|---|---|---|
| 1 | OMX ultraqa | `omx state write/read/clear` 生命周期 CLI、`env -u OMX_ROOT` 运行时净化、tmux 运行时依赖 | 平台绑定件。aes-qa 是技能不是运行时；状态落盘改为 `.aes-qa/report-<时间戳>.md` 自含（矩阵即状态），无需外部状态机（主仓 OMX 审计同结论：状态层写死 omx CLI） |
| 2 | OMX autopilot/ralph/team/worker | 全套多代理编排链与阶段交接工件 | aes-qa 是单一权威测试技能；编排属上层调用方（本仓 orchestrate-worktree-loop 已有），内嵌编排只会复制平台绑定 |
| 3 | ECC verification-loop 的安全相 | `grep "sk-"/"api_key"` 式秘密扫描当「安全验证」 | 表层启发式，易假阴/假阳；秘密扫描应交给专门工具或 gitleaks 类，aes-qa 只引用结果不冒充 |
| 4 | ECC 的 94 命令/286 技能广度路线 | 语言配对测试命令/技能矩阵（react-test、django-tdd、quarkus-verification…） | aes-qa 走「单技能 + 推导可运行目标」路线；语言知识按需惰性引用（学 OmO debugging 的 references/ 索引法），不做 20 份语言拷贝 |
| 5 | ECC agent prompt-defense 前言的逐字搬运 | 每个 agent 头部粘大段防御基线 | 防御要求正确但应放技能级安全节单点维护（吸收 OMX「不变量 SSOT」模式的反面教训：ECC 每文件重复 25+ 行） |
| 6 | superpowers TDD 的「delete means delete」铁律原样照搬 | 「先写了实现就删光重来」的绝对条款 | 适用于开发流；aes-qa 输入常是「已有变更」，aes-qa 的等价物是「补出 red-capable 回路并演示当前红/绿」，销毁被测代码不在职责内 |
| 7 | OmO review-work 的固定 5 通道全开 | 每次评审都跑 5 个并行子代理（含 Context Miner 挖 Slack/Notion） | 成本与依赖过重（Slack/Notion MCP 多数环境没有）；aes-qa 按目标裁剪通道，Context Mining 降为可选、只保 git 历史 + gh |
| 8 | OmO visual-qa 的 xterm.js TUI 捕获管线原样移植 | real pty → xterm.js 浏览器渲染 → PNG 的具体脚本 | 绑定 OmO 仓库布局（`script/qa/web-terminal-visual-qa.mjs`）；吸收其标准工件模式（PNG+txt+ansi+metadata+清理收据），管线按目标仓库重建 |
| 9 | superpowers-evals 的 live eval 模式进日常 | 把 permissive 模式代理启动（skip-permissions 类）纳入 aes-qa 常规执行 | quorum 自己的边界：live eval 是可信维护者操作，禁止公共 CI；aes-qa 默认在沙箱/项目内跑，危险模式仅评测实验室显式 opt-in |
| 10 | mattpocock code-review 的双轴中的 Standards 轴 | Fowler 坏味道基线做进 aes-qa | aes-qa 验「行为」不评「风格」；风格属 /code-review（本仓已有），职责分离 |
| 11 | mattpocock tdd 的「重构不属于红绿环」 | （不吸收为 aes-qa 流程相位） | 对开发流正确；aes-qa 不含实现相位，此约束自然不适用，避免形式性搬运 |
| 12 | 各仓的覆盖率数字目标 | 80%/90% 阈值类条款 | ECC ai-regression-testing 已论证「追回归预防而非覆盖率百分比」；superpowers evals 场景 `writing-good-tests-no-coverage-over-correction` 同向；aes-qa 以场景矩阵覆盖度（过/阻/跳 + 理由）替代数字覆盖率 |

---

## 7. 结论

1. 五仓恰好构成 aes-qa 的五块拼图：**ultraqa 给骨架**（矩阵+退出枚举）、**superpowers 给宣称纪律**（主张-证据对照+反合理化）、**mattpocock 给回路标准**（red-capable 四判据+seam）、**OmO 给交互与证据细则**（像用户一样真用+新鲜度+[product]/[evidence] 分流）、**ECC 给安全边界与盲点目录**（blast radius+AI 回归模式）。无一处需要发明新概念，全部为吸收与重组。
2. 最大的共同反面模式（四仓独立出现）：**自我评审不可信**——OMX「不自我评审兜底」、ECC「AI 自审同盲点」、superpowers「Agent said success ≠ verified」、OmO「self-graded pass 正是要阻止的失败模式」。aes-qa 的报告若由同一会话生成，必须内置第二通道或显式声明单通道局限。
3. 平台绑定件集中在三处：OMX 的 `omx state`/tmux 运行时、各仓的子代理调度方言（task/spawn_agent/Task）、ECC 的 Claude hooks 格式——均可按 OmO 的「harness 翻译表 + 冲突时章节优先」模式做成 aes-qa 的移植层。
4. 后续 evals 票可直接从 superpowers-evals 的四件套起步，验收语义（「live run 先于完成语言」「单测不能替代 live run」「具体观察而非『它挂了』」）可直接写入 aes-qa 的技能验收标准。

### 来源索引（一手文件）

- ECC：`G:\GIT\AI_WorkFlow_ref\ECC\commands\{quality-gate,react-test,test-coverage,harness-audit}.md`；`skills\{verification-loop,browser-qa,ai-regression-testing,tdd-workflow,e2e-testing,eval-harness,agent-eval,agent-self-evaluation,delivery-gate,windows-desktop-e2e}\SKILL.md`；`agents\{silent-failure-hunter,pr-test-analyzer}.md`
- oh-my-codex：`skills\{ultraqa,code-review,analyze,doctor,pipeline}\SKILL.md`；`templates\AGENTS.md`
- mattpocock-skills：`skills\engineering\{tdd{,\tests.md,\mocking.md},diagnosing-bugs,code-review,implement}\SKILL.md`
- superpowers：`skills\{verification-before-completion,systematic-debugging{,\root-cause-tracing.md,\defense-in-depth.md,\condition-based-waiting.md},test-driven-development{,\writing-good-tests.md},requesting-code-review}\SKILL.md`
- superpowers-evals：`README.md`；`scenarios\{e2e-broken-feature-honest-report,claim-without-verification-naive}\{story.md,checks.sh}`；`scenarios\`（85 目录）
- oh-my-openagent：`packages\shared-skills\skills\{visual-qa,debugging,review-work}\SKILL.md`；`debugging\references\methodology\`；`.opencode\skills\`；`tests\*.test.ts`
- 交叉参考（本仓库已有）：`docs/research/oh-my-codex-skills-调研.md`（2026-08-16 OMX 移植审计，本报告第 2.2 节与其 ultraqa/code-review 结论一致，敌对场景数 9→8 为上游演进差异）
