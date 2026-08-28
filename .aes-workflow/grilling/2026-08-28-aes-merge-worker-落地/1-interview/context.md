# Context Snapshot: aes-merge-worker-落地

- 创建：2026-08-28T20:30:00+08:00
- 分片来源：无，宿主直接调查

## 任务陈述
#126（aes-merge-worker 落地）范围边界访谈：#131 四项设计输入归属、live 验证轮拆分、载体形态待裁

## 用户提出的方案
未提出（要求对首轮 6 问草案做双向 steelman 后按本技能形式重问）

## 意图假设
任务陈述是「裁定范围」，真正要解决的是：#126 正文写于 #131 偏差清单产出之前，
范围段与最新事实（偏差 9/4/8/7、live 轮外部依赖、宿主 session 能力）之间的缝，
必须在开工前缝完，否则实现期每遇一条都要停下来回问。

## 已查事实
| 事实 | 出处 | 分类 |
| --- | --- | --- |
| master.mjs 机械层已全：claim/candidate/stage review/stage qa/terminal/gate/merge/verify/close/release/discovery/attempt/human | master.mjs 用法串 | Fact |
| 本票主体 = SKILL.md prose + 三个机械增量（血统检查、depthTier、review-return 路由） | #126 范围段 + 上行 | Fact |
| prose 契约已定稿且留「载体形态」「打回通道载体」两处待裁 | design.md:51-67 | Fact |
| 宿主实测：Claude 建不出可见 Desktop session（无 create_thread 等价物） | 记忆 claude-cannot-create-visible-desktop-session | Fact |
| #131 实测形态 = 编排侧人工顶替执行 merge，走通全链 | issue98-resolution-draft.md | Fact |
| 当前 registry：5 slot 全 QUARANTINED_MISSING、3 个 stale dispatched job、mergeQueue 空 | master.mjs status 实跑 | Fact |
| job-69-111801 不在当前 status 的 goal 里，close/release 积压去向待核（偏差 1/2 活例） | 同上 + resolution 草稿 | Fact |
| #132（分支 reset 事故票）已关，但 reconcile 机制无人接 | gh #132 CLOSED | Fact |
| #125（基线红同族，aes-qa 侧）、#119（血统检查，实现点已收编本票）、#114（分档 live 验证）均 OPEN | gh 实查 | Fact |
| pending 队列目录模式已在用（.aes-workflow/pending/） | 目录实存 | Fact |
| 偏差 9：close 与 gh comment 耦合，GitHub 故障 fail closed | #131 resolution | Fact |
| REPO_ROOT env 双向边界（设置 + 不泄漏 selftest）无文档 | #131 偏差 4 | Fact |

## 验证基建候选池
- `npm test` / run-tests 全量套件（commands file）——merge 后回归已由 #131 实跑过，代价：flaky 域（fixture/server 时序、board-ui SHA）需按 known-flaky 处理
- master.mjs selftest / fixture 场景——代价：REPO_ROOT env 不得泄漏
- 真实 mergeQueue live 轮——代价：需先有 worker 交付一张真 Issue 入队；MUST_FIX 场景需真实打回或人为注入
- 十域 post-merge verify 脚本——#131 实跑 PASS

## 四分类
- **Fact**：上表全部
- **User decision**：偏差 9 档位；live 轮拆分；载体形态 prose 写法（本轮提问区）；偏差 4/8/7 归属（默认区）
- **Agent-owned**：SKILL.md 章节结构、depthTier 判定实现、pending 队列文件格式、review-return 报文消费实现
- **Blocked**：无

## 未知项
- job-69 的 close/release 积压最终落点（实现期核对，属偏差 1/2 现场清理）
