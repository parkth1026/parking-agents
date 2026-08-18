# iteration-7 测试报告：跨技能契约（G1-G5 修复验收）

**日期**: 2026-08-15 | **套件**: `run-contract-tests.mjs`（29/29 PASS）
**范围**: jenkins-log-auto-learning / jenkins-pair-analyze / ue-error-solver / epic-ue-assistant 四技能交接面

## 修复内容与验收对照

| 缺陷 | 修复 | 验收用例 |
|------|------|---------|
| G1 `--knowledge`/`:see=` 零校验 | session.mjs stage done 机械门禁：存在性 + rawDir 包含 + `:see=` 指向 rawDir/wikiDir 内真实文件 | C6-C8, C14-C16 |
| G2 知识文件可检索性无护栏 | 门禁强制：一级标题 + 内容含错误码 token（score 型=ErrorCode，infra 型=reason）；ue-error-solver search-kb 增加文件名兜底匹配 | C10-C13, K3 |
| G3 score 无上界 | grammar 收紧为 0-10 | C2-C4, C17 |
| G4 双写入方口径不一 | ue-error-solver save-knowledge 命名对齐 `{job}-{build}-{code}-{desc}.md` + 头部对齐；删除"rawDir 同级 details"死路径 | K4-K6 |
| G5 契约无测试钉住 | 本套件：session 门禁 + KB 目录双向可发现（details/scratch 递归）+ epic CLI 接口（子命令表、--question 契约、完整 flag 组合真实解析、响应字段） | K1-K2, K7, E1-E4 |

## 实锤验收（真实环境）

- 当年实测搜不到的 `twe-114-DiskSpaceExhausted.md`：标题补 token 后，真实
  search-kb --terms "DiskSpaceExhausted" **命中找回**；twe-40 无回归
- 门禁上线后正序防错实证：C6（假路径拒）、C10（无标题拒）、C11（无 token 拒）、
  C2（score=99 拒）全部 exit 1 且报错可指导修正

## 全量回归

iteration-6 56/56 · iteration-1 19/19 · iteration-2 pre/post 38/38 · ue-error-solver 51/51 · 本套件 29/29

## 附带修复

- iteration-2 e2e 夹具的 `runE` 三元表达式恒取 scan-pairs（session 调用全部失效）——改为正确透传；
  S8/S18/E1 夹具按新门禁改用真实知识文件
