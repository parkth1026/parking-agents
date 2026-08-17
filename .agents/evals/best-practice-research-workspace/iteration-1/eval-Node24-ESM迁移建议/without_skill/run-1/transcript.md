# 执行过程记录（transcript）

任务：调研 Node.js 24 时代 CommonJS→ESM 迁移的官方最新建议，产出中文报告。
执行日期：2026-08-16。产物：`outputs/report.md`。

## 步骤

1. **建目录**：`mkdir -p` 创建 `outputs/` 目录（bash）。
2. **Web 搜索 1**：`Node.js 24 LTS "Krypton" release date schedule`
   → 确认 Node 24 时间线：v24.0.0（2025-05-06）、Active LTS 2025-10-28（v24.11.0 起，代号 Krypton）、支持至 2028-04。
   来源：nodejs.org/en/blog/release/v24.11.0、nodejs.org/en/about/previous-releases、NodeSource 博客。
3. **Web 搜索 2**：`Node.js require(esm) stable version 22.12 23 official announcement`
   → require(esm)：v22.12.0（2024-12）默认开启；发现 Joyee Cheung 2025-12-30 博客（from experiment to stability）。
   来源：nodejs.org/en/blog/release/v22.12.0、joyeecheung.github.io 博客、socket.dev 博客。
4. **WebFetch：Joyee Cheung 博客**（2025-12-30）
   → 关键结论：require(esm) 于 2025 年底标记 Stable（PR #60959）；v20.19.0+/v22.12.0+ 全线可用；建议 engines `"^20.19.0 || >=22.12.0"`、单一 ESM 入口、放弃双包与 ESM→CJS 转译；明确表示 CommonJS 不会废弃（Hyrum's Law、不破坏现有代码原则）。
5. **WebFetch：nodejs/release 的 release-schedule.json** → 404；改用 **WebFetch raw README.md**
   → 完整时间表：18/20 已 EOL（20 于 2026-04-30 EOL）、22 Maintenance（EOL 2027-04-30）、24 Active LTS（Maintenance 2026-10-20，EOL 2028-04-30）、26 Current（2026-05-05 发布）；半年一个主版本、偶数版进 LTS。
6. **Web 搜索 3**：官方对 CommonJS 废弃问题的表态
   → nodejs/node issue #33954（维护者：因 npm 网络效应永远不可能移除/废弃 CJS）；官方 esm.html 文档无任何弃用表述；找到官方 v22→v24 迁移指南存在。
7. **Web 搜索 4**：模块语法检测（detect-module）
   → v21.1.0 引入 flag；v22.7.0 起默认开启（`--experimental-detect-module` 变 no-op）；仅作用于无 `"type"` 的歧义 `.js` 文件；TS 兼容性 issue #56678。
8. **WebFetch：Node v24 官方文档 modules.html**（require(esm) 小节）
   → 版本历史：v24.15.0 起 "no longer experimental"；TLA 限制（ERR_REQUIRE_ASYNC_MODULE）；命名空间对象返回值、`__esModule`、`'module.exports'` 特殊导出；`--no-require-module`/`--trace-require-module`/`process.features.require_module`。
9. **WebFetch：Node v24 官方文档 packages.html**
   → 重大发现：Dual package 章节被清空，只留指向 nodejs/package-examples 的链接；新增 `"module-sync"` 条件；`"require"` 条件语义放宽（目标可以是 ESM）。
10. **WebFetch：github.com/nodejs/package-examples README**
    → 确认为官方"包发布模式 + CJS→ESM 迁移指南"仓库；详细内容在 guide/ 与站点 nodejs.github.io/package-examples/。
11. **WebFetch：nodejs.github.io/package-examples/** → 得到章节目录（含 "Migrating CommonJS to ESM" 四个子章节、07-dual-packages）。
12. **bash（gh api / curl raw）**：列出仓库 guide/ 目录结构（01~08 章 + q-n-a），仓库最后推送 **2026-04-06**。
13. **bash：读取官方指南原文**（raw.githubusercontent.com）
    - `05-cjs-esm-migration/migrating-imports/README.md`：静态/动态 require 的转换（`process.getBuiltinModule` v20.16.0+、`module.createRequire`、`import()`）、扩展名必填、目录导入不支持。
    - `migrating-exports/README.md`：具名/默认导出转换；两条兼容原则（ESM 消费者始终给 default export；非对象字面量的 `module.exports` 用 `'module.exports'` 特殊导出）。
    - `migrating-context-local-variables/README.md`：`__filename`→`import.meta.filename`（v20.11.0+）、`__dirname`→`import.meta.dirname`、`require.main`→`import.meta.main`（v22.18.0/v24.2.0）、`require.resolve`→`import.meta.resolve`。
    - `migrating-package-json/README.md`：`.mjs` vs `"type": "module"`（.mjs 少读 package.json、加载更快）；engines `"^20.19.0 || >=22.12.0"` + major 升版惯例。
    - `07-dual-packages/README.md`：官方明确标注旧双包文档"自 require(esm) 落地后大量过时，暂勿用于新包"。
    - `07-dual-packages/migrating-to-esm-only/README.md` 与 `q-n-a/README.md`：0 字节占位（在建）。
14. **WebFetch：Node v24 官方文档 esm.html**
    → 模块系统判定算法（DETECT_MODULE_SYNTAX）、CJS named exports 静态分析机制、互操作差异（URL 解析、无 require/exports/module、`import.meta.filename/dirname` v24 起稳定、`import.meta.main` v24.2.0、`import.meta.resolve`）、JSON modules 需 `with { type: 'json' }`。
15. **Web 搜索 5**：TypeScript 5.8 require(esm) 支持
    → TS 5.8（2025-02 发布）在 `--module nodenext` 下不再对 require ESM 报 TS1479（来源：devblogs.microsoft.com 官方公告）。
16. **bash：nodejs.org/dist/index.json**（本地 node 解析）
    → 确切日期：v24.0.0=2025-05-06、v24.15.0=**2026-04-15**、最新 v24.19.0=2026-08-03（Krypton）、v26.7.0=2026-08-05（Current）、v22.23.2=2026-07-28（Jod）。
17. **bash：v24 cli.html 文档文本抽取**
    → 确认"ESM syntax detection 自 v22.7.0/v20.19.0 默认开启"；顺带确认 v24 的 `--input-type` 支持 typescript 值。
18. **bash：v24 esm.html 文档文本抽取** → 确认 Import Attributes：JSON 模块必须 `with { type: 'json' }`（v21.0.0/v20.10.0 从 import assertions 切换为 import attributes）。
19. **撰写 `outputs/report.md`**：中文报告，含 TL;DR、版本时间线（带日期）、要不要迁的决策矩阵、五阶段渐进路线（基于官方 package-examples 指南与 v24 文档）、常见坑速查、带日期的引用来源列表、行动清单。

## 引用的主要来源清单

- https://github.com/nodejs/release （发布时间表）
- https://nodejs.org/dist/index.json （版本确切日期）
- https://nodejs.org/docs/latest-v24.x/api/modules.html （require(esm) 稳定性与限制）
- https://nodejs.org/docs/latest-v24.x/api/esm.html （模块判定、互操作、import.meta、JSON modules）
- https://nodejs.org/docs/latest-v24.x/api/packages.html （双包章节移除、module-sync 条件）
- https://nodejs.org/docs/latest-v24.x/api/cli.html （语法检测默认开启）
- https://github.com/nodejs/package-examples （官方包发布/迁移指南，2026-04-06 更新；05/07 章节原文）
- https://joyeecheung.github.io/blog/2025/12/30/require-esm-in-node-js-from-experiment-to-stability/ （2025-12-30，核心贡献者）
- https://nodejs.org/en/blog/release/v22.12.0 、 https://nodejs.org/en/blog/release/v24.11.0 （发布说明）
- https://github.com/nodejs/node/issues/33954 （CJS 不废弃的维护者表态）
- https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/ （TS 5.8，2025-02）

未读任何本地项目文件（任务为纯调研，无输入文件）。
