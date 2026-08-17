# Fact: diagram-design 绘图内核与可移植面

- 派遣问题：diagram-design（G:\GIT\AI_WorkFlow_ref\diagram-design，v2.4.0）的绘图规范内核是什么？哪些文件是"画一张架构/流程对照图"的最小依赖？移植有什么许可与依赖面约束？
- 完成：2026-08-16T17:39:47Z（探索代理调查，2026-08-17 访谈启动时归档）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| 技能本体在 `skills/diagram-design/`（148 文件：SKILL.md + references/×40 + assets/×104 + scripts/×3） | 仓库文件清单 |
| MIT 许可，© 2025 Cathryn Lavery；不带图标 vendor 资产即无第三方义务（THIRD_PARTY_LICENSES 只覆盖 icons） | `LICENSE:1-3`、`THIRD_PARTY_LICENSES.md` |
| 绘图纯指令驱动：模型直接手写 SVG；3 个随技能脚本与生成无关（mermaid_extract/drawio_extract 仅导入路径，self_check 仅生成后校验） | `skills/diagram-design/scripts/` |
| 产出形态：单文件自包含 HTML + 内联 SVG + 内联 CSS，默认零 JS | `SKILL.md:544-547`、ADR-0001 |
| 唯一外部依赖是 Google Fonts（Instrument Serif/Geist/Geist Mono）——与 parking-agents 家族 mock.html 的"无 CDN 外链"eval 断言冲突，移植必须改系统字体栈 | `SKILL.md:539-547`、`style-guide.md:74-81`、evals/evals.json:46 |
| 4px 网格："All values divisible by 4. Non-negotiable"，含字号/节点宽高/gap/radius 档位表 | `SKILL.md:339-354` |
| 语义色板（hex 只许出现在 style-guide 一处）：paper `#f5f5f5` / ink `#2d3142` / muted `#4f5d75` / soft `#7a8399` / accent `#eb6c36`（全图 ≤2 个 focal）/ link `#2e5aa8` | `references/style-guide.md:17-28` |
| 连线 6 条强制规则：圆角正交（r=8 Q-bend，公式 `M x1,y1 H mid-8 Q mid,y1 mid,y1+8 V y2-8 Q mid,y2 mid+8,y2 H x2`）、箭头先画后 box、3 种 marker 常驻 defs、标签 paper 色 mask、交叉 bridge 半圆、同边扇形接入公式 | `SKILL.md:236-334`、`type-architecture.md:16-22` |
| 复杂度预算：节点 ≤9、箭头 ≤12、accent ≤2、序列生命线 ≤5、泳道 ≤5；超了拆 overview+detail 两图 | `SKILL.md:356-387` |
| 密度目标 4/10；"The highest-quality move is **usually** deletion" | `SKILL.md:37-46` |
| fidelity ledger：输出小于输入必须申报 Detail/Merged/Collapsed/Dropped/Kept，"The reader of the diagram can't see what's missing"——原文语境是 draw.io 导入，移植时"源"需改为影响面扫描事实 | `references/output-spec.md:151-163` |
| before/after 的机制是两张同构图（it-state=before + dp-integration=after，仅 it-state 单向自称 companion）；"Simple before/after → table" 是它自己的反图规则 | `type-it-state.md:3`、`SKILL.md:58` |
| "两次生成视觉一致"must 仅 5/8 参数化类型；非参数化类型（architecture/flowchart）无此承诺，一致性靠通用规则维持 | `type-dp-integration.md:7` 等 |
| 最小移植内核 ≈ SKILL.md 核心节（设计系统/SVG 原语/网格/预算）+ style-guide.md + type-architecture.md + type-flowchart.md + 一个 worked 示例；导入/动画/图标/品牌 onboarding/CI 全可不带 | 依赖面评估 |
| semantic-patterns 有与访谈同构的模式："Unstructured input → structured artifact"（对话/笔记→规范化产物，要求 provenance 链与 missing/unknown 状态） | `references/semantic-patterns.md:47-59` |

## 未知项

- 27 类型中与架构/流程无关的 20 个未细读（超出派遣范围，移植也不需要）。

## 没查的

- 示例 HTML 逐个打开的渲染效果（浏览器人工验证不在只读调查范围；worked 示例随实现阶段自验）。
