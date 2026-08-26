# Design QA: AES 需求星图 700×1000 竖屏工作台 v4

- Source visual truth: `docs/design/design_handoff_issue_starmap/需求星图 7a.dc.html`
- Source SHA-256: `2703B1A632292A1AD4927D2BFD6E57384E234248B5E6EF59C9AA11128435B98A`
- Behavior source: `behavior.md` B23–B26
- Implementation: `mock.html`
- Implementation SHA-256: `1A94A5291A37D3969E71E245AFD8399425CA80E13839260A451FC7CD7D736CF4`
- Browser: Headless Chromium `151.0.7922.138` on Windows
- Device scale factor: `1`
- Run time: `2026-08-26T15:02:58+08:00`
- Exact visual baseline: `700×1000` CSS px / screenshot px
- Adjacent portrait smoke: `640×960` and `768×1024`
- Previous `390×844` result: superseded; preserved in `design-qa-390-history.md` and `qa/`
- State: user confirmation candidate

## Baseline correction

用户要的是约 `700×1000` 的中尺寸竖屏页面，不是 `390×844` 小手机。v3 的外壳虽是
竖屏，SVG 却永久使用 390 宽坐标系；显示在 700 像素宽时只会整体放大手机稿。v4 改为：

- `.app` 精确基线为 `700×1000`；
- `ResizeObserver` 从图谱真实 DOM rect 同步 `frameWidth` 与 `frameHeight`；
- SVG `viewBox`、节点 x/y、星点、zoom 中心、wheel/pan/pinch 坐标均使用当前容器坐标；
- `640×960` 时原生 `viewBox=0 0 640 644`；`768×1024` 时居中呈现
  `700×1000` 工作台，`viewBox=0 0 700 684`；
- 旧 390 截图、报告与 rounds 继续保留，但不再拥有当前验收权威。

## Visual evidence

| Evidence | State | Pixels | SHA-256 |
| --- | --- | ---: | --- |
| `qa-700/00-desktop-reference.png` | 原 desktop 视觉真源，仅用于语言/拓扑对照 | 1440×900 | `882B2B5AC09D85E8E8E113E121BB60D4ECAA17C2B5AF8F8E237660C1EB09DD3B` |
| `qa-700/01-portrait-overview.png` | 700 原生概览 | 700×1000 | `B666C43F7953C90AA09A95FFC0964754D7A74ABA94A48859FEA849DDAA2FC31D` |
| `qa-700/02b-one-hop-peek-final.png` | #58 真实一跳 + peek，顶栏完整；新路径排除旧截图缓存 | 700×1000 | `1AEDD014F796A5032533FFB53F65EE0EA013BD28FC53FCC75262B1543AC0B488` |
| `qa-700/03-human-full.png` | #7 awaiting-human 完整证据 | 700×1000 | `7CD53F8DEDAD30D7F2A3C10710DA4BF1223ABAE37A65D5593EEDBE2E4ACD1D97` |
| `qa-700/04-list.png` | 单列 List | 700×1000 | `A785EBF7AB6F2485BD5BB4F206C01B9EF871F77DE1D353928E73046A257EB542` |
| `qa-700/05-runners.png` | Runner slot drawer | 700×1000 | `FCAA704C007A10AE3651E89E965BD6B8AC0E52E8E88023FF026B7A8B4DDF607D` |
| `qa-700/06-adjacent-640x960.png` | 较窄相邻竖屏 | 640×960 | `6EFAE77E280BE6286F5F00C6D44964471F6F77BEEC394721B966CD21595E064D` |
| `qa-700/07-adjacent-768x1024.png` | 较宽相邻竖屏 | 768×1024 | `57992A444787E4427D0803FEE4D3EE0139B01409F721E2D45ACF508635059188` |

截图流程：固定 viewport → `prefers-reduced-motion: reduce` → 等待 `document.fonts.ready` →
进入指定状态 → `page.screenshot({scale: "css"})` → SHA-256。已验证 Segoe UI、Microsoft
YaHei、Cascadia Mono、Georgia 四个字体族均可用。

`02-one-hop-peek.png` 与 `02b-one-hop-peek-final.png` 当前字节相同、SHA 相同；正式清单使用
新路径，避免视觉审查工具继续显示路径缓存中的旧版缺顶栏截图。现场几何为 `scrollY=0`、
`h1.top=10`、`graph.top=258`，且 `01` 与 `02b` 的顶部 258 行逐像素相同。

## Layout and fidelity results

- Exact baseline geometry: viewport `700×1000`，app rect `0,0,700,1000`，graph rect
  `0,258,700,684`，SVG `viewBox="0 0 700 684"`，document scroll extent `700×1000`。
- Graph composition: 顶部控制区、五态图例、纵向依赖图、底部工具形成稳定三段节奏；节点
  按 700 宽原生分布，未等比放大 390 坐标。
- Contrast correction: 默认边相对纸面约 `3.33:1`，focused 边约 `5.15:1`，blocking 边约
  `4.46:1`；blocked/resolved 12–13px ID 使用约 `5.23:1` 的文本色。
- One-hop: 选择 #58 后只保留 #47/#53/#58/#60/#61 为可交互节点，真实揭示折叠的 #60；
  相关边突出，非邻居退出辅助技术树，peek 不遮挡中心与一跳标签。
- Pointer focus: 鼠标/触控选择 SVG 节点不会触发 viewport 自动滚动，仍把焦点转移到新节点；
  pointer focus 不伪装成键盘 focus-visible，键盘 Tab/Enter 保留可见焦点环。
- Details/List/Runner: #7 完整 sheet 显示人工验收证据；List 显示全部十条记录；Runner
  drawer 显示五个固定 slot、quarantine、idle 与 legacy archive。

## Mechanical interaction evidence

在干净 `700×1000` 浏览器会话通过：

- 十条 Issue 的 id/title/candidate 逐条同源绑定；缺失 candidate 显示
  `未产生 / NOT_RUN`，没有跨 Issue 串证据；
- Map/List、五态过滤、搜索、List → Map、Runner 定位、sheet/drawer 初始焦点与恢复；
- Map → List、打开 Runner 都清除 selection/expansion/detail，返回 Map 后不会留下分裂状态；
- `frontier` 过滤下定位 worker-1/#58 会先清除不兼容 filter，再使节点
  `aria-hidden=false`、`tabIndex=0`、`aria-selected=true` 并聚焦；
- 节点 Enter/Space 真实一跳，再次操作折叠；zoom、单指拖拽、wheel 坐标通过；
- 离中心双指缩放保持锚点：起点 `(130,192)`，`k=2.088061` 后仍映射到
  `(130,192)`；等距双指移动 `(+40,+30)` 得到 transform `(+40,+30,1)`；
- pinch → 单指 pan handoff 保持 `k=2.088`，后续移动 `(+40,+30)` 只改变 x/y；
- 700 → 640 resize 会把旧 pan/zoom 明确 reset 为 `(0,0,1)`，并更新
  `viewBox="0 0 640 644"`；
- 三档竖屏均无 document overflow；最终干净回归控制台 `0 errors / 0 warnings`；
- 内联 JavaScript 语法 PASS；HTML id 唯一性 PASS。

## Review finding closure

第一轮独立复审对 SHA `130F…F3970` 给出 BLOCK，所有可复现项已修：

1. 重新生成 02，顶栏完整且 `scrollY=0`；
2. 提高边线与 blocked/resolved 标签对比度；
3. pinch 改为以真实双指中点为锚点并支持双指平移与 pinch→pan；
4. Map/List/Runner 状态转换统一清除 selection/expansion/detail；
5. runner 定位清除不兼容 filter 后再渲染与聚焦；
6. ResizeObserver 在尺寸变化时明确 reset 旧 transform；
7. 主 QA 文档、截图清单、浏览器/DPR/字体/时间/哈希已绑定当前候选。

## Desktop and residual gaps

- `00-desktop-reference.png` 与 source SHA 证明当前对照所继承的 desktop 视觉/拓扑真源未被
  本轮编辑；当前修改只在独立的静态 prototype 目录。
- 真正产品的 desktop runtime 非回归在 prototype 阶段为 `NOT_RUN`，不能由参考截图冒充
  PASS；它继续作为实现阶段必须执行的 host-shaped/runtime debt，而不是本轮视觉原型 blocker。
- 当前仍是 `DEMO SNAPSHOT`，不连接真实 board API、GitHub 或 owner 日志。
- v4 只有用户明确确认后才成为锁定视觉真源；在此之前 2-prototype 保持 `in_progress`。

## Final independent rereview

- Designer: `PASS mockSha256=1A94…36CF4`；新路径 02b 的 `700×1000` 尺寸、SHA、完整顶栏、
  一跳图谱和 peek 状态全部确认。
- Code reviewer: `APPROVE SHA256=1A94…36CF4`；Standards PASS、Spec PASS、0 个可复现问题。
- Requirements verifier: `APPROVE artifactSha256=1A94…36CF4`；B23–B26 全部满足，desktop
  runtime 与真实 API 的 `NOT_RUN` debt 记录准确且不构成本轮 blocker。

三路 verdict 均绑定同一 mock SHA；任何后续 mock 或截图修改都会使本次批准失效。

final result: passed; awaiting user confirmation
