# 执行 Agent 启动指令

Contract 状态:Ready(已通过 validate-goal-contract.ps1 校验,AC_COUNT=7)。
把下面这段原样发给执行 Agent:

```text
按 G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-1\notes-search-feature\with_skill\outputs\goal-contract.md 执行。

这份 Goal Contract 是本次需求的唯一权威。先完整读它。其中 Agent Mandate 一节写明了你
可以自己决定什么、必须回来问什么、不能做什么,按它执行。

仓库里查得到的事实自己查,不要回来问我。

完成实现,跑通验证,review 最终 diff,在不改变行为的前提下 simplify。然后逐条报告每一条
AC 的证据、改动的文件和剩余风险。

全部 AC 满足之前不要停,也不要只交一份计划。

某条 AC 确实做不到时,把其余部分做完,然后单独说明是哪条、卡在哪里、需要什么才能解开。
不要因为一条卡住就停下整件事,也不要悄悄降低那条的标准。
```
