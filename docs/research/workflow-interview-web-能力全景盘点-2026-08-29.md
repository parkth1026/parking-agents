# workflow-interview-web 能力全景盘点

- 票：parkth1026/parking-agents#148（wayfinder map #147「story 级全链条工作流整合设计」子票）
- 日期：2026-08-29。方法：`research` 技能（一手来源、结论挂证据）。
- 调研对象：`.agents/skills/workflow-interview-web/`、`.agents/skills/workflow-interview/`、`.agents/skills/aes-interview/`、`.agents/skills/aes-prototype/`、`.agents/skills/aes-goal-contract/` 全量深读；辅以 #146（两载体同构裁决，已关闭）、#147（map 票面）。
- 本文所有 `SKILL.md`、`asking.md`、`web-protocol.md`、`design.md` 引用均指该技能目录下同名文件；`.mjs` 引用指对应 `scripts/` 下脚本。行号以 2026-08-29 工作区版本为准。

## 〇、架构分层总览

家族与 web 层的权威关系是理解全部能力的钥匙：

- `workflow-interview` 是编排器，「自己不产出任何文件」（workflow-interview/SKILL.md:11-12）；三阶段分别由 `aes-interview` / `aes-prototype` / `aes-goal-contract` 产出（同文件 :14-22）。
- `workflow-interview-web` 自我定位为「交互与决策档案投影层，不是第二套访谈逻辑」；「三阶段门禁、提问分诊、确认版产物和 Goal Contract 仍由家族技能定义；本技能只替换提问、展示和确认的载体」（workflow-interview-web/SKILL.md:9-15）。
- 真源层级固定：manifest/rounds 只由家族 `session.mjs` 写（workflow-interview-web/SKILL.md:49-52）；静态档案 authority 顺序「最终 Goal Contract → 已吸收的家族过程文件 → Web submission/ledger → 浏览器草稿」（web-protocol.md:204-206）。
- 唯一的跨层代码耦合是只读投影库 `workflow-interview/scripts/lib/dossier.mjs` 随家族分发，web runtime import 它（server.mjs:24-25 注释明言是「runtime 不 import 家族代码」的唯一例外）；#146 裁决后决策档案是家族核心逻辑（#146 票面：「决策档案算核心逻辑……两边期望一致」）。

## 一、能力全景清单

格式：名称 | 定义 | 载体 | 证据。

### A. 家族技能承载（载体无关，真源在盘上）

**A1. 三阶段门禁与阶段状态机**
| | |
| --- | --- |
| 定义 | `1-interview`（锁需求）→ `2-prototype`（锁对照物）→ `3-contract`（锁验收）串行推进；前一阶段状态非 `done`/`skipped` 不得进下一阶段；`done` 不是自报的，`session.mjs` 收到 done 时当场跑结构闸门，不过就拒收；`skipped` 仅 2-prototype 可用且必须带 `--reason`；`needs_reinterview` 打回第一阶段 | 
| 载体 | 家族（workflow-interview 编排 + session.mjs 执行） |
| 证据 | workflow-interview/SKILL.md:14-22（三阶段表）、:59-66（门禁与 skipped 语义）；session.mjs:308-352（`gateDone` 三阶段结构闸门）、:446-453（done 强制校验）、:457-470（skipped 限制）、:482-495（needs_reinterview 回退与阶段推进）；web 侧明确「阶段推进仍只调用家族 session.mjs stage / finalize」（workflow-interview-web/SKILL.md:31） |

**A2. 提问方法论与三档分诊**
| | |
| --- | --- |
| 定义 | 方法论横向共用一份（「方法论横向，阶段纵向」，asking.md:1-7）：批量问不挤牙膏（一轮问完所有互不依赖歧义，:9-20）；问到本质层（两选项落到同一实现就没问到点上，:23-29）；先分诊——置信 ≥80%×可逆 → 默认区（不反对就算定）、置信 ≥80%×难逆 → 确认区（要回一个字）、置信 <80% → 提问区（完整三段加百分比），且「跨出仓库边界的事一律进提问区，置信多高都一样」（:31-56）；三段=选什么/好处/代价，缺一不可（:98-121）；百分比是分布形状信号，34/33/33 是警报（:124-139） |
| 载体 | 家族（asking.md，三个子技能共同引用） |
| 证据 | asking.md 全文，分诊矩阵 :39-42，仓库边界条款 :47-56；aes-goal-contract 把同一把尺子用于验收分诊（「你出概率和途径，他出影响」，aes-goal-contract/SKILL.md:58-72） |

**A3. 结构化 response type（九种问答 schema）**
| | |
| --- | --- |
| 定义 | `ask.response.type` ∈ single_select / multi_select / boolean / short_text / long_text / number / date_time / ranking / evidence；`pct` 仅 `single_select` 必填且加和 100±2（多选选项是候选集合不是概率分布，不带 pct）；multi_select 数量边界 `min_selections`/`max_selections`（文档写法 `min`/`max` 落盘时正规化）与 `exclusive_keys` 互斥 |
| 载体 | 家族（rounds.jsonl schema；#146 裁决从 web 下沉）；web 是渲染与发布校验投影 |
| 证据 | session.mjs:150-151（RESPONSE_TYPES 与 web 同源注释）、:179-205（pct 仅单选强制 + ±2 容差理由）、:396-406（min/max 正规化，两名不一致直接拒）；aes-interview/SKILL.md:168-174（家族字段表）；web-protocol.md:102-119（type 表）、:122-139（多选示例与规则）；publish.mjs:99-157（发布侧同口径校验）；asking.md:146-163（纯对话版多选问法） |

**A4. Goal Contract 生成（例子聚类 → AC → 四档 Verify）**
| | |
| --- | --- |
| 定义 | 验收条件从具体例子聚出来不发明（例子池=确认版对照物：behavior 变化行/api-mock 报文对/example-run 场景/mock 关键状态/diagram 改动标注）；一个任务 ≤7 条 AC，超了说明该拆；每条 AC 恰好挂一行 `Verify: [A|B|C|D]`；`目标/范围/强约束/验收条件` 四节=验收摘要；契约必须自包含（单独拿走仍完整可交接，唯一允许指回 issue 内部的是「读什么」点名的确认版对照物）；「自主边界」「残留风险」从已有分诊/难逆标记聚出，不另问一轮 |
| 载体 | 家族（aes-goal-contract + goal-contract-shape.md） |
| 证据 | aes-goal-contract/SKILL.md:27-50（例子收集）、:126-146（对照物进验收、同一件事不判两遍）、:169-192（自主边界/残留风险来源、自包含不变量）；goal-contract-shape.md:7-13（四节摘要）、:17-144（骨架）、:154-179（不进验收条件的三类 + 条数聚类）、:183-196（四档语义）；validate-goal-contract.mjs:130-131（AC>7 拒收并要求拆任务）、:153-178（每 AC 恰好一行 Verify）、:221-230（引用过程文件直接拒） |

**A5. finalize 校验链（结构校验 + [A] 冒烟 + 交接闸门 + 交接指令）**
| | |
| --- | --- |
| 定义 | 一条命令四件事：① 跑 validate-goal-contract 并回填 manifest.validation；② 跑全部 [A] 档 Verify（此刻期望全红；UNRUNNABLE 是唯一要拦的——说明 AC 写错了）；③ 交接可执行性闸门（契约不在仓库根之下 WARNING、档位分布点名非 [A]、一条 [A] 都没有 WARNING、残留风险对账）；④ 现场生成交接指令并检查 ≤4000 字符（codex `/goal` create_goal 硬上限），指令不落盘 |
| 载体 | 家族（session.mjs finalize + handoff-prompt.md 模板） |
| 证据 | session.mjs:686-780（finalize 全流程；残留风险对账 :744-753；交接指令生成 :755-766；4000 上限 :767-771）；:505-601（verify/extractVerifyLines/classify，UNRUNNABLE 判定 :539-547）；handoff-prompt.md:31-54（`/goal` 变体与 4000 硬上限）、:56-63（为什么只有这么短）；aes-goal-contract/SKILL.md:207-232（冒烟三判读、交接三读法） |

**A6. 残留风险对账**
| | |
| --- | --- |
| 定义 | 用户说「别问了直接干」时把没问的东西用 `--residual-risk` 记进 manifest（一句）；跳过的阶段带 reason；finalize 拿 manifest 的 residual_risk 和被跳过阶段跟契约「残留风险」节对账，对不上直接拒——因为「契约会被单独拿走，manifest 不会跟着走」 |
| 载体 | 家族 |
| 证据 | workflow-interview/SKILL.md:112-114（当场落盘约定）；session.mjs:476（--residual-risk 入 manifest）、:744-753（对账拒收及理由）；validate-goal-contract.mjs:214-219（「残留风险」写了标题就必须有条目）；goal-contract-shape.md:85-95（残留风险 vs 挡着的事的语义区分） |

**A7. 非 [A] 验收面交接**
| | |
| --- | --- |
| 定义 | 只有 [A] 档会被真的执行，但四档都要数出来；finalize 与终态报告逐条点名非 [A] 档（「长时程执行里没有任何东西能反驳『我做完了』」，交接时要当面说清哪几条得人来看）；一条 [A] 都没有 = 完成判定全靠自陈 = 没有终止条件，要停一下 |
| 载体 | 家族（web 收尾同样要求报告，见 B7） |
| 证据 | session.mjs:505-511（「非 [A] 的那几条正是长时程执行里没有任何东西能反驳『我做完了』的地方」）、:728-739（档位分布逐条列出 + 无 [A] WARNING）；workflow-interview/SKILL.md:88-90（终态报告点名）；aes-goal-contract/SKILL.md:226-232 |

**A8. manifest / rounds 真源机制（单一写入者 + 结构 schema + 幂等续跑）**
| | |
| --- | --- |
| 定义 | issue 目录全部落在 `.aes-workflow/grilling/<slug>/`（session.mjs:53-55）；`manifest.json` 的 schema 只存在于 session.mjs 里，任何技能/subagent 不许 Edit/Write 直改；`rounds.jsonl` 只经 `session.mjs round` 追加且先过 schema 校验（单次 O_APPEND 短行天然原子）；`init` 幂等（已存在只读状态不覆盖）；`rebuild` 从目录扫描重建且判定口径与 done 闸门不分叉；rounds 行带 `overturned_recommendation`（你给低了却被选中，唯一能看出判断偏哪的信号）、`cross_repo_boundary`、`triggered_by`（回流问题带来源） |
| 载体 | 家族（session.mjs） |
| 证据 | session.mjs:3-17（头注释「issue 目录的唯一写入者」）、:79-87（读→改→tmp→rename 唯一写路径）、:356-379（init 幂等）、:384-417（round 校验+追加）、:605-673（rebuild，判定同口径 :622-648）；workflow-interview/SKILL.md:35-36（manifest 只由 session.mjs 写）；aes-interview/SKILL.md:157-189（rounds 字段表与可 grep 字段理由）；web SKILL.md:49（同款约束在 web 侧重申） |

**A9. 决策档案（dossier）重投影**
| | |
| --- | --- |
| 定义 | 从真源（manifest / rounds.jsonl / context.md / contract.md + web 的 state/submissions/consumed/ledger）只读投影单页自包含 HTML 档案：任务原文、每轮全部候选及优劣势、canonical 决策、Goal Contract（仅 finalize 通过后投影为契约，dossier.mjs:270-273）、来源文件 sha256 清单、事件账本、追踪矩阵、state/dossier digest；纯对话载体无 `web/` 时从 rounds.jsonl 投影（「决策档案不依赖载体存在」）；它是访谈的交付物、与契约同级，不是 Web 载体附属品 |
| 载体 | 家族（投影库 `lib/dossier.mjs` 随家族分发；web 的 export-static 与 GET /export 复用同一实现） |
| 证据 | dossier.mjs:1-9（两载体唯一投影实现、只读不写真源）、:142-194（`projectFamilyTrajectory`：rounds 行→页面轨迹，答案还原成与 web submission 同构）、:196-218（`projectContractFinal` 仅 validation.status=valid）、:220-246（追踪矩阵）、:248-295（buildDossier + 双 digest）、:416-436（renderDossierHtml，内嵌 machine JSON）、:439-451（输出路径按载体分流）；export-dossier.mjs:2-7；workflow-interview/SKILL.md:82-87（「与契约同级……共用同一投影实现」）；#146 验收「同一份访谈数据两载体 rounds.jsonl 同构」 |

**A10. 事实调查与四分类分片**
| | |
| --- | --- |
| 定义 | 只调查会改变目标/范围/公共行为/兼容性/验收/硬约束/难逆成本的事实；固定查清「仓库现有验证基建」作为下阶段验收途径候选池；事实四分类 Fact / User decision / Agent-owned / Blocked；两个以上互不依赖的事实问题可并行派遣只读 subagent，每个写 `1-interview/facts/<主题>.md` 互不重叠、不问用户、不碰 manifest；产出 `context.md`（六节固定结构） |
| 载体 | 家族（aes-interview） |
| 证据 | aes-interview/SKILL.md:24-30（调查范围 + 验证基建固定项）、:32-36（subagent 分片协议——家族内建的最明确「拆上下文」机制）、:38-52（四分类）、:91-155（facts/context 模板） |

**A11. 影响面七面扫描与确认版对照物（例子池）**
| | |
| --- | --- |
| 定义 | 判据「改完之后程序在哪些地方跑起来不一样、谁会看见」；逐面扫七面（用户可见界面/可观察行为/可运行输出/对外接口报文/用户配置/历史兼容性/架构与依赖），判「无」也要写下来；判「有」必出对照物，架构判「有」必须含 diagram.html（闸门当场拦）；未确认草稿带元数据进 drafts/，确认版不可修改（「不锁住尺子，被优化的就会是尺子」）；迭代撞出的新材料歧义带 `triggered_by` 回流 needs_reinterview，不就地糊；确认版对照物同时就是下一阶段例子池，不另立清单 |
| 载体 | 家族（aes-prototype + session.mjs 闸门） |
| 证据 | aes-prototype/SKILL.md:27-54（七面表 + 判无不许省）、:56-73（七面全否=needs_reinterview；skipped 唯一合法情形）、:75-170（五类对照物规范、fidelity ledger）、:171-187（迭代回流 triggered_by）、:189-200（例子池）；session.mjs:257-306（闸门校验、impact-surface 凑数拦截 :318-328、diagram 强制 :332-338） |

**A12. 五维自评收口**
| | |
| --- | --- |
| 定义 | 每轮回答后按 意图/结果/边界/约束/现状 五维自评（已定/部分/未定），没有维度停在「未定」且收口审计通过才能结束提问；`stage done` 用 `--assessment` 交齐，闸门查「未定」拒收 |
| 载体 | 家族 |
| 证据 | aes-interview/SKILL.md:73-87（自评与两条停止条件）；session.mjs:147（ASSESS_DIMS）、:245-255（validateAssessment 拒「未定」）、:309-314（并入 done 闸门） |

**A13. 简单不是跳过访谈的理由（需求侧防御话术）**
| | |
| --- | --- |
| 定义 | 六句常见推脱（别再问了/太啰嗦/方案定了/上轮分析过/直接排计划/验收你定）各配标准回应；照办但把没问的记成残留风险落盘 |
| 载体 | 家族 |
| 证据 | workflow-interview/SKILL.md:98-116（话术表 + 残留风险落盘） |

### B. web 投影层承载（载体特有）

**B1. 单页声明式交互入口（state.json 投影 + WS 推送）**
| | |
| --- | --- |
| 定义 | Agent 把每轮内容发布成声明式 JSON（round + 页面聚合字段），server 写 `web/state.json` 并 watch 广播 `state-updated`；前端按 state 渲染三视图（访谈流/契约/完整轨迹），不依赖 localStorage 作为权威（`GET /api/state` 返回 canonical dossier 投影） |
| 载体 | web |
| 证据 | publish.mjs:238-313（发布/校验/revision+digest/ledger）；server.mjs:469-481（/api/state 返回 buildDossier）、:668-674（watch state.json 节流广播）；web-protocol.md:58-100（发布 schema 与三档 item）；design.md:28-46（固定信息结构、逐题详情槽不跳动——AC-9） |

**B2. 提交吸收两阶段协议（submissions → 家族 rounds → consumed）**
| | |
| --- | --- |
| 定义 | 提交先原子落盘 `web/submissions/<round>.json`（一轮一个不覆盖、重复 409 以第一份为准）再回执；Agent 逐项映射成家族 round 行经 `session.mjs round` 写入，全部成功后才写 `web/consumed/` 标记；中途失败保留未消化状态，续跑按 rounds.jsonl 已有 q_id 去重补齐；「Web 文件不是 rounds.jsonl 的替代真源」 |
| 载体 | web（写入家族真源用家族写入器） |
| 证据 | workflow-interview-web/SKILL.md:22-24（每回合第 2 步）、:33-34（先入盘再回执/consumed 时序）；wait-submit.mjs:77-110（scan / mark-consumed 幂等+ledger）；server.mjs:505-536（409 判定、原子落盘、submission 记录发布时 round revision/digest）；web-protocol.md:164-184（提交映射规则：逐项保留候选文本/covers/pros/cons「不能压缩成一句摘要」） |

**B3. 提交唤醒与续跑协议（后台任务通知 + server 可恢复）**
| | |
| --- | --- |
| 定义 | Agent 把 `wait-submit.mjs --round <id>` 作为宿主后台任务运行（无超时），然后结束当前 Agent 回合；用户浏览器提交后文件出现、后台任务退出、通知唤起当前 Agent 回到吸收步；重开任务固定顺序：读 manifest → 扫描未消化提交 → 吸收并标记 → 探活或重启 server → 仍有 pending 就重挂等待，否则发下一轮；server 只保活提交入口不保活 Agent，默认 48h 空闲退出，进程退出不删任何盘上状态；禁止用 hook/插件/MCP/轮询/无限阻塞模拟唤醒 |
| 载体 | web |
| 证据 | workflow-interview-web/SKILL.md:20-31（五步回合循环）、:36-45（续跑协议）、:67-68（禁止模拟唤醒）；wait-submit.mjs:112-138（watch submissions 目录等待目标文件，`--timeout-ms` 只供测试）；server.mjs:104-116（probe 探活）、:135-183（start 复用/sticky 端口）、:605-617（shutdown 写 server-stopped、清凭据）、:29-30（48h idle）；design.md:19-20（「把 server 当可恢复的交互入口，不把它当 Agent 生命周期」） |

**B4. 降级阶梯**
| | |
| --- | --- |
| 定义 | ①宿主无后台任务能力 → 回合模式：仍发布页面，提交后用户回任务发任意消息唤醒，下一回合先读任务文本再读 submission，冲突以任务文本为准；②Node 不可用 → 纯文本家族原流程；③浏览器不可用 → 同②；三阶段范围与门禁在任何降级下不变 |
| 载体 | web（降级落点是家族流程） |
| 证据 | workflow-interview-web/SKILL.md:60-68；design.md AC-5（design.md:78） |

**B5. 会话安全与附件隔离**
| | |
| --- | --- |
| 定义 | server 只绑 loopback；首次 URL `?key=` 校验后设 HttpOnly/SameSite=Strict cookie 并 303 去 key；key 用 timing-safe 比较、只存在于 owner-only 文件与首次 URL、不写日志/git；WS 除鉴权还要求 loopback 同源 Origin；附件 iframe 空 sandbox + 收紧 CSP，`GET /files/` 只放行 assets 下普通非符号链接 basename；发布附件是复制到 `web/assets/`，确认版对照物保持只读 |
| 载体 | web |
| 证据 | server.mjs:82-91（safeEqual）、:213-224（authorized/originAllowed）、:446-457（key→cookie 303）、:558-582（/files 白名单+CSP）、:619-645（WS 升级双校验）；web-protocol.md:186-196（HTTP/WS 约定表）；publish.mjs:218-236（附件复制与不安全名拒绝）；web SKILL.md:53-55；app.mjs:616-624（iframe sandbox=''） |

**B6. 决策账本（decision-ledger.jsonl 摘要链）**
| | |
| --- | --- |
| 定义 | Web 侧 append-only 事件链，记录 `round_published`/`round_submitted`/`submission_consumed` 三类事件；每条带 `previous_event_digest` 与 `event_digest`，改删重排历史会破坏后续链；它是 Web 交互证据，权威低于家族过程文件与 Goal Contract；写入器留在 web 层（`lib/ledger.mjs`），读取与投影归家族 dossier.mjs |
| 载体 | web |
| 证据 | ledger.mjs:1-5（写入权/投影权分工注释）、:29-45（摘要链追加）；web-protocol.md:198-202；publish.mjs:294-306、server.mjs:537-542、wait-submit.mjs:101-106（三类事件写入点）；纯对话载体的账本就是 rounds.jsonl（#146：「decision-ledger 留 web 层（提交事件证据，纯对话版的账本就是 rounds.jsonl）」） |

**B7. 静态导出与终态报告（web 壳）**
| | |
| --- | --- |
| 定义 | `export-static.mjs` 与运行中 `GET /export` 生成自包含 HTML（断网可读、CSP 收紧、禁缓存）；web 收尾在家族终态报告之上追加：导出路径、dossier digest、非 [A] 验收面与精确交接指令一起报告，显式停止 server，盘上证据保留 |
| 载体 | web（投影实现是家族 A9） |
| 证据 | export-static.mjs:4-5（「本脚本只是 web 侧 CLI 壳」）、:34-43；server.mjs:483-494（GET /export）；workflow-interview-web/SKILL.md:70-75（收尾清单） |

**B8. 前端可用性与本地恢复**
| | |
| --- | --- |
| 定义 | 未提交答案以 slug+round 为键写 localStorage，提交成功删草稿；网络失败整轮 payload 进本机离线队列，WS 重连后顺序补发，409 视为已被首次提交吸收；重连 500ms 指数退避上限 30s；九种 response type 各有原生结构渲染（多选 checkbox+固定解释行、ranking 上移下移、evidence 每行一条等）；必答校验客户端先算、服务端再验 |
| 载体 | web |
| 证据 | app.mjs:28-55（草稿键）、:556-598（postSubmission/flushQueue/409 处理）、:906-911（指数退避）、:347-445（九类渲染）、:514-554（answerComplete/missingRequired/submissionFor）；server.mjs:276-396（服务端九类规范化+必答 422）；design.md:48-52 |

**B9. runtime 黑盒回归**
| | |
| --- | --- |
| 定义 | 根部 `run-tests.mjs` 一次执行覆盖启动、鉴权、发布、提交、恢复、附件隔离与关闭（AC-6；迭代记录称 runtime 16/16） |
| 载体 | web |
| 证据 | design.md:79（AC-6）、:93/100/102（回归数字）；scripts/run-tests.mjs（存在且自建 tmp issue 目录） |

### C. 编排与流程纪律（家族，跨能力）

- **每问必落盘**：问完一轮把问答与分诊追加进 rounds.jsonl，「只活在聊天记录里的百分比，上下文一压缩就没了」（asking.md:166-169）。
- **回退不是倒退**：重新提出的问题带「是哪份草稿撞出来的」落盘（workflow-interview/SKILL.md:68-74；aes-prototype/SKILL.md:171-187）。
- **跨 issue 全局视图不落盘、现扫**：`session.mjs list`（workflow-interview/SKILL.md:92-96；session.mjs:784-811）。
- **收束判据统一**：所有阶段的收口判据都是「还想问的问题，不同答案只会改变措辞，不会改变执行」（aes-interview/SKILL.md:83-87；aes-goal-contract/SKILL.md:119-123）。

## 二、「上下文爆炸」成因解剖

#147 票面对痛点原文：「workflow-interview-web 的 grilling 与全局掌控高效，但**大部分工作在一个 session 里执行**，story 级任务上下文爆掉进傻子区域」。以下按「必须同会话谱系」与「可拆而未拆」分开给证据链。

### 2.1 真正绑死会话谱系的环节：只有「唤醒绑定」一项

**（1）pending round 的等待-唤醒循环绑定当前会话。**
workflow-interview-web/SKILL.md:28-30：「把 `wait-submit.mjs --round <id>` 作为宿主后台任务运行，不设超时，然后结束当前 Agent 回合。用户在浏览器提交后，后台任务退出通知**唤起当前 Agent**。回到第 2 步，**直到当前阶段收口**」。宿主后台任务语义是退出通知只回到启动它的那个会话（ZCode `run_in_background`：keeps running across turns and re-invokes **you** when it exits）。注意这里有**回合边界但没有会话边界**：Agent 每轮结束 turn，但通知把同一个会话谱系拉回来，循环「直到当前阶段收口」——一个阶段的全部轮次（吸收→调查→分诊→构造 JSON→发布→挂等待）都累计在同一上下文窗口里。

**（2）三阶段推进也在同一会话延续。**
SKILL.md:31「阶段推进仍只调用家族 `session.mjs stage` / `finalize`」——编排器没有「阶段切换=切会话」的指令；续跑协议（:36-40）是为「重开任务」准备的异常路径，不是主路径的会话管理。于是默认路径是：**同一会话跑完三阶段全部轮次**。

除这两条外，其余环节**没有会话耦合**：

- **真源不耦合**：manifest/rounds/state/submissions/consumed/ledger 全部在盘上；`init` 幂等（session.mjs:362-379「已存在就只读出当前状态，一个字节都不覆盖」）；`rebuild` 可从目录重建（session.mjs:605-673）。design.md:19 明言设计意图就是「把 server 当可恢复的交互入口，不把它当 Agent 生命周期；**跨会话恢复只依赖盘上状态**」。
- **门禁不耦合**：done/skipped/finalize 的全部闸门都是文件结构判据（session.mjs:308-352、:686-780），换会话执行结果不变。
- **投影不耦合**：dossier 是只读投影（dossier.mjs:1-9）；export/finalize/verify 都是脚本。
- **吸收不耦合**：未消化提交靠 scan 发现（wait-submit.mjs:77-86），任何新会话按「读 manifest → 扫描 → 吸收 → 标记」即可接上（web SKILL.md:36-40）。

**结论：会话谱系耦合不是真源耦合、不是门禁依赖，只是「宿主后台任务通知」这一唤醒原语的副作用。** 换成显式回合边界（降级阶梯 1，SKILL.md:62-63：提交后用户回任务发任意消息）流程完全成立——这证明异步自动唤醒是便利性选择而非结构性必需。

### 2.2 可拆而未拆的环节（证据链）

| 环节 | 现状 | 拆分的依据已在盘上 |
| --- | --- | --- |
| 轮次循环 | 同一会话循环到阶段收口（SKILL.md:30） | 续跑协议本身就是「新会话冷启动清单」（SKILL.md:36-40）；每轮结束 turn 时磁盘已是完整恢复点；损失仅是会话内对用户措辞细节的「暖记忆」 |
| 阶段切换 | 同一会话连跑三阶段（SKILL.md:31） | `manifest.stage` + `next_action` 是显式接续点（workflow-interview/SKILL.md:40-43；session.mjs:489-495 写入下一步） |
| 事实调查 | 宿主会话内读规则+代码+测试+设计+日志（aes-interview/SKILL.md:24-25） | 家族已内建 subagent 分片协议：并行派遣只读 subagent，各写 `facts/<主题>.md` 互不重叠（aes-interview/SKILL.md:32-36）——这是现成的上下文隔离机制，但没有被当作强制策略 |
| 契约起草 | 读 context + 2-prototype 全部确认版对照物做例子池（aes-goal-contract/SKILL.md:33-40） | 例子池就是那几份固定文件名（aes-prototype/SKILL.md:189-200），新会话冷启动按清单读即可，量有界 |
| 校验/导出 | 无会话需求 | finalize/verify/export-dossier 全是脚本（session.mjs:686-780；export-dossier.mjs） |

### 2.3 体量放大器（为什么 story 级会爆）

1. **每阶段工作集包含全部上游产物**：prototype 读 context+rounds（aes-prototype/SKILL.md:23），contract 读 context+全部确认版对照物（aes-goal-contract/SKILL.md:33-40）。story 级任务的 context/对照物体量是普通需求的数倍。
2. **每轮 JSON 双向过模型**：发布侧构造带 covers/pros/cons/options 的完整 items（web-protocol.md:88-139）；吸收侧读 submission 后「用当时发布的 item 补齐家族行」「逐项保留候选文本、covers/pros/cons，不能压缩成一句摘要」（web-protocol.md:164-177）——信息保真的代价是每轮两份全量 JSON 都进上下文。
3. **方法论文档每会话载入**：web SKILL.md:12-15 要求完整读家族 SKILL+asking+当前阶段子技能（约千行级），三阶段各载一次对应子技能。
4. **缺 story→票拆解层**：家族的原子单位是「一件能独立交付的事」，validate-goal-contract.mjs:130-131 在 AC>7 时明确要求「拆成几个能独立交付的任务」，goal-contract-shape.md:168-179 说「聚出六条以上，这个目标太大了，拆」——但**拆出来的多件事没有任何编排层接管**：没有拆解协议、没有票间依赖、没有每票会话预算。story 级任务只有两个坏选项：塞进单 issue 三阶段（上下文爆），或人工拆票（失去 grilling 与全局掌控）。这正是 #147 要补的层。

### 2.4 小结

上下文爆炸 = **唤醒绑定把「阶段内全部轮次 + 三阶段」钉进一个会话谱系**（结构性根因，唯一硬耦合）× **story 级任务的单 issue 工作集无界增长**（放大器 1/2/3）× **没有拆解层把 story 切成有界票**（缺失层）。而磁盘真源、幂等续跑、subagent 分片、文件化门禁这些「可拆」的地基**全部已经存在**——缺的是把它们组合成显式会话边界的编排协议。

## 三、继承判别表（面向 #147 story 级全链条工作流）

### 3.1 可直接继承（家族真源/方法论，载体无关）

| 能力 | 继承方式 | 依据 |
| --- | --- | --- |
| A2 提问方法论与三档分诊 | 方法论文档直接引用。它本来就设计为「方法论横向，阶段纵向」（asking.md:1-7）；story 工作流的决策阶段（哪些问用户、哪些票自己定）与分诊矩阵同构 | asking.md 全文 |
| A1+A8 三阶段门禁 + manifest/rounds 真源机制 | 模式继承：单一写入者、schema 只活在写入器里、done 非自报、结构闸门、幂等 init、rebuild 同口径、`next_action` 接续点。story 工作流的票流真源应套同款纪律；`needs_reinterview` 回退协议原样可用 | session.mjs:3-17、:79-87、:308-352、:446-470 |
| A3 结构化 response type schema | 直接复用 rounds.jsonl schema（#146 已两载体统一）；story 决策轮次的问答落盘格式不变，pct 口径不变 | session.mjs:150-205；#146 |
| A4+A5+A6+A7 Goal Contract 全链（形状/校验/finalize/残留风险对账/非 [A] 交接） | 每张执行票的验收面直接用 contract.md 骨架 + validate-goal-contract + finalize 四合一；[A]-[D] 四档与「你出概率途径、他出影响」的验收分诊是 #147「验收回填与 story 收口协议」的现成判据；交接指令模板两变体（会话式 / `/goal`）直接可用 | aes-goal-contract/SKILL.md:198-254；handoff-prompt.md 全文；session.mjs:686-780 |
| A9 决策档案投影 dossier.mjs | 只读投影库直接复用。#147「决策档案与 map Decisions 的分层」问题：票级 dossier 用它从票真源投影，map 的 Decisions-so-far 保持索引层——投影库保证两级同构（这正是 #146 已验证的「两载体同构」架构推广到「两层级同构」） | dossier.mjs:1-9、:439-451；#146 |
| A10 事实调查 subagent 分片 | 放大为核心手段：story 拆解/决策阶段的调查全部走「subagent 写 facts/<主题>.md、互不重叠、不碰真源」协议，这是现成的上下文隔离模式 | aes-interview/SKILL.md:32-36 |
| A11 七面扫描与对照物例子池 | 方法论照用；story 的每票原型阶段沿用七面+确认版不可修改+例子池进 AC | aes-prototype/SKILL.md:27-200 |
| A12 五维自评 + C 组流程纪律（每问落盘/回退带源/收束判据） | 原样继承，全部是文件判据与文档约定 | aes-interview/SKILL.md:73-87；asking.md:166-169 |
| B2 吸收两阶段协议（submissions→家族行→consumed） | **模式**继承：任何异步输入（票评论、web 提交）进真源都应走「先原子落盘→逐项映射→全部成功才标记→失败可重试不丢输入」 | web SKILL.md:33-34；wait-submit.mjs:77-110 |
| B3 续跑协议三段式（读状态→吸收→续跑） | 直接继承为 story 工作流的会话边界协议骨架；它证明换会话零损失 | web SKILL.md:36-40；session.mjs:362-379 |

### 3.2 web 载体特有（后置投影层再谈，#147 已定「v1 web 交互面 out of scope」）

- B1 单页声明式入口与 WS 推送；B5 会话安全（loopback/key/CSP/sandbox）；B6 decision-ledger 摘要链（写入器留 web；纯对话账本=rounds.jsonl）；B7 的 HTTP 壳（GET /export）；B8 前端可用性与 localStorage 恢复；B9 runtime 回归。
- 其中 B3 的「宿主后台任务退出通知」唤醒原语**本身值得保留为通用原语**（它不属于浏览器），但须与「会话切割策略」解耦使用（见 3.3 第 1 条）。
- 真源设计可为投影层预留的挂点已存在：声明式 round JSON schema（web-protocol.md:58-162）就是「页面=状态投影」的稳定接口；只要 story 真源保持可投影（结构化 rounds + manifest），后置 web 面可以无伤重挂。

### 3.3 应放弃 / 必须改造

| 项 | 判定 | 理由 |
| --- | --- | --- |
| 「同一会话谱系跑完阶段乃至三阶段」的隐式默认 | **放弃**（这是缺陷不是能力） | 唯一硬耦合是唤醒绑定（2.1）；story 工作流必须显式设会话边界（每票/每阶段/每 N 轮），靠磁盘真源续跑——地基已在（2.2 表） |
| `web/state.json` 作为第二份页面聚合状态 | **后置层再议，倾向放弃** | 若 story 真源换成 issue/票系统，双状态维护应消失，页面直接从真源投影；现架构的「runtime 不 import 家族写入器」边界（web SKILL.md:50-52）已经为这种替换留好了缝 |
| 降级阶梯 1（回合模式）作为「降级」 | **升格为正选路径之一** | 显式回合边界正是天然的会话切割点（2.1 末段）；对 story 工作流，用户回话即换会话不损失真源 |
| 48h idle、sticky 端口、server-info 等 server 运营细节 | 放弃（属投影层） | 与流程真源无关 |

## 四、对 #147 设计的直接输入（3 条）

1. **会话预算的解法不是压缩上下文，是切割谱系**：全部真源、门禁、投影、吸收协议已经是文件化的，story 工作流只需在「票边界、阶段边界、轮次上限」三处显式结束会话并按续跑三段式（读状态→吸收→续跑）冷启动下一个。
2. **拆解层可借用契约层的同构思想**：家族在 AC>7 时强制「拆成几个能独立交付的任务」（validate-goal-contract.mjs:130-131），但没有接管拆出来的多件事；story 工作流的拆解输出应与 Goal Contract 同型（每票一份自包含验收面），这样 A4-A7 全部免改造复用。
3. **决策档案分层已有现成积木**：dossier.mjs 是只读投影库（#146 已裁决家族化），map 的 Decisions-so-far 保持索引、票级 dossier 保持投影，两级同构由同一库保证，不需要新协议。

## 附：证据文件清单

- `.agents/skills/workflow-interview-web/`：SKILL.md、references/web-protocol.md、references/design.md、scripts/server.mjs、scripts/publish.mjs、scripts/wait-submit.mjs、scripts/export-static.mjs、scripts/lib/ledger.mjs、scripts/web/app.mjs、scripts/run-tests.mjs
- `.agents/skills/workflow-interview/`：SKILL.md、references/asking.md、scripts/session.mjs、scripts/export-dossier.mjs、scripts/lib/dossier.mjs、scripts/validate-goal-contract.mjs
- `.agents/skills/aes-interview/SKILL.md`、`.agents/skills/aes-prototype/SKILL.md`、`.agents/skills/aes-goal-contract/SKILL.md`、`.agents/skills/aes-goal-contract/references/goal-contract-shape.md`、`.../references/handoff-prompt.md`
- GitHub Issues：#146（已关闭，两载体同构裁决）、#147（map 票面，`gh issue view 147` 输出）
