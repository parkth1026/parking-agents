# notes-cli search 行为对照表（确认版 2026-08-07）

- 状态：用户已逐行确认，无修改。执行 Agent 只读，不得修改本文件。
- 对照对象：`fixtures/notes-cli/notes.py`
- 数据前提：以下所有例子共用同一份 `notes.json`（6 条笔记）

## 示例数据集

| id | title | body | tags | archived | created_at |
|----|-------|------|------|----------|------------|
| 1 | Deploy 流程整理 | 先跑 CI 再发布 | work | false | 2026-07-01 |
| 2 | 周会记录 | 讨论了 deploy 频率 | work,meeting | false | 2026-07-02 |
| 3 | 读书笔记 | 随手记的一些想法 | deploy | false | 2026-07-03 |
| 4 | 旧的 DEPLOY 清单 | 已经不用了 | (空) | true | 2026-06-10 |
| 5 | a.c 命名规范 | 见附录 | (空) | false | 2026-07-04 |
| 6 | abc 前缀约定 | 统一小写 | (空) | false | 2026-07-05 |

## 变化行（新增行为）

### 场景 1：普通关键词，默认范围 —— 变化

输入：`python notes.py search deploy`

现在：argparse 报 `invalid choice: 'search'`，退出码 2。

改后：退出码 0，stdout：

```text
ID   标题                       标签               创建时间
1    Deploy 流程整理              work             2026-07-01
2    周会记录                     work,meeting     2026-07-02
```

说明：#1 标题命中（大小写不同也算），#2 正文命中，#3 只有标签命中所以不出现，#4 已归档所以不出现。

### 场景 2：包含归档 —— 变化

输入：`python notes.py search deploy --all`

现在：同上，退出码 2。

改后：退出码 0，stdout：

```text
ID   标题                       标签               创建时间
1    Deploy 流程整理              work             2026-07-01
2    周会记录                     work,meeting     2026-07-02
4    旧的 DEPLOY 清单                              2026-06-10
```

### 场景 3（边界）：关键词含正则元字符 —— 变化

输入：`python notes.py search a.c`

现在：同上，退出码 2。

改后：退出码 0，stdout：

```text
ID   标题                       标签               创建时间
5    a.c 命名规范                                  2026-07-04
```

说明：`.` 按字面字符匹配，所以 #6 的 `abc` 不命中。这是「不要正则」的判据行。

### 场景 4（边界）：无命中 —— 变化

输入：`python notes.py search kubernetes`

现在：同上，退出码 2。

改后：退出码 0，stdout 只有一行，不打印表头：

```text
no notes matched "kubernetes"
```

## 不变清单（这些现有行为保持原样）

| 输入 | 现在 = 改后 |
|------|-------------|
| `python notes.py add "标题" --body "正文" --tags work,idea` | 追加笔记、`next_id` 自增、打印 `added #7: 标题`，退出码 0 |
| `python notes.py list` | 打印表头 + 全部未归档笔记，退出码 0 |
| `python notes.py list --all` | 打印表头 + 含归档的全部笔记，退出码 0 |
| `python notes.py list`（库为空时） | 只打印表头，退出码 0（不打印 no notes 提示） |
| `python notes.py archive 4` | 置 `archived=true` 并打印 `archived #4`，退出码 0 |
| `python notes.py archive 99` | stderr `note #99 not found`，退出码 1 |
| `python notes.py delete 99` | stderr `note #99 not found`，退出码 1 |
| `notes.json` 的字段与结构 | 不新增字段、不改字段名、不改写盘格式 |
| 表格列宽与表头 | 与 `list` 完全一致（同一渲染），空标签仍填充 16 个空格；CJK 视觉错位是既有行为，保持不变 |
| 结果顺序 | 与 `list` 一致，按存储顺序（id 升序），不引入排序选项 |
