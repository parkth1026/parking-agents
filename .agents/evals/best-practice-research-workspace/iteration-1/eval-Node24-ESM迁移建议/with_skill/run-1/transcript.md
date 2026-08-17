# 执行过程简记 — best-practice-research / Node 24 ESM 迁移建议

日期：2026-08-16。执行者按 SKILL.md 流程：分类问题 → (按需) 收集仓库本地事实 → 收集外部官方/上游证据 → 按输出契约综合 → 停止（terminal, read-only；仅按调用方要求写入本 workspace 的两个产物文件）。

## 步骤记录

1. **读取技能文件**
   - 读取 `G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\best-practice-research\SKILL.md`（88 行，全文）。
   - 要点：terminal & read-only 默认；官方/上游来源优先；每条 material claim 带 URL + 版本/日期上下文；第三方来源仅作补充；不过度检索；按固定输出契约（Direct Recommendation / Evidence Used / Version-Date Context / Repo-Local Context / Boundaries / Handoff）交付。

2. **问题分类**
   - 判定为「迁移/版本指导 + 官方建议」类，外部证据为主。
   - 仓库本地事实：任务声明输入文件为 none，且调用方已给出关键事实（旧项目全 CJS require、Node.js 24）→ Repo-Local Context 标记为 not needed，不读项目代码。

3. **外部证据收集 — 第 1 轮（并行 3 个调用）**
   - WebFetch `https://nodejs.org/docs/latest-v24.x/api/modules.html` → 拿到 require(esm) 完整版本历史：v22.0.0/v20.17.0 添加；v23.0.0/v22.12.0/v20.19.0 去 flag；v23.5.0/v22.13.0/v20.19.0 默认无实验警告；**v24.15.0 不再实验**。限制（无 top-level await，否则 ERR_REQUIRE_ASYNC_MODULE）、返回命名空间对象、`'module.exports'` 互操作导出、`process.features.require_module`、`--trace-require-module`。CJS 为 Stability: 2。
   - WebFetch `https://nodejs.org/en/about/releases/` → v24 Krypton（2025-05-06 首发）现 LTS、最新 24.19.0（2026-08-03）；v26 自 2026-05-05 起 Current（26.7.0）；Node 22 Jod LTS 尾段；LTS 约 30 个月；Node 27 起年度发布。
   - WebSearch「Node.js 24 LTS October 2025 Krypton announcement」→ 确认 2025-10（v24.11.0）进入 LTS，维护至约 2028-04（nodejs.org 官方 release blog + changelog）。

4. **外部证据收集 — 第 2 轮（并行 4 个调用）**
   - WebFetch `https://nodejs.org/docs/latest-v24.x/api/esm.html` → ESM 导入 CJS：default = module.exports；命名导出靠静态启发式分析（动态挂载可能漏）；'module.exports' 具名导出 v23.0.0 起；模块语法检测算法；ESM/CJS 差异（无 __dirname/__filename/require.cache/NODE_PATH）。无 CJS 弃用表述。
   - WebFetch `https://nodejs.org/docs/latest-v24.x/api/packages.html` → 双包主题官方仅一行、指向 nodejs/package-examples 仓库；`module-sync` 条件（同步 ESM 同时服务 import/require，含 TLA 限制）；exports 的 import/require 条件与双包风险提示。
   - WebSearch「TypeScript 5.8 require() of ECMAScript modules --module nodenext」→ TS 5.8（2025 年初发布）在 nodenext 下不再对 require(esm) 报错（typescriptlang.org 官方 release notes + devblogs 公告）。
   - WebSearch「Node.js core migrating internal code to ESM Joyee Cheung 2025」→ 关键发现：nodejs/node issue #58523（核心内部迁 ESM 风险极高）；Joyee Cheung 博客《require(esm) in Node.js: from experiment to stability》（2025-12-30）；《Shipping Node.js packages in 2025》演讲。

5. **外部证据收集 — 第 3 轮（并行 4 个调用）**
   - WebFetch Joyee Cheung 博客（2025-12-30）→ 维护者结论：活跃 LTS 均支持 require(esm) 后包无需转译/双发；engines 建议 `^20.19.0 || >=22.12.0`；2024-09 top-5000 统计（CJS 3000+、dual 466、faux ESM 526、ESM-only 559、TLA 仅 6）；ESM 加载可能仍慢于 CJS。
   - WebSearch「module syntax detection enabled by default 22.7.0」→ 官方 release blog 确认 v22.7.0（2024-08）默认启用。
   - WebSearch「Node.js v24.15.0 release date no longer experimental」→ v24.15.0 发布于 2026-04-15（官方 release 页），该版本 require(esm) 转正。
   - WebFetch `https://github.com/chalker/npm-esm-vs-cjs` → **404**（来源无效，弃用）。

6. **外部证据收集 — 第 4 轮（并行 2 个调用）**
   - WebFetch `https://github.com/wooorm/npm-esm-vs-cjs`（Titus Wormer）→ 2026-06-08 数据：16,231 高影响包中 CJS-only ~52%、ESM-only ~16%、dual ~22%、faux ESM ~10%；2025-12 换数据源（ecosyste.ms），前后不可比。标注为第三方补充证据。
   - WebSearch「module-sync exports condition added version」→ 确认 module-sync 条件 v23.5.0 / v22.13.0 引入（官方 packages 文档 + CHANGELOG_V22）。

7. **停止判断**
   - 官方立场（CJS Stable、无弃用、核心迁移谨慎）、互操作机制（require(esm)/module-sync/语法检测）、工具链（TS 5.8）、生态数据（npm-esm-vs-cjs）均已有一手来源；继续检索只会润色措辞 → 按 Stop Rules 停止收集，进入综合。

8. **产出**
   - 按输出契约撰写中文报告 → `...\run-1\outputs\report.md`。
   - 本简记 → `...\run-1\transcript.md`。
   - 未修改仓库其他任何文件/状态。

## 引用来源清单（报告 Evidence Used 与之一一对应）

官方/上游：
1. https://nodejs.org/docs/latest-v24.x/api/modules.html — require(esm) 用法/限制/版本历史；CJS Stability: 2
2. https://nodejs.org/docs/latest-v24.x/api/esm.html — ESM↔CJS 互操作、语法检测、差异清单
3. https://nodejs.org/docs/latest-v24.x/api/packages.html — exports 条件、module-sync、双包指向 package-examples
4. https://nodejs.org/en/about/releases/ — 版本状态/日程（v24 LTS、v26 Current）
5. https://nodejs.org/en/blog/release/v24.11.0 — v24 进入 LTS（2025-10）
6. https://nodejs.org/en/blog/release/v24.15.0 — 2026-04-15 发布（require(esm) 转正版本）
7. https://nodejs.org/en/blog/release/v22.7.0 — 语法检测默认启用（2024-08）
8. https://github.com/nodejs/node/issues/58523 — 核心内部迁 ESM 风险评估
9. https://joyeecheung.github.io/blog/2025/12/30/require-esm-in-node-js-from-experiment-to-stability/ — 维护者回顾与建议（2025-12-30）
10. https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html — TS 5.8 nodenext 支持 require(esm)
11. https://github.com/nodejs/package-examples — 官方双包模式示例

第三方（补充）：
12. https://github.com/wooorm/npm-esm-vs-cjs — 生态格式占比（2026-06-08）

无效来源：https://github.com/chalker/npm-esm-vs-cjs（404，未采用）。
