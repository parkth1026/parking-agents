<!-- draft v1 | published 2026-08-16
     用户意见：确认锁定
     状态：confirmed -->

# 可执行示例: 2026-08-16-scoring-system-fixes（确认版·锁定）

> 输出为写死示意；验收以关键断言对照，不逐字比对。

## 场景 1：validate-raw 全库（兼容分界）

```
$ node .claude/skills/jenkins-log-auto-learning/scripts/validate-raw.mjs
files: 14 checked, 14 valid, 0 ERROR
（存量 recorded_at < 生效时刻：无 Warning Trend 放行）
```

手工构造一份缺 Warning Trend 的"新"文件（recorded_at = 生效后）→ `ERROR: Warning Trend 节缺失`。

## 场景 2：等效强归因链判分（无 diff 对）

分析中：diff 不可得，但 pin 对比显示两构建间唯一变化 = 提交 db82ef2（标题 "Add RuntimeVersion.json to plugin root"，失败对象正是 RuntimeVersion.json 缺失），#330 错误消失 → Reuse 第 1 分成立，总分 8，`details/`，正文归因节注明「diff 不可得，等效强归因链：唯一 pin 变化 db82ef2 + 标题同名 + 错误消失」。

反例：pin 间有 3 个提交、无法唯一定位 → 链不成立，Reuse 0 分，按总分落档。

## 场景 3：infra 修复侧证据判分

修复 = job 配置增补插件仓库清单（有 job config diff 截图/diff 文本入文件）→ Commit 第 1 分（修复侧变更证据）+ 第 3 分（描述清楚）= 2/3；「磁盘清理后重跑即好」无书面变更证据 → 0/3。

## 场景 4：Warning Trend（新文件）

```markdown
## Warning Trend
| Build | Warnings |
| #328 (fail) | 41 |
| #330 (fix)  | 12 |
趋势：改善（-29）。details/ 档无恶化，无需解释段。
```

若 fix 警告数 > fail：details/ 档必须附「恶化解释」段，否则降 scratch。

## 场景 5：重复模式落账

命中同码同根因已有文件 → 结论串 `failure:score=8:LNK2019:fix=#402:see=aes6-40-54-C1083-ipluginmanager-public-header.md`；该文件 Recurrences 表加一行；`session.mjs list` 中 :see= 计数可 grep 统计。

## 场景 6：盲评流程

```
盲评包: scoring-audit-2026-08-16/blind-review/
  set/            ← 去分副本（编号匿名，无 score/scoring 行）
  scoring-sheet.md ← 四维打分表（每文件一行）
  procedure.md    ← 流程（先读文件→独立打分→不得回看原分）
用户填表 → 计算指标 → results.md
  指标: 逐文件 |Δ总分|、|Δ|≤1 占比、四维差异表
```

## 场景 7：校准触发条件查询

`grep -n "校准触发" .../scoring.md` → 三条件任一满足触发复审（:see=≥30 / ≥6 个月 / 盲评一致率 <0.8）。
