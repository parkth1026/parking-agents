# Transcript: best-practice-research — CRA 脚手架现状调研（with_skill / run-1）

任务：新项目搭纯 React 前端，`npx create-react-app` 是否还可行？官方现在推荐怎么起项目？（要求有出处的中文建议）
执行日期：2026-08-16

## 步骤记录

### 1. 读取技能文件
- 读取 `G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\best-practice-research\SKILL.md`（完整 88 行）。
- 按技能要求分类问题：**官方推荐 + 版本/迁移现状类**（external evidence 为主），需走 Workflow：分类 → （如需）explore 本地事实 → researcher 收集官方/上游证据 → 按输出契约综合 → 停止。
- 遵守 Source-Quality Rules：官方/上游优先、给出处 URL、标注版本/日期、第三方仅作补充、不过度抓取。

### 2. 仓库本地事实（explore 步骤）
- `ls G:\GIT\AI_WorkFlow\parking-agents` → 内容为 GEMINI.md / README.md / docs / gemini-extension.json / hooks / package.json / scripts / skills / tests，是一个 agent 技能工具仓库，非 React 项目。
- 结论：问题针对全新项目，仓库本地上下文 **not needed**（写入报告 Repo-Local Context 一节）。

### 3. 外部证据收集（researcher 步骤，官方来源优先）

按顺序抓取/检索了以下来源（WebFetch 为主，两次 WebSearch 补充，一次 npm registry API 查询）：

1. **https://react.dev/learn/start-a-new-react-project**（WebFetch）
   - 提取：官方推荐先用框架（Next.js、React Router v7、Expo；TanStack Start Beta、RedwoodSDK）；"Full-stack frameworks do not require a server"；不用框架时官方指向 from-scratch 指南并点名 Vite/Parcel/RSbuild；该页已完全不提 CRA。
2. **https://github.com/facebook/create-react-app**（WebFetch，上游 README）
   - 提取：README 顶部标注 Deprecated，原句 "long-term stasis... migrate to one of React frameworks documented on Start a New React Project"；仓库未归档、社区志愿维护、1.9k open issues。
3. **https://create-react-app.dev/docs/getting-started/**（WebFetch，CRA 官网）
   - 提取：顶部横幅 "Create React App is deprecated. Read more here." → 指向 react.dev/link/cra；文档最后更新 2022-04-28，Node >= 14（内容停滞佐证）。
4. **https://react.dev/link/cra**（WebFetch，追踪官方弃用说明跳转）
   - 跳转到官方博客 **《Sunsetting Create React App》** https://react.dev/blog/2025/02/14/sunsetting-create-react-app（2025-02-14，Matt Carroll & Ricky Hanlon）。
   - 核心原句："Today, we're deprecating Create React App for new apps, and encouraging existing apps to migrate to a framework, or to migrate to a build tool like Vite, Parcel, or RSBuild."；弃用原因 "no active maintainers"；CLI 打印弃用警告；两条迁移路径；经验法则 "if your app needs routing, you would probably benefit from a framework"。
5. **https://www.npmjs.com/package/create-react-app**（WebFetch）→ 403 失败；改用 npm registry API：
6. **https://registry.npmjs.org/create-react-app**（Bash curl + python 解析）
   - 结果：latest = 5.1.0，最后发布 2025-02-15（弃用公告次日的维护版），modified 2025-05-07。
7. **https://vite.dev/guide/**（WebFetch，Vite 官方文档）
   - 提取：`npm create vite@latest my-app -- --template react | react-ts`（另有 react-compiler 模板）；文档对应 v8.2.1（基线 2026-01-01）；Node 20.19+ / 22.12+。
8. **WebSearch #1**：`react.dev "build a React app from scratch" guide Vite`
   - 定位官方从零构建指南确切 URL：https://react.dev/learn/build-a-react-app-from-scratch
9. **https://react.dev/learn/build-a-react-app-from-scratch**（WebFetch）
   - 提取：三种构建工具命令（Vite `--template react-ts`、Parcel、`npx create-rsbuild --template react`）；后续步骤为路由（React Router/TanStack Router）、数据获取（TanStack Query/SWR/RTK Query）、代码分割、渲染模式；"building your own adhoc framework" 警示。
10. **WebSearch #2**：`Create React App deprecated 2026 官方 替代 脚手架`
    - 确认 2026 年口径未变（CRA 弃用、Vite 为主流替代）；获得官方博客中文版链接 zh-hans.react.dev 及 CSDN/知乎/Reddit 第三方讨论（仅标记为补充来源）。

### 4. 综合 & 产出
- 按技能 Output Contract（Direct Recommendation / Evidence Used / Version-Date Context / Repo-Local Context / Boundaries / Handoff）撰写中文报告。
- 产物保存：`...\run-1\outputs\report.md`。
- 结论一句话：**CRA 已于 2025-02-14 被官方弃用（无维护者，最后版本 5.1.0 仅维护模式），不要用于新项目；纯 React 前端按官方 from-scratch 路径首选 Vite：`npm create vite@latest my-app -- --template react(-ts)`，注意 Node 20.19+/22.12+。**
- 按技能 Stop Rules：结论已可复用，停止；不做任何实现（Handoff 指向 $ralplan / $ultragoal / $team / executor）。

## 引用来源清单

官方/上游（报告主要依据）：
- https://react.dev/blog/2025/02/14/sunsetting-create-react-app （中文版 https://zh-hans.react.dev/blog/2025/02/14/sunsetting-create-react-app ）
- https://react.dev/learn/start-a-new-react-project
- https://react.dev/learn/build-a-react-app-from-scratch
- https://github.com/facebook/create-react-app
- https://create-react-app.dev/docs/getting-started/
- https://vite.dev/guide/
- https://registry.npmjs.org/create-react-app

补充（第三方，仅佐证）：
- https://blog.csdn.net/Px01Ih8/article/details/145504141
- https://www.zhihu.com/question/12864122043/answer/107362013519
- https://www.reddit.com/r/reactjs/comments/wb9ia5/what_are_use_cases_to_not_use_createreactapp_but/
