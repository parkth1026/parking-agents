---
name: jenkins-log-auto-learning
description: |
  批量扫描 Jenkins CI 任务，寻找 FAILURE→SUCCESS 构建对，提取错误模式，
  通过 git 提交验证修复，并生成带评分的知识文件。

  **在以下场景使用此技能：**
  (1) 批量扫描或从 Jenkins 日志自动学习
  (2) 检查知识库进度、剩余未分析构建或跟踪状态
  (3) 查找 FAILURE→SUCCESS 构建对或构建知识库

  **不适用于单次构建诊断** —— 请使用 `ue-error-solver`。
disable-model-invocation: true
---

# Jenkins 日志自动学习技能 v5.1

在 Jenkins 中寻找 FAILURE→SUCCESS 构建对，提取错误模式和修复方法，写入知识文件。

## 配置

读取技能目录下的 `config.json`。如果 config.json 不存在或格式错误，向用户报告缺失的配置项并停止执行，不要使用默认值。详见 [references/config.md](references/config.md)。

## 执行流程

### 阶段 0：获取待分析构建对                                                                                                      
从 `pending-pairs.json` 取下一个未分析的 FAILURE→SUCCESS 对。如文件过期或不存在，先运行 `scan-pairs.ps1`。如果扫描后 pending-pairs.json 为空（无可用构建对），向用户报告并停止执行。每次用户调用此技能时，只处理一个构建对，处理完成后停止。如需处理更多，用户需再次调用。
→ 详见 [references/phase0-scan.md](references/phase0-scan.md)

### 阶段 1：分析当前构建对
处理阶段 0 选出的那一个 FAILURE→SUCCESS 对：下载日志 → 提取错误 → 获取提交 → 关联 → 查询 Epic → 评分 → 写知识文件。如果日志下载或 API 调用失败，将该构建对在跟踪文件中标记为 error 状态并附原因，然后进入阶段 3 报告后结束。用户需再次调用以处理下一个构建对。
→ 详见 [references/phase1-analyze.md](references/phase1-analyze.md)

### 阶段 2：更新跟踪
分析完后立即更新 `{trackFile}`。
→ 详见 [references/phase2-tracking.md](references/phase2-tracking.md)

### 阶段 3：报告
向用户简要总结：已扫描/跳过/剩余构建数、知识文件路径和评分、遇到的问题。

## 知识文件                         
→ 详见 [references/knowledge-format.md](references/knowledge-format.md)

## 参考文件

| 主题 | 文件 |
|------|------|
| 配置与环境 | [references/config.md](references/config.md) |
| 阶段 0 扫描 | [references/phase0-scan.md](references/phase0-scan.md) |
| 阶段 1 分析 | [references/phase1-analyze.md](references/phase1-analyze.md) |
| 阶段 2 跟踪 | [references/phase2-tracking.md](references/phase2-tracking.md) |
| 知识文件格式 | [references/knowledge-format.md](references/knowledge-format.md) |
| Epic 查询指南 | [references/epic-query.md](references/epic-query.md) |
| 评分标准 | [references/scoring.md](references/scoring.md) |
| 日志裁剪策略 | [references/log-strategy.md](references/log-strategy.md) |

## 核心约束

1. **每次调用处理一个构建对**：处理完成或出错后停止，用户再次调用处理下一个
2. **单实例**：同一跟踪文件同一时间只运行一个实例
3. **只写 rawDir**：绝不修改 wikiDir。评分公式：Info/3 + Diff/2 + Commit/3 + Reuse/2 = 总分/10，详见 [references/scoring.md](references/scoring.md)

   | 评分 | 写入位置 |
   |------|----------|
   | ≥8 | details/ |
   | 5-7 | scratch/ |
   | <5 | 仅跟踪 |

4. **配置驱动**：所有路径和 URL 来自 config.json
5. **UTF-8 without BOM**：所有输出文件
