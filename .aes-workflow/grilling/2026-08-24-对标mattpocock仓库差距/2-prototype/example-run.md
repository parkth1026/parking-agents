# 可执行示例: 2026-08-24-对标mattpocock仓库差距

写死的示例输出,不连真实系统;命令与参数名为草案,执行时定稿。报文结构类约定不存在(无对外接口),本文只写「怎么用、看到什么」。

## 场景 1:用户自助晋级一个自研技能(标准流程端到端)

```text
$ # 第 1 步:在 .agents/skills/karpathy-llm-wiki/SKILL.md frontmatter 加一行
$ cat .agents/skills/karpathy-llm-wiki/SKILL.md | head -5
---
name: karpathy-llm-wiki
description: Karpathy LLM Wiki ...
category: productivity        ← 新增的唯一一行
---

$ # 第 2 步:评测达标(五件套在盘,最新一轮绿)
$ npm run evals -- --skill karpathy-llm-wiki
skill               trigger        output         verdict
karpathy-llm-wiki   12/12 (1.00)   4/4 assertions PASS   ✅ 达标

$ # 第 3 步:生成
$ node scripts/build-release.mjs
[build-release] 分类真源:Matt 28(按位置)+ 自研 1(category)
[build-release] 生成 skills/productivity/karpathy-llm-wiki/ (7 files)
[build-release] 刷新 skills/productivity/README.md(+1 行)
[build-release] 刷新 README.md 索引段(+1 行)
[build-release] 完成:1 技能晋级,2 个索引更新

$ # 第 4 步:防漂移校验(也是 npm test 新末段)
$ node scripts/build-release.mjs --check
[build-release] --check:生成树与真源一致 ✓

$ git status --short
 M README.md
 M skills/productivity/README.md
?? skills/productivity/karpathy-llm-wiki/
```

## 场景 2:npm test 新末段(漂移被当场抓住的样子)

```text
$ # 有人手改了生成树里的文件(或真源改了没重新生成)
$ node scripts/build-release.mjs --check
[build-release] 不一致:skills/productivity/karpathy-llm-wiki/SKILL.md 与真源漂移
Error: 生成树过期,运行 node scripts/build-release.mjs 后重试
exit 1
$ # npm test 里对应段:
✗ build-release --check ——(同上信息,整链非零退出)
```

## 场景 3:`npm run evals` 汇总表

```text
$ npm run evals
skill                    trigger          output          verdict
parking-skill-creator    21/21 (1.00)     6/6             ✅
karpathy-llm-wiki        12/12 (1.00)     4/4             ✅
workflow-interview-web   21/21 (1.00)     —(跳过:开口裁定未闭)  ⚠️
shopping-deep-research   12/12 (1.00)     —(run-tests 豁免)   ⚠️
steelman-analysis        10/12 (0.83)     3/4             ❌ 未达标
(无评测产物技能不出行)
汇总:2 ✅ / 2 ⚠️ / 1 ❌ —— ⚠️/❌ 技能不满足晋级门槛
```

(逐行数字为示例;实跑时以各技能 run-tests 实际输出为准。)

## 场景 4:按分类选装

```text
$ ./install-skills-agents.cmd --only productivity
[install] 分类 productivity:Matt 6 + 自研 1,共 7 个技能
[install] junction:~/.agents/skills ← 7 个(平铺)
[install] 跳过:engineering(未选)
完成,退出码 0

$ ./install-skills-agents.cmd --skills parking-skill-creator,karpathy-llm-wiki
[install] 按名单 2 个技能 → junction 完成
```

## 场景 5:不变场景(必须逐字节同阶)

```text
$ ./install-skills-agents.cmd        # 无参数:与改造前完全一致
[install] 开发侧 30 + 发布侧 28,按名合并,重名开发侧赢
[install] junction:~/.agents/skills、~/.claude/skills
(输出结构与既有版本相同;唯一允许差异:发布侧计数若含自研晋级副本则数字相应增加)

$ npm test                           # 前 9 段输出不变,末尾多一段
...(既有 9 段全部照旧...)
✓ build-release --check
```
