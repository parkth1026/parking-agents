# Goal Contract — notes-cli 搜索功能

- 版本:1.0(2026-08-04)
- 状态:已与用户确认(见同目录 interview-log.md,共 2 轮访谈)
- 目标代码库:`G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\fixtures\notes-cli\notes.py`

## 1. 背景与目标

notes-cli 是个人用的极简命令行笔记工具(Python 单文件,argparse 子命令,数据存于同目录 `notes.json`)。用户现有几百条笔记,靠 `list` 翻找越来越费劲。

**目标**:新增 `search` 子命令,按关键词在标题和正文中查找笔记,输出与 `list` 相同格式的表格。

## 2. 功能需求

### 2.1 命令形态

```
python notes.py search <keyword> [--all]
```

- `keyword`:单个必填位置参数(含空格时由用户自行加引号,argparse 原生支持,无需特殊处理)。
- `--all`:可选开关,语义与 `list --all` 一致——加上则连已归档笔记一起搜;默认只搜未归档笔记。

### 2.2 匹配语义

- 搜索字段:**仅标题(title)和正文(body)**;标签(tags)不参与匹配。
- 匹配方式:**不区分大小写的普通子串匹配**。任一字段(标题或正文)命中即算该笔记命中。
- 大小写不敏感通过对关键词与字段统一 `str.lower()`(或 `casefold()`)实现;中文等非拉丁字符按原样子串匹配即可。
- **明确排除**:正则表达式、模糊匹配、多关键词 AND/OR 组合、按标签过滤。

### 2.3 输出格式

- 与现有 `cmd_list` 完全相同的表格:表头 `ID / 标题 / 标签 / 创建时间`,列宽与格式化方式一致(建议复用/提取现有打印逻辑,而非复制粘贴两份)。
- 不需要高亮匹配词,不需要正文摘要片段。
- 结果顺序:按笔记在 `notes.json` 中的存储顺序(即创建顺序),不提供排序选项。

### 2.4 空结果行为(用户明确要求写入契约)

- 无任何笔记命中时:
  - 向 **stdout** 打印一行:`no notes matching '<keyword>'`(其中 `<keyword>` 为用户输入原文);
  - **不打印表头**;
  - 进程退出码为 **1**(与 grep 惯例一致,便于脚本判断)。
- 有至少一条命中时:打印表头 + 命中行,退出码为 **0**。

## 3. 非功能需求与约束

- **兼容性(硬约束)**:现有 `add` / `list` / `archive` / `delete` 四个子命令的行为、输出、退出码一律不得改变。
- **性能**:数据量为几百条,直接线性扫描 `notes.json` 即可;**不得**引入索引、缓存或额外存储文件。
- **依赖**:仅使用 Python 标准库,不新增第三方依赖。
- **实现范围**:仅修改 `notes.py`,并在 `README.md` 的命令列表中补一行 `search` 用法说明。不新建其他文件。
- **数据文件**:`search` 为只读操作,不得写入 `notes.json`。

## 4. 明确不做(Out of Scope)

- 正则 / 模糊匹配 / 多关键词组合
- 标签搜索或 `--tag` 过滤
- 结果排序选项
- 搜索历史
- 高亮、摘要片段
- 自动化测试框架(见第 5 节,手工验证即可)

## 5. 验收标准(Acceptance Criteria)

准备数据:在干净的 `notes.json` 上执行

```
python notes.py add "Weekly Meeting" --body "讨论 Q3 计划" --tags work
python notes.py add "购物清单" --body "牛奶 鸡蛋"
python notes.py add "OKR draft" --body "meeting notes for okr"
python notes.py archive 3
```

| # | 命令 | 期望 |
|---|------|------|
| AC1 | `search meeting` | 命中 #1(标题含 "Meeting",大小写不敏感);#3 已归档默认不出现;退出码 0 |
| AC2 | `search meeting --all` | 命中 #1 和 #3(#3 正文含 "meeting");退出码 0 |
| AC3 | `search 牛奶` | 命中 #2(正文中文子串匹配);退出码 0 |
| AC4 | `search work` | 无命中("work" 只在 #1 的标签里,标签不参与搜索);stdout 打印 `no notes matching 'work'`,不打印表头,退出码 1 |
| AC5 | `search 不存在的词` | 打印 `no notes matching '不存在的词'`,退出码 1 |
| AC6 | 命中时的输出 | 表头与各列格式与 `list` 输出逐字符一致 |
| AC7 | 回归 | `add` / `list` / `list --all` / `archive` / `delete` 行为与改动前完全一致;`search` 执行前后 `notes.json` 内容不变 |
| AC8 | `python notes.py search`(缺关键词) | argparse 报用法错误,非零退出码(argparse 默认行为即可) |

验收方式:手工按上表执行命令并核对输出与退出码(PowerShell 下用 `$LASTEXITCODE` 查看),无需自动化测试。

## 6. 交付物清单

1. 修改后的 `notes.py`(新增 `cmd_search` 与对应 argparse 子命令注册)。
2. 更新后的 `README.md`(命令列表补充 `search <keyword> [--all]`)。
