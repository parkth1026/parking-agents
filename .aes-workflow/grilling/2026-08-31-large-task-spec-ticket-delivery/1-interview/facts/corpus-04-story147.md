# Fact: 第19例——Issue #147 大任务设计重访

- 派遣问题：核对最大历史案例的用户目标、任务分解、迭代与验收语义、版本反转及当前终态，检验“补 to-spec/to-tickets 就能解决大任务”。
- 完成：2026-08-31（本轮只读研究）
- 样本：2026-08-30-issue-147-steelman-rerun。
- 清点：162 个文件、11,853,821 bytes；这些是资料规模，不是执行 token 数、成功率或失败原因。
- 边界：未运行产品、脚本、浏览器或远端 tracker 操作；未修改原案例。图片只清点，没有在本专项逐张视觉检查。
- 原文读取：manifest 全文；context.md 全文（分段读）；rounds 63 条事件的 question/item/user_verbatim/choice 与已选分支投影，关键推翻由 context/正式 behavior 再对照；非全部未选方案逐字阅读。
- 原型读取：behavior.md、api-mock.md、example-run.md、impact-surface.md、design-qa.md；业务和来源审计、P14 确认与验证 JSON。diagram 两文件做实际 SHA256 核对，不宣称本轮渲染验证。
- 关联旧 Spec：docs/design/workflow-story-map/spec.md 首部与流程表（第1—65行）及 ADR0001/3/4；作为历史方案核对，不假设被本轮继续全盘批准。

## 查到的

| 事实 | 证据出处 | 对本次假说的作用 |
| --- | --- | --- |
| 原案例Q1允许推翻旧spec/ADR；Q2只重新完成设计定稿，不编码、不发布 | [rounds Q1/Q2](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/rounds.jsonl:1) | 缺新contract或实现不能直接判失败；旧Accepted ADR不是不经版本核对的当前全部规范 |
| Q3/Q4要求切断上下文爆炸、保留全局掌控，新会话能从持久事实重建 | [Q3/Q4](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/rounds.jsonl:3) | 大任务不仅需要拆小，还需要全局索引与交接信息完整性 |
| Q8原话说明“拆太多管理不过来，合在一起上下文爆表”，希望多Agent线路与完整旅程可见 | [Q8原话](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/rounds.jsonl:9) | 不能将本次痛点只解释为写长Spec，亦不能假设新建Agent Host就是答案 |
| Q22已经要求按可验收wave推进，执行后会出现bug、新问题和小需求变化，不应过小也不能一步跨完 | [Q22原话](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/rounds.jsonl:23) | 当前用户再次提出的分阶段并非新概念；一次静态拆票不能覆盖演进 |
| Q23/Q28/Q32分别锁定双图、目标integration SHA最终回归、Contract不变修复自动续波/承诺变化回Discovery | [Q23](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/rounds.jsonl:24)、[Q28](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/rounds.jsonl:30)、[Q32](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/rounds.jsonl:34) | 应支持总体承诺与分波演进、分层验收，不以子票结束代替总完成 |
| Q25补充要求风险匹配测试和逐项人工case，最终全量回归 | [Q25补充](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/rounds.jsonl:27) | 不宜每个小票机械全量测试，也不能只做文案grep；这些是该案例既有裁决，不自动给新任务增加硬AC |
| P10否决AesAgent依赖，P11又明确Runtime只同步、不调Agent，P12确认单向Skill→事实→Runtime→Web | [P10—P12](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/rounds.jsonl:55) | “整体交付责任”和“实现一个Agent调度Runtime”必须拆开；不能由前者推导后者 |
| P13锁required/optional Lane，P14只确认业务五件套不确认Web、不授权实现 | [P13/P14](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/rounds.jsonl:62) | 确认对象必须有范围；不能把“继续”解释为全部通过 |
| 正式behavior区分RepoLane和同仓Workstream，candidate和integration，Receipt和Gate，控制/生命周期/验收三轴 | [术语表](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/2-prototype/behavior.md:19)、[变化行](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/2-prototype/behavior.md:57) | 按前后端组件切分不等于按独立交付身份切分；需要可判定契约，不应由UI布局发明业务层次 |
| v5视觉QA曾记录passed，但业务审计列11项不对齐：历史被当当前、组件当RepoLane、candidate当integration等 | [v5业务审计](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/facts/web-v5-business-alignment-audit.md:18)、[历史QA说明](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/context.md:254) | 视觉/静态绿色不能覆盖业务语义；需要各层验证及相互映射 |
| P14有来源→确认版映射、bundle digest和每文件SHA256；本轮实际核对五个confirmed文件全匹配 | [确认凭据](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/2-prototype/evidence/webp14-v6/p14-confirmation.json:1) | 反驳“体系完全没有版本/批准绑定”：局部案例已正确具备，应推广有效机制 |
| v6只有53项有限静态/样本检查记录；browser NOT_RUN、design_qa blocked、real_runtime NOT_CONNECTED | [v6验证记录](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/2-prototype/evidence/webp14-v6/validation.json:1)、[design QA](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/2-prototype/design-qa.md:3) | 原型阶段未通过是真实边界，不是产品失败，不以v5旧证据代替v6 |
| 当前manifest阶段2-prototype，整套未done，未进入contract | [当前manifest](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/manifest.json:9) | 正确统计为进行中的设计案例；不能列入实现失败/成功分母 |

## 版本与依赖的具体反例

1. context 前部仍保存早期 Web 可提交领域命令，后部 P12 明确只读。正式 behavior:113 已将 P12 覆盖关系写清。直接摘取前文或只读旧 ADR 会得到相反规格；保留历史本身无错，缺乏确定性有效版本选择才危险。
2. 一条研究/设计票关闭，不等于代码已交付。正式 behavior:43—48及api-mock:35—60明确历史#147关闭与当前Discovery未完成共存、真实Delivery 0 VERIFIED。
3. web-v6-provenance-audit:49—55记录成员关系12条与依赖关系7条不同，root无依赖不代表整张图无依赖；评论顺序也不能被编造成原生blocked-by边。用户“关联最小”应理解为只保留必要阻塞，不是假装依赖不存在。
4. API-mock §2A与example-run场景10给出required满足/optional blocked仍可完成，同时required依赖缺失仍阻断、运行中把required改optional必须回Discovery。它是明确、有边界的终态设计，不需要再从零发明。

## 五文件摘要复核

本轮对 p14-confirmation.json 所列 confirmed 文件重新计算原始字节 SHA256：

| 文件 | 复核摘要 | 是否匹配记录 |
| --- | --- | --- |
| behavior.md | 92ae87b6c76f82002e5342b81fa99d4df341546943da9ea345212012609e7181 | 是 |
| api-mock.md | 56d88233532de057515cffe68fb3d48dd2917d0840979399747bc3a332b66a6e | 是 |
| example-run.md | 0da1d9796b19f5e5988180ca4b40f5b00b0463f9fe0a6a5c75a26dd7af5d8302 | 是 |
| diagram.html | 29e3f9f2b9ed42b8ec72d8acef4f56a86165c5b53a8b917683409af47efaecb9 | 是 |
| diagram-detail.html | 45bf2f605cfaed5f53bb7b720d5fe1700ac307ad5abfe126eb4565b343b16948 | 是 |

复核只证明当前文件字节与本地历史确认记录相符；不独立认证签署身份，不证明浏览器或产品实现通过，也不将业务批准扩到Web。

## 对制作目标的有界推论

- 有力支持总体Spec/父契约及分波执行；但旧Spec早已存在，当前薄弱点不能概括为“缺少to-spec这一步”。
- 应承接可替换会话、稳定用户意图、父子覆盖、显式依赖、分波回流和总完成证据；不必一次把本例所有概念搬进新流程。
- 上一轮新访谈Q1把“任务包”与“完整推进”作为从零二选的倾向过早。必须先呈现这里已有的Q8/Q22/Q28及P11/P12，再只裁定本次是否继承或调整；不能无视已有答案重问。
- 同样不能反过来把#147所有已定事项自动套入新任务：它是特定Story Atlas设计，当前制作范围仍未批准；本轮先提供跨案例结论，不继续逼问Q1。

## 未知项与没查的

- 未刷新#147及子票远端状态；本地审计本身声明没有完整原始API响应，不能升级为当前tracker证据。
- 未运行story.mjs/projection-runtime.mjs；example-run明确是对照物，不证明脚本存在。
- 未测模型上下文消耗或效果，不能从162个文件直接推出模型变笨的因果关系。
- 未查看全部截图、未独立重跑视觉检查；图片文件存在不等于本次视觉验收。

