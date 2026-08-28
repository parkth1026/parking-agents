# Issue #69 — aes-worktree-board: issue-contract 解析器取首个同名小节，重复小节静默取错
labels: ready-for-agent, wayfinder:task  |  state: OPEN  |  抢救时间: 2026-08-28
（#98 人工顶替轮的选定候选 Issue：单文件、low risk、三条 AC 全 automated、无依赖、无人认领）

## 问题

`issue-contract.mjs` 的 `sectionBody()` 用 `pattern.exec(body)` 取**第一个**匹配的小节，不检查同名小节是否出现多次。契约完整性检查只问「有没有这一节」，不问「有几个」。所以当 Issue 正文里已经存在一个同名小节（例如作者写的 `## 依赖` 散文段），后面追加的契约块中的 `## 依赖` **永远不会被读到**。

## 实测

#62 原正文末尾有一个 `## 依赖` 小节，内容是散文。把标准契约块朴素追加到正文末尾后：`complete=true  deps=[]  missing=[]`，**没有任何报错**。解析器读的是那段散文，`dependencies` 之所以是合法的 `[]`，只是因为散文里恰好没有出现 `#数字`。如果那段散文里提到了任何 `#123`，契约就会凭空多出一个不存在的依赖，而且同样 `complete=true`。

## 为什么值得修

`contractDigest` 绑定 AC 与副作用边界的精确内容，是 review/QA 证据失效语义的锚点。重复小节静默取错会让「解析出的契约就是作者写的契约」这个前提失效，而失败形态与成功**完全一样**——没有报错、没有 missing、没有 invalid。

## 目标

issue-contract.mjs 的 parseIssueBody 对七个契约小节（目标 / workflow role / 验收条件 / 依赖 / 风险 / 允许的副作用 / 人工门）逐一做重复检测：同名小节出现两次及以上时判 invalid（理由 DUPLICATE_SECTION）并 fail closed，不再静默取第一个。

## workflow role

implement

## 验收条件

- **AC-1**（automated）：正文含两个同名契约小节（如首个为散文的 `## 依赖`）时，parseIssueContract 返回 invalid 含 DUPLICATE_SECTION 且 complete=false。
- **AC-2**（automated）：七个契约小节各自重复时均判 invalid；无重复的单份契约块解析结果与现行为逐字段一致（不破坏既有 contract-complete Issue）。
- **AC-3**（automated）：技能回归入口 run-tests.mjs 受影响域全绿。

## 依赖

无。

## 风险

riskProfile: low

## 允许的副作用

- edit-worktree
- run-tests
- create-commit

## 人工门

无。全部 AC 可自动验证。
