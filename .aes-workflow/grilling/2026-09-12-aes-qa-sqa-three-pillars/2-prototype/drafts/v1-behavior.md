<!-- draft v1 | published 2026-09-12T09:00:00Z
     用户意见：待质疑
     状态：draft -->
# 行为对照表: 2026-09-12-aes-qa-sqa-three-pillars

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | 最终轮；仓已在 run.toml 注册 gate | v3 才有等级栏，opt-in 声明 | v4 等级栏强制：repositoryGate.status=referenced，digest 原子引用引擎收据（同 candidate 双绑定） |
| 2 | 最终轮；仓未做门禁建设 | 只能出 v1/v2（v3 的 "none" 仅 tracker-only 白名单） | v4 出 not-onboarded + 非空 reason（+trackerOnly 布尔），验收单有效，GATE-qa 放行 |
| 3 | 已接入仓声明了目标级（requiredLevel 非空）且引擎实跑未达 | v3 消费侧 fail closed 拒收，失败原因不在 receipt 里 | receipt 自身 outcome=FAIL + failureClass=gate-shortfall（新枚举），失败原因进 receipt 可读，GATE-qa 照样拒合并 |
| 4 | agent 驱动验收中断言「看到了 X」 | live 档一行定义，无操作标准，agent 可自由断言 | agent-live check：每条断言必须带托底证据（dom-assertion / server-trace / read-model / sidecar-session 四层闭集）；无托底断言降档进 humanChecklist（AWAITING_HUMAN，agent 不得代答），带 demotedFrom/demotionReason 标注 |
| 5 | 截图义务轮 VERIFIED 后 | 终点=GitLab note+marker；本地仅临时 spool，无正式保留 | 冻结伴随目录 receipts/&lt;attempt&gt;/shots/ + shots-manifest.json；manifestSha256 与 secretsScan 进 receipt；GitLab 发布链路原样并行 |
| 6（边界） | candidate 变更后提交旧伴随截图 | marker.candidateSha 校验拒收 | 伴随目录随旧 receipt 同批作废（STALE_EVIDENCE 同源），新 candidate 必须新 attempt 重跑截图 |
| 7（边界） | 同 candidate 换驱动模型重跑 agent-live | checks 无执行者标识，证据无法解释 | driver 块记录 model+capabilitySkill；candidate 未变 receipt 不作废，但执行者变化在报文可见 |
| 8（边界） | secrets 扫描命中（截图含 token/凭据模式） | 不存在此检查 | secretsScan=BLOCKED → receipt outcome=FAIL，截图不得入库 |
| 9 | GATE-qa 消费 receipt | 只认 /v3 尾缀；v4 会被当 legacy 豁免（现状漏洞） | 显式认 v4：referenced 四重校验（candidate/standardVersion/digest/required-if-declared）、not-onboarded reason 非空、companionShots 完整性；缺字段 fail closed |
| 10（边界） | v4 receipt 缺 repositoryGate.status / 裸 "L3"（非全称）/ status 不在闭集 | —（v4 尚不存在） | GATE-qa 拒收，报文给理由码；不降级按旧版处理 |

## 不变清单

- v1/v2/v3 receipt 读法与 GATE-qa 豁免语义逐字节不变（历史语义永久冻结）
- `NOT_RUN` 永不写成 `PASS`；`AWAITING_HUMAN` 永不因超时自动转 PASS，agent 不得代答
- 循环轮只出 finding 不出 receipt
- GitLab 截图发布链路（U upload + 1 note + strict readback 2U+2 + marker）零收窄
- aes-gate 判级引擎、AES-QG/1 标准、run.toml/gate-policy.toml 文法零改动
- manual 档 humanChecklist 语义不变（仅新增 demotedFrom 标注字段）
- 既有 5 个 screenshot-evidence 契约 case（默认套件）断言语义不变
- v3 的 "none"（tracker-only）语义在 v3 里冻结不变；v4 用 not-onboarded 表达

## 配置差异

（无——不新增配置文件、环境变量、CLI 选项；等级声明是 receipt 报文内字段）
