<!-- draft v4 | published 2026-08-30T11:07:25Z
     用户意见：P8/P9 已确认；命令名与晋级方式待确认
     状态：superseded by P10 independent Skill+Web Runtime direction -->

# 可运行输出候选：同一个 Workflow Module 跑在两个 Host

**已被 P10 推翻，仅保留历史，也不是已实现命令。** SkillDev 的 durable/continuation 示例可被下一版重用；AesAgent install、双 Host conformance 和 Extension promotion 已移出当前范围。

## 场景 1：SkillDevHost 高频孵化

```powershell
node skills/workflow/workflow-story-map/scripts/dev-host.mjs start `
  --issue-dir .aes-workflow/grilling/<issue> `
  --module skills/workflow/workflow-story-map/module
```

候选输出：

```text
WORKFLOW DEV HOST READY
host-kind       skill-dev
workflow        workflow-story-map@0.1.0-dev
module-digest   sha256:module-abc
surface-schema  aes.workflow-surface/document/v1
durability      restart-local
continuation    manual-followup
web             http://127.0.0.1:<port>/

Business rules loaded from one Workflow Module.
The Skill and Web Shell contain no StoryRoot/Gate/Router copy.
```

启动成功只证明 Dev Host 可用，不证明 AesAgent compatibility。

## 场景 2：Web 提交后必须诚实显示三层完成状态

```text
USER ACTION      story.answer-decision/v1
PERSISTED        PASS  revision=83 event=event-083
AGENT RESUMED    NOT_YET
CONSUMED         NOT_YET

next: return to the current task and continue
```

用户回当前 task 继续后：

```text
CONTINUATION     generation=4 owner=role-attempt-52
AGENT RESUMED    PASS
DOMAIN APPLY     PASS  module-digest=sha256:module-abc
CONSUMED         PASS  resulting-revision=85
```

若 Agent 无法恢复：

```text
PERSISTED        PASS
AGENT RESUMED    MANUAL_REQUIRED
CONSUMED         NOT_RUN
input retained   yes
canonical loss   no
```

不能把最后一种结果显示成“已完成”。

## 场景 3：同一 Role 在两个 Host 绑定不同 Carrier

SkillDevHost：

```text
ROLE             QAValidator
SUBJECT          git:c3
REQUIREMENTS     fresh + read-only + actor-separated + receipt-required
ROUTER            selected=fresh-subagent
SKILL BINDING     aes-qa@sha256:qa-procedure
RECEIPT           receipt.qa/v1
```

AesAgentHost：

```text
ROLE             QAValidator
SUBJECT          git:c3
REQUIREMENTS     fresh + read-only + actor-separated + receipt-required
ROUTER            selected=provider-task
SKILL BINDING     aes-qa@sha256:qa-procedure
RECEIPT           receipt.qa/v1
```

允许 Carrier 不同；RoleAssignment、requirements、Skill digest、Receipt/Gate 语义不得不同。若任一 Host 缺 capability，应报告 `BLOCKED_NO_CARRIER`，不能改用不满足要求的 Carrier。

## 场景 4：运行双 Adapter canonical trace

```powershell
node skills/workflow/workflow-story-map/scripts/conformance.mjs `
  --module skills/workflow/workflow-story-map/module `
  --fixture fixtures/surface/story-wave-01 `
  --hosts skill-dev,aes-agent
```

候选输出：

```text
CONFORMANCE story-wave-01
module-digest       sha256:module-abc / sha256:module-abc      MATCH
events              sha256:events-91 / sha256:events-91      MATCH
state               sha256:state-85  / sha256:state-85       MATCH
surface-document    sha256:surface-7 / sha256:surface-7       MATCH
receipts             sha256:receipt-3 / sha256:receipt-3      MATCH
recovery-payload     sha256:recovery-8 / sha256:recovery-8    MATCH

allowed host differences
  store              file-journal / sqlite-event-store
  transport          loopback / rpc-ws
  carrier            current-agent-subagent / provider-task

verdict              PASS
```

任一 canonical 项不同：

```text
verdict              FAIL
promotion-status     PORTABLE_CANDIDATE
claim-no-rewrite     FORBIDDEN
```

## 场景 5：晋级候选——从唯一源码构建 Extension artifact

```powershell
node skills/workflow/workflow-story-map/scripts/promote.mjs build `
  --module skills/workflow/workflow-story-map/module `
  --version 1.0.0 `
  --target-aes-agent G:\GIT\AI_WorkFlow\aes-agent
```

候选输出：

```text
PROMOTION PREFLIGHT
source-commit       <manual repo commit>
workflow            workflow-story-map@1.0.0
module-digest       sha256:module-abc
platform-range      ^1.9.0
skilldev-live       PASS
adapter-conformance PASS
clean-rebuild       PASS

artifact            workflow-story-map-1.0.0.plugin.tgz
plugin-digest       sha256:plugin-release-1
business-copy-diff  0
status              READY_FOR_AESAGENT_INSTALL
```

这条命令只是候选外观。正式 build 必须调用 AesAgent 官方 `aes.workflow-platform/plugin-build`；不能在 Skill 的零依赖 `.mjs` 中重写 tar/digest 算法。

## 场景 6：AesAgent 安装并运行同一 artifact

```text
PLUGIN INSTALL
plugin-id          aes.workflow-story-map
plugin-version     1.0.0
plugin-digest      sha256:plugin-release-1
module-digest      sha256:module-abc
result             INSTALLED

PRODUCT SMOKE
web-submit         PASS
durable-receipt    PASS
provider-resume    PASS
domain-consumed    PASS
surface-digest     sha256:surface-7

PROMOTION RECEIPT  PROMOTED_NO_REWRITE
```

若 AesAgent wrapper 新增了第二份 reducer、schema、validator、Prompt 语义或 page specification：

```text
PROMOTION RECEIPT  REJECTED
reason             BUSINESS_LOGIC_COPY_DETECTED
```

## 场景 7：Rollback 不覆盖历史 release

```text
disable aes.workflow-story-map@1.0.1  → 禁止新 Run
enable  aes.workflow-story-map@1.0.0  → 新 Run 可重新选择旧 release

existing Run A  remains pinned to 1.0.0 + exact digest
existing Run B  remains pinned to 1.0.1 + exact digest
```

同一 `pluginId@version` 不得替换为不同 digest。紧急修复必须回唯一源码发布新 patch version，不能直接修改已安装 bytes。

## 场景 8：旧 SkillDev Run 的当前保守行为

在 importer/replay equality 尚未被单独设计和验证时：

```text
old SkillDev Run       remains readable/exportable in Dev Host
promoted Extension     starts new Runs with the same Workflow Module
automatic import       NOT_SUPPORTED
claim lossless migrate FORBIDDEN
```

是否把旧 Run 无损迁入 AesAgent 是后续兼容裁决；不能因“同一 Module”自动推断历史存储格式可迁移。
