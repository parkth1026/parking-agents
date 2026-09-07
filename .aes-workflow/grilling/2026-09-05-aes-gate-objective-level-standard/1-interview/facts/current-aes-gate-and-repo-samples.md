# 当前 aes-gate 与跨仓样本

## aes-gate 当前合同

- `skills/workflow/aes-gate/SKILL.md`：定位为门禁建设者，支持单条沉淀、批量检测、组装与
  aes-qa handoff；没有统一 assurance level schema。
- `run.toml` 被定为 gate 唯一注册真源，registry 只保存运行事实。
- 当前门状态是 `green/red/missing/stale`，评分是阻断强制性、覆盖、分层反馈、有效性、AI、持续演进；
  这些都不等同本任务的 L0-L5。
- `aes-qa` 当前使用 `automated/live/manual/screenshot` 作为证据形态；AES Master 的
  `GATE-qa` 校验 receipt outcome、candidate/base 绑定、NOT_RUN、截图 marker，但不校验仓库 gate 等级。

## 跨仓样本

| 仓库 | 当前注册 | 观察 |
| --- | --- | --- |
| AntAgentWeb2 | `gate` + `gate.quick`；内部 L0/L1/L2/L4 | L 是历史执行层号；#53 删除 HTTP L3 后出现空洞，证明层号被实现历史污染 |
| SuperTools-dev | `gate` + 独立 `verify.native` | 没有统一 L；完整 gate 混合脚本合同、CMake、engine 回归 |
| AesDataCenterManger | 无根 `run.toml` | 不能假设每仓已有标准注册面 |
| parking-agents | 无根 `run.toml`，但已有 aes-gate skill | 技能自举报告曾把无 run.toml 记为 G0 缺口；G0 与新 L0 存在术语碰撞风险 |

## 兼容性与迁移事实

- 旧 aes-gate 用 `G0` 表示“缺 run.toml”缺口，不是 assurance level；新标准需要重命名该缺口编号域。
- `run.toml` 当前 action schema 只有 `id/name/kind/run`；若等级成为机器合同，需要配套 metadata
  载体或版本化扩展，不能只写进 name。
- 历史 report/receipt/issue 中存在大量裸 `L0/L1...`；新标准只能约束新证据，旧证据必须标为
  `legacy-unqualified`，不能回溯性重解释。
- 旧 #41/#42 已完成的是 gate builder；本任务是对 open map #102 的标准扩展，不应改写旧决议历史。

## 验证基建候选池

- `node skills/workflow/aes-gate/run-tests.mjs`：aes-gate contract/selftest。
- `node skills/workflow/aes-worktree-board/run-tests.mjs`：Master/receipt/GATE-qa 全域回归。
- `npm test`：parking-agents 发布树与安装/发现回归。
- `node skills/workflow/workflow-interview/scripts/session.mjs ...`：三阶段结构门。
- 跨仓 fixture：至少用 library/CLI、desktop app、service/data pipeline 三种仓型做分类正反样例。
- 语义验收：给定同一批 gates，独立 agent 应在不读仓库特定解释的情况下得到相同 L；需要新建 eval，代价含先建。
