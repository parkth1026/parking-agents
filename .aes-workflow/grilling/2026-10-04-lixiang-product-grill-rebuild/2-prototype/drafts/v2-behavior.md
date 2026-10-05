<!-- draft v2 | published 2026-10-04T18:10+08:00
     用户意见：v1 六质疑点经三路 subagent 审计（仓规/行业/红队）后由用户拍板三项
     （换点名习惯、ceo-copilot 全量重跑、打包排除 archive），其余 11 条必修默认成立
     状态：confirmed（已转确认版） -->

# 行为对照表: 2026-10-04-lixiang-product-grill-rebuild（v2）

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | 用户说「用李想方法论盘一下 X」（不点名，旧习惯短语） | 语境触发，进入九模块复盘 | **不触发**（名字触发负例，trigger-evals 显式收录该短语）。用户点名 lixiang-product-grill／李想产品复盘 才触发（用户已裁定换点名习惯） |
| 2 | 用户点名 lixiang-ceo-grill（旧名） | 触发旧技能 | **不触发**（负例，评测显式定义期望行为）。干净断裂，无别名兼容 |
| 3 | 用户点名 lixiang-product-grill 或「李想产品复盘」 | （技能不存在） | 触发。开场问范围（一次一问），**菜单倒序**：①指定维度（如「只盘定价」，1-3 轮）②单个模块（产品战略／从0到1／从1到10，各约 5-15 轮）③全量 14 维度（垫底，每维度 1-3 轮）。顺序固定：战略→0到1→1到10，禁止反向 |
| 4 | 逐维度复盘·某维度第 1 回合 | 亮九模块标准→引用用户思考→对照→问缺口 | 亮 16 讲该维度标准句（逐字引文+讲次）→引用用户思考→对照→问缺口。协议八步不变。**smart-skip 默认激进**：事实底座已能对照的项先出示对照裁定请确认，只对覆盖不满的项发问 |
| 5 | 某维度需要追问弹药 | 仅题库内置追问/红旗 | **先读该维度 wiki source 页**（题库该维度块带 S-页指针，读取是可核对动作）取案例链与推理过程；追问引案例锚点（门店市占 8 倍、成本 20%→5% 等）。**裁定唯一依据仍是题库标准句**；wiki 只供弹药与语境，不承载裁定标准 |
| 6 | 用户质疑「李想原话是不是这个意思」 | 按需读 lixiang-ceo-article.md 对照 | 读该维度 wiki source 页引文，必要时读 references/archive/ 对应讲全文（19 篇 md，带溯源头：来源仓/抓取日期/仅个人使用标注） |
| 7 | 层间依赖检查（收尾前专项） | 四断裂点 | **五断点，逐条带课程逐字锚点**：编译时锚得到原句才保留原表述；锚不到的（现草案中断点 1「总纲」与断点 5「回扣目标」最弱）在题库标注「本技能自构检查」或砍掉。**先锚点定稿、后冻结 run-tests 断言** |
| 8 | 最终报告矩阵 | 9 模块×三层表 | 14 维度×三模块表；证据分布与裁定四档计数同构保留 |
| 9 | 边界：材料贫瘠单轮复盘 | 空话点名、缺失不硬凑、按九模块 | 同构，按 14 维度组织 |
| 10 | 边界：用户两次催促 | 不耐烦降级 | 不变 |
| 11 | 边界：原话已覆盖合格线 | smart-skip | 判定素材新增 wiki 对照（见变化行 4 激进姿态） |
| 12 | web 端用户复制 web-prompt.md | 九模块单文件 | 16 讲 14 维度单文件（~240 行），自包含不变 |
| 13 | 旧文章 lixiang-ceo-article.md | 列在资源加载清单「按需」 | **退出运行时加载清单**；SKILL.md 仅在边界节一句话说明其存在与适用域（CEO 方向视角、非本技能尺子）。头部加非尺子声明 |
| 14 | ceo-copilot 的 description 让渡句 | 「用户明确要求以李想创业课程逐模块复盘……不触发本技能」 | 措辞同步：「李想创业课程」→「李想产品方法论课程」；**让渡路由行为不变**（该类召唤仍让渡给本技能） |

## 不变清单

1. 复盘协议八步（亮标准→引用你的思考→对照→问缺口→红旗点名→校准式认可→证据分级→模块裁定附依据）
2. 一次一问铁律；多问句拆开逐问；问完即停
3. 提问写在对话正文，不使用 AskUserQuestion 类结构化提问工具
4. 证据三级／裁定四档；合理答案判据三条件；「没想过」也算合理答案
5. 层序禁止反向；报告七节结构与「你是怎么思考这个产品的」节；推荐四要素硬性
6. run-tests.mjs 是结构完整性唯一判定尺；复盘质量走人工评审
7. output-evals 3 场景结构；history.json runs schema
8. ceo-copilot 让渡路由行为（只改措辞与题库元数据，见变化行 14 与配置差异）
9. 协议对「先收集用户怎么想、事实自己查」的要求

## 配置差异

| 字段 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| frontmatter name | lixiang-ceo-grill | lixiang-product-grill | 点名换新名（变化行 1/2） |
| description | 语境全描述 | 名字触发字款式：`lixiang-product-grill / 李想产品复盘`（剔除 name 后 ≤16 字符，合规） | 旧短语与旧名=负例 |
| agents/openai.yaml | display_name/default_prompt("Use $lixiang-ceo-grill…")/short_description 全绑旧名旧尺子 | **文件保留、内容同步**：三字段换新名新身份 | 避免断链（仓规 A4） |
| design.md | 触发场景节按语境写 | 加「触发模式：名字触发」声明行（法典记录位） | — |
| history.json 顶层 skill 字段 | lixiang-ceo-grill | 重写为新名；runs 追加 bank_epoch 2 | 旧 run 原样保留 |
| 用户级 symlink | lixiang-ceo-grill → 旧路径 | lixiang-product-grill → 新路径（commit 后、评测前重建） | 删旧链建新链 |
| ceo-copilot trigger-evals.json/run-tests.mjs | 规范名旧名；3 负例 expected_skill=旧名；source 指 pub/ 旧路径 | 换新名新路径；**按定稿条款视为新题库全量重跑其触发评测**（用户裁定 q8） | benchmark 跨纪元 |
| package-skill 打包出口 | 全量打包 | **排除清单加 references/archive/**（repo 内始终保留；用户裁定 q9） | 分发版溯源降级为仓外指引 |
| 新增数据文件 | — | trigger-evals.json（正例=点名，含新名中英文；负例=旧习惯短语/旧名/邻域语域）、trigger-benchmark.json（真实 schema：split/rounds/train/test/valid_probes/invalid_probes） | 五件套补齐 |
| 评测执行链 | —（草稿 v1 曾误写 npm run evals） | **真实流程**：trigger-eval.md 探针 spawn（每题 3 探针）→ aggregate-trigger.mjs --persist；output evals 含 without_skill 基线臂 + with_skill_no_refs 臂（验证 wiki 增益） | — |
