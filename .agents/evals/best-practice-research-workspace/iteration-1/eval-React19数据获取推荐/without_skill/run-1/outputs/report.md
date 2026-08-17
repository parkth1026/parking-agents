# React 19 数据获取官方推荐做法调研简报

> 调研日期：2026-08-16
> 调研范围：React 官方文档（react.dev）与 React 官方博客，全部结论均附官方出处
> 用途：为项目升级 React 19 后的数据获取代码改造提供决策依据

---

## 一、结论摘要（TL;DR）

1. **官方从未"禁止"用 `useEffect` 获取数据**。`useEffect` 参考文档明确写道："You can continue fetching data directly in Effects if neither of these approaches suit you."（如果前述方案都不适合你，可以继续在 Effect 中直接获取数据。）`useEffect` 数据获取在 React 19 中**没有被废弃、没有被移除**。
2. 官方推荐是一个**三层优先级**，且这个立场在 React 19 发布前后是一致的：
   - **首选**：用框架内置的数据获取机制（如 Next.js 等）；
   - **次选**：用客户端缓存库——官方点名 **TanStack Query、useSWR、React Router 6.4+**（也可自建，底层仍是 Effect，但需自己补齐去重、缓存、防瀑布流）；
   - **兜底**：继续在 Effect 里直接 fetch，但必须正确处理清理与竞态。
3. React 19 提供了**新的官方数据获取能力**，但它们主要面向**框架 / Server Components 场景**，对纯客户端 SPA 不是"一键替换品"：
   - **`use` API**：在渲染中读取 Promise（配 Suspense / Error Boundary 自动管理 loading 与 error）；
   - **Server Components + `cache`**：在服务端获取数据并做请求去重；
   - **Server Actions + `useActionState` / `useOptimistic`**：面向"数据变更"（写操作）而非读取。
4. 官方明确指出：**"Suspense 无法感知在 Effect 或事件处理器中发起的数据获取"**——也就是说，保留 `useEffect` 取数的组件无法享受 Suspense 的声明式加载体验，这是迁移到新方案的核心收益点之一。

**对升级决策的一句话建议**：React 19 升级本身**不要求**重写现有 `useEffect` 取数代码；是否迁移应按"是否用框架 / 是否有服务端渲染需求 / 是否需要缓存去重"来分层决策（见第五节）。

---

## 二、官方对 `useEffect` 数据获取的现行立场

### 2.1 官方承认它常用，但列出四大缺点

`useEffect` 官方参考文档（"Fetching data with Effects" Deep Dive）原文：

> "Writing `fetch` calls inside Effects is a popular way to fetch data... This is, however, a very manual approach and it has significant downsides"

四大缺点（官方原文翻译）：

| # | 缺点 | 说明 |
|---|------|------|
| 1 | **Effect 不在服务端运行** | 首屏服务端渲染的 HTML 只含加载态、没有数据；客户端要下载全部 JS 并渲染后才开始取数，低效 |
| 2 | **容易产生网络瀑布流（network waterfalls）** | 父组件渲染→取数→子组件渲染→再取数，串行而非并行，慢网下明显变慢 |
| 3 | **没有预加载（preload）和缓存** | 组件卸载再挂载就要重新取数 |
| 4 | **人体工学差** | 要写大量样板代码才能避免竞态条件（race conditions）等 bug |

官方特别强调：**这些缺点不是 React 特有的**——"It applies to fetching data on mount with any library."

来源：[useEffect 参考 — react.dev](https://react.dev/reference/react/useEffect)

### 2.2 官方推荐的三层替代方案（原文顺序）

1. **"If you use a framework, use its built-in data fetching mechanism."**
   现代全栈 React 框架（文档指向 [full-stack frameworks 列表](https://react.dev/learn/creating-a-react-app)）内置的数据获取机制高效且没有上述陷阱。
2. **"Otherwise, consider using or building a client-side cache."**
   官方点名的开源方案：**TanStack Query、useSWR、React Router 6.4+**；自建的话底层仍会用 Effect，但必须补上请求去重、响应缓存、避免瀑布流。
3. **"You can continue fetching data directly in Effects if neither of these approaches suit you."**
   兜底方案：继续直接在 Effect 里 fetch。

来源：[useEffect 参考](https://react.dev/reference/react/useEffect)、[Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)（两页 Deep Dive 内容一致）

### 2.3 官方同时确认：数据获取是 Effect 的合法用途

《You Might Not Need an Effect》（你未必需要 Effect）官方教程对数据获取的立场**比传言更温和**：

> "You can also fetch data with Effects: for example, you can synchronize the search results with the current search query. Keep in mind that modern frameworks provide more efficient built-in data fetching mechanisms than writing Effects directly in your components."

即：把"搜索结果与当前查询同步"这类需求写在 Effect 里是**符合 React 范式的**（Effect 的本职是"与外部系统同步"），只是框架内置机制效率更高。官方还明确说**不要**把这类 fetch 搬进事件处理器（因为数据来源可能是 URL、前进/后退导航等，不只来自输入事件）。

来源：[You Might Not Need an Effect — react.dev](https://react.dev/learn/you-might-not-need-an-effect)

### 2.4 如果继续用 `useEffect` 取数，官方要求的最小正确写法

两份官方文档给出了必须满足的规范——**清理函数防止竞态**（`ignore` 标志模式）：

```js
useEffect(() => {
  let ignore = false;
  async function startFetching() {
    const json = await fetchTodos(userId);
    if (!ignore) {
      setTodos(json);
    }
  }
  startFetching();
  return () => {
    ignore = true;  // 清理：作废过期的响应
  };
}, [userId]);
```

- "If your Effect fetches something, the cleanup function should either abort the fetch or ignore its result"（应中止请求或忽略其结果；请求本身无法"撤销"，但要保证不再影响应用）。
- 开发模式下 StrictMode 会看到**两次请求，这是正常的**（"There is nothing wrong with that"）；如果这困扰你，官方回答是"用带请求去重和缓存的方案"。
- 官方还建议：直接在 Effect 里写 fetch 重复且难优化，**应封装成自定义 Hook**（如 `useData(url)`），"The fewer raw `useEffect` calls you have in your components, the easier you will find to maintain your application."

来源：[Synchronizing with Effects — Fetching data](https://react.dev/learn/synchronizing-with-effects)、[You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

---

## 三、React 19 带来的官方新选项

### 3.1 `use` API：渲染中读取 Promise（读取场景的官方新方案）

React 19 发布博客："In React 19 we're introducing a new API to read resources in render: `use`."

官方参考文档专门有一节 **"Reading a Promise with use vs fetching in an Effect"** 做并排对比：

```js
// 新写法：use + Suspense
function Albums() {
  const albums = use(fetchData('/albums'));  // fetchData 必须是缓存过的函数
  return <ul>{albums.map(a => <li key={a.id}>{a.title}</li>)}</ul>;
}
// 外层：<Suspense fallback={<Loading />}> + <ErrorBoundary>
```

官方对比结论：

> "Compared to `use`, this approach [useEffect] requires managing loading and error states manually."

即 `use` 方案由 Suspense 自动展示加载态、由 Error Boundary 自动接管错误，不需要手写 `isLoading` / `error` state。

**关键限制（决定它能否直接替换你们的 useEffect 代码）：**

1. **不能在渲染中现创建 Promise**——`use(fetch('/albums'))` 是官方标出的错误用法；Promise 必须**缓存**（同一实例跨渲染复用），否则每次渲染都重新挂起、fallback 反复闪烁。
2. React 19 博客原文明确："**`use` does not support promises created in render.** ... Creating promises inside a Client Component or hook is not yet supported, **except via a Suspense-compatible library or framework**." —— 也就是说，**没有框架/兼容库配合时，`use` 不能独立完成客户端数据获取**。
3. 理想的 Promise 创建时机在渲染之前："in an event handler, a route loader, or a Server Component"——渲染中惰性创建会延迟请求并造成瀑布流。
4. `use` 不能包在 try-catch 里（错误必须用 Error Boundary 处理）；刷新数据要配合 `startTransition` 把新 Promise 存入 state。
5. 亮点：`use` 虽然名字像 Hook，但**可以在条件语句 / 循环中调用**。

来源：[use 参考 — react.dev](https://react.dev/reference/react/use)、[React 19 发布博客](https://react.dev/blog/2024/12/05/react-19)

### 3.2 Suspense 与数据获取的官方关系（重要边界）

Suspense 官方参考明确列出了能激活 Suspense 边界的取数方式：

> "Reading a Promise with `use`, including data streamed from Server Components or loaded through a **Suspense-enabled framework**."

并解释框架在底层做什么：

> "Under the hood, a Suspense-enabled framework maintains a cache of Promises and calls `use` to suspend on a Promise."

同时给出关键负面结论：

> "Suspense **does not detect when data is fetched inside an Effect or event handler**."

即：**`useEffect` 里的 fetch 永远不会触发 Suspense fallback**。这是"继续用 Effect"与"迁到新方案"在体验上的本质差异之一。

来源：[Suspense 参考 — react.dev](https://react.dev/reference/react/Suspense)

### 3.3 Server Components + `cache`：服务端获取与请求去重

- `cache` 官方定位："`cache` lets you cache the result of a data fetch or computation."
- **仅限 Server Components**："`cache` is for use in Server Components only."，且缓存**每个服务端请求间失效**。
- 典型用法：`const getTemperature = cache(async (city) => fetchTemperature(city))` —— 多个组件取同一数据只发一次请求（请求去重）；还支持"先调用不 await"的**预加载（preload）**模式提前发起请求、并行化渲染。
- Server Component 内可直接 `await` 数据；把 Promise 作为 prop 传给 Client Component，后者用 `use` 解包（"Client Components can't `await` during render, so they unwrap the Promise with `use` instead."）。

来源：[cache 参考 — react.dev](https://react.dev/reference/react/cache)、[use 参考 — Server/Client 对比](https://react.dev/reference/react/use)

### 3.4 Server Actions / `useActionState` / `useOptimistic`：面向"写"而非"读"

React 19 的 Actions 体系解决的是**数据变更**（表单提交等）的 pending 状态、错误、乐观更新与顺序请求问题——官方称这些过去"需要手动处理"。它不替代读取型数据获取，但升级后可以把原来挂在 `useEffect` 里的"提交后刷新"逻辑交给 `useActionState`。

来源：[React 19 发布博客](https://react.dev/blog/2024/12/05/react-19)

---

## 四、官方立场的完整决策树

```
你们的组件需要获取数据
│
├─ 用了全栈框架（Next.js 等）？
│    └─ 是 → 【官方首选】用框架内置数据获取 / RSC + cache，
│            Client 端用 use 解包服务端传来的 Promise
│
├─ 纯客户端 SPA（无框架）？
│    ├─ 需要缓存 / 去重 / 竞态防护 / 失败重试？
│    │    └─ 是 → 【官方次选】TanStack Query / useSWR / React Router 6.4+
│    │
│    ├─ 想用 use + Suspense？
│    │    └─ 前提：有 Suspense 兼容库/框架帮你缓存 Promise
│    │       （官方：use 不支持渲染中创建的 Promise）
│    │
│    └─ 都不满足 → 【官方兜底】继续 useEffect + 清理函数（ignore 标志），
│             并封装成自定义 Hook（useData），留好日后替换的口子
```

---

## 五、对本次升级的具体建议

按官方文档口径，给出分场景行动项（供决策参考）：

1. **升级本身零强制改动**：React 19 没有废弃 `useEffect` 取数，现有代码可以先原样升级、再渐进改造。
2. **盘点现有 `useEffect` 取数代码，先补两类官方要求的正确性措施**（无论是否迁移都应做）：
   - 清理函数 + `ignore` 标志（或 `AbortController`）防竞态；
   - 把裸 fetch 封装进自定义 Hook（官方明确建议），为后续替换成 TanStack Query / `use` 降低成本。
3. **SPA 场景的"官方推荐终点"是引入 TanStack Query / useSWR**，而不是 `use`——官方对 `use` 的限制（Promise 必须缓存、不支持渲染中创建、需 Suspense 兼容库）决定了它在无框架客户端项目里不是开箱即用的 `useEffect` 替代品。
4. **如果项目计划迁到 Next.js / RSC 架构**，则取数逐步下沉到 Server Components（`await` + `cache` 去重），客户端组件用 `use` 接收 Promise，表单/变更用 Server Actions + `useActionState`。
5. **注意体验差异**：只要数据获取还在 Effect 里，就无法触发 Suspense 边界（官方明确说明）；迁移到 `use` / 框架方案才能获得声明式的加载/错误处理。

---

## 六、来源清单（全部为官方渠道，访问日期 2026-08-16）

| # | 来源 | 类型 | 关键内容 |
|---|------|------|----------|
| 1 | [useEffect 参考 — react.dev](https://react.dev/reference/react/useEffect) | 官方 API 文档 | 四大缺点、三层推荐方案（框架 / 客户端缓存 / 继续 Effect）、ignore 清理写法 |
| 2 | [Synchronizing with Effects — react.dev](https://react.dev/learn/synchronizing-with-effects) | 官方教程 | 取数清理函数规范、开发模式双请求说明、去重缓存推荐 |
| 3 | [You Might Not Need an Effect — react.dev](https://react.dev/learn/you-might-not-need-an-effect) | 官方教程 | 数据获取是 Effect 合法用途、竞态修复、自定义 Hook 封装建议 |
| 4 | [use 参考 — react.dev](https://react.dev/reference/react/use) | 官方 API 文档 | "use vs fetching in an Effect" 官方对比、Promise 缓存要求、Server/Client 用法 |
| 5 | [React 19 发布博客 — react.dev](https://react.dev/blog/2024/12/05/react-19) | 官方博客 | React 19 新增 `use`、Server Components、Server Actions、`use` 不支持渲染中创建的 Promise |
| 6 | [Suspense 参考 — react.dev](https://react.dev/reference/react/Suspense) | 官方 API 文档 | 激活 Suspense 的取数方式；Effect/事件中的 fetch 不触发 Suspense |
| 7 | [cache 参考 — react.dev](https://react.dev/reference/react/cache) | 官方 API 文档 | `cache` 仅限 Server Components、请求去重、预加载模式 |

> 注：TanStack Query / useSWR / React Router 6.4+ 为**官方文档点名的生态推荐**，其本身并非 React 官方出品；本简报结论均以上表官方页面原文为依据。
