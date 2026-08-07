# 启动指令模板

`Ready` 的 Contract 落盘并通过校验后，按执行 Agent 的类型二选一。两个变体都把落盘的
Contract 当作唯一权威，不复述其内容——复述一份就会漂移一份。

## 变体一：会话式执行 Agent

把下面这段发给执行 Agent。把 `<contract-path>` 换成绝对路径，其余原样。

```text
按 <contract-path> 执行。

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

## 变体二：Codex `/goal` 长时程执行

`/goal` 的续跑机制每个 turn 都会重新注入 objective 文本并对它做完成审计，所以一句话端态
必须内联在命令里——它是每 turn 的锚，光给路径不够。预算走 `/goal` 的参数传递，接入真实
记账；写进文档的预算数字不接入任何机制。

```text
/goal 完成 <contract-path> 定义的目标——<Goal 节的一句话端态>。验收以该文档 Success
Criteria 节全部 Verify 通过、Constraints 节保持为准；Agent Mandate 节是行动授权边界。
```

## 为什么只有这么短

Contract 自己已经带着 `Agent Mandate` 和 `Completion` 两节，授权边界和完成标准都在里面。
启动指令再抄一遍，两处就会各自漂移，而落盘的 Contract 比聊天里的指令活得久。所以指令只
做三件事：指路、确立权威、点名最常见的两种失败。

那两种失败是停在计划、和拿一条卡住当作整件事的借口。其余交给 Contract。
