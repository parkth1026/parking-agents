# Design QA history: superseded 390×844 mobile candidate (v3)

> Historical evidence only. This was the complete verdict summary before the user corrected the target
> from a small-phone baseline to a roughly 700×1000 portrait workbench on 2026-08-26. The screenshots
> remain immutable under `qa/`; this file prevents the old QA rationale from being overwritten by v4.

- Implementation SHA-256: `EF0EF7FA69FD96FF6D46634D40FEB27F3728A000C4AB9D1E800C793988D0BB33`
- Browser: HeadlessChrome `151.0.0.0` on Windows
- Device scale factor: `1`
- Former locked viewport: `390×844`
- Compact smoke viewport: `320×568`
- State at supersession: designer `PASS`; code reviewer `APPROVE`; requirements verifier `PASS`

## Historical evidence

| Evidence | State | Pixels | SHA-256 |
| --- | --- | ---: | --- |
| `qa/00-reference-desktop.png` | 原 desktop 高保真参考 | 1440×900 | `882B2B5AC09D85E8E8E113E121BB60D4ECAA17C2B5AF8F8E237660C1EB09DD3B` |
| `qa/01-mobile-overview.png` | 390 概览 | 390×844 | `9B9B4762906D846F88A7688CDA05A36A08D8ACC5690441C41894447299A8205A` |
| `qa/02-mobile-one-hop-peek.png` | #58 一跳展开 + peek | 390×844 | `C02620DCF2329F54A6048267DB20586DB84B01CD1DBC70451F2D6C270896A62D` |
| `qa/03-mobile-human-full.png` | #7 awaiting-human 完整证据 | 390×844 | `40AE631AE8BE57E690C8A9EF92F2471E54E20F49C8F23444669326017C911232` |
| `qa/04-mobile-list.png` | 单列 List | 390×844 | `24F71F44641DE26275B8091F6C1AE6B2D273C0D1771932C5A7E68B856739627E` |
| `qa/05-mobile-runners.png` | runner drawer | 390×844 | `ED07E1DC9DE00A0A1738F85FABC7FD6496FE871A70688C9D9118F12127F5D0EA` |
| `qa/06-compact-portrait.png` | 320 #58 一跳 + peek | 320×568 | `DBF7D7A7FA11A88303BEA0A2680A89DF5EE561ECDC4C601E184DC5DB550D8B66` |
| `qa/07-desktop-preview-shell.png` | 桌面中的手机预览壳 | 1200×900 | `FE33307A6E85F1141FDFFA93ECF0B611494CD651DB90F2B30589AE1647994627` |
| `qa/08-compact-overview.png` | 320 概览 | 320×568 | `758C9643729FBF883D0987492C5FD04FA9FCD99BA07AA7B3F73483CEFEBE502C` |

## What v3 proved

- It replaced the original horizontal crop with a vertical graph, unified ten Issue records, labelled
  fixture data as `DEMO SNAPSHOT`, implemented a real one-hop expansion, separated worker beacons from
  node fading, and made Map/List/search/filter/runner/detail share one source of truth.
- It verified awaiting-human evidence, legacy archive semantics, safe-area handling, focus trapping and
  restoration, pointer/pinch transitions, hidden-node ARIA handling, and zero console errors/warnings.
- It did **not** prove the later 700×1000 requirement. Its SVG viewBox stayed 390 units wide and therefore
  only scaled a small-phone composition when shown at 700 pixels.

## Historical review chain

1. 初稿 BLOCK：横屏 SVG 裁切、详情串用 #58、伪 LIVE、desktop 语义错误、sheet 遮挡、beacon
   被淡出、List/search/filter/焦点/compact/生命周期与证据覆盖不完整。
2. 修订 v3：统一 Issue fixture、DEMO mode、真实一跳、独立 beacon layer、动态详情、
   List/search/filter、runner/full sheet、awaiting-human/legacy 架构边界。
3. 第一轮复审 BLOCK：修正 pulse 命中区、320 overflow、触控尺寸、状态条、human badge、
   drawer/detail 互斥与 compact 字号。
4. 第二轮复审 REQUEST CHANGES：修正同 Issue force-open、pinch→pan、top safe area、Markdown
   表格、diagram 陈旧引用、peek 复位、隐藏节点焦点与 overlay 辅助技术树。
5. 第三轮复审 REQUEST CHANGES：修正 runner focus 自动滚动、compact 几何碰撞、淡出节点
   aria-hidden、compact 下层标题与 sheet 间隙、scrim 收起后的焦点。
6. 最终独立复审：designer `PASS`；code reviewer `APPROVE`；requirements verifier `PASS`。

## Supersession reason

用户明确说明目标不是 `390×844` 小分辨率手机，而是约 `700×1000` 的竖屏页面。旧结果
保留用于技能演进和回归分析，但不能再被 contract 或执行 Agent 当作当前视觉真源。
