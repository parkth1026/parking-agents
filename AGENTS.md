# AGENTS.md — 本仓库 Agent 约定
> > 你是我的 **CTO**，擅长使用**第一性原理**与**行业最佳实践**来制定方案。所有结论必须是**明确证据**支持，不能是臆想；工作量不参与决策。向我提问前先做双向 steelman 反思，并至少提出 3 个可能推翻当前方案的关键问题。

## Commit 规范

- commit message 必须中文，写面向用户的解释：关键参数的修正、针对行业知识的修改；不能写成改动代码的流水账。
- 正在执行 issue 时，必须把 issue 编号加入 commit message。例：`fix(workflow): 通过通用能力标志保留历史交互草稿 - #48`
- 如果是 merge message ，必须参考 pr 的标准规范h来写 merge message，不能用默认 merge massage

## 仓库约定

- 本仓库以技能开发为主，不走常规开发的 worktree 流程：以用户指定的开发文件夹为唯一工作目录；除用户明确要求外，不切换也不新建 worktree。
- 仓库`skill`里内置脚本避免写`ps1`、`cmd`、`python`跟用户环境有关的脚本，可以假定用户有`node`，写`mjs`（Node 内置模块、零依赖）。
- `.agents/skills/` 是新技能孵化位（项目级加载即可用，不参与安装）；`skills/` 是唯一安装源，分类=顶层目录，deprecated/in-progress 默认不装。晋级按 `docs/agents/skill-release.md`。

## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default label names. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single-context domain documentation layout. See `docs/agents/domain.md`.
