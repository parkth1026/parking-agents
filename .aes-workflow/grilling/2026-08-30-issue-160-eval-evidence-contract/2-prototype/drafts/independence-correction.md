# 原型修正：Creator 独立性与上下文预算

## 被用户否决的旧依赖方向

旧候选把 `writing-for-agents` 画成 Creator 运行时会条件性读取的共享 skill。该方向作废：它会让 Creator 的安装、打包与执行依赖另一个 skill，也让跨环境复现取决于宿主是否安装该依赖。

## 修正后的方向

- `writing-for-agents` 只作为本轮设计调研来源，不进入 Creator 的运行依赖、package manifest、skill pointer 或 eval 前置。
- Creator 复用自己已经存在的 `references/writing-guide.md`；把本轮确认有效的最小机制压缩进去，不新增第二个 writing reference。
- `SKILL.md` 仍只保留已有的按需读取指针与主流程完成判据；细节只在“创建/改写 Agent 文档”分支加载本地 writing guide。
- 质量假设 schema、定向 gate、stability runs 和 quality verdict 都由 Creator 自身脚本/references 实现。
- `.skill` 单包复制到没有 `writing-for-agents` 的环境时，创建、校验、评测、viewer 与打包全链仍可运行。

## 当前可量基线

| 上下文面 | 当前实测 |
| --- | --- |
| 常驻 `parking-skill-creator/SKILL.md` | 31,415 UTF-8 bytes / 312 行 |
| 创建/改写分支：`SKILL.md + references/writing-guide.md` | 40,364 UTF-8 bytes / 475 行 |

UTF-8 bytes 与行数不是模型 token 的同义词，但它们是当前仓库可零依赖、跨运行重复测量的稳定代理。若选择“零增长双预算”，新增质量机制必须用 pruning 抵消，不能通过把正文搬进本地 guide 来规避常驻预算后无限扩大分支预算。

