---
name: jenkins-pair-analyze
description: |
  分析一个 FAILURE→SUCCESS Jenkins 构建对：下载日志、提取错误、验证修复、
  关联修复提交、查询 Epic 官方助手、评分并写知识文件。

  由 jenkins-log-auto-learning 编排调用（其阶段 1 的执行者）；
  用户点名"分析这个构建对 / 这对构建 / 分析 fail=X fix=Y"时也独立可用。
---

# 构建对分析（jenkins-log-auto-learning 阶段 1 执行者）

本技能只做一件事：把**一个** FAILURE→SUCCESS 构建对变成一份带评分的知识文件或一条明确的终态结论。扫描、领取构建对、跟踪记账都归编排器，与本技能无关。

## 入口：先拿事实，不要转抄

无论编排器进入还是独立调用，第一步都是：

```bash
node <orchestrator>/scripts/session.mjs status
```

`<orchestrator>` = 本技能同级的 `../jenkins-log-auto-learning`。输出三件事：

1. **当前构建对**：任务名、jobPath、失败构建组 `fail=[..]`、修复构建 `fix=#N`
2. **生效配置**：baseUrl、gitRepos、rawDir、tmpDir、trackFile
3. **下一步**：会话处于什么门禁

以这份输出为准，不要凭记忆转抄路径。配置分层（config.json ⊕ 环境层域文件 `jenkins-log-auto-learning.json`）的完整说明见编排器的 `references/config.md`。

独立调用（用户直接点名某构建对）时：先用 `status` 确认会话，没有进行中的会话就按用户给的任务/构建号工作，配置仍从 `status` 输出取。

## 做什么

执行 [references/analyze.md](references/analyze.md) 的完整流程：

日志下载 → 错误提取 → SUCCESS 验证修复 → 提交获取（changeSet API + 控制台日志回退）→ 错误↔提交关联 → 根因分析 → Epic 查询 → 评分 → 评分<8 反思 → 写知识文件。

| 细分规则 | 文件 |
|------|------|
| Epic 查询构造/速率/空响应 | [references/epic-query.md](references/epic-query.md) |
| 评分标准（Info/Diff/Commit/Reuse，满分 10） | [references/scoring.md](references/scoring.md) |
| 知识文件命名与结构 | [references/knowledge-format.md](references/knowledge-format.md) |
| 大日志裁剪 | [references/log-strategy.md](references/log-strategy.md) |

## 边界

- **只分析当前这一对**。不跑 scan-pairs.mjs、不 `next` 领取新对、不更新跟踪账本
- **不碰 workflow.json 与 analyzed-builds.json 本体**——唯一写入者是 session.mjs
- 只写 `{rawDir}/details|scratch/` 与 `{tmpDir}`；wikiDir 只读；所有输出 UTF-8 无 BOM
- 连续 FAILURE 共享修复 → 合并为一个知识文件（文件名引用全部构建号）；错误确实不同才拆开

## 收尾（必须，命令写死）

分析成功——交出知识文件。score 限定 **0-10**（scoring.md 满分 10，越界会被拒）：

```bash
node <orchestrator>/scripts/session.mjs stage 1-analyze done \
  --result "failure:score={N}:{ErrorCode}:fix=#{fixBuild}" \
  --knowledge "{知识文件绝对路径}"
```

`--knowledge` 与 `:see=` 有**机械门禁**（validate-raw.mjs v2，不满足 exit 1，按报错修正后重新收尾即可，不算流程失败）：
文件必须真实存在且位于 rawDir 内；文件名 `{jobCode}-{fail}[-{end}]-{ErrorCode}-{ShortDesc}.md`（jobCode 来自编排器 config.json 注册表）；文件头必须有完整 frontmatter（schema/base_url/job/job_code/job_path/fail_builds/fix_build/error_code/score/result/recorded_at，与文件名、结论串三方一致）；正文（frontmatter 之外）须含错误码 token（infra 型为 reason）——否则 search-kb 永远搜不到该文件。规范全文见 [references/knowledge-format.md](references/knowledge-format.md)。

其他终态，`--result` 换成对应结论串（grammar 与跟踪账本既有条目一致）：

| 情形 | result |
|------|--------|
| 无修复 SUCCESS | `failure:no-fix-found` |
| 日志 404/为空 | `failure:log-unavailable` |
| 基础设施故障（两构建间无代码变更） | `failure:infra:{reason}` |
| 重复模式（已有同错误+根因知识文件） | `failure:score={N}:{code}:fix=#X:see={existingFile}` |
| 跳过 | 用 `skipped --reason "{REASON}"` 收尾 |

可选 `--success "success:w={N}"`：对 fixBuild 做了警告计数时附带落账。

失败——日志下载或 API 调用失败、无法完成分析：

```bash
node <orchestrator>/scripts/session.mjs stage 1-analyze error --reason "<一句话原因>"
```

收尾后**停止**：编排器会 `finish` 落账并进入阶段 3 报告。独立调用时，收尾后向用户简述结论（评分、知识文件路径、遇到的问题），并说明完整流程（记账、领取下一对）由 jenkins-log-auto-learning 编排。
