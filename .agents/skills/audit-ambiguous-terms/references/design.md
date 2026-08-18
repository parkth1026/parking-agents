# design: audit-ambiguous-terms

## 意图与触发场景

这个 skill 面向中文开发者和中文优先的 agent authoring 场景：审查 prompt、Codex `SKILL.md` 和 skill `description` 中会改变执行、触发、输出或验收的歧义词，并只为少量真正有信息增益的核心概念生成 English terminology 和最小改写。

应在用户要求“检查歧义词”“找行业公认说法”“保留中文但翻译核心技术词”“优化 skill description/prompt 的触发语义”或“把已有 prompt 最小改写得更准确”时触发。普通全文翻译、一般英文润色、代码重构和只查拼写不属于本 skill 的核心范围。

## 设计取舍

| 决策 | 选择 | 原因 |
| --- | --- | --- |
| 语言策略 | Chinese-first，只对通过四道 gate 的 semantic nucleus 加入 English | 保留用户阅读习惯，避免把术语审计变成全文翻译 |
| 核心判断 | agent 做上下文判断，参考目录提供候选 | 歧义依赖领域和目标，静态词典无法覆盖所有 prompt |
| 转换数量 | 短 prompt 最多 2 个，普通文章最多 5 个，不足不凑数 | 用硬上限阻止逐句翻译，同时允许长文保留真正重要的少量术语 |
| 文件修改 | 默认 audit/rewrite；明确授权才 apply | 防止把建议误写入已有 skill 或 prompt |
| skill 目标 | 默认只改 `description` | 保留已有 skill 的 name、正文、接口和触发边界 |
| 确定性校验 | Node `.mjs` 脚本检查结构和 protected tokens | 结构约束适合脚本，行业语义不能伪装成机械证明 |
| 评测 | fixture 回归 + with/without + near-miss trigger eval | 既验证格式不回归，也验证技能是否真的改善决策 |

## 验收条件

| 编号 | 条件 | 类型 |
| --- | --- | --- |
| AC-1 | description 同时说明技能做什么、何时触发、严格转换上限和不应做什么 | script |
| AC-2 | 能区分 inline prompt、`SKILL.md` 和 frontmatter description，并选择 audit/rewrite/apply 模式 | manual |
| AC-3 | 首个转换例只对“钢人”和“分歧核心”两个 semantic nucleus 加入 English，保持其他正常中文 | manual/script |
| AC-4 | 普通中文不因存在 English equivalent 就被转换；转换会同时通过 Named concept、Execution impact、English information gain、Stable mapping 四道 gate | manual |
| AC-5 | context-dependent 或 unverified 术语不会被无条件宣称为 industry-standard | manual |
| AC-6 | 改写保留代码、API、identifier、provider name、path、URL、版本号和原有控制约束 | script |
| AC-7 | 未明确授权 apply 时不写入目标文件；apply 时输出最小 diff 并重新校验 | manual |
| AC-8 | `run-tests.mjs` 黑盒执行校验脚本，首个 fixture 和 skill 本身均通过 | script |

## 迭代记录

| 日期 | 改了什么 | 轮次结果 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-08-18 | 创建首版 Chinese-first 术语审计 skill，加入首个 prompt fixture 和确定性校验 | n/a | 未命中拆分信号；待 trigger eval |
| 2026-08-18 | 根据用户反馈收紧 conversion gate、预算和 semantic nucleus；首个 prompt 从五个 English terms 降到两个 | n/a | 未命中拆分信号；待 trigger eval |
