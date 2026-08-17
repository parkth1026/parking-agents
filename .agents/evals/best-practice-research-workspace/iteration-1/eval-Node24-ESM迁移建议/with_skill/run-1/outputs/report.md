# Best-Practice Research: 老 CommonJS 项目运行在 Node.js 24 上 —— 要不要迁 ESM、如何渐进迁移

> 执行技能：`best-practice-research`（问题分类：迁移/版本指导 + 官方建议）。
> 报告日期：2026-08-16。所有证据均为当日抓取。

## Direct Recommendation

**一句话结论：不需要"必须迁移"，官方没有任何弃用 CommonJS 的计划；建议采用"渐进式 ESM-first"——新代码用 ESM、旧代码保持 CJS，靠 Node 24 的 `require(esm)` 互操作兜底，按收益分批迁移，而不是按倒计时迁移。**

### 1. 要不要迁：先看官方立场（带版本/日期）

- **CommonJS 在 Node.js 24 中是 Stability: 2（Stable）的正式特性**，官方文档完整维护，没有任何弃用条目或时间表（v24 官方 CommonJS 文档，2026-08 抓取）。
- **Node 24 "Krypton" 是当前推荐的生产 LTS**：2025-05-06 首发（v24.0.0），2025-10（v24.11.0）进入 LTS，LTS 支持约 30 个月（预计到 2028-04）。你们至少还有约一年半以上的官方支持窗口，不存在"不迁就掉队"的紧迫性。
- **连 Node.js 核心自己内部迁 ESM 都被官方评估为"高风险、需极其谨慎"**（nodejs/node issue #58523，2025-01）。这是"官方并不把 CJS→ESM 当作必须完成的事"的最强信号。
- **迁移压力的历史性拐点已经过去**：过去 CJS 项目迁 ESM 的最大动因是"被 ESM-only 依赖卡死"。`require(esm)` 已在 **v24.15.0（2026-04-15）转正（不再是实验特性）**——CommonJS 代码现在可以直接 `require()` 绝大多数 ESM 包（唯一硬限制：目标模块图中不能有 top-level await）。require(esm) 的作者、Node 核心开发者 Joyee Cheung 在 2025-12-30 的回顾博客中明确：所有活跃 LTS 线都支持后，包作者"不再需要转译或双格式发布"。

**决策建议（按项目角色）：**

| 情形 | 建议 |
|---|---|
| 应用/服务端项目（你们的情况：全 CJS、跑 Node 24） | **不做一次性大迁移**。采用"新代码 ESM、旧代码 CJS"双轨制，按模块收益分批迁。 |
| 迁移的正当理由 | 需要 top-level await / `import.meta`；想吃静态分析、tree-shaking；新依赖是 ESM-only；希望与生态新工具链对齐。 |
| 暂不迁的正当理由 | CJS Stable 无弃用；Node 24 LTS 到约 2028-04；迁移本身有成本且 ESM 在部分场景加载仍可能比 CJS 慢（Joyee Cheung 2025-12 博客提到，性能敏感路径需实测）。 |
| 若同时维护要发布的 npm 包 | 官方方向是 ESM-first：可发布 ESM-only 并设 `engines: { "node": "^20.19.0 || >=22.12.0" }`；若要同时服务 `require()` 消费者，用 `module-sync` 导出条件提供"无 top-level await 的同步 ESM"单入口，避免双包风险。 |

### 2. 怎么渐进地迁：应用类项目的分步路径（Node 24）

- **第 0 步（盘点，不改代码）**：确认 `node -v`（≥ 22.12 即具备无 flag 的 require(esm)，24.15+ 为稳定版）；检查 `package.json` 的 `type`/`engines`；盘点依赖中的 ESM-only 包。可用 `process.features.require_module === true` 在运行时探测支持。
- **第 1 步（选共存策略，二选一）**：
  - **方案 A（推荐给老项目，影响面最小）**：不动 `package.json`（默认 CJS），新增文件用 `.mjs` 扩展名。
  - **方案 B（决心 ESM-first 的仓库）**：设 `"type": "module"`，把旧 CJS 文件改后缀 `.cjs`（`git mv` 可分批进行）。
  - 注意：Node ≥ 22.7.0（2024-08）默认开启"模块语法检测"，无显式标记的 `.js` 会按源码嗅探。官方文档将其定位为"缺少显式标记时的兜底"；迁移期间应显式标记（`.mjs`/`.cjs`/`type` 字段），不要依赖嗅探，避免歧义与工具链行为差异。
- **第 2 步（用 require(esm) 消化 ESM-only 依赖）**：CJS 代码中直接 `const { foo } = require('esm-only-pkg')`。要点：
  - `require()` ESM 返回**模块命名空间对象**，默认导出在 `.default`（`pkg.default`），别漏取；
  - 硬限制：目标 ESM 及其依赖图**不能含 top-level await**，否则抛 `ERR_REQUIRE_ASYNC_MODULE`，此时改用动态 `import()`；
  - 可用 `--trace-require-module` 观测哪些调用走了 require(esm)，`--experimental-print-required-tla` 定位 top-level await 位置。
- **第 3 步（新代码一律 ESM）**：`import`/`export`；用 `import.meta.url` + `node:url` 的 `fileURLToPath` 替代 `__dirname`/`__filename`。
- **第 4 步（旧代码分批机械迁移）**：按模块/目录分批把 `require` 改 `import`（可借助第三方 codemod 如 cjstoesm——属第三方工具，官方未背书，迁移结果需人工复核），每批跑完整测试与 CI。
- **第 5 步（收尾，可选）**：全仓 `"type": "module"`、清除 `.cjs` 残留、同步更新 lint/测试/打包工具配置。
- **TypeScript 项目**：升到 TypeScript ≥ 5.8（2025 年初发布），在 `--module nodenext` 下 TS 官方已支持对 ESM 的 `require()` 调用，不再报错。

### 3. 常见坑清单（官方文档明确记载）

1. top-level await 的 ESM 不能被 `require()`（`ERR_REQUIRE_ASYNC_MODULE`）→ 用动态 `import()`。
2. ESM 中没有 `__dirname`、`__filename`、`require.cache`、`NODE_PATH`。
3. ESM 导入 CJS：默认导出 = `module.exports`；命名导出靠静态启发式分析（cjs-module-lexer 类方案），**运行时动态挂到 `module.exports` 上的导出可能识别不到**，此时用默认导入。
4. require(esm) 返回命名空间对象，取默认导出必须 `.default`；ESM 侧可通过 `export { X as 'module.exports' }` 自定义 `require()` 的返回值（v23.0.0/v22.12.0 起）。
5. 发布库时避免"双包风险"（dual package hazard）：同一包被 `import` 和 `require` 各加载一次会产生两个实例（单例失效、`instanceof` 失败）。官方 Packages 文档把详细模式放在 nodejs/package-examples 仓库（如 ESM wrapper、状态隔离）。
6. ESM 加载性能不一定优于 CJS（维护者 2025-12 博客提醒），性能敏感路径迁移前后要实测。

## Evidence Used

**官方/上游（结论主依据）：**

- Node.js v24 官方文档《Modules: CommonJS》 https://nodejs.org/docs/latest-v24.x/api/modules.html — require(esm) 的用法与返回值（模块命名空间对象）、`'module.exports'` 互操作导出、限制（无 top-level await）、完整版本历史（v22.0.0/v20.17.0 添加 → v23.0.0/v22.12.0/v20.19.0 去 flag → v23.5.0/v22.13.0/v20.19.0 默认无实验警告 → **v24.15.0 不再实验**）、`process.features.require_module`；CommonJS 标记为 **Stability: 2 (Stable)**。
- Node.js v24 官方文档《Modules: ECMAScript modules》 https://nodejs.org/docs/latest-v24.x/api/esm.html — ESM 导入 CJS 的互操作规则（default = module.exports、命名导出静态分析及其局限）、模块语法检测算法、ESM 与 CJS 差异清单（无 `__dirname`/`require.cache`/`NODE_PATH`）。
- Node.js v24 官方文档《Modules: Packages》 https://nodejs.org/docs/latest-v24.x/api/packages.html — `exports` 条件、`module-sync` 条件（同步 ESM 同时服务 import 与 require）、双包主题官方指向 nodejs/package-examples。
- Node.js 官方发布日程 https://nodejs.org/en/about/releases/ — v24 Krypton（2025-05-06 首发）现为 LTS、v26 自 2026-05-05 起 Current、LTS 约 30 个月支持、Node 27 起改年度发布。
- Node.js v24.11.0 发布说明 https://nodejs.org/en/blog/release/v24.11.0 — 2025-10 v24.x 进入 LTS（Krypton）。
- Node.js v24.15.0 发布说明 https://nodejs.org/en/blog/release/v24.15.0 — 2026-04-15 发布（require(esm) 转正所在版本）。
- Node.js v22.7.0 发布说明 https://nodejs.org/en/blog/release/v22.7.0 — 2024-08 模块语法检测默认启用。
- nodejs/node issue #58523《Change internals to use ESM》 https://github.com/nodejs/node/issues/58523 — Node 核心内部迁 ESM 的官方风险评估："generally not possible without extremely careful consideration and significant risk"。
- Joyee Cheung（require(esm) 实现者、Node.js TSC 成员）博客《require(esm) in Node.js: from experiment to stability》2025-12-30 https://joyeecheung.github.io/blog/2025/12/30/require-esm-in-node-js-from-experiment-to-stability/ — 维护者结论：所有活跃 LTS 支持后包无需再转译/双发；engines 建议 `"^20.19.0 || >=22.12.0"`；2024-09 top-5000 包统计（CJS 3000+ / dual 466 / faux ESM 526 / ESM-only 559，其中仅 6 个用了 top-level await）；提醒 ESM 加载可能仍慢于 CJS。
- TypeScript 5.8 官方发布说明 https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html （公告 https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/ ） — `--module nodenext` 下 `require()` ESM 不再报错。
- nodejs/package-examples https://github.com/nodejs/package-examples — 官方双包模式示例库（由 Packages 文档直接引用）。

**补充（第三方，仅作生态背景，不构成决策主依据）：**

- npm-esm-vs-cjs（Titus Wormer 维护） https://github.com/wooorm/npm-esm-vs-cjs — 2026-06-08 数据：16,231 个高影响包中 CJS-only 约 52%、ESM-only 约 16%、dual 约 22%、faux ESM 约 10%；CJS 占比从约 77% 降至约一半。注意 2025-12 起改用 ecosyste.ms 数据源，前后数据不可直接比较。
- （检索中另见 Joyee Cheung《Shipping Node.js packages in 2025》演讲材料，佐证 ESM-first 发布趋势，未逐页核验，不作为主依据。）

## Version / Date Context

- **报告日期**：2026-08-16（当日抓取全部来源）。
- **Node.js 24 "Krypton"**：v24.0.0 2025-05-06；2025-10（v24.11.0）进入 Active LTS；当前最新 v24.19.0（2026-08-03）；LTS 支持预计至约 2028-04。Node 26 自 2026-05-05 起 Current（最新 v26.7.0）；Node 22 "Jod" 处于 LTS 尾段；Node 25/23 已 EOL。
- **require(esm) 版本线**：v22.0.0/v20.17.0（2024-04/2024-09，实验 + flag）→ v23.0.0/v22.12.0/v20.19.0（2024-10 至 2024-12，无需 flag）→ v23.5.0/v22.13.0（2025-01，默认不再发实验警告）→ **v24.15.0（2026-04-15）Stable**。
- **模块语法检测默认启用**：v22.7.0（2024-08）。**`module-sync` 导出条件**：v23.5.0 / v22.13.0（2025-01）。
- **TypeScript 5.8**：2025 年初（2 月底）发布。
- **生态数据快照**：2026-06-08（npm-esm-vs-cjs）；top-5000 分析：2024-09（Joyee Cheung 博客引用）。
- **未发现任何官方弃用 CommonJS 的时间表或承诺**；CJS 在 v24 文档为 Stability: 2。若 2026-08 之后 Node 26/27 出现新政策，需重新核查。

## Repo-Local Context

not needed —— 调用方已给定关键本地事实：旧项目全部为 CommonJS `require()`，运行于 Node.js 24；本次任务无输入文件，未读取具体项目代码。落地前建议先盘点目标仓库的 `package.json`（`type`、`engines`）与依赖中的 ESM-only 包清单。

## Boundaries / Non-goals

- 不决定依赖的采用/替换/对比（`dependency-expert` 范围）。
- 不做整体架构评审，不评估打包器（webpack/esbuild 等）与 monorepo 工具链差异。
- 不实际修改任何代码或配置（本技能只读、终端）。
- 未验证第三方 codemod（如 cjstoesm）的实际迁移质量，仅标注其为可选辅助。

## Handoff

- **规划**：将"Direct Recommendation"中的第 0–5 步交给 `$ralplan` 细化为分批迁移计划（建议按目录/模块分批，每批附测试与 CI 验证；先建性能基线以防 ESM 加载回归）。
- **执行**：`$ultragoal` / `$team` / `executor` 落地；测试基线先行，`--trace-require-module` 用于观测过渡期行为。
- 本技能到此停止（terminal & read-only）；除非用户显式切换到上述工作流，不继续。
