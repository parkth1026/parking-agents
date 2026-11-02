# matt-skills复用关系

只在进入对应阶段时读取上游 SKILL.md。通过宿主技能目录按名称查找，或在 parking-agents 源码仓的 `skills/matt-skills/` 下定位；孵化目录与安装目录深度不同，避免硬编码某台机器的绝对路径。若副本同名，记录实际采用路径。

| 阶段 | 上游相对 matt-skills 的路径 | 复用内容 |
| --- | --- | --- |
| 目标歧义 | engineering/wayfinder/SKILL.md | Destination、决策前沿、迷雾、票与答案索引 |
| 人类决定与术语 | productivity/grilling/SKILL.md；engineering/domain-modeling/SKILL.md | 问清影响结果的选择、沿用领域语言 |
| 需要具体讨论物 | engineering/prototype/SKILL.md | 低成本对照物；不冒充正式实现 |
| 执行拆票 | engineering/to-tickets/SKILL.md | 可演示纵向切片、一窗大小、依赖、用户确认 |
| 故事执行 | engineering/implement-spec/SKILL.md | 新上下文实现者、依赖图调度、集成与最终审查 |
| 单票实现 | engineering/implement/SKILL.md；engineering/tdd/SKILL.md | 已同意验证表面的局部实现与回归 |
| 故障归因 | engineering/diagnosing-bugs/SKILL.md | 收集事实、解释失败、验证修复 |
| 最终代码审查 | engineering/code-review/SKILL.md | Standards／Spec 两轴的新上下文审查 |

本入口只适配这些差异，其余沿用上游：

- **决策与实施分开**：wayfinder 默认规划且每会话最多解决一张非研究票；继续遵守该节奏。Story执行器可连续完成全部获准执行票，不把这个节奏限制移植到实施。
- **父票职责分阶段**：to-tickets的“不修改或关闭parent”约束拆票发布阶段；最终整体验收通过后，由本入口的Story owner更新与关闭执行根票，不由拆票者或单票实现者关闭。
- **复用不等于再次授权**：部分上游写明创建／重置分支、worktree、提交、推送、PR、合并与清理。先用当前仓库规则和用户授权选择集成方式；保留现有修改，不执行未经授权或破坏现场的动作。缺提交权限时使用已确认的共享工作区、串行写入与字节摘要；需要更强隔离而无合适授权时明确报告。
- **调用按宿主能力适配**：用户专用技能不靠模型自动触发。用户委托本入口后，读取这些文档作为参考来实现上述步骤；不声称用户另行调用了它们。宿主提供可用技能调用入口时按其规则使用。
- **上下文与集成**：使用宿主真正的新上下文子 Agent，依赖边以“已集成并验收”为释放条件。独立任务并发受工具实际可用槽位限制；每票只保留一个写入所有者。
- **Tracker沿项目约定**：支持项目已配置的GitHub、GitLab或本地markdown。依赖优先用原生关系，缺能力时用项目正文约定；父子关系按项目能力表达，链接用标题包裹。没有tracker时使用to-tickets本地票形态，不另建服务。
- **验收补足**：implement-spec的最终code-review之后，增加独立Story用户旅程验收和全证据索引。最终代码审查与运行验收可由同一个新上下文验收Agent负责，避免为仪式固定加角色。
- **只加载当前需要的材料**：已有Story可直接沿用，不强制调用to-spec生成很长的用户故事清单；不重跑完整访谈、不复制上游技能或维护第二套执行引擎。
