# 执行过程简记 — eval-CRA脚手架现状 / without_skill / run-1

日期：2026-08-16

## 步骤

1. **Web 搜索**：`create-react-app deprecated official recommendation 2025 react.dev start a new react project`
   - 确认 CRA 于 2025-02-14 被 React 官方弃用；找到官方公告与 react.dev 推荐页等线索。
2. **抓取 react.dev 官方文档《Start a New React Project》**（https://react.dev/learn/start-a-new-react-project）
   - 页面已完全不提 CRA；官方推荐 Next.js / React Router v7 / Expo，另指路 "build from scratch"（Vite/Parcel/Rsbuild）给不要框架的场景。
3. **抓取 react.dev 官方博客《Sunsetting Create React App》**（https://react.dev/blog/2025/02/14/sunsetting-create-react-app）
   - 弃用时间（2025-02-14）、原因（无活跃维护者、缺路由/数据获取/代码分割）、迁移建议（框架或 Vite/Parcel/Rsbuild）、维护模式说明。
4. **抓取 react.dev 官方指南《Building a React App from Scratch》**（https://react.dev/learn/build-a-react-app-from-scratch）
   - Vite / Parcel / Rsbuild 的初始化命令，路由（React Router / TanStack Router）与数据获取（TanStack Query / SWR 等）选型建议。
5. **抓取 npm 包页面**（https://www.npmjs.com/package/create-react-app）— 返回 403，改走 npm registry API。
6. **Bash 查询 npm registry API**（registry.npmjs.org）
   - `create-react-app`：latest 5.1.0，2025-02-15 发布（弃用公告次日的收尾版）；此前正式版 5.0.1 停留在 2022-04-12；npm `deprecated` 字段未设置。
   - `react-scripts`：latest 5.0.1，2022-04-12。
7. **抓取 Vite 官方指南**（https://vite.dev/guide/）
   - `npm create vite@latest my-app -- --template react(-ts)` 命令、Node 20.19+/22.12+ 要求、react-compiler 模板变体。
8. **写入产物**：`outputs/report.md`（最终中文调研报告）与本文件 `transcript.md`。

## 引用的来源

- https://react.dev/blog/2025/02/14/sunsetting-create-react-app （官方弃用公告）
- https://react.dev/learn/start-a-new-react-project （官方起步推荐页）
- https://react.dev/learn/build-a-react-app-from-scratch （官方从零搭建指南）
- https://vite.dev/guide/ （Vite 官方 Getting Started）
- registry.npmjs.org 的 create-react-app / react-scripts 元数据（实测 API 查询）
- https://www.devclass.com/development/2025/02/18/react-team-formally-deprecates-create-react-app-following-perfect-storm-of-incompatibility/1631009 （辅助佐证，来自搜索结果）

## 读取的本地文件

- 无（纯网络调研任务）。

## 产物

- `outputs/report.md` — 最终中文调研报告
- `transcript.md` — 本执行记录
