# Changelog

本文件记录仓库面向使用者可感知的变化。

## v0.2.1 - 2026-09-02

- 安装器/卸载器交互升级为方向键 TUI（clack 风格，对齐 skills.sh 生态观感）：真终端里 ↑↓ 选择、回车取高亮推荐项（目标=两个都装，套档=default），Ctrl-C 优雅取消；管道/CI/哑终端（如 Git Bash mintty）自动回退纯文本菜单，回车即默认。非交互参数路径与退出码不变。
- TUI 实现为冻结的 vendor bundle（`scripts/vendor/clack-prompts.mjs`，来源 @clack/prompts 1.7.0 等 6 个 MIT 包，许可证内嵌，重建流程见 `scripts/vendor/README.md`），保持克隆即用、零 npm install。

## v0.2.0 - 2026-08-25

> 内部能力里程碑：表示生成式发布机制已经实现，不代表九个 harness 的可消费发布版本已经从 `0.1.0` 升级。

- 建立自研技能的生成式分类发布树：`category` → 评测门槛 → `build-release`，并用 `--check` 防止发布副本漂移。
- junction 安装器支持 `--only <分类>` 与 `--skills <名单>`，无参数行为保持不变。
- 新增独立 `npm run evals` 汇总入口、自研技能晋级标准和 mattpocock/skills 差距报告。
