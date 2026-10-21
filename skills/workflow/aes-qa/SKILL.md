---
name: aes-qa
description: AES worker 闭环的验证角色——围绕目标和实际影响选择证据，考虑验证总时间成本；循环轮只出 finding，最终轮为 candidate 出具绑定 SHA 的 typed QaReceipt，打回后回归重验。如实记录未执行项与人工债务，不把 NOT_RUN 记成 PASS。仅当用户点名 aes-qa 或明确要求循环验证/出 QaReceipt 时使用。
---

# AES QA

判断本次期望结果是否成立，并如实交付证据结论。先理解背景、目标、范围、必要例子与 AC；隔离实现者自证叙述，不切掉用户目标。

## 围绕目标选择验证

AC 是目标的补充。围绕期望结果和实际变化的重要影响选证据，不自动铺通用 QA 清单。已观察到目标偏差时给出依据并报 finding；没有依据的品质偏好不升级为阻塞。

准备、执行、诊断和维护时间都参与取舍。复用仍适用的证据，允许廉价现成套件；证据足够时停止重复，重要疑点未解决就调查或保留未证明结论。

已确认的 Verify、证据档位、人工决定权和仓库门禁仍须履行。未执行不写 PASS；真实效果不能用代理指标冒充，时间不足不能静默降标。

## 独立验证与回报

循环轮以只读、独立上下文运行，只出 finding。最终轮为当前 candidate 出具绑定 SHA 的 QaReceipt；candidate、契约或相关环境变化后按既有协议复验，不拿旧绿顶新内容。

- 出具回执或等待人工：读 [回执格式与续接](references/receipt.md)，使用相应校验器；人工未答仍是 AWAITING_HUMAN。
- 需证明真实身份、权限、外部效果或 agent 旅程：读 [业务真实验收](references/business-acceptance.md)。
- 实际执行截图检查，或截图参与规格／判定／finding：按 [截图证据协议](references/screenshot-evidence.md) 执行。没有截图不发布空 note；该协议不扩成通用 artifact 门禁。

不得代答人验或泄露凭据。回报明确区分失败、环境阻塞和未执行，保留可复核依据。
