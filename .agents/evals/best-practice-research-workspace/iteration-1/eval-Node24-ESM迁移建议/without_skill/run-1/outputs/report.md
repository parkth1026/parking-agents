# 老项目（CommonJS）在 Node.js 24 上的 ESM 迁移建议

> 报告日期：2026-08-16。所有版本号与日期均以当天的官方来源为准（Node.js 官方文档 v24.x、nodejs.org 发布索引、nodejs/release 时间表、nodejs/package-examples 官方指南仓库、Node.js 核心贡献者 Joyee Cheung 的官方背景博客）。
> 场景：存量项目全部为 CommonJS（`require`），运行时为 Node.js 24。

---

## 一、一句话结论（TL;DR）

**不需要"大爆炸"式迁移，但建议渐进式迁移。** 官方从未宣布废弃 CommonJS（核心维护者的明确表态是"永远不太可能移除或废弃"）；而 Node.js 24.15.0（2026-04-15 发布）起 `require(esm)` 已脱离实验状态，CommonJS 项目现在可以直接 `require()` 同步的纯 ESM 包——过去"被迫迁移"的最大理由已经消失。官方最新的定位是：**两种模块格式长期共存，各团队按自己的节奏迁移**。对你们的建议是：先升到 24.15+，新代码一律写 ESM，存量代码按模块逐步转换，最后再整体切 `"type": "module"`；如果是发布给他人的库，可考虑在下一个 major 版本直接发 ESM-only。

---

## 二、关键事实与版本时间线（截至 2026-08-16）

### 2.1 Node.js 版本状态（来源：nodejs/release 时间表 + nodejs.org/dist 索引，2026-08-16 查询）

| 版本 | 代号 | 状态 | 首发日期 | 进入 Active LTS | 转 Maintenance | End of Life |
|---|---|---|---|---|---|---|
| 20.x | Iron | **已 EOL** | 2023-04-18 | 2023-10-24 | 2024-10-22 | **2026-04-30（已过）** |
| 22.x | Jod | Maintenance LTS | 2024-04-24 | 2024-10-29 | 2025-10-21 | 2027-04-30 |
| **24.x** | **Krypton** | **Active LTS（你们的版本）** | 2025-05-06 | 2025-10-28 | 2026-10-20（即将） | **2028-04-30** |
| 26.x | — | Current | 2026-05-05 | 预计 2026-10 进入 LTS | — | 约 2030-04 |

- 2026-08 当时的最新小版本：v24.19.0（2026-08-03，LTS "Krypton"）、v26.7.0（2026-08-05，Current）、v22.23.2（2026-07-28）。
- 含义：Node 24 会持续获得支持到 **2028 年 4 月**（2026-10-20 起转维护模式，只收安全与关键修复），你们的 CommonJS 代码在这条线上**至少还能安全跑到 2028 年**。

### 2.2 CommonJS 不会被废弃（官方态度）

- Node.js 官方文档（esm.html）将 CommonJS 与 ESM 的互操作描述为长期受支持的特性，没有任何弃用标注。
- 官方 issue [nodejs/node#33954]（"When will CommonJS modules (require) be deprecated?"）中维护者的回复：由于 npm 生态的网络效应，"我不认为我们能够移除甚至废弃 CommonJS"。
- Node.js 核心贡献者 Joyee Cheung（`require(esm)` 的推动者）在 2025-12-30 的总结博客中同样强调：核心原则是"Try not to break existing code"（不破坏现有代码）；CommonJS 长期仍是最主流的发布格式，大量工具链事实上依赖 CommonJS loader 的内部行为（Hyrum's Law），**彻底移除是不可能无破坏地做到的**。

### 2.3 `require(esm)`：改变游戏规则的特性（官方时间线）

用 CommonJS 的 `require()` 直接加载纯 ESM 包（含 ESM-only 的第三方依赖）：

| 里程碑 | 版本 | 日期 |
|---|---|---|
| 实验性引入（需 `--experimental-require-module`） | v22.0.0 / v20.17.0 | 2024-04 / 2024-07 |
| **默认开启（去 flag）** | v22.12.0 / v23.0.0 / v20.19.0 | 2024-12 / 2024-10 / 2025-03 |
| 不再打印实验性警告 | v22.13.0 / v23.5.0 | 2025-01 / 2025-01 |
| **标记为 Stable（PR #60959）** | 2025 年底完成；v24 线自 **v24.15.0** 起文档标注 "no longer experimental" | **2026-04-15** |

限制（v24 官方文档 modules.html）：
- 只能加载**同步**的 ESM：被加载模块（及其依赖图）若含 top-level await，会抛 `ERR_REQUIRE_ASYNC_MODULE`，此时必须改用 `import()`。
- 返回值是 **模块命名空间对象**，default export 挂在 `.default` 属性上（除非该 ESM 提供了特殊的 `'module.exports'` 具名导出，见 5.3）。
- 能力检测：`process.features.require_module === true`；可用 `--no-require-module` 关闭，`--trace-require-module` 追踪使用。

### 2.4 其他相关能力（v24 现状）

- **模块语法检测**：自 v22.7.0 / v20.19.0 起默认开启。没有 `"type"` 字段的包里，`.js` 文件若含 `import`/`export`/`import.meta`/top-level await 等 ESM 语法，会被自动当作 ESM 执行（可用 `--no-experimental-detect-module` 关闭）。这让"一个包里 CJS/ESM 混放"变得可行。
- **`import.meta.filename` / `import.meta.dirname`**：v20.11.0 加入，**v24.0.0 起脱离实验**——`__filename`/`__dirname` 的正式替代品。
- **`import.meta.main`**（等价 `require.main === module`）：v24.2.0 加入。
- **`import.meta.resolve`**（同步版，等价 `require.resolve`）：v20.6.0 起无需 flag。
- **JSON 模块**：ESM 中 `import data from './x.json' with { type: 'json' }`（`type` attribute 是强制性的；CJS 里直接 `require('./x.json')` 不变）。
- **TypeScript**：若项目含 TS，TypeScript 5.8（2025-02 发布）起在 `--module nodenext` 下允许 `require()` ESM 文件（不再报 TS1479）。

### 2.5 官方文档正在重写"发布指引"（重要信号）

- v24 的官方 packages 文档中，老的 "Dual CommonJS/ES module packages"（双包发布）章节已被**清空**，仅指向官方新仓库 **nodejs/package-examples**（"记录常见包发布模式、优缺点，以及 CJS 到 ESM 的迁移指南"；最后更新 2026-04-06）。
- 该仓库把旧双包文档整体搬入 `07-dual-packages`，并在开头明确标注：**"A lot of the information below been outdated since Node.js started to support require(esm). Do not follow the documentation below for new packages for the time being."**（旧内容自 Node 支持 require(esm) 起已大量过时，暂不要按它来写新包。）
- 即：官方当前的立场是，**require(esm) 时代"为一个包维护 CJS+ESM 两套发行物"的做法正在被劝退**；新指南（05-cjs-esm-migration 等）则以"单一 ESM 发行 + `engines` 声明"为推荐路径。

---

## 三、要不要迁？—— 决策建议

### 3.1 不迁的理由（都成立，但分量在下降）

1. CommonJS 是长期支持格式，Node 24 LTS 到 2028-04，官方不废弃（见 2.2）。
2. 有了 require(esm)，纯 CJS 项目也能用上 ESM-only 的依赖（只要对方不含 top-level await），"不迁就装不了某个包"的压力基本消失。
3. 大规模改代码有回归风险，需要测试覆盖兜底。

### 3.2 建议渐进迁移的理由

1. **生态方向**：新包、新工具链（Vite 生态、现代 CLI、很多新库）日益 ESM-only；Joyee Cheung 在 2025-12 博客中指出，require(esm) 落地后反而**加速**了生态转向 ESM-only（如 Storybook v8 等），因为迁移不再需要上下游同步。
2. **语言与工具能力**：静态 `import`/`export` 带来更好的静态分析、tree-shaking、循环依赖诊断；top-level await、`import.meta` 等只在 ESM 中可用。
3. **官方文档的新内容（如 package-examples 指南）默认以 ESM 为目标态**，CJS→ESM 迁移章节是官方当前投入维护的方向。
4. **成本低窗口**：Node 24 上混用两种格式已经非常顺滑（语法检测 + require(esm) + ESM 可 import CJS），是历以来渐进迁移摩擦最小的时期。

### 3.3 按项目类型的决策矩阵

| 情况 | 建议 |
|---|---|
| **内部应用/服务**（不对外发 npm 包），Node 24 基线 | **建议迁**，节奏自定：新代码 ESM、存量按模块渐进，最终切 `"type": "module"`。没有外部消费者，兼容负担小。 |
| 对外发布的**库**，用户里有老 Node（<20.19） | 暂缓整体切换；可以先按官方指南"Shipping ESM for CommonJS"思路，或继续双格式/纯 CJS，并在 README 标注计划。等 `engines` 允许 `^20.19.0 \|\| >=22.12.0` 时再发 ESM-only major。 |
| 对外发布的库，可接受 major 断代 | 官方新指路线：发 **ESM-only**、`exports` 单入口、`engines: "node": "^20.19.0 \|\| >=22.12.0"`，**放弃** CJS 发行物与 ESM→CJS 转译（dual-package hazard 成为历史）。 |
| 依赖大量老 CJS 专有机制（`require.cache`、`NODE_PATH`、运行时改 `exports` 等） | 谨慎：这些在 ESM 中没有等价物（见 5.4），先架构改造再谈迁移。 |

**给你们的直接答案**：老项目跑在 Node 24（内部服务可能性大）——**迁，但用 3~6 个月的渐进节奏迁，不要停机重写。**

---

## 四、渐进迁移路线图（以 Node 24 为基线）

### 阶段 0：打底（1 周内）

1. 升级到 **Node ≥ 24.15.0**（2026-04-15 起 require(esm) 非实验）；检查 `process.features.require_module === true`。
2. **盘点**：把所有 `require` 用法分类——顶层静态 require、条件/动态 require、目录导入（`require('./lib')`）、省略扩展名的 require、对 `__dirname`/`require.main`/`require.resolve` 的使用。前三类决定迁移工作量。
3. 补齐关键路径的测试（迁移主要靠测试兜底，尤其是"动态改 exports"、单例状态这类模式）。
4. 在 `package.json` 里固定 `"engines": { "node": ">=24.15.0" }`（或至少 `">=22.12.0"`）。

### 阶段 1：先解决"外部依赖"（几乎零成本，立刻做）

- 从现在起，**可以直接 `require()` 任何同步的 ESM-only 依赖**，不需要任何配置。default export 取 `.default`（或优先选依赖的具名导出）。
- 若某依赖使用 top-level await，`require` 会抛 `ERR_REQUIRE_ASYNC_MODULE`——在代码里把那一处改成 `await import()`（CJS 里动态 `import()` 早已稳定可用）。
- 这一步之后，"被迫迁移"的外部压力归零，后面按业务节奏走。

### 阶段 2：新代码一律 ESM，包内混放（当周生效）

- 新文件用 `.mjs` 扩展名（官方指南指出：相比 `"type": "module"` + `.js`，`.mjs` 在模块加载时**少读一次 package.json，性能更好**）；或建一个子目录放 `"type": "module"` 的子 package.json。
- 混放规则（Node 24 实际行为）：
  - ESM 里 `import` CJS：`module.exports` 就是 default export；具名导出靠静态分析（cjs-module-lexer）尽力识别——动态挂上去的导出识别不了，此时用 `import cjs from 'x'; const { a } = cjs;` 兜底。
  - CJS 里 `require` ESM：见阶段 1。
- 跨格式引用内部模块时注意：**ESM `import` 路径必须写全扩展名**（`./utils.js`），且**不支持目录导入**——顺手就把存量里的无扩展名/目录 require 修成全路径，这是后面机械转换的前置工作。

### 阶段 3：存量模块批量转换（核心工作，按目录/模块推进）

官方 package-examples 指南（05-cjs-esm-migration，2026-04 更新）给出的对照关系：

**导入侧**：
| CommonJS | ESM 写法 |
|---|---|
| `const fs = require('fs')`（整包） | `import fs from 'node:fs'` |
| `const { join } = require('path')` | `import { join } from 'node:path'` |
| 无扩展名/目录 require | 必须写完整相对路径 + 扩展名 |
| 条件/动态 require（内置模块，需同步） | `process.getBuiltinModule('fs')`（v20.16.0+） |
| 条件/动态 require（第三方，需同步） | `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url)` |
| 条件/动态 require（可异步） | `await import('pkg')` |

**导出侧**（官方强调的两条兼容原则）：
- `exports.foo = ...` / `module.exports = { foo }` → 具名导出 `export const foo` / `export { foo }`。
- `module.exports = function/class` → `export default`。
- **给 ESM 消费者兜底**：CJS 时代 `module.exports` 自动成为 ESM 眼中的 default export；转成 ESM 后不再自动生成，所以对外接口**始终保留一个 default export**（通常聚合具名导出），否则老的 `import x from 'pkg'` 写法会断。
- **给 CJS 消费者兜底**：如果原来 `module.exports` 是函数/类（非对象字面量），在 ESM 里加一个特殊具名导出 `export { main as 'module.exports' }`，这样 `require(esm)` 会直接返回该值而不是命名空间对象。

**上下文变量**（官方对照表）：
| CommonJS | ESM 等价 | 最低版本 |
|---|---|---|
| `__filename` | `import.meta.filename`（v24 起稳定） | v20.11.0 |
| `__dirname` | `import.meta.dirname`（v24 起稳定） | v20.11.0 |
| `require.main === module` | `import.meta.main` | v24.2.0 |
| `require.resolve` | `import.meta.resolve`（同步） | v20.6.0 |
| `require`（ESM 内需要时） | `module.createRequire(import.meta.url)` | v12.2.0 |

**无法直接转换的模式**（迁移前先重构）：运行时动态增删 `exports` 属性、带 getter/setter 的 exports、依赖 `require.cache`/`NODE_PATH`/`require.extensions` 的逻辑——ESM 导出是静态的，没有模块缓存反射。

### 阶段 4：切换 package.json，收尾

```json
{
  "type": "module",
  "exports": { ".": "./index.js", "./package.json": "./package.json" },
  "engines": { "node": "^20.19.0 || >=22.12.0" }
}
```
- 官方建议的 engines 写法（指南与 Joyee Cheung 博客一致）：`"^20.19.0 || >=22.12.0"`——这正是"所有支持 require(esm) 的版本"。你们内部统一在 24 的话，直接 `">=24.15.0"` 更简单。
- 切换时机选在阶段 3 全部文件转完之后；个别暂时转不了的文件可改名 `.cjs` 留在包里。
- 如果是发库：按 semver 升一个 **major** 版本（官方指南明确这是常见做法），并在发布说明里写清模块格式变化。

### 阶段 5（仅库作者）：放弃双包

- 官方旧双包指引（ESM wrapper / 状态隔离两套方案）已被标注过时，"勿用于新包"；`"module-sync"` 等 exports 条件是为 require(esm) 时代设计的新机制（匹配"无 top-level await 的 ESM，可被 import 也可被 require"）。
- 结论：**不要再新造 dual package**；已有双包的，按 Joyee Cheung 的建议在 major 版本收敛为单一 ESM 发行，删掉转译步骤，减小 node_modules 体积。

---

## 五、常见坑速查（Node 24 实测行为）

1. **`require()` 含 top-level await 的 ESM** → `ERR_REQUIRE_ASYNC_MODULE`。改 `import()`。
2. **`require(esm)` 拿到的对象上找不到导出** → 它是命名空间对象，default 在 `.default`；或让对端提供 `'module.exports'` 特殊导出。
3. **import CJS 时具名导入报不存在** → cjs 静态分析没识别出该导出（动态赋值、`Object.keys(exports)` 生成等）。先 default import 再解构。
4. **`__dirname is not defined`** → 用 `import.meta.dirname`。
5. **`ERR_MODULE_NOT_FOUND`（路径明明存在）** → ESM 不做扩展名探测、不支持目录导入；把 `./config` 改成 `./config.js`。
6. **路径含 `#`、`?` 等特殊字符** → ESM 按 URL 解析，需要 percent-encode（`%23`、`%3F`）。
7. **JSON 导入** → `import data from './d.json' with { type: 'json' }`，attribute 必写。
8. **`require.cache`、`NODE_PATH`、`require.extensions`、改 `module.exports` 反射** → ESM 无等价物，先架构层面去掉依赖。

---

## 六、引用来源（均为 2026-08-16 访问）

1. Node.js 发布时间表（nodejs/release 仓库 README）：https://github.com/nodejs/release —— 24.x Krypton 时间线、各版本 EOL。
2. Node.js 官方下载索引：https://nodejs.org/dist/index.json —— v24.19.0（2026-08-03）、v26.7.0、v22.23.2、v24.15.0（2026-04-15）等确切日期。
3. Node.js v24 官方文档 Modules（require(esm) 小节）：https://nodejs.org/docs/latest-v24.x/api/modules.html —— 稳定性变更历史（v24.15.0 不再实验）、TLA 限制、`'module.exports'` 特殊导出、相关 CLI 开关。
4. Node.js v24 官方文档 ESM：https://nodejs.org/docs/latest-v24.x/api/esm.html —— 模块系统判定（DETECT_MODULE_SYNTAX）、CJS/ESM 互操作、`import.meta.filename/dirname/main/resolve` 版本历史、JSON modules。
5. Node.js v24 官方文档 Packages：https://nodejs.org/docs/latest-v24.x/api/packages.html —— 双包章节已清空并指向 package-examples；`"module-sync"` 条件；`"require"` 条件语义放宽。
6. Node.js 官方包发布指南仓库 nodejs/package-examples（最后推送 2026-04-06）：https://github.com/nodejs/package-examples
   - 05-cjs-esm-migration（imports/exports/context-local variables/package.json 四个子章节，本文档第四阶段对照表的主要依据）；
   - 07-dual-packages README（旧双包指引标注"已过时、勿用于新包"）。
7. Joyee Cheung（Node.js 核心贡献者）博客 "require(esm) in Node.js: from experiment to stability"（2025-12-30）：https://joyeecheung.github.io/blog/2025/12/30/require-esm-in-node-js-from-experiment-to-stability/ —— require(esm) 稳定化时间线、engines 建议、"不废弃 CJS、各团队按自己节奏迁"的官方背景表述、放弃双包与 faux ESM 的建议。
8. Node.js v22.12.0 发布说明（2024-12）：https://nodejs.org/en/blog/release/v22.12.0 —— require(esm) 首次在 LTS 线默认开启。
9. nodejs/node issue #33954（维护者关于"永不废弃 CommonJS"的表态）：https://github.com/nodejs/node/issues/33954
10. Node.js v24 CLI 文档（`--no-experimental-detect-module`、语法检测自 v22.7.0/v20.19.0 默认开启）：https://nodejs.org/docs/latest-v24.x/api/cli.html
11. TypeScript 5.8 发布公告（2025-02，`--module nodenext` 支持 require(esm)）：https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/

---

## 七、给你们的行动清单（精简版）

- [ ] 本周：升 Node ≥ 24.15.0；确认 `process.features.require_module`；盘点 require 用法分布。
- [ ] 本周：新依赖即使 ESM-only 也可直接引入（注意 `.default` 与 TLA 限制）。
- [ ] 本月：新文件一律 ESM（`.mjs`）；顺手消灭无扩展名/目录 require。
- [ ] 本季度：按模块逐目录转换（用官方对照表 + 测试兜底）；`__dirname`→`import.meta.dirname` 等直接替换。
- [ ] 转换完成后：`"type": "module"` + `"exports"` 单入口 + engines（对外库则升 major、考虑 ESM-only、退役双包）。
- [ ] 全程：不要为"兼容老 Node"而引入 ESM→CJS 转译层——官方已把这类做法归入"历史方案"。
