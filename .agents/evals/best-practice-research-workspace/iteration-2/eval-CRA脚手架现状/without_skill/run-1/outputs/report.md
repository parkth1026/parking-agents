# CRA 脚手架现状与官方推荐的新项目起步方式（中文调研报告）

> 调研日期：2026-08-16
> 场景：新项目要搭一个纯 React 前端（SPA），不想用 Next.js 这种大框架。确认 `npx create-react-app` 是否还能用，以及官方现在推荐怎么起项目。

## 一、结论（TL;DR）

1. **不建议再用 `npx create-react-app` 起新项目。** React 官方已于 **2025 年 2 月 14 日** 正式宣布弃用 Create React App（CRA）。它仍能在"维护模式"下运行（最后版本 5.1.0，发布于 2025-02-15，为兼容 React 19 的收尾版本），但没有活跃维护者，新装时会打印弃用警告，官方明确不推荐用于新应用。
2. **针对"纯 React 前端、不要大框架"的场景，官方文档推荐：用 Vite（或 Parcel / Rsbuild）从零搭建。** 这是 react.dev 官方指南《Building a React App from Scratch》给出的方案，一条命令即可起步：
   ```bash
   npm create vite@latest my-app -- --template react     # JavaScript
   npm create vite@latest my-app -- --template react-ts   # TypeScript
   ```
3. 如果愿意接受一个"比 Next 轻得多"的框架，官方也推荐 **React Router v7 框架模式**（`npx create-react-router@latest`），它底层就用 Vite，可以做纯 SPA，不需要服务器。
4. 官方同时强调：**"框架 ≠ 必须要服务器"**。官方推荐的所有框架都支持 CSR/SPA、可静态导出部署到 CDN；只是从零搭建意味着路由、数据获取、代码分割都要自己选型组装。

## 二、CRA 现状：官方已弃用

### 2.1 官方弃用公告

React 官方博客 2025 年 2 月 14 日发布《Sunsetting Create React App》，原文要点：

> "今天，我们针对**新应用**弃用了 Create React App，并鼓励现有应用**迁移到框架，或迁移到构建工具（如 Vite、Parcel 或 RSBuild）**。"

- 弃用原因：**CRA 目前没有活跃的维护者**，且社区已有许多现成框架解决了同样的问题。
- 更深层的批评：CRA 只解决了"工具配置"问题，但缺少生产应用必需的**路由、数据获取、代码分割**方案，用户在 CRA 之上各自临时拼装——"这正是 CRA 最初试图解决的问题"。
- 公告中说明 CRA 在**新安装时会显示弃用警告**，但已存在的项目**仍可在维护模式下继续工作**。

来源：[Sunsetting Create React App — react.dev 官方博客](https://react.dev/blog/2025/02/14/sunsetting-create-react-app)

### 2.2 npm 包状态（本次实测 npm registry）

- `create-react-app` 最新版 **5.1.0**，发布于 **2025-02-15**（弃用公告次日发布的收尾版本，主要为兼容 React 19）；上一个稳定版 5.0.1 还停留在 **2022-04-12**，之后三年没有正式发版。
- 包本身未在 npm 元数据里打 `deprecated` 标记，所以 `npx create-react-app` 依然"能跑"，但这只是维护模式，不代表官方认可用于新项目。
- 配套的 `react-scripts` 最新版仍是 5.0.1（2022-04-12），长期未更新。

来源：npm registry API（registry.npmjs.org，`create-react-app` 与 `react-scripts` 的 dist-tags 与 time 字段，2026-08-16 查询）

### 2.3 官方文档已删除对 CRA 的推荐

react.dev 的《Start a New React Project》页面（官方"如何起项目"的入口页）**已完全不提 create-react-app**，开篇即：

> "If you want to build a new app or website with React, **we recommend starting with a framework**."（如果你想用 React 构建新应用或网站，我们建议从框架开始。）

来源：[Start a New React Project — react.dev](https://react.dev/learn/start-a-new-react-project)

## 三、官方现在推荐怎么起项目

### 3.1 官方推荐清单（react.dev《Start a New React Project》）

| 场景 | 官方推荐 | 初始化命令 |
|---|---|---|
| 全栈 Web 应用 | Next.js（App Router） | `npx create-next-app@latest` |
| 全栈但更轻、标准 Web API | React Router v7（配 Vite） | `npx create-react-router@latest` |
| 移动/原生/通用应用 | Expo | `npx create-expo-app@latest` |
| 特殊约束 / 自建框架 / 学习原理 | Vite、Parcel、Rsbuild 从零搭建 | 见下文 |

官方对"框架"的一个关键澄清：

> "Full-stack frameworks **do not require a server**."（全栈框架不需要服务器。）

即所有列出的框架都支持 CSR、SPA 和静态导出（SSG），可部署到 CDN 或静态托管，并允许按路由选择性地开启 SSR。官方还给出经验法则：

> "一个好的经验法则是：**如果你的应用需要路由，你大概率会从框架中受益**。"

### 3.2 "不要框架、纯 React" 的官方路径

对不想要 Next 这种大框架的场景，react.dev 官方指南《Building a React App from Scratch》明确给出三个推荐的构建工具，并直接给出初始化命令：

```bash
# 1. Vite（首选，React Router 框架也用它做构建工具）
npm create vite@latest my-app -- --template react-ts

# 2. Rsbuild（Rspack 驱动）
npx create-rsbuild --template react

# 3. Parcel（零配置）
npm install --save-dev parcel
```

指南同时给出配套选型建议（这部分 CRA 从来不提供，需要自己补）：

- **路由**：React Router 或 TanStack Router；
- **数据获取**：REST 场景用 TanStack Query、SWR 或 RTK Query；GraphQL 用 Apollo、Relay；官方建议尽量在路由 loader 或服务端预取数据，避免组件内串行请求造成网络瀑布；
- **代码分割**：参考所选构建工具的文档。

官方也提醒从零搭建的成本："从零开始……往往等同于自建一个临时框架"，除非有特殊约束或想学习原理，否则直接用推荐框架更省事。

来源：
- [Building a React App from Scratch — react.dev](https://react.dev/learn/build-a-react-app-from-scratch)
- [Start a New React Project — react.dev](https://react.dev/learn/start-a-new-react-project)

### 3.3 Vite 官方文档的起步命令

Vite 官方指南给出的 React 模板命令（npm 7+ 需要额外的 `--`）：

```bash
npm create vite@latest my-react-app -- --template react      # JS
npm create vite@latest my-react-app -- --template react-ts    # TS
# yarn / pnpm / bun 同理：
yarn create vite my-react-app --template react
pnpm create vite my-react-app --template react
```

注意：Vite 要求 Node.js 20.19+ 或 22.12+。模板列表里还提供 `react-compiler` / `react-compiler-ts`（带 React Compiler）变体。

来源：[Getting Started — vite.dev](https://vite.dev/guide/)

## 四、给这个新项目的具体建议

结合"纯 React 前端、不用 Next"的诉求：

**推荐方案 A（最贴合诉求）：Vite + React 模板**

```bash
npm create vite@latest parking-frontend -- --template react-ts
cd parking-frontend
npm install
npm run dev
```

然后按需补齐官方指南建议的配套件：
- 路由：`react-router`（库模式即可）或 TanStack Router；
- 数据请求：TanStack Query 或 SWR；
- 测试：指南未强制指定，社区主流搭配是 Vitest + React Testing Library（Vite 生态原生集成）。

**推荐方案 B（想要更完整约定但仍然轻）：React Router v7 框架模式**

```bash
npx create-react-router@latest my-app
```

它是官方推荐清单里比 Next 轻一档的选择，底层就是 Vite，可配置为纯 SPA/静态导出、不需要服务器，同时自带路由、数据加载等约定，省去自己拼装。

**明确不推荐**：继续用 `npx create-react-app`。命令本身还能执行（维护模式），但属于官方已弃用路线，新装即见弃用警告，生态（模板、插件、文档）都在向 Vite 迁移，没有理由让新项目背上这个历史包袱。

## 五、参考来源

1. [Sunsetting Create React App — react.dev 官方博客（2025-02-14 弃用公告）](https://react.dev/blog/2025/02/14/sunsetting-create-react-app)
2. [Start a New React Project — react.dev 官方文档](https://react.dev/learn/start-a-new-react-project)
3. [Building a React App from Scratch — react.dev 官方文档](https://react.dev/learn/build-a-react-app-from-scratch)
4. [Getting Started — Vite 官方文档](https://vite.dev/guide/)
5. npm registry API：`create-react-app`（最新 5.1.0，2025-02-15 发布）与 `react-scripts`（5.0.1，2022-04-12 发布）的版本与时间数据（2026-08-16 实测查询）
6. 辅助背景：[DevClass: React team formally deprecates Create React App](https://www.devclass.com/development/2025/02/18/react-team-formally-deprecates-create-react-app-following-perfect-storm-of-incompatibility/1631009)（社区报道，佐证弃用与 React 19 兼容问题）
