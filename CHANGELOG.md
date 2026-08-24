# Changelog

本文件记录仓库面向使用者可感知的变化。

## v0.2.0 - 2026-08-25

- 建立自研技能的生成式分类发布树：`category` → 评测门槛 → `build-release`，并用 `--check` 防止发布副本漂移。
- junction 安装器支持 `--only <分类>` 与 `--skills <名单>`，无参数行为保持不变。
- 新增独立 `npm run evals` 汇总入口、自研技能晋级标准和 mattpocock/skills 差距报告。
