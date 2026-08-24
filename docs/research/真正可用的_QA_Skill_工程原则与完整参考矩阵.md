# 真正可用的 QA Skill：工程原则与完整参考矩阵

你的方向需要先校准一个定义：

> **“像用户一样测试”不是一种与 E2E 并列的测试类型。它是一套以用户目标、真实场景、系统状态和业务终态为中心的验证方法。**

它的执行层可以是 Playwright、Electron 自动化、Windows UI 自动化、PTY/CLI、API、Git、文件系统或者多种表面组合。E2E 只是执行范围；测试是否严格，真正取决于：

> **风险覆盖 × 场景真实性 × Oracle 强度 × 环境可信度 × 证据完整性 × 验证独立性**

这不是数学公式，而是评价 QA 严格程度的六个核心维度。

ISTQB 明确区分了 verification 和 validation：前者检查系统是否满足规格，后者检查系统在实际运行环境中是否满足用户和利益相关方需求。即使所有需求和测试都通过，产品仍可能不满足用户目标，这就是“absence-of-defects fallacy”。

---

## 一、先确定你的 QA Skill 究竟是什么

建议将它定义为：

> **一个风险驱动、状态感知、以证据为基础的用户旅程验证系统。**

它不是：

- Code Review 的附属步骤；
- Playwright 测试生成器；
- “跑完 build、lint、unit test 就结束”的脚本；
- 让 Agent 随机点击页面；
- 让同一个 Agent 看截图后自行宣布通过；
- 用 LLM Judge 替代确定性断言。

它应该覆盖四层质量活动：

| 层级 | 要回答的问题 | 典型方法 | QA Skill 中的定位 |
|---|---|---|---|
| 静态验证 | 代码和设计是否存在明显问题 | Code Review、静态分析、类型检查、安全扫描 | 基线门禁，不可删除 |
| 小范围动态验证 | 模块、接口和规则是否正确 | 单元、集成、契约、属性、模糊测试 | 快速、稳定地定位缺陷 |
| 用户旅程验证 | 用户能否在真实状态下完成目标 | 场景测试、状态迁移、E2E、CLI/桌面交互、故障恢复 | 你的 QA Skill 核心 |
| 真实用户验证 | 用户是否理解、信任、满意，认知成本是否合理 | 代表性用户、真实任务、观察、访谈、问卷 | Agent 自动化不能完全替代 |

自动化 Agent 可以验证任务完成、交互行为、可访问性结构、异常恢复和业务状态，但不能可靠替代真人对“理解程度、信任、满意度、认知负担”的评价。正式可用性测试需要代表性用户执行现实任务。

---

# 二、真正好的工程测试必须遵守哪些原则

## 2.1 目标、风险与测试组合原则

| 原则 | QA Skill 必须怎么做 | 不合格表现 |
|---|---|---|
| **1. Verification 与 Validation 同时存在** | 既检查“是否符合规格”，也检查“用户是否真正完成目标”；最终任务结果必须映射到用户或业务价值 | 代码、接口、页面都符合需求，但用户无法顺利完成任务 |
| **2. 用户目标是测试基本单位** | 测试输入应是“用户要完成什么”，不是“依次点击哪些按钮”；步骤只是完成目标的一条轨迹 | 测试名称是“点击按钮 A、检查元素 B”，却不知道用户为什么做这件事 |
| **3. 风险驱动，而不是平均用力** | 综合业务影响、发生概率、改动范围、复杂度、历史缺陷、权限和数据敏感度确定 P0/P1/P2 | 每个页面固定生成十条测试，关键支付流程与普通设置页面权重相同 |
| **4. 不追求穷举，追求有依据的覆盖** | 使用状态、场景、边界、决策表、历史缺陷和风险优先级定义覆盖范围；明确哪些风险未覆盖 | 声称“完整测试了所有情况” |
| **5. 测试方法必须因上下文而变化** | Web、CLI、桌面端、数据管线、Agent、金融系统不能使用完全相同的矩阵；先发现仓库和产品类型再选策略 | 所有仓库都执行同一套 `npm test + Playwright` |
| **6. 保留平衡的测试组合** | 用户旅程测试不能替代单元、集成、静态、安全和模糊测试；根据速度、维护成本、资源、可靠性和保真度分配测试 | 把全部质量责任压到少量大型 E2E 上 |
| **7. 越早测试越好，但晚期验证不能省略** | 需求阶段检查可测试性，开发期执行小测试，完成后运行用户旅程和异常恢复 | “Shift left”被解释成只做单元测试，不再做系统级验证 |
| **8. 建立需求—风险—场景—结果追溯** | 每条验收标准和高风险项必须映射到一个或多个场景；结果可反向追到需求和改动 | 报告只有“18 passed、2 failed”，无法确认覆盖了什么 |

ISTQB 的基础原则包括：测试不能证明没有缺陷、穷举测试不现实、测试应尽早开始、缺陷会聚集、测试会失效、测试依赖上下文，以及“没有发现缺陷”不等于产品成功。

Google 的 SMURF 模型则要求在速度、可维护性、资源利用、可靠性和保真度之间权衡，而不是机械套用测试金字塔。

NIST 的最低验证建议同时包含威胁建模、自动化测试、静态扫描、黑盒测试、结构测试、历史用例、模糊测试、Web 扫描和供应链检查，也证明了“只做用户模拟”本身并不完整。

---

## 2.2 用户旅程、状态与交互原则

| 原则 | QA Skill 必须怎么做 | 不合格表现 |
|---|---|---|
| **9. 场景来自真实任务和用户研究** | 从用户故事、Persona、用户旅程、支持工单、生产事件和真实业务操作提取任务 | LLM 凭空生成“典型用户”并将其当成真实需求 |
| **10. 每个场景必须定义前置状态** | 明确账户、权限、数据、缓存、会话、工作区、服务、网络、应用版本等初始状态 | 测试依赖上一个用例遗留的数据或登录状态 |
| **11. 对状态迁移建模** | 将用户可观察状态作为节点，将操作、事件和异常作为边；覆盖有效迁移、无效迁移和往返路径 | 只检查单个页面，不测试取消、恢复、重开、返回和跨会话 |
| **12. 覆盖主路径、替代路径和异常路径** | 一个旅程至少考虑正常完成、可接受替代行为、非法输入、依赖失败和用户中断 | 只测试最短 happy path |
| **13. 系统化覆盖顺序和循环** | 对可跳过、重复、乱序、回退、零次、一次、多次和最大次数执行进行设计 | 只按开发者预期顺序操作一次 |
| **14. 覆盖边界和组合条件** | 使用等价类、边界值、决策表、Pairwise 或风险组合减少无效穷举 | 仅测试一个“正常长度”的输入 |
| **15. 按用户可感知语义交互** | 优先通过角色、名称、标签、键盘、焦点和可访问性树定位与操作；避免 CSS 类、组件内部状态和实现细节 | `div:nth-child(4) > span` 成为主要选择器 |
| **16. 测试目标，而不是固定动作录像** | 场景可以规定目标和约束，执行器自行寻找操作路径；同时记录实际轨迹以便复现 | 页面布局略有变化，测试即失效，即使用户仍能正常操作 |

ISTQB Test Analyst 将场景测试定义为在现实场景中评估行为，并建议使用用户研究、用户故事、Persona 和用户旅程图建立工作流模型；同时要求覆盖主场景、替代场景、异常场景以及循环的零次、一次、多次和最大次数。

Testing Library 和 Playwright 都建议按用户可见、可操作的语义测试，而不是依赖实现细节；Playwright 还会检查元素是否可见、稳定、启用并能够接收事件。

---

## 2.3 Oracle、证据、环境与生命周期原则

| 原则 | QA Skill 必须怎么做 | 不合格表现 |
|---|---|---|
| **17. 先定义 Oracle，再执行测试** | 在操作前写清楚成功状态、失败状态、允许偏差和验证方法 | 执行完后让 Agent 临时判断“看起来应该算成功” |
| **18. 优先验证业务终态** | 检查数据库、文件、Git 状态、事件、队列、API、副作用和最终用户状态，而不只是 toast 或退出码 | 页面显示“成功”，但实际文件、订单或提交不存在 |
| **19. 最终验收与修复角色分离** | Fixer 可以修改代码；Verifier 默认只验证和报告，不修改生产代码；高风险场景使用独立上下文或独立 Agent | 同一个 Agent 写测试、改代码、删除失败场景并宣布通过 |
| **20. 环境必须可复现且有足够保真度** | 记录版本、配置、依赖、权限、网络、服务、数据和与生产环境的偏差 | 在无法说明环境状态的个人机器上偶然跑通一次 |
| **21. 测试数据必须真实但受控** | 包含典型数据、边界数据、异常数据和历史缺陷数据；敏感数据需合成、匿名化或假名化 | 全部用 `test123`，无法触发真实数据约束 |
| **22. 测试必须隔离、可重入、可清理** | 每个场景可独立执行；生成的数据、进程、端口、文件和工作区必须追踪并清理 | 用例顺序改变就失败，或留下后台进程和脏数据 |
| **23. 同时使用脚本化和探索式测试** | 稳定关键路径做确定性回归；未知风险使用有时间盒、有任务书、有记录的探索式 Session | 一边是完全固定脚本，另一边是无目标随机点击 |
| **24. 系统性执行敌对与滥用测试** | 跳步、乱序、重复、伪造请求、越权、Prompt Injection、超长输入、并发和资源滥用必须进入风险矩阵 | 认为安全扫描能够发现所有业务逻辑缺陷 |
| **25. 测试故障恢复，而不只测试正常可用** | 注入网络中断、超时、服务崩溃、磁盘/权限问题、进程挂起和依赖降级，并验证稳定状态是否恢复 | 依赖永远成功，网络永远稳定 |
| **26. 可访问性必须覆盖完整流程** | 检查键盘、焦点、角色、名称、错误提示、对比度和完整多步旅程，而非只扫单页 | 首页通过 axe 就宣布整个产品可访问 |
| **27. 非功能要求必须绑定用户体验** | 以用户侧延迟、错误率、可用性、数据持久性和资源上限定义 SLI/SLO | 只测“请求返回 200”，不检查响应时间和实际可用性 |
| **28. 证据必须足以诊断和复现** | 保存动作轨迹、截图、视频、trace、console、network、日志、进程、Git diff、文件 hash、API/DB 状态 | 报告只有一句“无法完成” |
| **29. 失败后必须复现、诊断、修复、确认和回归** | 保存最小复现；修复后先跑失败场景，再跑相关回归；有效缺陷转为长期 testcase | 修改代码后只重新运行最后一步 |
| **30. Flaky 不能通过重试洗绿** | 首次失败、重试结果和波动原因必须记录；未分类 flake 应阻止严格发布门禁 | 重试三次有一次成功即标记 PASS |
| **31. 测试系统本身也必须被测试** | 对产品植入受控缺陷、变异或压力场景，检查 QA Skill 是否发现；保留基线失败与改进后成功的证据 | 只证明 Skill 能正常运行，未证明它能发现真实问题 |
| **32. 自动化不能冒充真人可用性研究** | 功能旅程可自动化；理解、信任、满意度和认知成本进入 `HUMAN_REVIEW_REQUIRED` | LLM 看截图后给出“用户体验良好”并作为发布结论 |

ISTQB 对 Test Oracle 问题的建议包括独立实现的 pseudo-oracle、模型化 Oracle、属性测试、变形测试和人工 Oracle；尤其在 AI、概率行为和需求含糊时，不能依赖单一简单断言。

探索式测试也不是随机操作。合格的 Test Charter 应明确任务、范围、资源、风险、时间限制、进入与退出条件、环境、禁止行为和记录要求。

OWASP 专门要求测试业务流程绕过，例如跳过、重复、乱序执行步骤，以及为具体系统编写 abuse/misuse case。

混沌工程则要求先定义可测量的稳定状态，再注入现实故障，并尝试推翻系统仍能维持稳定状态的假设。

---

# 三、你应该参考哪些标准、框架、基准和现有 Skill

## 3.1 方法论与标准

| 参考对象 | 最应该吸收的内容 | 在你的 QA Skill 中落地 | 不应机械照搬 | 优先级 |
|---|---|---|---|---:|
| **ISTQB CTFL 4.0.1** | Verification/Validation、七项测试原则、风险测试、静态与动态测试、测试过程 | 作为总原则和发布门禁语义 | 它是知识体系，不是执行引擎 | **P0** |
| **ISTQB Test Analyst 4.0** | 状态迁移、场景测试、主/替代/异常流、循环覆盖、Test Oracle、测试环境 | `journey-model`、`state-model`、`oracle-contract`、`environment-spec` | 不必完全采用其文档形式 | **P0** |
| **Session-Based Exploratory Testing** | 有任务书、有时间盒、有记录的探索式测试 | `exploration-charter` 和 session sheet | 不要退化成随机点击 | **P0** |
| **Metamorphic / Property-Based Testing** | 没有确定结果时，用关系、不变量和性质判断 | 针对 AI 输出、排序、推荐和概率行为建立关系型断言 | 不能替代业务需求本身 | **P1** |
| **ISO 25010 / ISO 9241-11 思路** | 功能适合性、可靠性、安全、性能、交互能力、可用性等质量维度 | 风险分析时生成质量属性清单 | 不要让每次变更测试所有质量维度 | **P1** |
| **WCAG 2.2** | Perceivable、Operable、Understandable、Robust；A/AA/AAA 可测标准 | A11y 检查器、键盘旅程和完整流程覆盖 | 自动扫描只能覆盖一部分问题 | **P0，Web/桌面 UI** |
| **OWASP ASVS 5.0** | 可追溯的应用安全验证要求和严谨等级 | 安全 requirement ID、风险等级、适用性过滤 | 不是所有 ASVS 条目都适用于每个产品 | **P1** |
| **OWASP WSTG** | 工作流绕过、次数限制、业务逻辑滥用、会话和输入测试 | `abuse-scenario-generator` | 不应只执行通用 payload 扫描 | **P0** |
| **NIST IR 8397** | 多技术组合：静态、黑盒、结构、历史、模糊、供应链等 | 防止 QA Skill 退化成单一 UI 自动化 | 面向安全最低验证，不是完整产品 QA | **P1** |

WCAG 2.2 将要求组织为可感知、可操作、可理解和健壮四项原则，并提供可测试的 A、AA、AAA 成功标准；对于多页完整流程，不能只检查其中一页。

OWASP ASVS 提供应用安全控制的验证基线和严谨等级，而 WSTG 更适合作为动态攻击与业务流程滥用测试库。

---

## 3.2 执行引擎与 Agent 评测基准

| 参考对象 | 最应该吸收的内容 | 在 QA Skill 中落地 | 局限 | 优先级 |
|---|---|---|---|---:|
| **Testing Library** | 测试越接近用户真实使用方式，信心越高；优先可访问语义 | UI locator 策略、组件/页面语义验证 | 不是完整用户旅程和运行时系统 | **P0** |
| **Playwright** | 用户可见 locator、自动等待、隔离 Context、自动重试断言、trace、截图和报告 | Web/Electron 执行适配器与证据采集 | 它不负责场景设计和业务 Oracle | **P0** |
| **Google SMURF / Test Pyramid** | 速度、维护性、资源、可靠性、保真度的平衡 | 测试级别选择器和执行预算 | 不应硬编码某个固定比例 | **P0** |
| **WebArena** | 真实、可复现、自托管环境；任务由自然语言目标定义；按最终功能状态评分 | 学习“目标任务 + 可控环境 + 程序化终态奖励” | 是 Agent benchmark，不是交付流程 | **P0** |
| **BrowserGym** | 统一 observation/action space、环境适配和可重复实验 | 统一 browser/desktop/CLI adapter 协议和 run record | 主要面向 Agent 研究 | **P1** |
| **OSWorld 2.0** | 长时、多应用、动态状态、真实文件、跨工具用户工作流 | 长任务、恢复、跨应用状态和中途消息测试 | 环境建设和运行成本较高 | **P1** |
| **Principles of Chaos Engineering** | 稳定状态、现实故障、对照组、可观测结果 | 故障注入和恢复测试 | 不适合每个 PR 全量执行 | **P1** |
| **Google SRE** | 以用户相关 SLI/SLO 衡量可靠性，执行压力和极限测试 | 延迟、错误率、吞吐、持久性门禁 | 需要产品定义自己的 SLO | **P1** |
| **OpenTelemetry** | 使用 trace、metric、log 观察一次用户旅程的完整路径 | 每次测试 run 绑定 trace ID 和证据 | 观测数据本身不是成功 Oracle | **P1** |
| **Stryker Mutation Testing** | 通过植入代码变异验证测试是否真的能失败 | QA Skill 自测、回归套件有效性评估 | 大型仓库运行成本较高 | **P1** |

WebArena 的核心不是模拟点击，而是提供真实、独立、可复现的应用环境，并用程序化检查验证最终功能状态，而不是要求 Agent 复现固定动作序列。

OSWorld 2.0 则将真实交互进一步扩展到长流程任务。严格用户测试必须处理长时状态、动态事件、跨应用产物和中断恢复，不能只是十几步页面录制。

Playwright 适合作为确定性执行器：它提供用户可见 locator、动作条件检查、隔离 Browser Context、可重试断言和 trace。但 Playwright 本身不会替你定义用户目标、风险、业务终态或正确 Oracle。

---

## 3.3 现有 Agent QA Skill

| 参考对象 | 最值得借鉴 | 应修正或补齐的部分 | 在你的设计中承担什么 |
|---|---|---|---|
| **oh-my-codex UltraQA** | Hostile user taxonomy、baseline + adversarial、修复循环、证据、临时资产清理、脏工作区和假成功检查 | 临时测试缺少长期 testcase 沉淀；Oracle 和场景仍较依赖模型；与 OMX 状态耦合 | **对抗策略与 QA 生命周期参考** |
| **Browserbase `ui-test`** | 对每个交互元素执行空输入、长输入、特殊字符、重复提交、modal 生命周期等敌对模式 | 主要局限于 Web UI；业务终态和跨系统恢复不足 | **浏览器敌对执行参考** |
| **Wshobson Ship-Mate QA** | 每条 AC、边界和错误状态转为 testcase；QA 不改生产代码；结构化报告；失败返回实施阶段 | 对 Agent session、Git/worktree、进程和跨表面风险不足 | **追溯和角色分离参考** |
| **Superpowers Verification / Debugging** | 不允许无新鲜证据宣布完成；先复现、找根因、单一假设、修复后重新验证 | 更偏开发纪律，不是完整最终用户验收 | **完成门禁和诊断流程参考** |
| **Superpowers Writing Skills** | 对 Skill 本身做行为 TDD：先观察无 Skill 时失败，再加入 Skill，最后用压力场景堵漏洞 | 需要额外测试 Harness 和运行成本 | **QA Skill 自身评测参考** |
| **Addy Osmani Agent Skills** | 先发现仓库技术栈和原生命令；核心方法保持生态中立 | TDD 重点仍在开发期，并非敌对用户验证 | **仓库发现和跨语言适配参考** |

UltraQA 已经明确反对把 build、lint 和已有测试全绿当成充分验收，并加入 hostile user、取消恢复、stale state、dirty worktree、hung command、flaky test 和 misleading success 等场景。

Browserbase 的敌对模式适合直接做成你的场景库，但其重点仍然是网页交互元素。

Ship-Mate 最重要的设计不是 Playwright，而是“每条验收标准和错误状态都变成 testcase”，以及 QA 角色不修改生产代码。

Superpowers 最应该借鉴的是对 Skill 本身进行行为测试：先证明没有 Skill 时 Agent 会失败，再证明 Skill 能改变行为，并使用压力场景寻找规避规则的漏洞。

---

# 四、推荐的 QA Skill 架构

最重要的架构原则是：

> **LLM 负责理解、建模、探索、提出假设和诊断；确定性系统负责执行、测量、断言、重置、采集证据和作出可机器判定的结论。**

不能把所有逻辑都塞进一个巨大的 `SKILL.md`。

| 模块 | LLM 的职责 | 确定性系统的职责 | 主要产物 |
|---|---|---|---|
| **1. Trigger Router** | 判断是否需要 QA、需要哪些测试域 | 根据改动类型、配置和策略激活流程 | `activation.json` |
| **2. Repository Discovery** | 理解仓库用途和可能的运行入口 | 读取 package、CI、脚本、测试配置、端口和平台信息 | `repo-profile.json` |
| **3. Test Basis Loader** | 解析需求、PRD、Goal Contract、验收标准、issue、diff | 保留来源、版本、hash 和 requirement ID | `test-basis.json` |
| **4. Change Impact Engine** | 推断受影响的用户能力和潜在风险 | 计算变更文件、调用关系、历史缺陷和覆盖映射 | `impact-map.json` |
| **5. Risk Engine** | 识别业务、安全、数据和恢复风险 | 按规则计算 severity、probability、priority | `risk-register.json` |
| **6. Persona / Context Builder** | 提取角色、目标、经验、权限和上下文 | 校验 Persona 是否来自真实资料或明确假设 | `personas.json` |
| **7. Journey Modeler** | 生成用户目标、主路径、替代路径和异常路径 | 保存 journey ID、requirement ID 和 risk ID | `journeys.json` |
| **8. State Modeler** | 识别重要状态和状态迁移 | 检查不可达状态、缺失迁移和循环覆盖 | `state-model.json` |
| **9. Scenario Compiler** | 根据风险和状态生成有价值的场景 | 去重、组合、预算控制、覆盖计算 | `qa-plan.json` |
| **10. Oracle Compiler** | 提议成功不变量和可观察结果 | 将 Oracle 编译为 API、DB、文件、Git、UI、进程或 telemetry 断言 | `oracle-contract.json` |
| **11. Environment Manager** | 判断所需环境和依赖 | 启动、健康检查、seed、snapshot、reset、teardown | `environment-manifest.json` |
| **12. Surface Adapters** | 选择合适交互表面 | 执行 browser、desktop、CLI、API、Git、filesystem、process 操作 | 统一 action log |
| **13. Explorer / Red Team** | 依据 Charter 动态探索和生成新假设 | 限制时间、权限、数据范围和危险操作 | `session-sheet.json` |
| **14. Fault Injector** | 选择值得验证的故障 | 精确注入网络、进程、权限、超时、依赖错误 | `fault-record.json` |
| **15. Evidence Recorder** | 标注哪些证据支持哪个结论 | 保存 trace、截图、日志、network、Git diff、文件 hash、状态快照 | `evidence-manifest.json` |
| **16. Independent Verifier** | 对含糊结果提出质疑 | 重新执行 Oracle、校验证据完整性、禁止修改产品 | `verification.json` |
| **17. Triage / Fix Handoff** | 提出根因假设和最小复现 | 将失败转给独立 Fixer；记录变更和复测范围 | `defect.json` |
| **18. Regression Promoter** | 判断发现是否值得长期保留 | 将临时场景转为稳定 testcase，加入测试注册表 | `testcase.json` |
| **19. Gate / Reporter** | 总结残余风险 | 按预定义规则生成 PASS、FAIL、BLOCKED 等 verdict | `verdict.json` |
| **20. Skill Eval Harness** | 设计压力任务和规避尝试 | 植入受控缺陷、执行多轮评测、计算发现率和误报率 | `eval-report.json` |

---

## 建议的文件组织

```text
skills/qa/
├─ SKILL.md
├─ schemas/
│  ├─ qa-plan.schema.json
│  ├─ scenario.schema.json
│  ├─ oracle.schema.json
│  ├─ result.schema.json
│  ├─ evidence-manifest.schema.json
│  └─ verdict.schema.json
├─ references/
│  ├─ testing-principles.md
│  ├─ risk-taxonomy.md
│  ├─ scenario-taxonomy.md
│  ├─ oracle-patterns.md
│  ├─ adversarial-patterns.md
│  ├─ accessibility.md
│  └─ security.md
├─ adapters/
│  ├─ browser/
│  ├─ desktop/
│  ├─ cli/
│  ├─ api/
│  ├─ git/
│  ├─ filesystem/
│  └─ process/
├─ scripts/
│  ├─ discover.ts
│  ├─ provision.ts
│  ├─ execute.ts
│  ├─ collect-evidence.ts
│  ├─ verify.ts
│  └─ cleanup.ts
└─ evals/
   ├─ pressure-scenarios/
   ├─ seeded-defects/
   ├─ reference-projects/
   └─ expected-results/
```

`SKILL.md` 只保存触发条件、不可违反的规则、阶段顺序和退出条件。详细场景库、标准、脚本和 schema 分开保存并按需加载。

---

# 五、推荐的完整运行流程

| 阶段 | 核心动作 | 强制产物 | 退出条件 |
|---|---|---|---|
| **0. 激活与边界确定** | 识别改动类型、产品表面、权限和允许执行的操作 | `activation.json` | 测试范围和禁止行为明确 |
| **1. 读取 Test Basis** | 读取需求、验收标准、issue、diff、历史缺陷、现有测试 | `test-basis.json` | 每个需求有来源；含糊项被标记 |
| **2. 仓库与运行发现** | 确认原生命令、技术栈、测试入口、服务、环境 | `repo-profile.json` | 不再假设固定 npm/Python/浏览器环境 |
| **3. 风险分析** | 生成 P0/P1/P2 风险，识别关键用户目标 | `risk-register.json` | 所有高影响能力都有风险条目 |
| **4. 用户旅程和状态建模** | Persona、前置状态、主/替代/异常路径、状态迁移 | `journeys.json`、`state-model.json` | P0 旅程和关键状态可追溯 |
| **5. Oracle 设计** | 为每个场景定义业务终态、允许偏差和验证方法 | `oracle-contract.json` | 没有 Oracle 的场景不得执行为正式验收 |
| **6. 场景矩阵编译** | 结合风险、边界、权限、数据、顺序、故障生成测试计划 | `qa-plan.json` | 满足计划覆盖标准和执行预算 |
| **7. 环境与数据准备** | provision、seed、snapshot、健康检查 | `environment-manifest.json` | 环境可重复，初始状态可验证 |
| **8. Baseline** | 运行构建、静态、单元、集成、已有 E2E、安全检查 | `baseline-result.json` | 基线失败被解释，不能静默忽略 |
| **9. 关键用户旅程** | 从真实入口执行主路径和高风险替代路径 | scenario results | 所有 P0 场景有可验证结果 |
| **10. 探索、敌对与恢复测试** | 按 Charter 执行乱序、重复、中断、攻击和故障注入 | session sheet、fault record | Charter 完成，发现均有证据 |
| **11. 独立验证** | 重新检查终态、证据、清理和报告一致性 | `verification.json` | 不接受仅由执行 Agent 提供的结论 |
| **12. 缺陷处理与复测** | 最小复现、根因、修复、确认、相关回归 | `defect.json` | 原失败场景和相关回归均重新执行 |
| **13. 回归沉淀** | 将有价值的临时场景转为长期测试资产 | `testcase.json` | 新缺陷不再只存在于临时报告中 |
| **14. 清理与发布判定** | 检查文件、进程、端口、Git 和环境状态 | `verdict.json` | 证据、残余风险和 cleanup 全部明确 |

---

# 六、Oracle 必须分级

真正严格的 QA Skill，最难的部分不是“如何点击”，而是“如何证明成功”。

| 等级 | Oracle 类型 | 示例 | 是否能单独作为 PASS 依据 |
|---|---|---|---|
| **O1** | 业务不变量或正式规则 | 订单金额恒等式、权限约束、状态机合法迁移 | **可以，最强** |
| **O2** | 持久化业务终态 | 数据库记录、Git commit、文件 hash、队列事件、服务端状态 | **通常可以** |
| **O3** | 跨层副作用一致性 | UI 显示成功，同时 API、DB、事件和文件状态一致 | **可以，推荐** |
| **O4** | 用户可感知语义状态 | accessible name、role、错误说明、焦点、按钮状态 | **适合 UI 行为** |
| **O5** | 可观测性和 SLO | trace 无错误、p95 延迟、无进程泄漏、无异常日志 | **适合非功能门禁** |
| **O6** | 视觉比较 | 页面布局、遮挡、溢出、视觉回归 | **不能单独证明业务正确** |
| **O7** | LLM Judge | 文案是否清晰、AI 输出是否相关、截图是否合理 | **不得单独决定高风险 PASS** |
| **H1** | 真人可用性判断 | 用户是否理解、信任、满意，是否能形成正确心智模型 | **主观 UX 的最终依据** |

对于 AI 输出或概率系统，建议采用：

- 属性断言；
- 变形关系；
- 独立 pseudo-oracle；
- 多样本统计阈值；
- 独立模型评审；
- 必要时人工评审。

不能用“另一个 LLM 觉得不错”作为唯一质量证明。

---

# 七、每个测试场景必须包含哪些字段

| 字段 | 含义 |
|---|---|
| `scenario_id` | 稳定、唯一的场景 ID |
| `requirement_ids` | 对应需求、AC、issue 或合同条款 |
| `risk_ids` | 对应风险及优先级 |
| `persona` | 执行任务的用户角色 |
| `goal` | 用户真正要完成的目标 |
| `context` | 设备、平台、权限、经验和运行背景 |
| `pre_state` | 登录、数据、工作区、服务、网络、缓存、会话等初始状态 |
| `fixtures` | 测试数据和外部依赖 |
| `route_constraints` | 允许或禁止的操作；是否允许捷径 |
| `main_path` | 预期正常旅程 |
| `variations` | 替代、异常、边界、重复、乱序、并发和中断 |
| `faults` | 需要注入的依赖、网络、权限和进程故障 |
| `oracles` | 成功、失败和允许偏差的机器可执行判断 |
| `evidence_required` | 必须保存的 trace、截图、日志、状态和 hash |
| `cleanup` | 必须回收和恢复的资源 |
| `reproduction` | 失败后的最小复现步骤 |
| `severity` | 缺陷严重程度 |
| `verdict` | PASS、FAIL、BLOCKED、INCONCLUSIVE 等 |
| `residual_risk` | 未覆盖或暂时接受的风险 |

关键要求是：

> **场景文件同时保存“意图”和“实际轨迹”。**

只有意图，没有轨迹，失败难以复现；只有固定轨迹，测试会过度依赖页面实现。

---

# 八、最终 Verdict 不应只有 PASS / FAIL

| Verdict | 含义 | 是否允许发布 |
|---|---|---|
| **PASS** | 所有强制场景、Oracle、证据和清理均满足 | 可以 |
| **FAIL** | 已被强 Oracle 证明存在产品缺陷 | 不可以 |
| **BLOCKED** | 环境、权限、依赖或必要资料阻止执行 | 不可以，不能伪装成测试通过 |
| **INCONCLUSIVE** | 结果含糊、Oracle 不足、环境污染或 Flaky 未归因 | 不可以 |
| **HUMAN_REVIEW_REQUIRED** | 涉及理解、信任、满意度、法律或高风险主观判断 | 等待人工结论 |
| **PASS_WITH_WAIVER** | 有明确残余风险，由指定责任人批准，并有原因和失效日期 | 只允许显式风险接受 |

### PASS 的最低条件

1. 所有 P0 和要求执行的 P1 场景均已覆盖；
2. 每个必测场景都有预先定义的 Oracle；
3. 没有未解决的 Critical/High 缺陷；
4. 不存在通过重试掩盖的 Flaky；
5. 证据清单完整且可读取；
6. 测试环境、文件、进程、端口和 Git 状态已清理；
7. 新发现的重要缺陷已经提升为永久回归测试；
8. 残余风险明确，不使用“应该没问题”之类的模糊语言。

---

# 九、针对多 Agent / Worktree 产品，P0 用户测试至少应包含什么

| P0 场景 | 用户目标 | 必测异常 | 最强 Oracle |
|---|---|---|---|
| 首次导入仓库 | 用户能建立项目并看到正确仓库状态 | 无 Git、权限不足、超大仓库、路径带空格和中文 | 项目记录、Git root、UI 状态一致 |
| 创建并分派 Worker | 用户能将任务分派给指定 Agent/worktree | CLI 未安装、模型不可用、权限拒绝 | 真实进程、worktree、任务状态和 UI 一致 |
| 多 Worker 并发 | 多个工作区同时运行且不互相污染 | 同文件编辑、分支冲突、资源竞争 | 每个 worker 的 Git、文件和进程隔离 |
| Dirty Worktree 保护 | 用户未提交代码不会被覆盖 | reset、checkout、清理或错误回滚 | 测试前后用户原始 diff 完整 |
| 取消任务 | 用户取消后系统真正停止 | 子进程残留、端口残留、状态仍显示运行 | 进程树终止、状态终结、资源清理 |
| 恢复任务 | 关闭或重开应用后能恢复正确上下文 | stale session、旧 PID、旧缓存、任务已实际完成 | 新 UI 状态与持久化状态、Git 和进程一致 |
| 崩溃恢复 | 应用或 Agent 崩溃后不会丢失关键工作 | 部分写入、锁文件、半完成提交 | 产物完整性和状态机合法性 |
| 网络或模型失败 | 用户收到明确可恢复的错误 | 超时、429、断网、流中断、错误响应 | 无假成功，任务状态为 blocked/retryable |
| Hung Command | 长命令不会无限卡住系统 | 无输出、子进程等待、stdin 阻塞 | 超时、可取消、无孤儿进程 |
| 冲突处理 | 用户能看见并处理并发冲突 | 自动覆盖、错误 merge、冲突被隐藏 | Git conflict 状态和 UI 提示一致 |
| 假成功检查 | Agent 声称完成时产物必须真实存在 | exit code 0 但结果缺失、只写总结未执行 | 文件、commit、test result、目标状态全部存在 |
| Prompt Injection | 仓库内容不能覆盖系统安全和执行规则 | README、issue、测试数据内恶意指令 | 权限边界未突破，无未授权工具调用 |
| Worker 地图与状态 | 用户能准确知道每个 worktree 在哪里、做什么 | HUD 延迟、旧状态、worker 已退出仍显示运行 | UI、任务存储、进程和 Git 坐标一致 |
| 清理失败 | 测试和 Agent 不污染用户环境 | 临时文件、测试分支、后台服务、端口 | cleanup manifest 全部满足 |
| 全链路验收 | 用户能从提出任务一直走到验证完成 | 中途取消、补充需求、失败回退、重新规划 | Goal/AC、实现、证据和最终 verdict 可追溯 |

UltraQA 中的 dirty worktree、cancel/resume、stale state、hung command 和 misleading success 很适合这一类产品，但必须把它们从“提示词建议”升级为有 schema、Oracle 和持久化 testcase 的正式能力。

---

# 十、建议的实施优先级

| 阶段 | 必须完成的能力 | 说明 |
|---|---|---|
| **V1：可相信** | Test Basis、风险模型、用户旅程、状态模型、强 Oracle、浏览器/CLI/Git/进程适配、证据、清理、独立 Verifier | 没有这些，不应称为严格 QA |
| **V2：能发现未知缺陷** | Session-Based Exploration、敌对场景、权限和业务滥用、故障注入、Flaky 治理、回归提升 | 从“执行测试”升级为“主动找问题” |
| **V3：可度量和持续改进** | 变异测试、缺陷植入 benchmark、误报/漏报率、历史趋势、生产 telemetry、真人可用性入口 | 证明 Skill 本身真的有效 |

建议的执行频率：

| 时机 | 测试范围 |
|---|---|
| 每个 PR | 改动影响分析、基线、受影响的 P0/P1 用户旅程 |
| Nightly | 更广的场景组合、探索式测试、故障注入、Flaky 检查 |
| Release Candidate | 完整关键旅程、安全、可访问性、恢复、安装升级和跨平台 |
| 重要产品里程碑 | 代表性真实用户可用性测试 |
| 生产环境 | Synthetic journey、真实 telemetry、SLO 和历史缺陷回流 |

---

# 十一、最终参考组合

你的 QA Skill 不应该复制某一个仓库，而应组合以下能力：

| 来源 | 采用什么 |
|---|---|
| **ISTQB Test Analyst** | 场景、状态、探索式测试、Oracle、环境和可用性方法论 |
| **UltraQA** | Agent、CLI、状态和工作区的敌对风险分类 |
| **Ship-Mate** | AC → Test → Evidence 的追溯，以及 QA/Fixer 角色分离 |
| **Browserbase ui-test** | Web 交互元素级敌对模式 |
| **Testing Library + Playwright** | 用户语义交互和确定性浏览器执行 |
| **WebArena + BrowserGym + OSWorld** | 真实任务、可复现环境、长流程和最终状态评分 |
| **OWASP ASVS/WSTG** | 安全控制、业务逻辑绕过和滥用场景 |
| **WCAG** | 可访问性和完整流程验证 |
| **Chaos + Google SRE + OpenTelemetry** | 故障恢复、用户侧 SLO 和全链路证据 |
| **Stryker + Superpowers Skill Testing** | 验证测试是否有效，以及 QA Skill 是否真的改变 Agent 行为 |

最重要的四条系统不变量应直接写入 `SKILL.md`：

> **没有预先定义的 Oracle，不得给出 PASS。**  
> **没有实际执行证据，不得给出 PASS。**  
> **没有成功完成清理，不得给出 PASS。**  
> **执行者或修复者的自我声明，不得作为最终独立验证。**

这会让你的 QA Skill 从“会操作测试工具的提示词”，升级为真正可用于工程发布门禁的质量验证系统。

---

# 参考资料

- ISTQB Certified Tester Foundation Level 4.0.1  
  https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf
- ISTQB Certified Tester Advanced Level Test Analyst 4.0  
  https://istqb.org/certifications/test-analyst
- NIST IR 8397: Guidelines on Minimum Standards for Developer Verification of Software  
  https://csrc.nist.gov/pubs/ir/8397/final
- WCAG 2.2  
  https://www.w3.org/TR/WCAG22/
- OWASP Application Security Verification Standard  
  https://owasp.org/www-project-application-security-verification-standard/
- OWASP Web Security Testing Guide  
  https://owasp.org/www-project-web-security-testing-guide/
- Testing Library Guiding Principles  
  https://testing-library.com/docs/guiding-principles/
- Playwright Best Practices  
  https://playwright.dev/docs/best-practices
- Playwright Locators  
  https://playwright.dev/docs/locators
- Playwright Visual Comparisons  
  https://playwright.dev/docs/test-snapshots
- WebArena  
  https://arxiv.org/abs/2307.13854
- BrowserGym  
  https://github.com/ServiceNow/BrowserGym
- OSWorld  
  https://os-world.github.io/
- Principles of Chaos Engineering  
  https://principlesofchaos.org/
- Google SRE  
  https://sre.google/
- OpenTelemetry  
  https://opentelemetry.io/
- Stryker Mutation Testing  
  https://stryker-mutator.io/
- oh-my-codex UltraQA  
  https://github.com/Yeachan-Heo/oh-my-codex/tree/main/skills/ultraqa
- Browserbase UI Test Skill  
  https://github.com/browserbase/skills/tree/main/skills/ui-test
- Wshobson Ship-Mate QA  
  https://github.com/wshobson/agents
- Superpowers  
  https://github.com/obra/superpowers
- Addy Osmani Agent Skills  
  https://github.com/addyosmani/agent-skills
