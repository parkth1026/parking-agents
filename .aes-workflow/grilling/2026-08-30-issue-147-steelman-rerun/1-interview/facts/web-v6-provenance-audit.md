# Fact: Web v6 历史 Issue 字段来源审计

调查者：只读 subagent v6_provenance；主 Agent 已完整读取其报告并聚合。本文件不是用户裁决。

## 范围和证据限制

本次只核对本地事实摘录，未访问 GitHub。历史抓取日期为 2026-08-30，精确抓取时间未知。没有找到随本轮材料保存的独立完整 API 响应；不能把摘录称为完整原始 API JSON，也不能把 issue.updatedAt 或文件 mtime 当 fetchedAt。

- S1：1-interview/facts/issue-147-real-data.md；SHA256 4f3bc5a5c5e88cfeb26c8516470359d3ca5e6ee0342e4b3013ecc7010fccf9d0
- S2：1-interview/facts/web-v5-real-story-dataset.md；SHA256 aabbd06c803a5694434604d97c137bef36de8a20346fd95fd188f6dcf3c9f7fd
- S3：2-prototype/drafts/v5-story-work-graph.html；旧显示值，不作为 tracker 权威来源。

## 逐字段结论

| 字段 | 证据 | 正确边界 |
| --- | --- | --- |
| 原始 title | S1:15、92–103 | 历史 ISSUE FACT；图上的简称另标 DERIVED，保留完整标题 |
| state | S1:16、88；S2:49 | 历史 CLOSED；不表示当前 dossier 完成，更不表示 Delivery PASS |
| author | S1:19；S2:49 | tracker author，不是 runtime owner |
| assignees | S1:21；S2:49 | root 空数组，子票 parkth1026；只能显示快照 assignee |
| runtime owner | 无证据 | NOT_VERIFIED；不得借历史 author/assignee 填造 |
| membership | S1:88–105；S2:12、49 | 12 条原生 contains，不是 blocks |
| dependency | S2:53–77 | 7 条 descendant native dependency；root 自身 0/0 不代表全图 0 |
| comment count | S2:53–64 | 历史计数不等于评论内容、批准或验收 |
| 评论交付与顺序声明 | S1:78–84 | ISSUE COMMENT；作者声明，不是 typed Receipt |
| kind/why/next/unlocks | S3 的原型归纳 | DERIVED，不能继承整节点 ISSUE FACT |
| current dossier revisits | 当前 rounds/manifest | DOSSIER / 领域映射，非 GitHub 原生字段 |

v5 的子票标题全部经过缩写或改写；尤其 #152 的“独立组合层技能”把结论写进原本仍列举多个候选的 title。v6 保留 rawTitle，并在 Inspector 展示原文；图卡简称明确属于编辑派生。#159 的 contract 类别也是展示归类，原生 issueType 并不存在。

## 原始标题

- #147 story 级全链条工作流整合设计
- #148 调研：workflow-interview-web 能力全景盘点
- #149 调研：wayfinder 双变体与票协议深读
- #150 调研：aes-worktree-board 星图与 Issue 关系数据面
- #151 调研：aes-workflow engineering 路由与门禁思想
- #152 裁决：整合能力落点——升级 interview 家族 / 独立新技能 / 强化 wayfinder
- #153 裁决：执行与验收的挂载架构
- #154 裁决：票载体与 claim 强度
- #155 裁决：三阶段门禁与 map 票流的融合
- #156 裁决：决策档案分层——map 索引 + 票级 dossier 两级同构
- #157 裁决：新编排技能命名与发布路径
- #158 裁决：web 投影层与星图归一——双 tracker 渲染归属
- #159 定稿：workflow-story-map 设计 spec + ADR 撰写

## 关系

原生 membership：#147 contains #148…#159，共12条。

原生 dependency：148→152、148→153、148→155、149→152、149→154、150→153、158→159，共7条。

#151、#156、#157 在快照中没有 native dependency；不代表没有语义关联。S1 早期“没有 GitHub dependency”泛化已被 S2 的逐票核对纠正，不能继续沿用。

root 评论 https://github.com/parkth1026/parking-agents/issues/147#issuecomment-5460289640，作者 parkth1026，时间 2026-08-29T04:18:30Z，表达“#148–151 调研组 → #152 → #153 → … → #159”。评论没有声明四张调研票按编号串行，也没有单独声明 #151→152。v5 将调研组压成该端点边属于图示推断；v6 不新增此二元边，评论 overlay 仅表达 #152 起的回溯且标 DERIVED from ISSUE COMMENT。#158→159 同时有 native 与 comment 证据，不能由此把整条评论链升级为原生依赖。

子票分片给出评论数量与摘要，未完整保留各条评论 ID/URL/正文；不得伪造子票原文引用。

## 主 Agent 应用与停止点

v6 的历史节点使用 ISSUE SNAPSHOT 总标签，再在字段层分开 rawTitle/state/assignee、评论声明与编辑派生；runtime owner 保持 null。真实数据默认展示当前 dossier，并可单独切到历史图；Delivery NOT_CONNECTED / 0 VERIFIED 是“本原型未验证”，不宣称客观上不存在执行者或证据。

本次未复验 tracker 实时值、未验收历史 spec/ADR、未替用户做业务裁决。模拟完整闭环只依据 P14 确认版，而非旧分片里的 WEB/CORE 假 Lane 建议。
