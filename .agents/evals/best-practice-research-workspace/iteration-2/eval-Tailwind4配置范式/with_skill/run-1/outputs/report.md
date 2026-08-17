# 最佳实践调研:Tailwind CSS 现行配置范式(教程里的 `tailwind.config.js` + `purge` 为什么对不上了)

> 调研日期:2026-08-16。所有结论以 Tailwind 官方文档 / 官方发布渠道为准,来源见文末。

## 一句话结论

**你跟的教程至少落后一个大版本周期:`purge` 是 Tailwind v2 时代的选项(连 v3 在 2021 年都已把它改名为 `content`,而 v4 彻底不再需要它)。2026 年新开项目直接按官方现行 v4 文档走:不创建 `tailwind.config.js`、不配 purge/content,全部配置写进 CSS。**

---

## Direct Recommendation(该按哪套来)

### 1. 先定性:教程属于 v2/v3 旧范式

- `purge` 是 v2 的配置项(v2 底层依赖 PurgeCSS)。官方 v2→v3 升级指南原文:*"Since Tailwind no longer uses PurgeCSS under the hood, we've renamed the purge option to content to better reflect what it's for"* —— 即 v3.0(2021-12)起 `purge` 已改名为 `content`。
- "装 `tailwindcss` → `npx tailwindcss init` 生成 `tailwind.config.js` → CSS 里写三条 `@tailwind` 指令" 是 **v3** 的标准流程。现行 v4 官方安装文档(文档站顶部标注 v4.3)已完全没有这些步骤,所以你"跟文档对不上"。
- v4.0 于 2025-01-22 发布,配置范式整体重写:配置从 JS 文件迁移到 CSS,类名裁剪从手动 `content` 数组改为自动内容检测。

### 2. 新项目按 v4 现行范式落地(三选一)

**路线 A —— Vite 插件(官方首选,Laravel/SvelteKit/Nuxt/React Router 等均适配):**

```bash
npm install tailwindcss @tailwindcss/vite
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
})
```

```css
/* src/index.css —— 入口只有这一行 */
@import "tailwindcss";
```

然后在入口(如 `main.ts`)`import './index.css'` 即可。**全程不需要 `tailwind.config.js`。**

**路线 B —— PostCSS(Webpack 等传统构建链):**

```bash
npm install tailwindcss @tailwindcss/postcss
```

```js
// postcss.config.js
export default { plugins: ["@tailwindcss/postcss"] }
```

注意:PostCSS 插件已拆到独立包 `@tailwindcss/postcss`;v4 内置了 `@import` 处理与语法转换,可以删掉 `postcss-import` 和 `autoprefixer`。

**路线 C —— Tailwind CLI(无构建工具的纯静态项目):**

```bash
npm install tailwindcss @tailwindcss/cli
npx @tailwindcss/cli -i ./src/input.css -o ./src/output.css --watch
```

### 3. purge 的现役替代:自动内容检测(零配置)

v4 不再需要任何 purge/content 配置:

- 自动把**当前工作目录**下的源文件当纯文本扫描,提取类名;
- 自动遵守 `.gitignore`,自动忽略 `node_modules`、二进制文件(图片/视频/zip 等)、CSS 文件、常见锁文件;
- 需要补充/排除来源时在 CSS 里用 `@source`:

```css
@import "tailwindcss";
@source "../node_modules/@my-company/ui-lib";  /* 额外添加(如扫描装进 node_modules 的组件库) */
@source not "../src/legacy";                    /* 排除 */
@source inline("underline");                    /* 强制生成(替代 v3 safelist) */
@import "tailwindcss" source(none);             /* 完全关闭自动检测,全手动注册 */
```

monorepo 注意:自动检测基准是"当前工作目录",构建命令若在仓库根执行需用 `@import "tailwindcss" source("../src")` 显式指定基准。

### 4. 主题定制的现役方式:CSS 里的 `@theme` 块

原 `tailwind.config.js` 的 `theme.extend` 改为在 CSS 中定义设计令牌(变量按命名空间自动生成工具类,并同时输出为 `:root` 下的原生 CSS 变量):

```css
@import "tailwindcss";

@theme {
  --color-mint-500: oklch(0.72 0.11 178);   /* 生成 bg-mint-500 / text-mint-500 … */
  --font-display: "Satoshi", sans-serif;     /* 生成 font-display */
  --breakpoint-3xl: 1920px;                  /* 生成 3xl: 变体 */
  --spacing: 4px;                            /* 间距基数,动态派生 p-17 等任意值 */
}
```

清除默认色板:`--color-*: initial;`;完全禁用默认主题:`--*: initial;`。

**存量兼容(仅迁移期用):** 旧的 JS 配置文件仍可显式加载,但不再是自动检测:

```css
@config "../../tailwind.config.js";
```

且 `corePlugins`、`safelist`、`separator` 三个选项在 v4 中不受支持(safelist 改用 `@source inline()`)。新项目不要走这条路。

### 5. 环境要求与"留在 v3"的例外

- **Node.js 20+**(官方升级工具要求);
- 目标浏览器:Safari 16.4+ / Chrome 111+ / Firefox 128+(v4 依赖 `@property`、`color-mix()` 等现代 CSS)。官方明确:若需支持更老浏览器,**留在 v3.4**——注意即便如此,v3 也是用 `content` 而不是 `purge`。

### 6. 三代范式对照速查

| 维度 | v2(你的教程) | v3(旧文档) | v4(现行,2026-08) |
|---|---|---|---|
| 安装包 | `tailwindcss` | `tailwindcss` | `tailwindcss` + `@tailwindcss/vite`(或 `/postcss`、`/cli`) |
| 配置文件 | `tailwind.config.js`(`purge`) | `tailwind.config.js`(`content`) | 不需要;CSS 内 `@theme`(可用 `@config` 兼容旧文件) |
| 类名裁剪 | `purge` 选项 | `content` 数组 | 自动内容检测 + `@source` |
| CSS 入口 | `@tailwind base/components/utilities` 三条 | 同左 | `@import "tailwindcss";` 一行 |
| PostCSS | 作为插件 | 作为插件(需 PostCSS 8) | 独立包 `@tailwindcss/postcss`,可移除 autoprefixer/postcss-import |
| Node | — | — | 20+ |

---

## Evidence Used

**官方/上游来源(全部一级证据):**

- 官方博客《Tailwind CSS v4.0》 https://tailwindcss.com/blog/tailwindcss-v4 — 确立 v4 新范式:发布日期 2025-01-22;不再需要 `tailwind.config.js`;`content` 配置被移除、自动内容检测;`@theme` CSS 优先配置;`@import "tailwindcss"` 取代三条 `@tailwind` 指令;`@tailwindcss/vite` 与 `@tailwindcss/postcss`。
- 官方安装文档(文档站标注 v4.3) https://tailwindcss.com/docs/installation — 现行推荐安装路径(Vite 插件为首选),流程中无 `tailwind.config.js` 步骤,入口 CSS 仅 `@import "tailwindcss";`。
- 官方升级指南(v3 → v4) https://tailwindcss.com/docs/upgrade-guide — `@tailwind` 指令移除、配置迁移到 CSS、`@config` 显式加载旧配置、`corePlugins`/`safelist`/`separator` 不支持、`npx @tailwindcss/upgrade` 升级工具、Node 20+ 与浏览器要求、旧浏览器留在 v3.4。
- 官方主题文档 https://tailwindcss.com/docs/theme — `@theme` 用法、命名空间→工具类映射、清除/禁用默认主题、令牌输出为原生 CSS 变量。
- 官方类名检测文档 https://tailwindcss.com/docs/detecting-classes-in-source-files — 自动内容检测规则(.gitignore/二进制/CSS/锁文件排除)、`@source` / `@source not` / `@source inline()` / `source(none)`、monorepo 基准路径注意事项。
- 官方 v3 安装文档 https://v3.tailwindcss.com/docs/installation — v3 标准流程:`npx tailwindcss init`、`content` 数组、三条 `@tailwind` 指令(用于对照说明教程属于旧范式)。
- 官方 v2→v3 升级指南 https://v3.tailwindcss.com/docs/upgrade-guide — 原文确认 `purge` 更名为 `content`("Tailwind no longer uses PurgeCSS under the hood"),证明教程中的 `purge` 是 v2 时代写法。
- 官方 GitHub Releases https://github.com/tailwindlabs/tailwindcss/releases — 现行最新版本 v4.3.3(2026-07-16;页面仅标月日,年份按页面版权标注推断)。

**补充来源:** 无(未使用第三方教程/博客作为论断依据)。

---

## Version / Date Context

- v3.0:2021-12 发布,`purge` → `content` 更名发生在本版(来源:v3 升级指南)。
- v4.0:2025-01-22 发布,配置范式全面重写(来源:官方博客)。
- 现行版本:v4.3 系列 —— 文档站顶部标注 v4.3;GitHub 最新 release 为 v4.3.3(2026-07-16,年份由页面版权推断,存在小幅不确定)。
- 本报告结论时效:2026-08-16。Tailwind 主版本迭代较快,执行前建议再确认一次官方安装文档版本号。
- 用户教程无版本标注,按 `purge` 写法推断其内容至少来自 v2 时代(≤2021),与现行文档差 2~3 个大版本。

---

## Repo-Local Context

not needed(用户为新开 Tailwind 项目,无本地代码/版本约束;本次任务输入为 none,未做仓库内探索)。

---

## Boundaries / Non-goals

- 不决定"存量 v3 项目是否应该迁移到 v4"(迁移成本/风险评估不在本次范围)。
- 不做 CSS 框架选型对比(如 Tailwind vs UnoCSS / Panda)——属依赖选型,应交由 dependency-expert。
- 未覆盖各框架(Next.js/Nuxt/Laravel 等)的专有集成差异,仅给通用三条路线;框架细节见官方 framework-guides。
- 未执行任何安装、代码修改或仓库变更(本技能只读、到此为止)。

---

## Handoff

- **决定按 v4 落地(新项目推荐):** 下一步进入规划/执行工作流——`$ralplan` 做接入规划,`$ultragoal` / `$team` / `executor` 执行:按"路线 A/B/C"安装,建 `index.css` 写 `@import "tailwindcss";`,主题定制走 `@theme`,不要创建 `tailwind.config.js`。
- **若实际是在维护存量 v3 项目:** 升级前在新分支跑 `npx @tailwindcss/upgrade`,并人工核对破坏性变更:默认边框色 gray-200 → `currentColor`、`ring` 默认 3px→1px、`shadow-sm`/`rounded-sm`/`blur-sm` 等重命名、`outline-none`→`outline-hidden`、`!important` 修饰符移到类名末尾(`bg-red-500!`)、Sass/Less/Stylus 不再支持。
- 本技能(best-practice-research)到此刻为止,不实施任何改动;仅在用户显式切换到上述规划/执行工作流后继续。
