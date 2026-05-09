# Insight 工具链

> VS Code Copilot 使用行为洞察分析，支持 **定量统计 + LLM 语义分析** 的完整工作流。

## 概述

Insight agent 从 VS Code Copilot debug-logs (JSONL) 中提取使用行为数据，通过三阶段流水线生成交互式 HTML 报告。支持两种运行模式：**快速模式**（纯脚本，零 LLM 成本）和 **完整模式**（含 LLM 语义分析）。

## 三阶段流水线

```
Phase 1: 定量提取（脚本，零 LLM 成本）
  node analyze-insight.js --extract-transcripts
  → insight-data.json + session-transcripts/*.txt

Phase 2: LLM Facets 提取（通过 Copilot 对话）
  读取 session-transcripts/ → LLM 分析 → facets-cache/{sessionId}.json
  已缓存的 session 自动跳过

Phase 3: 叙事生成 + HTML 报告
  node generate-insight-report.js --facets-path facets-cache --narratives-path insight-narratives.json
  → 包含语义分析的完整 HTML 报告
```

## 报告模式

Insight 工具链提供三种报告生成方式，适用于不同场景：

| 模式 | 脚本 | 所需阶段 | 说明 |
|------|------|----------|------|
| **完整报告** | `generate-insight-report.js` | Phase 1-3 全跑 | 包含所有区域（定量 + 语义 + 叙事），产出最完整的分析报告 |
| **客观数据报告** | `generate-quant-report.js` | Phase 1 即可 | 仅定量分析，零 LLM 成本，适合快速查看工具调用、Token 消耗等客观指标 |
| **语义分析报告** | `generate-qual-report.js` | Phase 2-3 完成后 | 仅 LLM 分析结果（目标分类、满意度、摩擦点、叙事洞察），需要 facets + narratives 数据 |

## 快速模式（零 LLM 成本）

跳过 Phase 2-3，仅用 Phase 1 数据生成基础报告：

```powershell
# 1. 提取定量数据
node .\analyze-insight.js --output-path insight-data.json --days-back 30

# 2. 生成客观数据 HTML 报告（不含语义分析）
node .\generate-quant-report.js --data-path insight-data.json --output-path report.html
```

## 完整模式（含语义分析）

三阶段全跑，产出包含目标分类、满意度推断、摩擦点分析的完整报告：

```powershell
# Phase 1: 提取数据 + 转录
node .\analyze-insight.js --output-path insight-data.json --extract-transcripts --transcript-output-path session-transcripts

# Phase 2: 在 Copilot 对话中调用 insight agent，自动批量提取 facets → facets-cache/

# Phase 3: 生成完整报告
node .\generate-insight-report.js --data-path insight-data.json --facets-path facets-cache --narratives-path insight-narratives.json
```

## 参数参考

### analyze-insight.js

| 参数 | 类型 | 说明 |
|------|------|------|
| `--output-path` | string (必填) | 输出 JSON 路径 |
| `--workspace-path` | string | 筛选指定 workspace |
| `--session-id` | string | 筛选指定 session |
| `--days-back` | int | 分析最近 N 天（默认 30） |
| `--max-files` | int | 限制处理文件数（0=不限） |
| `--extract-transcripts` | flag | 提取压缩 session 转录 |
| `--transcript-output-path` | string | 转录输出目录（默认 `session-transcripts`） |

### generate-insight-report.js

| 参数 | 类型 | 说明 |
|------|------|------|
| `--data-path` | string (必填) | insight-data.json 路径 |
| `--output-path` | string | 输出 HTML 路径（默认 `insight-report.html`） |
| `--title` | string | 报告标题 |
| `--facets-path` | string | facets 缓存目录（默认 `facets-cache`） |
| `--narratives-path` | string | 叙事 JSON 路径 |

### generate-quant-report.js

| 参数 | 类型 | 说明 |
|------|------|------|
| `--data-path` | string (必填) | insight-data.json 路径 |
| `--output-path` | string | 输出 HTML 路径（默认 `insight-report.html`） |
| `--title` | string | 报告标题 |

### generate-qual-report.js

| 参数 | 类型 | 说明 |
|------|------|------|
| `--data-path` | string (必填) | insight-data.json 路径 |
| `--output-path` | string | 输出 HTML 路径（默认 `insight-report.html`） |
| `--title` | string | 报告标题 |
| `--facets-path` | string | facets 缓存目录（默认 `facets-cache`） |
| `--narratives-path` | string | 叙事 JSON 路径 |

## 缓存管理

`facets-cache/` 目录存放每个 session 的 LLM 分析结果：

- 文件名格式：`{sessionId}.json`
- Phase 2 执行时自动跳过已缓存的 session
- 删除单个文件可强制重新分析该 session
- 删除整个目录可全量重新提取

## 数据源

```
%APPDATA%\Code\User\workspaceStorage\<workspace-hash>\
  └── GitHub.copilot-chat\debug-logs\<session-id>\
      ├── main.jsonl
      └── runSubagent-*.jsonl
```

## 输出格式

`analyze-insight.js` 输出 JSON 包含三个顶层字段：

- **`meta`**：扫描元信息（日期、文件数、数据量、耗时）
- **`sessions`**：每个 session 的详细统计（token、工具、错误、代码变更等）
- **`aggregated`**：跨 session 聚合数据（总量、分布、按 workspace 分组）

## 依赖

- Node.js 18+
- 零外部依赖
