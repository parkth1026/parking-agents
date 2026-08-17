# 执行过程简记 — React 19 数据获取官方推荐调研（without_skill / run-1）

日期：2026-08-16

## 任务
调研 React 官方对组件内用 `useEffect` 做数据获取的推荐做法，以及 React 19 后的官方替代方案，产出带出处的中文简报。

## 执行步骤

### 第 1 步：检索官方对 useEffect 数据获取的立场（3 个并行检索）
- WebFetch `https://react.dev/reference/react/useEffect`（官方 API 文档）
  → 获得 "Fetching data with Effects" Deep Dive：四大缺点（Effect 不在服务端运行、网络瀑布流、无预加载/缓存、人体工学差易竞态）+ 三层推荐（框架内置机制 → 客户端缓存库 TanStack Query/useSWR/React Router 6.4+ → 继续在 Effect 里直接 fetch）+ `ignore` 标志清理写法。
- WebFetch `https://react.dev/learn/synchronizing-with-effects`（官方教程）
  → 确认 "Fetching data" 一节：清理函数应中止请求或忽略结果；开发模式 StrictMode 双请求属正常；最佳方案是带去重与缓存的方案。
- WebSearch「React 19 official recommendation data fetching useEffect alternative use hook React Server Components」
  → 定位到官方 `use` 文档的 "Reading a Promise with use vs fetching in an Effect" 对比章节（react.dev/reference/react/use），并收集到若干社区参考（仅作线索，未作为结论依据）。

### 第 2 步：核实 React 19 官方新能力（2 个并行检索）
- WebFetch `https://react.dev/reference/react/use`（官方 API 文档）
  → `use` 与 `useEffect` 取数的官方对比（Suspense/Error Boundary 自动管理 loading/error）；限制：不是 Hook 可条件调用、必须在组件/Hook 中调用、Promise 必须缓存、不能渲染中现建 Promise、不能 try-catch、刷新需 `startTransition`；Server/Client Component 用法差异。
- WebFetch `https://react.dev/blog/2024/12/05/react-19`（React 19 官方发布博客）
  → React 19 引入 `use`、Server Components、Server Actions、`useActionState`/`useOptimistic`；关键原文："use does not support promises created in render ... except via a Suspense-compatible library or framework"。

### 第 3 步：补齐两个关键官方页面（2 个并行检索）
- WebFetch `https://react.dev/learn/you-might-not-need-an-effect`（官方教程）
  → 确认数据获取是 Effect 的合法用途（与外部系统同步），官方不建议搬进事件处理器；竞态修复示例；建议封装自定义 Hook（useData）。
- WebFetch `https://react.dev/reference/react/cache`（官方 API 文档）
  → `cache` 仅限 Server Components；请求去重、预加载模式、缓存按请求失效、浅相等缓存键等注意事项。

### 第 4 步：核实 Suspense 官方边界（1 个检索）
- WebFetch `https://react.dev/reference/react/Suspense`（官方 API 文档）
  → 激活 Suspense 的取数方式（框架加载、`use` 读取缓存 Promise、RSC 流式数据）；关键原文："Suspense does not detect when data is fetched inside an Effect or event handler"。

### 第 5 步：撰写产物
- 创建输出目录并写入 `outputs/report.md`：中文简报，含 TL;DR、官方现行立场（缺点/三层推荐/合法用途/最小正确写法）、React 19 新选项（use、Suspense、cache+RSC、Server Actions）、决策树、升级行动建议、7 条官方来源清单（全部 react.dev，含原文引用）。

## 引用来源（全部为 react.dev 官方页面，访问日期 2026-08-16）
1. https://react.dev/reference/react/useEffect — useEffect 参考与取数 Deep Dive
2. https://react.dev/learn/synchronizing-with-effects — 取数清理与双请求说明
3. https://react.dev/reference/react/use — use 与 useEffect 取数官方对比
4. https://react.dev/blog/2024/12/05/react-19 — React 19 发布博客
5. https://react.dev/learn/you-might-not-need-an-effect — Effect 合法用途与自定义 Hook 建议
6. https://react.dev/reference/react/cache — cache API（仅 RSC）
7. https://react.dev/reference/react/Suspense — Suspense 激活条件

另：WebSearch 返回的社区链接（SitePoint / Dev.to / Medium / Stack Overflow 等）仅用于定位官方文档线索，未写入报告结论。

## 关键结论
- 官方未禁止/未废弃 useEffect 取数；推荐层级为：框架内置 > 客户端缓存库（官方点名 TanStack Query/useSWR/React Router 6.4+）> 继续 Effect 兜底。
- React 19 新选项（`use`、RSC+`cache`、Server Actions）主要面向框架/服务端场景；`use` 在无框架的客户端项目里不能直接替换 `useEffect`（Promise 必须缓存、不支持渲染中创建）。
- Effect 中的 fetch 不会触发 Suspense（官方原文确认）。

## 产物
- 报告：`outputs/report.md`
