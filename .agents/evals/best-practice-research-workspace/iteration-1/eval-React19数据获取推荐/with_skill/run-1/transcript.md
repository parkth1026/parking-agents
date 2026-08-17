# 执行过程简记 — best-practice-research（React 19 数据获取推荐）

**日期：2026-08-16**

## 步骤

### 1. 读取技能文件
- 读取 `G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\best-practice-research\SKILL.md`，确认流程：分类问题 → （必要时）`explore` 收集仓库本地事实 → `researcher` 收集官方/上游证据 → 按输出契约综合 → 停止。要求：官方来源优先、给出 URL、注明版本/日期、不过度检索、只读不改仓库。

### 2. 问题分类
- 判定为"版本感知的实现指引"类（React 19 升级语境下 useEffect 数据获取的官方推荐 + 官方替代方案），需要官方上游证据。

### 3. 仓库本地事实（轻量 explore 替代：本会话直接检查）
- 读取 `G:\GIT\AI_WorkFlow\parking-agents\package.json`：本仓库是技能库（parking-skills），无 react/react-dom 依赖。
- Bash 全仓 grep：`react`/`react-dom` 依赖未命中；skills 目录中 `useEffect` 仅出现在 `skills/dev/dev-environment/SKILL.md`、`skills/pub/shadcn/SKILL.md` 两个技能文档文本里，非业务代码。
- 结论：仓库本地上下文记为"不需要/未适用"（待升级的 React 项目不在本仓库）。

### 4. 外部证据收集（全部为官方 react.dev 来源；检索日期 2026-08-16）
- WebFetch https://react.dev/learn/you-might-not-need-an-effect — 获取数据属于与外部系统同步、可留在 Effect；竞态需 cleanup + ignore；推荐抽自定义 Hook；框架内置数据获取更高效。
- WebFetch https://react.dev/reference/react/useEffect — "Fetching data with Effects" 示例；Deep Dive 列四大缺陷与替代方案（框架、TanStack Query/useSWR/React Router 6.4+、自定义 Hook；手动 Effect 为兜底）。
- WebFetch https://react.dev/blog/2024/12/05/react-19 — React 19（2024-12-05 稳定）：Actions、useActionState、useOptimistic、form actions、use()、Server Components/Actions、prerender；use() 的 Promise 缓存限制。
- WebFetch https://react.dev/reference/react/use — use() 详细限制：Promise 必须缓存、不能渲染中创建、不能 try-catch；无框架时模块级 Map 缓存示例。
- WebSearch（"react.dev blog React 19.1 19.2 release useEffectEvent data fetching"）→ 定位到官方 19.2 博文与 useEffectEvent 文档。
- WebFetch https://react.dev/blog/2025/10/01/react-19-2 — React 19.2（2025-10-01）：useEffectEvent（示例 + 滥用警告）、Activity、cacheSignal、partial pre-rendering、SSR Suspense 批量揭示；确认 19.1 为 2025-06、无数据获取 API 变化。
- WebFetch https://react.dev/reference/react/Suspense — 旧"暂不支持"警示已移除；无框架可用 use()+缓存 Promise；Effect/事件处理器中获取不激活 Suspense。
- WebSearch（最新版本确认）+ https://react.dev/versions / facebook/react GitHub Releases / npm — 截至 2026-08 最新稳定为 19.2.x（19.2.8，2026-07-21），无 React 20。

### 5. 综合
- 按技能输出契约（Direct Recommendation / Evidence Used / Version-Date Context / Repo-Local Context / Boundaries-Non-goals / Handoff）撰写中文简报。
- 核心结论：useEffect fetch 未被废弃（兜底可用，必须竞态清理）；官方优先级 = 框架 > 缓存库（TanStack Query/useSWR/React Router 6.4+）> 自定义 Hook > 手写 Effect；React 19 新替代：use()（需缓存 Promise）、Actions/useActionState/useOptimistic（写场景）、RSC（框架内）；19.2 的 useEffectEvent 辅助而非替代。
- 修正报告内一处 GitHub 链接笔误（facebook/react）。

### 6. 产物
- 报告：`...\eval-React19数据获取推荐\with_skill\run-1\outputs\report.md`
- 过程简记：本文件 `...\run-1\transcript.md`
- 未修改仓库任何源码（符合技能"terminal & read-only"要求；产物仅写入用户指定的工作区目录）。

## 引用来源清单
1. https://react.dev/learn/you-might-not-need-an-effect
2. https://react.dev/reference/react/useEffect
3. https://react.dev/blog/2024/12/05/react-19
4. https://react.dev/reference/react/use
5. https://react.dev/reference/react/Suspense
6. https://react.dev/blog/2025/10/01/react-19-2
7. https://react.dev/versions
8. https://github.com/facebook/react/releases（版本核对，补充）
9. https://www.npmjs.com/package/react（版本核对，补充）
