# 行为对照表: 2026-08-17-diagram-artifact

**确认版·锁定。** 执行 Agent 改的是产品，不是这份对照表。
用户确认：2026-08-16T18:41:27Z（整体放行，Q4 裁决后「请继续」）

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | `stage 2-prototype done`，impact-surface.md 写全六面、缺「架构与依赖」 | 六面全在即放行 done | 拒收：`impact-surface.md 没提到影响面「架构与依赖」。七面逐面扫，判「无」也要写下来。` |
| 2 | `stage 2-prototype skipped`，impact-surface.md 缺第七面 | 六面在盘 + `--reason` 即放行 | 拒收：`skipped 不豁免七面扫描。理由写进 impact-surface.md…` |
| 3 | `rebuild`，issue 的 impact-surface.md 无「架构与依赖」 | 2-prototype 保持 done | 降级为 in_progress；存量 issue 2026-08-16 已裁定补扫一行「架构与依赖：无（补扫）」豁免 |
| 4 | 契约引用 `2-prototype/diagram.html`，正文无「读什么」节 | 无告警（WARNING 正则只认 `mock*.html`） | WARNING：引用 HTML 对照物须有「读什么」节（正则扩为 `(mock\|diagram)*.html`） |
| 5 | aes-goal-contract 收集例子，盘上有 diagram.html | 例子池四行，无 diagram.html 消费规则 | 架构视图每处标注变化 = 例子：依赖断言进 `强约束` 或 `[A]`；流程视图不另立条目（对应 behavior.md 变化行） |
| 6 | aes-prototype 扫影响面 | 六面逐面扫 | 七面逐面扫：新增「架构与依赖」，判「有」必出 diagram.html 架构视图，判「无」写下来即可（不强制出图） |
| 7 | 边界值：`--artifacts "diagram"` 但 2-prototype/ 下无对应文件 | （新名）按三候选 `.md`/`.html`/原名查找 | 行为同既有开放命名：拒收并列出找过的候选——零代码改动的直接推论 |
| 8 | 边界值：impact-surface 写了「架构与依赖」四字但没写「有/无」判定 | 闸门放行（`includes` 只查字串在场） | 行为不变——闸门挡结构不挡质量，逐面判读仍由自评与用户确认负责 |

## 不变清单（谁在依赖它）

- rounds.jsonl 行 schema、三档 tier、pct 100±2 校验——访谈记录的既有格式依赖它，逐字节不动
- `--artifacts` 开放命名与三候选映射、`mock` 特例映射、`impact-surface` 凑数拒绝——本次零改动的正是这套机制
- manifest schema_version=1、tmp+rename 原子写、finalize 四件事、契约 mtime 复核——不动
- 六面既有校验逻辑与语义（仅「六面」字样→「七面」两处用户可见文案，已列变化行 1/2）——存量 issue 与习惯依赖
- 契约自包含不变量、过程文件拒收清单（`drafts/`、`manifest.json`、`rounds.jsonl`、`impact-surface.md`）——不动
- aes-interview 全部行为、asking.md 全部内容、eval 1/2/3 既有断言——不动
- 存量 issue 2026-08-16 的确认版产物——除 impact-surface.md 补扫一行外一字不动
- 六个命令 `init/round/stage/list/rebuild/finalize` 的用法与退出码语义——这条现在能跑，改完之后必须逐字节一样能跑

## 配置差异

（省略——无配置变化）
