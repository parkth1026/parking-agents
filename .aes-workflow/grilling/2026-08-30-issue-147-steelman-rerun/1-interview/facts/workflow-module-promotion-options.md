# Workflow Module 从 SkillDev 孵化到 AesAgent Extension 的晋级候选

> 只读架构候选；不替用户裁决，不修改 manifest、rounds、context、prototype 或产品代码。调查绑定：`parking-agents-manual` 当前工作区，以及 `G:/GIT/AI_WorkFlow/aes-agent` 的 `main@a57b93fe6f07e38af7e13a1603cbb3a652bd145e`。

## 结论先行

在 P7～P9 已确认“同一个 Workflow Module、SkillDevHost 与 AesAgentHost 两个 Adapter、共用 Web Shell + 页面说明书”的前提下，**当前最强候选是：Workflow Module 源码继续在 manual repo 孵化，由该源码直接构建 immutable `.plugin.tgz`；AesAgent 安装并运行这个 artifact，不复制业务源码。**

这不是把整个 manual repo 塞进 AesAgent。发布单元只含：Workflow Module、版本化 schema、`SurfaceDocument` projector、Prompt/Skill assets、canonical fixtures 及机械 Plugin wrapper。AesAgent repo 只需一次性提供通用 Host/Surface seam；以后每个 Workflow 的晋级是 artifact promotion，不是源码迁移。

候选排序（架构判断，不是用户决定）：

1. **manual repo 构建 immutable `.plugin.tgz`，AesAgent 安装：80%**。最符合高频孵化与单一业务真源，且直接利用当前 Plugin install/digest/并存/回滚机制。
2. **中立发布包或独立 repo，双方消费：15%**。长期可扩展，但在只有两个宿主、且开发明确从 manual repo 起步时，会过早增加第三个版本与评审队列。
3. **复制/迁移源码进 `aes-agent/extensions`：5%**。若 manual 继续演进，它会立即形成第二份业务规则；若永久移走，反过来破坏 manual repo 的高频孵化目标。

推荐的是一个可演进的组合：**先选候选 1，并把 Workflow Module 做成可搬迁的自包含发布目录；只有出现第三个真实消费者、独立团队或独立发布节奏时，再保持相同 artifact/interface 将源码所有权抽到中立 repo。**

## 1. 仓库事实约束

### 1.1 manual repo 的当前晋级只解决 Skill，不解决产品 Extension

manual repo 的现行规则是 `.agents/skills/` 孵化，五件套和 `run-tests.mjs` 过门槛后 `git mv` 到 `skills/`；它没有生成器、发布清单或产品 runtime artifact（`docs/agents/skill-release.md:1-9,13-36`）。因此“Skill 晋级”与“Workflow Module 晋级到 AesAgent”必须是两个门禁，但它们可以读取同一份 Module 源码。

### 1.2 AesAgent 已经有合适的二进制发布 Seam

- AesAgent 明确规定 `extensions/*` 是自包含业务 Plugin，独立打包 `.plugin.tgz`，可 install/disable/remove；Plugin 只能依赖公开 `aes.workflow-platform`，Host 生产代码不 import 业务 Plugin（`G:/GIT/AI_WorkFlow/aes-agent/AGENTS.md:62-71`）。
- Plugin bundle manifest 已包含 `pluginId`、SemVer、`platformRange`、payload digest 与 contribution entry（`apps/server/src/plugin/manifest.ts:3-27`）。
- 官方 builder 对所有 payload path/bytes 做 canonical SHA-256，并以 portable、no-mtime tar 生成 `<pluginId>-<version>.plugin.tgz`；同一 release 可复现（`packages/workflow-platform/src/plugin-build.ts:37-66,105-120,123-195`）。builder 本身通过 `aes.workflow-platform/plugin-build` 暴露；当前 Extension 的 `build-plugin.mjs` 只是 13 行机械调用（`extensions/goal-contract/scripts/build-plugin.mjs:1-13`）。
- 安装先复制到 staging、验证 identity/digest，再在事务内核对 tombstone 与已安装版本；同一 `pluginId@version` 不同 digest 永久 `version-conflict`（`apps/server/src/plugin/PluginManager.ts:858-923,925-995`）。
- 新旧 release 可并存；历史 Run 总是解析自己锁定的 exact release。disable 只禁止新 Run，现有 Run 继续；purge 后相同 identity+digest 可重装恢复，identity 相同但 digest 不同永远拒绝（`docs/plugin-operations.md:105-124`）。
- Workflow binding 已精确锁定 plugin/workflow/prompt 的 version+digest，缺失或 mismatch 时 fail closed（`packages/workflow-platform/src/wire.ts:76-87`; `packages/workflow-platform/src/v1.ts:861-903`）。

这些事实说明 `.plugin.tgz` 已是一个深发布 **Seam**：AesAgent caller 只学习 manifest、binding 和 lifecycle，Module 的业务 Implementation 隐藏在 artifact 内。没有证据要求业务源码必须物理存在于 `aes-agent/extensions/` 才能成为 Extension。

### 1.3 现有 Goal Contract 展示了复制方案的语义漂移

当前 Goal Contract 把 manual repo 的四个 Skill 复制到 gitignored `skill-source/`，再镜像进 `assets/`（`extensions/goal-contract/README.md:30-46`）。但是 Extension 自己另外拥有 domain、reducer、validators、Viewer 和 Plugin instructions（`:3-21`）；同步器明确**不会**自动修改 `plugin.ts` instructions 或语义 fixtures，只报告给人判断（`:48-54`）。`update-skills.mjs` 也明确把门禁语义变化标成需要人工改写 `plugin.ts`，并把 CLI/文件布局变化另作兼容审查（`extensions/goal-contract/scripts/update-skills.mjs:182-188,213-233`）。

这条通道能防止静默漂移，却不能满足 P8 的“核心业务规则只有一份”。它适合兼容旧 Skill 资产，不适合作为新 Workflow Module 的长期 promotion 方案。

## 2. 何谓“唯一源码”与“同一 release”

单一真源不是只比较文件名。建议把一次 Workflow Release 的 semantic material 定义为：

```text
WorkflowReleaseSource
├─ domain state / event / reducer
├─ commands / interactions / validators
├─ SurfaceDocument projector + page specification
├─ recovery payload rules
├─ Prompt / Skill procedure assets
└─ canonical traces + expected events/state/surface/receipts
```

`SKILL.md` 可以继续负责触发和教 Agent 怎样调用 SkillDevHost，但不得重新实现 reducer、Gate、Router 或 input validation。AesAgent Plugin wrapper 也只能登记 Module、声明 capabilities、映射 Host Adapter；不能出现第二份业务 transition。

一次发布至少绑定四类身份：

| 身份 | 用途 |
|---|---|
| source commit | 人和跨 repo review 定位源码；不替代运行时 digest。 |
| `pluginId@version + pluginDigest` | AesAgent 安装、并存、tombstone 与回滚身份。 |
| `workflowVersion + workflowDigest/moduleDigest` | 证明 SkillDev 与 Extension 装载同一个业务 Module。现有 Binding 已有 workflow digest。 |
| schema/fixture/surface/prompt digests | 判断局部兼容与双 Adapter canonical trace 是否仍是同一行为。 |

Promotion receipt 还应记录目标 `aes.workflow-platform` version/range、目标 AesAgent commit、两宿主 conformance 结果与真实闭环证据。它是审计记录，不是第二份源码。

## 3. 三个候选逐项比较

### 候选 A：manual repo 直接构建 immutable `.plugin.tgz` 并安装（推荐候选）

```text
parking-agents-manual
  WorkflowReleaseSource  ← 唯一业务真源
       ├─ SkillDevHost 直接加载（高频 source mode）
       └─ official plugin-build → immutable .plugin.tgz
                                      │ exact id/version/digest
                                      ▼
                                AesAgent install
```

**Source of truth**：manual repo 内的 WorkflowReleaseSource。AesAgent repo 不保存其业务源码；若产品发行需要默认可发现版本，只保存 artifact lock/catalog metadata 或把 bundle 发布到 Plugin store。

**Release/digest**：日常 source mode 可使用 dev digest/host epoch；正式 promotion 必须提升 SemVer，使用唯一的 `aes.workflow-platform/plugin-build` 生成 bundle 和 payload digest。不要在 manual 的零依赖 `.mjs` 中重写 digest/tar 算法；AesAgent 运维文档明确该算法只有一个实现，重写会改变历史尺子（`docs/plugin-operations.md:126-132`）。官方 builder 当前会运行 `pnpm exec vp pack`，所以 release build 是独立 CI/tooling concern，不应污染 Skill 高频运行路径（`plugin-build.ts:198-232,238-262`）。

**CI**：

1. Module purity/golden：同 input 得到相同 events/state/surface/recovery。
2. SkillDevHost conformance + 本地真实 Web `publish → submit → persisted → manual/host continuation → consumed`。
3. release build：exact SDK dependency、schema validation、native payload rejection、两次 clean build digest 相同、声明的 payloadDigest 对账。
4. AesAgent compatibility：在明确 Host commit 上安装真实 tgz，跑相同 canonical trace、Plugin isolation、Web submit 与 Provider continuation smoke。
5. 只有 1～4 都绑定相同 artifact/workflow digest，才能签发 promotion receipt。

**紧急修复**：回到 manual 的唯一源码修复，发布新 patch version+digest；不得直接 patch 已安装 bytes 或在 AesAgent repo 热修一份 reducer。Host 能力缺失则先单独升级 workflow-platform/Host seam，再发布要求新 platform range 的 Module。

**版本兼容**：Plugin 精确依赖 SDK version，并声明兼容 `platformRange`；新 Run 锁实际安装 release。additive schema 可 minor，行为修复可 patch，无法由旧 Host 解码的协议/状态变化应 major，并由 conformance/handshake fail closed。版本策略最终仍需 Goal Contract 固化。

**离线开发**：SkillDev source mode 保持 Node 本地、loopback、文件/embedded store；只有正式 release 需要已缓存的官方 platform/build tool。AesAgent 安装会把 bundle 完整复制到隔离目录，共享 store 离线不影响已安装版本运行（`docs/plugin-operations.md:28-43`）。

**跨 repo review**：semantic review 发生在 manual PR；AesAgent CI 只审 Host compatibility receipt。若无需 Host 改动，AesAgent 源码零 diff；若需要新 Surface capability，必须先在 AesAgent 形成独立 SDK/Host PR，Module promotion 等该版本发布，不能在 Plugin 里绕过 Host。

**Promotion diff**：允许改变 release version/metadata、Plugin wrapper、capability declaration、packaging 和 artifact lock；不允许把 reducer、schema、validator、projector、Prompt 语义复制进 `aes-agent/extensions/`。机械 wrapper 可以生成或人工维护，但其“业务逻辑行数”应为零，并由 grep/AST lint 与 canonical trace 证明。

**Rollback**：disable 新版本以阻止新 Run，重新选择/enable 旧版本；旧、新版本并存。remove 必须等待 active Run drain；purge 只用于明确放弃本机 bytes，tombstone 仍保留。不能用旧版本覆盖新版本 identity，也不能给同版本换 digest。

**旧 Run**：

- AesAgent Run 永远继续绑定创建时的 exact release；升级 Extension 不解释旧 Run。
- 当前平台的显式 migration 证据只覆盖 binding/configuration migrator（`v1.ts:936-976`），没有证据支持把任意运行中 domain state 自动换到新 Module。因此第一版应默认“旧 Run 原版本继续或只读 unavailable”，而不是自动升级。
- SkillDev 的历史 file ledger 进入 AesAgent 是另一项 import/migration capability。没有 canonical ledger importer + 双宿主 replay equality 前，只允许“新 Run 使用 promoted Extension”；旧 Skill Run 留在 DevHost/导出档案，不能宣称无损迁入。

**Codebase-design 评价**：发布 Seam 位于 immutable artifact，两个 Host Adapter 都消费同一 Module；Interface 小而 Implementation 深。删除这条 Module/artifact 后，业务规则会重新散到 Skill 与 Extension 两处，因此它产生高 **Leverage** 和强 **Locality**。缺点是 manual repo 必须新增一个区别于 Skill 评测的 release lane，并维护与 AesAgent SDK 的兼容矩阵。

### 候选 B：复制/迁移源码到 `aes-agent/extensions`

有两种实际含义，但都与当前目标有张力：

1. **复制后两边继续开发**：manual 与 AesAgent 各有 reducer/validator/viewer，直接违反 P8。
2. **一次迁移后 AesAgent 成为唯一源码**：可以只有一份源码，但之后 SkillDev 必须从 AesAgent source/package 反向消费，manual repo 不再是高频孵化位置。

| 维度 | 结果 |
|---|---|
| Source of truth | 双开发时含糊；永久迁移时变为 AesAgent。 |
| Release/digest | AesAgent 本仓 build 最自然，但 manual source 与 bundle digest 没有天然同一性。 |
| CI | AesAgent 全仓门禁近；Skill 高频测试要跨 repo 或靠 mirror。 |
| 紧急修复 | 容易在 AesAgent 先修而忘记 manual，或反向发生。 |
| 版本兼容/rollback | Plugin lifecycle 可用，但源码同步问题仍在 lifecycle 之前。 |
| 离线开发 | 必须同时具备两个 repo/依赖，或接受其中一边落后。 |
| 跨 repo review | 每次语义变化需要复制 PR、漂移报告和顺序协调。 |
| Promotion diff | 大量业务文件出现于 AesAgent；review 无法机械证明“只换宿主”。 |
| 旧 Run | AesAgent exact binding仍可守旧 Run；Skill history 迁移仍未解决。 |

**Codebase-design 评价**：源码复制处不是有意义的 Seam，只是一个浅 pass-through。删除同步脚本后，复杂度仍以手工复制形式存在；Locality 最差。当前 Goal Contract one-way mirror 已经证明可以检测漂移，却仍需人工改写语义，不能作为“同一条规则”的证据。

### 候选 C：中立发布包/独立 repo，manual 与 AesAgent 双方消费

```text
neutral workflow-release repo/package ← 唯一业务真源
       ├─ manual SkillDevHost consumes exact package/digest
       └─ builds final .plugin.tgz → AesAgent installs
```

它只有在中立 repo **自己产出最终 `.plugin.tgz`** 时最干净；若 manual 与 AesAgent 各自拿同一 package 再组装 Plugin，仍需要证明两个 wrapper/bundle 没有改变语义。

| 维度 | 结果 |
|---|---|
| Source of truth | 最明确地中立；适合第三宿主、独立团队或独立产品节奏。 |
| Release/digest | package digest + plugin digest 两层；最终 artifact 仍须唯一发布者。 |
| CI | 可集中跑 Module/双 Adapter matrix；但要编排三个 repo 的版本和失败归属。 |
| 紧急修复 | 先发中立 package/artifact，再更新两个 consumer pin；步骤比候选 A 多。 |
| 版本兼容 | 最清晰，但同时维护 protocol、module package、plugin release 三层 SemVer。 |
| 离线开发 | 依赖本地 cache/vendor/packed tgz；未缓存 registry 会阻塞 manual 高频循环。 |
| 跨 repo review | ownership 清楚，但每次 promotion 至少跨 source、manual、Host compatibility 三条队列。 |
| Promotion diff | 两边通常只改 dependency lock/receipt，较容易机械审计。 |
| Rollback | consumer pin 可回退，AesAgent 仍按 exact Plugin release 回滚。 |
| 旧 Run | 与候选 A 相同：exact release pinned；跨 release/state migration 必须显式。 |

**Codebase-design 评价**：package Interface 可以很深，且未来第三消费者会产生高 Leverage；但目前它把 Locality 从一个 repo 分散到三个 release queues。根据“一种 Adapter 是假设、两种 Adapter 才是真 Seam”的原则，双宿主已经证明 host-neutral contract 的 Seam；却没有第三个源码 owner/consumer 证明必须立即拆 repo。应让目录和 build manifest 可搬迁，而不是预先支付独立 repo 成本。

## 4. 三候选总表

| 判据 | A. manual 构建 tgz | B. 复制/迁移到 AesAgent | C. 中立包/独立 repo |
|---|---|---|---|
| 单一业务真源 | **强** | 复制时弱；永久迁移时强但违背孵化位置 | **强** |
| 高频 SkillDev | **强** | 弱 | 中，受 package/repo 链路影响 |
| AesAgent 集成自然度 | **强**，正式 install seam | 强 | 强 |
| Promotion 是否无业务 diff | **可机械证明** | 很难 | 可机械证明 |
| Locality | **强** | 最弱 | 中 |
| 第三宿主扩展 | 中，可后续拆分 | 弱 | **最强** |
| 当前新增治理成本 | 中 | 中且持续 | 高 |
| 紧急修复路径 | **一处修、发新 artifact** | 易双边漂移 | 一处修但需多 consumer 协调 |
| 推荐状态 | **现在采用的最强候选** | 拒绝作为双开发模式 | 达到翻转条件后升级 |

## 5. “晋级而不重写”的机械门禁

以下全部成立，才可写 promotion receipt：

1. SkillDev 与 `.plugin.tgz` 中 Module 的 workflow/module digest 相同。
2. Plugin wrapper 不含 domain branch、validation、projection 或 Prompt 语义；只做 declaration/registration/Adapter wiring。
3. 两个 Host Adapter 对同一 canonical trace 的 events、state digest、`SurfaceDocument`、receipts 与 recovery payload 规范化后全等。
4. promotion diff 不新增/修改第二份 reducer、schema、validator 或 page specification。
5. tgz clean rebuild digest 可复现，`pluginId@version` 未被不同 digest 使用。
6. AesAgent exact target 能真实 install、enable，并完成 Web submit → durable receipt → Provider/Agent continuation → consumed。
7. SkillDev 也完成同一可见闭环；manual fallback 必须如实显示，不能冒充自动 resumed。
8. 旧 Run 策略明确标成 `pinned`、`new-runs-only`、`explicit-migration` 之一；未验证 importer 时不得选 explicit migration。

缺任一项，只能叫“portable candidate”，不能叫“已晋级且无重写”。

## 6. 双向 steelman、Crux 与下一问

**支持候选 A 的最强论证**：用户已经明确 manual 是高频孵化位置、AesAgent 是最终 Host；AesAgent 又已经提供不要求源码入主仓的 immutable install Seam。让源码留在 manual、把同一 release artifact 安装进 AesAgent，是同时满足两项约束且最少权威的方案。

**反对候选 A 的最强论证**：长期产品 Extension 若不与 AesAgent Host 源码同仓，Host contract 变化、SDK 兼容、真实 Web/Provider 验收和紧急修复会跨 repo；如果维护团队、发布节奏和第三方消费很快分化，中立 release repo 会比 manual repo ownership 更稳。并且 current plugin builder 不是 Skill 的 Node built-in/零依赖路径，必须新增独立 release tooling lane。

**Crux**：promotion 的目标是“把源码搬进产品仓”，还是“把经过同一 contract 验证的 immutable release 装进产品 Host”？当前 AesAgent 的 Plugin 体系证据更支持后者。

**可翻转变量**：

1. AesAgent 产品发行是否要求所有默认 Extension 源码必须同仓，还是允许来自审核过的 Plugin store/artifact lock；
2. manual repo 是否接受 release-only 的 `aes.workflow-platform`/pnpm toolchain，同时保持日常 Skill `.mjs` 零依赖；
3. 是否会在近期出现第三个真实 Host、第二维护团队或独立许可/发布节奏；
4. 旧 SkillDev Run 是否必须无损迁入 AesAgent，而不是仅保证新 Run 使用同一 Module；
5. AesAgent Host contract 的变更频率，以及是否能为外部 Workflow release 提供版本矩阵 CI；
6. Plugin store/离线 artifact 的供应、签名与长期保留要求；当前代码证明 digest 与 tombstone，不证明签名发布链。

**最小下一问**：是否接受把“晋级”定义为——**Workflow Module 源码继续留在 manual repo 作为唯一业务真源，由这里构建并发布 immutable `.plugin.tgz`；AesAgent 只安装该 artifact 和保存 promotion receipt，不复制业务源码；中立独立 repo 等第三个真实消费者或独立团队出现后再评估？**

