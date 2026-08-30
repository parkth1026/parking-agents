# 可执行示例: 2026-08-30-psc-layout-regression-fix

<!-- 确认版·锁定 | 用户确认 2026-08-30（选项 A：确认含 B9）
     执行 Agent 改的是产品，不是这份对照物 -->

场景 1~4 是**新的**跑法样子；场景 5 是**必须保持不变的**现有用法。

## 场景 1：在仓库 2 层技能目录里跑快照（改后）

```console
$ cd G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/parking-skill-creator
$ node scripts/snapshot-skill.mjs .
SNAPSHOT G:\GIT\AI_WorkFlow\parking-agents-manual\evals\parking-skill-creator-workspace\skill-snapshot
$ echo $?
0
```

产物落在 `<repo>/evals/`（与 `skills/` 平行、扫描根外），`.gitignore` 的 `/evals/` 保证不入库。

## 场景 2：在仓库 3 层技能上跑快照（改后，嵌套越深越归位）

```console
$ node <repo>/skills/matt-skills/engineering/ask-matt/../../parking-skill-creator/scripts/snapshot-skill.mjs \
    G:/GIT/AI_WorkFlow/parking-agents-manual/skills/matt-skills/engineering/ask-matt
SNAPSHOT G:\GIT\AI_WorkFlow\parking-agents-manual\evals\ask-matt-workspace\skill-snapshot
```

同一公式，与技能嵌套深度无关。

## 场景 3：从用户级 link 路径跑快照（不变场景）

```console
$ node C:/Users/parking/.agents/skills/parking-skill-creator/scripts/snapshot-skill.mjs \
    C:/Users/parking/.agents/skills/parking-skill-creator
SNAPSHOT C:\Users\parking\.agents\evals\parking-skill-creator-workspace\skill-snapshot
```

与现行输出逐字节相同（本就正确，修复不得碰它）。

## 场景 4：无 skills 祖先时回退（新提示行）

```console
$ node <repo>/skills/workflow/parking-skill-creator/scripts/snapshot-skill.mjs D:/mytools/foo-skill
注: 目录向上未找到 skills 祖先，回退上两级解析
SNAPSHOT D:\evals\foo-skill-workspace\skill-snapshot
```

落点与现行一致，只多一行提示；退出码不变。

## 场景 5：check-shadow 对真实仓库根（改后）

```console
$ node scripts/check-shadow-skills.mjs G:/GIT/AI_WorkFlow/parking-agents-manual/skills
G:\GIT\AI_WorkFlow\parking-agents-manual\skills
  技能 63 个（递归）
  ✓ 无影子技能
$ echo $?
0
```

（现行输出为「一级技能 0 个 / 影子技能 63 个 / exit 1」。）

## 场景 6：注入冒充产物仍被点名（改后，能力不回退）

```console
$ mkdir -p <root>/evals/demo-workspace/skill-snapshot && cp 真-SKILL.md <root>/evals/demo-workspace/skill-snapshot/SKILL.md
$ node scripts/check-shadow-skills.mjs <root>
<root>
  技能 1 个（递归）
  影子技能 1 个:
    evals\demo-workspace\skill-snapshot\SKILL.md  → 位于评测产物目录，会冒充真技能
共 1 个影子技能:递归扫描的宿主会把它们当真技能列进清单。
$ echo $?
1
```

（影子报告的「点名 + 理由 + 汇总」结构与现行一致。）
