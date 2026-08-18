# Skill Benchmark: ue-error-solver

**Model**: GLM-5.2 (builtin:bigmodel-coding-plan)
**Date**: 2026-08-14T07:17:07Z
**Evals**: 1, 2, 3 (1 run each per configuration)
**Configs**: with_skill = 新版 Node mjs；old_skill = git HEAD 的 PS1 快照

## Summary

| Metric | Old Skill | With Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 1% ± 0% | 1% ± 0% | +0.00 |
| Time | 622.8s ± 124.5s | 469.4s ± 84.0s | -153.4s |
| Tokens | 1590180 ± 248211 | 760906 ± 97054 | -829274 |

## Analyzer Notes

- 【pass_rate 不判别】两组 26/26=100%——断言集全部考察流程合规，无内容性断言；真实质量差仅通过评分代理独立取证可见。未来轮次应补内容断言（根因须点名 Missing precompiled manifest / ExitCode=6、日志副本须与 Jenkins 响应逐字节一致、引入提交归因须经 git 核实）。
- 【token 效率】with_skill 三场均值 76.1 万 tokens，old_skill 159.0 万——新版仅 48%。主因：old_skill 执行器被迫手写兜底绕过两个 PS1 实缺陷（① PS 5.1 按 ANSI 误读无 BOM UTF-8 的 .psm1，2/3 场需换 pwsh 7 或做带 BOM 副本；② curl URL glob 吞掉 Find-JenkinsJob 的方括号查询致静默返回空，2/3 场需复刻递归枚举）。两者均经评分代理取证确认为旧版真实缺陷，新版原生无此问题。
- 【耗时】with_skill 均值 469.4s vs old_skill 622.8s，新版快 25%。
- 【日志保真度（eval-2 实质差）】old_skill 保存的日志副本发生系统性 UTF-8→GBK 双重编码乱码（约 84 行中文提交信息不可读，如 添加→娣诲柇），执行器未察觉；with_skill 副本逐字节无损。PS 管道解码缺陷。
- 【归因精度（eval-2 实质差）】引入提交归因：with_skill 正确指向 5e3358744（git 核实 8894ec395 未触碰该头文件）；old_skill 误归因到 CI commit 8894ec3 本身。
- 【错误块保真（eval-2 实质差）】with_skill 逐字引用两条 note + 完整实例化链（含 UniquePtr.h:272 中间 note）；old_skill 为散文概述，缺失中间 note。
- 【with_skill 运行期暴露的 2 个工具缺口】resolve-error-file 不识别 CI 工作区 PluginsG<Repo> 前缀布局、git-history 拒绝 --oneline flag——均在运行结束后修复并有回归测试（套件 51/51），未计入本轮成绩。
- 【共同盲点（迁移前后同在，非回归）】extract-errors 均抓不到 Missing precompiled manifest 类 UBT 配置错误（不在预定义正则），两版都靠 LLM 人工复核日志补齐。候选改进：增加 UBT manifest 模式。
- 【一致性观察】同一知识库条目两执行器评分口径不一（9/10 vs 10/10）——建议 SKILL.md 增加评分锚点定义。
