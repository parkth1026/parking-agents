# Best-Practice Research: 新项目还能用 `npx create-react-app` 吗？现在官方推荐怎么起一个纯 React 前端项目？

> 调研日期：2026-08-16（所有结论以该日期可访问的官方来源为准）

## Direct Recommendation（直接建议）

**不要再用 `npx create-react-app` 起新项目。** CRA 已于 2025 年 2 月 14 日被 React 官方正式弃用（官方博客《Sunsetting Create React App》），原因是它"目前没有活跃维护者"（no active maintainers）。命令本身仍能运行（npm 上最新版 5.1.0，2025-02-15 发布，纯维护模式，仅为兼容 React 19），但安装时会打印弃用警告，且官方明确建议不要基于它开始新的生产应用。

针对你的场景——**纯 React 前端、不上 Next.js 这类大框架**——官方给的对应路径叫"从零构建（from scratch）"，React 官方文档目前点名三个构建工具：**Vite、Parcel、RSbuild**。其中 Vite 社区生态最大、也是 react.dev 从零构建指南的主要演示对象，是默认首选：

```bash
# JavaScript
npm create vite@latest my-app -- --template react

# TypeScript（推荐）
npm create vite@latest my-app -- --template react-ts
```

注意：Vite 当前文档（v8.2.1）要求 **Node.js 20.19+ 或 22.12+**。

两个需要知道的官方提醒：

1. **从零构建 = 自己做框架该做的事**。官方 from-scratch 指南明确了后续要自己选型补齐：路由（推荐 React Router 或 TanStack Router）、数据获取（TanStack Query / SWR / RTK Query）、代码分割、渲染模式（SPA/SSR/SSG）。官方原话：这条路"often is the same as building your own adhoc framework"（相当于自造一个临时框架）。
2. **官方的经验法则**："if your app needs routing, you would probably benefit from a framework"（需要路由就多半适合用框架）。react.dev 同时强调其推荐的框架（Next.js、React Router v7、Expo）**并不强制要求服务器**，都可以纯 SPA/静态方式部署——所以"React Router v7 框架模式"其实也满足"纯前端"诉求，只是你已经明确排除大框架，那么 **Vite + 手动加 React Router** 就是最贴合官方建议的答案。

## Evidence Used（证据来源）

### 官方 / 上游来源

- https://react.dev/blog/2025/02/14/sunsetting-create-react-app （中文版：https://zh-hans.react.dev/blog/2025/02/14/sunsetting-create-react-app ）
  — React 官方博客《Sunsetting Create React App》（2025-02-14）。核心原句："Today, we're deprecating Create React App for new apps, and encouraging existing apps to migrate to a framework, or to migrate to a build tool like Vite, Parcel, or RSBuild." 弃用原因是 "Create React App currently has no active maintainers"。该文确立了：新应用弃用 CRA、两条迁移路径（框架 / 构建工具）、CLI 会打印弃用警告、以及"需要路由就考虑框架"的经验法则。
- https://react.dev/learn/start-a-new-react-project
  — 官方"启动新 React 项目"指南。确立当前推荐顺序：优先框架（Next.js、React Router v7、Expo；另有 Beta 的 TanStack Start、RedwoodSDK），并强调这些框架不强制服务端；对不用框架的场景，官方指向 from-scratch 指南，点名 Vite、Parcel、RSbuild。该页面已完全不再提及 Create React App。
- https://react.dev/learn/build-a-react-app-from-scratch
  — 官方"从零构建 React 应用"指南（对应"纯 React、不上框架"的场景）。给出三种构建工具的初始化命令：Vite `npm create vite@latest my-app -- --template react-ts`、Parcel `npm install --save-dev parcel`、Rsbuild `npx create-rsbuild --template react`；并给出路由（React Router/TanStack Router）、数据获取（TanStack Query/SWR/RTK Query）、代码分割与渲染模式的官方选型建议。
- https://github.com/facebook/create-react-app
  — CRA 上游仓库 README。顶部标注 Deprecated，原句："it is now in long-term stasis and we recommend that you migrate to one of React frameworks documented on Start a New React Project"。仓库未归档，但为社区志愿维护（约 1.9k open issues、553 open PRs）。
- https://create-react-app.dev/docs/getting-started/
  — CRA 官网文档。顶部横幅原文："Create React App is deprecated. Read more here."（链接指向 react.dev/link/cra → 官方弃用博客）。页面标注最后更新 2022-04-28，Node 要求仍写着 >= 14，内容已明显停滞。
- https://vite.dev/guide/
  — Vite 官方文档。确立官方脚手架命令 `npm create vite@latest <name> -- --template react | react-ts`（另有 react-compiler 模板）；当前文档对应 Vite v8.2.1（大版本运行时基线日期 2026-01-01）；Node 版本要求 20.19+ / 22.12+。
- https://registry.npmjs.org/create-react-app （npm registry 元数据）
  — 确认 `create-react-app` 最新版本为 5.1.0，最后发布时间 2025-02-15（即弃用公告次日发布的维护版），包元数据最后变更 2025-05-07。证明 CLI 仍可安装运行，但已无实质迭代。

### 补充来源（第三方，仅作佐证，未用于替代官方来源）

- https://blog.csdn.net/Px01Ih8/article/details/145504141 、https://www.zhihu.com/question/12864122043/answer/107362013519 、https://www.reddit.com/r/reactjs/comments/wb9ia5/... — 中文社区对 CRA 弃用的讨论与 Vite 迁移实践，方向与官方一致（仅浏览搜索摘要，未作为结论依据）。

## Version / Date Context（版本与日期上下文）

- 调研执行日期：2026-08-16。
- CRA 弃用公告：2025-02-14；npm 最后版本 5.1.0 发布于 2025-02-15（维护模式，React 19 兼容），此后无新版本。
- CRA 官网文档最后更新：2022-04-28（内容停留在 Node >= 14 时代）。
- Vite：官方文档当前对应 v8.2.1（2026-01-01 基线），要求 Node 20.19+ 或 22.12+。
- react.dev 推荐列表中的版本状态：React Router v7（稳定）、TanStack Start（Beta）。
- 未知项：react.dev 各指南页面未标注具体更新日期（从内容看为 2025 年及以后的版本）；CRA 仓库未归档，理论上仍可能有维护性小版本，但官方口径是"长期停滞（long-term stasis）"。

## Repo-Local Context（仓库本地上下文）

不需要。当前仓库 `parking-agents`（G:\GIT\AI_WorkFlow\parking-agents）是一个 Claude 技能/钩子/脚本的工具仓库，非 React 项目；本问题针对一个全新项目，不涉及现有代码约束，故未做仓库内代码调研（仅列目录确认）。

## Boundaries / Non-goals（边界 / 不决定的事）

- 不做 Vite vs Parcel vs RSbuild 的深度依赖对比评测（那是 dependency-expert 的范畴；本文只按官方口径给出默认首选）。
- 不评判 Next.js / React Router v7 框架模式是否更适合你的业务（你已明确排除大框架）。
- 不包含具体实施：项目目录结构、ESLint/测试配置、CI 等落地细节未展开。

## Handoff（交接）

若采纳建议，下一步实施非常直接：运行 `npm create vite@latest my-app -- --template react-ts`（确认 Node 20.19+），然后按官方 from-scratch 指南补路由与数据获取选型（React Router + TanStack Query 是官方点名的常见组合）。如需完整规划（技术选型清单、目录规范、工程化配置），交给 `$ralplan`；如需直接执行搭建，交给 `$ultragoal` / `$team` / `executor`。本技能（best-practice-research）到此为止——只产出调研结论，不做任何实现或仓库修改。
