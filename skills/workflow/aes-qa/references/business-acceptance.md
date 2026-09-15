# 业务真实验收（live / agent-live 档操作配方）

> aes-qa `live` 与 `agent-live` 档的可复用操作标准。第一实例参照：消费仓 aes-agent
> issue #153 F-1 的 `docs/operations/real-provider-acceptance.md`（真实 Provider 与模型验收）。
> 本页是 tracker 无关的通用配方；GitLab 截图链路另见
> [screenshot-evidence.md](screenshot-evidence.md)。

## 何时进本配方

改动实际触及 GitHub identity、权限、外部 API（live 档），或需要 agent 驱动真实
浏览器/进程做业务旅程验证（agent-live 档）。判断标准见 SKILL.md「先定影响面，再定
档位」——选 `automated` 却改了 identity 等于没验；选 `manual` 却本可自动断言等于
把成本转嫁给用户，两边都算失职。

## 1. 证据分层：四层闭集与降档规则

agent-live 断言的 `backing.layer` 是闭集，缺一不可伪造：

| 层 | 指什么 | pointer 例 |
| --- | --- | --- |
| `dom-assertion` | 浏览器/客户端 DOM 内可机械断言的事实 | `dom:#session-card-88:visible` |
| `server-trace` | 服务端留下的真实调用痕迹（日志/请求记录） | `log:apps/server/2026-09-12T08-11#L420` |
| `read-model` | 持久化读模型里的可查询事实 | `sqlite:sessions/row-88` |
| `sidecar-session` | 被驱动进程的会话产物（CLI banner、spawn 记录） | `codex/sessions/2026-09-12T08-11.log` |

- 每条进 receipt 的断言必须带 `layer + pointer + digest`；`digest` 是被指工件的
  canonical sha256（`sha256:<64hex>`）——**无 digest 视同无托底**，整条降档
  humanChecklist（`AWAITING_HUMAN` + `demotedFrom: "agent-live"` + `demotionReason`），
  agent 不得代答。降档用 `scripts/v4-receipt.mjs` 的 `demoteUnbackedAssertions`，
  不要手搬条目。
- 「我看到了 X」这类观感断言四层都托不住——直接走 manual 档，别包装成 agent-live。
- 循环轮 finding 不要求 digest（只有进 receipt 的断言强制）。
- 同 candidate 换驱动模型不作废 receipt，但 `driver{model, capabilitySkill}` 变化
  必须在报文可见——执行者方差要可追溯。

## 2. 配额 / 凭据类 BLOCKED 口径

认证失败、配额耗尽、凭据缺失、账号不符**不是 FAIL**，记 `BLOCKED`（细化如
`BLOCKED_PROVIDER_AUTH`），保持 receipt 有效但不推进放行：

- 先做零成本预检（transport、pairing、权限、capability），再做一次**最小真实 Turn**
  （极短确定性响应），通过后才跑目标场景；`auth status`、Settings 状态、模型列表
  都不能替代真实 Turn。
- 预检任一步出现 `OAuth session expired` / refresh failure / 账号不符：停止、记
  BLOCKED、保留时间戳与去密错误摘要；恢复凭据后从预检第 2 步重跑。
- BLOCKED 不是失败也不是通过——由用户决定恢复凭据、授权更高成本或缩小范围；
  agent 不得用重启、缓存状态或更贵模型掩盖。

## 3. 正反例模板（fail-closed 必验）

live/agent-live 档必须双向闭环——只有正例的「真实环境验证」是半张验收单。

```json
{
  "id": "agent-journey-login", "kind": "agent-live", "outcome": "PASS",
  "driver": { "model": "<最低成本足够模型>", "capabilitySkill": "<指名的能力技能>" },
  "assertions": [
    { "claim": "正例：<合法输入产生期望业务效果>", "backing": { "layer": "read-model", "pointer": "<可复查位置>", "digest": "sha256:<工件摘要>" } },
    { "claim": "反例：<非法/越权输入被 fail closed，错误账号绝不能通过>", "backing": { "layer": "server-trace", "pointer": "<拒绝痕迹位置>", "digest": "sha256:<工件摘要>" } }
  ],
  "summary": "正例 <what> + 反例 <what> 被拒，双向闭环"
}
```

- 反例断言的对象是**拒绝本身**：错误账号被拒、越权 patch 被拒、非法输入报错——
  托底层通常是 `server-trace`（拒绝发生在服务端）。
- 无反例可设计时（纯展示类旅程），在 `summary` 里写明为什么反例不适用；
  「没想」和「不适用」是两回事。

## 4. 成本控制：最低成本足够模型 + 真实调用最小化

- 测试只选**能证明目标的最低成本模型**；验收对象本身是模型质量/上下文窗口/
  特定能力/精确 StagePlan 时才用契约要求的模型，不用低价模型替代。
- 高成本选项（thinking 等）默认关闭；上下文窗口取满足场景的最小档。
- 不静默切换 Provider、模型、账号或配置根——任何切换都产生新验收候选，必须重新记录。
- 顺序：零成本检查 → 一次最小真实 Turn → 目标场景。真实调用次数最小化是硬要求，
  不是风格建议。

## 5. tracker 无关手法配方（按能力指名组合既有技能）

能力层只经 reference 指名既有能力技能组合，**不内建浏览器驱动、不新造独立 skill**：

| 手法 | 指名技能 | 适用 |
| --- | --- | --- |
| 真实浏览器控制（read-only 配对会话 + IAB 控制面） | `browser-use:control-browser` | Web UI 旅程、DOM 断言、截图 capture |
| 桌面/本地应用控制 | `computer-use` | Desktop 客户端、非浏览器 UI |
| 浏览器自动化脚本化（DOM 级精断言） | `playwright-cli` | 需要精确 selector 断言的回归型旅程 |
| WS 直连 / CLI 配对 | 直接驱动被测进程（sidecar 会话留痕） | 协议层、CLI 报文、长连接行为 |

- 组合语法：`driver.capabilitySkill` 写实际驱动的那一个；多能力接力时断言按层拆条，
  每条各配各的托底。
- 截图参与断言时先进 GitLab 证据分支（screenshot-evidence.md），终态冻结走
  companion-freeze；截图本身不是托底层——`backing.layer` 永远指向四层闭集。

## 6. 独立 skill 重开条件

本配方以 reference 形态存在，不建独立 skill。出现以下任一条件时重开评估
（届时按 skill-release 流程另开票，不在 aes-qa 内静默膨胀）：

- 配方被 ≥2 个非 AES 技能族复用，且各仓开始出现本地分叉副本；
- 手法配方需要自己的契约测试面（当前断言纪律由 aes-qa v4 schema 契约承载）；
- 出现第二类 evidence target（当前唯一 = GitLab 截图协议）需要同构的 live 配方。

## 附：not-onboarded 治理与复议条件（v4 等级栏）

未接入门禁的仓出 v4 时记 `repositoryGate.status="not-onboarded"` + 非空 reason +
trackerOnly 布尔，验收单有效、GATE-qa 放行——代价形态是**计量 + 定期复盘**，不设
硬门（2026-09-12 盘点：全域仅 1/N 仓接入判级资格，硬门即变相强制接入，违背
「建设问用户、执行自主」的渐进双使命）：

- 计量：not-onboarded receipt 可单独统计（扫消费仓 receipts 目录）；
- 复盘：纳入定期 QA 复盘议题；
- 复议升级条件：接入率显著变化（如接入仓占比过半或用户指示）时，把「计量+复盘」
  升级为任何形式的硬门须用户拍板——agent 不得自行加门。

消费侧防伪对账不受治理形态影响：仓有 `gate-policy.toml` 而 receipt 自称
not-onboarded → fail closed 拒收（无条件）。
