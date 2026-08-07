# Process Notes（aes-grilling / minicli --json）

## 提问轮数

共 3 轮用户交互（1 轮歧义提问 + 1 轮 AC 裁决 + 1 轮 Contract 整体确认）。歧义提问严格 1 轮，未追加。

## 每轮问题主题

- 第 1 轮（Step 2 批量歧义，4 题一次问全，AskUserQuestion 不可用走编号文本降级）：
  - Q1 JSON 输出形状（裸数组 / 信封对象 / JSON Lines）→ B 信封对象（用户明确要整体结论，字段命名授权 Agent）。
  - Q2 JSON 模式退出码语义 → A 与文本模式一致（用户明确退出码不能变）。
  - Q3 坏输入错误处理是否入 Scope → A 本次 Out（PERSONA 未覆盖，按推荐项）。
  - Q4 JSON 排版（紧凑单行 / pretty-print）→ A 紧凑单行（PERSONA 未覆盖，按推荐项）。
- 第 2 轮（Step 3 AC 裁决）：5 条候选 AC 一次列全并附 Verify 档位；用户按「跟仓库测试约定走、推荐即准」接受 AC-01～04，AC-05（流程性、与其它 Verify 重复）按推荐删除；[B] fixture 四问（数据来源/脱敏/期望输出基准/存放位置）均按推荐项落定（合成配置、无需脱敏、以定稿 schema 为准、放 test/fixtures/ 并列入 Deliverables）。
- 第 3 轮（Step 4 确认）：完整候选（Goal / In / Out / AC / Blocker 摘要）整体确认，同意落盘。

## 维度自评结果（第 1 轮回答后，此后无变化）

- Intent：已定 —— CI 流水线机器读审计结果，摆脱文本解析脆弱性。
- Outcome：已定 —— `--json` 输出单行信封 JSON（findings + ok + summary），退出码语义不变。
- Boundary：已定 —— In：flag、JSON 输出、golden 测试、README；Out：审计规则、其它 flag、schema 版本化、配置文件、坏输入错误美化、参数体系重构。
- Constraints：已定 —— 文本输出与退出码逐字节兼容、零依赖、遵循 docs/testing.md。
- Context：已定 —— 仓库 5 个文件全部查清；验证基建 `npm test` 存在，[A] 默认档可用。

收口审计：通过。剩余可问项（如 summary 内部字段命名）不同答案只改措辞不改执行，已划入 Agent Mandate 的 May decide。

## 最终状态

- Status：Ready（无 Blocker）。
- Contract：`G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-2\eval-2-cli-json-with-infra\with_skill\run-1\workdir\docs\goal-contracts\2026-08-07-minicli-json-output.md`
- 校验：VALID / FORMAT: AES Goal Contract B / STATUS: Ready / AC_COUNT: 4 / LINE_COUNT: 71 / 退出码 0，无 WARNING。

## 启动指令全文（handoff-prompt.md 变体一）

```text
按 G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-2\eval-2-cli-json-with-infra\with_skill\run-1\workdir\docs\goal-contracts\2026-08-07-minicli-json-output.md 执行。

这份 Goal Contract 是本次需求的唯一权威。先完整读它。其中 Agent Mandate 一节写明了你
可以自己决定什么、必须回来问什么、不能做什么，按它执行。

仓库里查得到的事实自己查，不要回来问我。

完成实现，逐条跑通 Success Criteria 里的 Verify，review 最终 diff，在不改变行为的前提下
simplify。然后按 Completion 的 Final report 要求落盘报告：每条 AC 的 Verify 证据、改动的
文件和剩余风险。

全部 AC 满足之前不要停，也不要只交一份计划。

某条 AC 确实做不到时，把其余部分做完，然后单独说明是哪条、卡在哪里、需要什么才能解开。
不要因为一条卡住就停下整件事，也不要悄悄降低那条的标准。
```
