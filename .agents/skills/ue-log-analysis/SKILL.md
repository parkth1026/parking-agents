---
name: ue-log-analysis
description: |
  分析 UE（Unreal Engine）运行时日志：判活（帧号/心跳/终止形态）、定位卡点
  （时间空窗）、错误频次分组、噪声刷屏聚类、里程碑时间线。适用于打包版或编辑器
  的 Saved/Logs/*.log、-ABSLOG 产物，以及"卡住/崩溃/GPU 占用归零/掉帧/黑屏/
  打包后异常"类反馈的诊断，多份日志判断是否同因复现。

  **触发条件：**
  (1) 用户给出 UE 运行日志文件/目录要求分析、深度搜索或找卡点
  (2) 用户反馈运行中卡死、画面冻结、GPU 占用异常、掉帧、崩溃，且有日志可查
  (3) 需要对比多份 UE 日志确认是否同一问题复现

  **不适用**：Jenkins 构建/编译/链接日志 → 用 ue-error-solver。
---

# UE Log Analysis

把一份 UE 运行日志变成结构化体检：判活 → 卡点 → 错误分组 → 噪声聚类，确定性
部分交给脚本，根因综合按 method.md 推理。

## Quick Start

```bash
SCRIPT="<skill目录>/scripts/ue-log-analysis.mjs"
node "$SCRIPT" summary <logfile>              # 一键 markdown 体检报告
node "$SCRIPT" frames   <logfile> --json      # 帧号: 判活/停滞段/FPS 骤降
node "$SCRIPT" timeline <logfile>             # 里程碑 + 终止形态 + 心跳
node "$SCRIPT" gaps     <logfile> --min-ms 3000   # 空窗 + 前后上下文
node "$SCRIPT" errors   <logfile>             # 错误频次(按次数降序)
node "$SCRIPT" noise    <logfile> --min-count 10  # 刷屏模式聚类
```

退出码：0=正常（含"未发现问题"），2=参数/文件错误。`--json` 对除 summary 外的
子命令输出机器可读结构。

## 分析流程（细节见 references/method.md）

1. **判活**：`frames` + `timeline` 四问——出过帧吗、帧号停在哪、怎么终止的、
   活着但慢吗。帧号是 UE 日志独有的判活信号，**不要用 GPU 占用判断健康度**。
2. **定位卡点**：`gaps` 的空窗前最后几行 = 阻塞开始时正在做的事。
3. **错误分组**：`errors` 表里排第一的不一定是根因，从首次错误往前追触发者
   （常见连锁：找不到包 → 异步加载线程 ensure）。
4. **噪声还原主干**：`noise` 聚类出刷屏模式后 grep -v 过滤，再看时间线。
5. **报告**：每条结论挂日志证据（时间/行号/帧号），区分实锤/强假设/待澄清。

## 何时读哪个参考文件

- `references/method.md` — 完整工作流、报告结构、五个常见陷阱（帧号归属、
  GPU 占用语义、日志终止≠崩溃、`_2` 后缀日志、UTC 时间戳）
- `references/ue-log-format.md` — 行格式解剖、帧号语义表、日志类别速查、
  终止形态判定表、常见错误模式库（ensure 连锁/PSO 等待/LOW-POWER 语义/
  PROJ 刷屏，实战沉淀）
- `references/design.md` — 设计取舍与验收条件 AC-1…AC-8

## 测试

技能自带回归测试。每次升级、改动后必跑：

```bash
node run-tests.mjs
```

fixtures 固化三类日志形态：stall（帧 0 卡死+噪声刷屏）、run-freeze（出帧→
骤降→空窗→心跳终止）、crash（Fatal 崩溃结尾）。
