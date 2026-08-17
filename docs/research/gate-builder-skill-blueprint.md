# Gate Builder Skill 设计蓝图

> 依据：[ref-repos-gate-research.md](ref-repos-gate-research.md)（TOP5 门禁调研，v2 已核查）
> 参考实现：`G:\GIT\AI_WorkFlow\aes-gate`（门禁协议）、`G:\GIT\AI_WorkFlow\twe-gate`（发布回归门禁引擎）
> 日期：2026-08-16
> 目标：定义「帮助任意仓库建设并持续演进 Gate 系统」的 Skill 应具备的能力与建设路径

---

## 0. 定位切割：三个层次，不要混淆

| 层次 | 是什么 | 已有资产 | 关系 |
|---|---|---|---|
| **引擎** | 门禁的执行、证据采集与裁决权威 | twe-gate（Rust CLI，Jenkins 调度，内网） | Skill 生成的 gate **可以**跑在它上面，但不强依赖 |
| **协议** | 门禁的语言中立合同（状态、身份、摘要、退出码） | aes-gate（`gate/v1`，gate.toml→lock→run→verify） | Skill 生成物应**遵守**其语义（三态、不可变 Run、单一裁决权威），无论底座是什么 |
| **建设者** | 进任意仓库，调查→设计→组装→落地→持续收紧 | **缺，即本 Skill** | Skill 不运行门禁，它**建设**门禁 |

核心判断：aes-gate 和 twe-gate 解决「怎么跑得可信」，Skill 要解决「怎么建得起来、怎么持续变好」。多数仓库装不起 Rust CLI 或不在内网，所以 Skill 必须**底座中立**：产出物接 GitHub Actions / GitLab CI / Jenkins / pre-commit hooks / AI hooks 都行；aes-gate 是未来可选的高可信收敛点，不是前置条件。

---

## 1. 能力模型：一个完善的仓库 Gate 系统要具备什么

从 TOP5 + 惜败者 + aes-gate/twe-gate 已验证设计提炼。前五维即调研报告的评分体系（权重也沿用），第六维是用户点名的需求、也是现有工程普遍最弱的。

| # | 能力域 | 一句话判据 | 标杆（证据） | 关键机制 |
|---|---|---|---|---|
| 1 | **阻断强制性**（30%） | 不碰配置的情况下，红代码能不能进 main？能进就是纸面门禁 | codex（required 清单版本化 + 聚合 job）；cbm（branch protection + 单一稳定 `ci-ok`） | 聚合 required check 用一条稳定名字；branch protection；fail-closed（该 fail 的分支不存在也 fail，open-design） |
| 2 | **覆盖广度**（20%） | 该管的面管住了吗 | orca（覆盖最全） | 基础面（lint/typecheck/test）+ 架构适应度函数（codex 的 import 边界脚本）+ 生成物漂移（check-clean-worktree）+ 兼容性契约矩阵 + 覆盖率阈值 |
| 3 | **分层反馈**（15%） | 全量测试有没有拖死 PR 反馈 | codex（pre-merge 快检 / post-merge 全量）；claude-code-haha（变更影响分析选 lane） | 快慢分层；按变更文件确定性选择执行面；「未选中的 lane 必须显式 skipped」防条件跳过被误当通过 |
| 4 | **有效性证据**（20%） | 门禁自身被治理了吗 | orca（reliability-gates 登记簿 69 门）；cbm（license gate selftest 植入违规必须检出） | 门禁脚本自测试；flake 治理（禁 SKIP / quarantine 限期复审）；诚实降级（知情移出聚合并注明恢复路径） |
| 5 | **AI 门禁**（15%） | AI 是只评论，还是产证据，还是能阻断 | gstack（唯一 eval-as-gating）；oh-my-openagent（NO EVIDENCE == NO COMMIT） | 三档光谱：advisory（评论）→ evidence（结构化验证证据）→ gating（eval 进 CI 阻断）；PreToolUse 实时拦截 |
| 6 | **持续演进**（本次新增） | 半年后这个 gate 比今天更严了吗 | orca（max-lines 棘轮 "only SHRINK"）；haha（覆盖率棘轮 allowedDropPercent: 0.5） | 棘轮基线文件只许收紧；登记簿追踪每门红绿/flake；定期复诊；豁免清单只许缩小 |

aes-gate / twe-gate 补充的**合同级能力**（无论什么底座都应遵守）：

| 合同 | 内容 | 为什么重要 |
|---|---|---|
| 三态结果 | `FAILED > BLOCKED > PASS` 归约；建立运行后一切不确定都算 FAILED | 消除「超时算不算过」这类语义漂移 |
| 不可变 Gate Run | 每次运行面向确定 commit/定义/环境，只追加不覆盖；「当前有效结论」是派生视图 | 历史可审计，复盘有事实 |
| 单一裁决权威 | CI 只调度不判定；语义只有一处定义 | 防止 Jenkins 和本地各一套「什么叫过」 |
| 结构化证据合同 | 证据是带 schema 的 JSON（twe-gate 有 4 个 v1 schema），不是日志片段 | AI 轨和 CI 轨的通用接口 |
| 摘要链可重放 | run 的 digest 链可 verify 且不执行任何门禁 | 信任传递 |

---

## 2. Skill 的工作流：它进一个仓库后干什么

核心设计约束（呼应用户提醒）：**通用模板无效——「这个仓库能怎么验」是查出来的，不是套分级套出来的。** 无调查不生成，是 SKILL.md 里的硬规则。

```
Phase 1 调查 ──→ Phase 2 体检 ──→ Phase 3 分诊 ──→ Phase 4 组装 ──→ Phase 5 自举 ──→ Phase 6 复诊
 (只读)          (打分)          (四分类)         (生成资产)        (门禁自测试)      (持续收紧)
```

### Phase 1 调查（只读，产出事实清单）

固定查清（借 aes-interview 的「验证基建固定项」）：

| 查什么 | 决定什么 |
|---|---|
| CI 配置（.github/workflows、.gitlab-ci、Jenkinsfile） | 现有 lane、聚合方式、缺口 |
| 本地 hooks（pre-commit/pre-push/husky） | shift-left 现状 |
| 测试/lint/覆盖率命令与 fixture 约定 | 生成物的命令必须从这里来，不许发明 |
| AGENTS.md / CLAUDE.md 既有约定 | 验证协议挂在哪、别和已有约定冲突 |
| 语言、包管理器、平台矩阵（Windows？多平台？） | 兼容契约的形状 |
| 托管平台与权限（能否开 branch protection？fork 场景？） | 阻断强度上限；fork 不可信 → 敏感验证只允许维护者跑（haha 模式） |
| **现有门禁的红绿状态** | 红着的门 = 没有门，先修红再谈建设 |
| 已有 gate 资产（gate.toml？twe-gate？） | 有引擎就接引擎，没有就原生底座 |

### Phase 2 体检（用调研报告的 5 维评分）

逐维打分 + 差距清单 + 加权总分，产出一份「Gate 体检报告」。这一步本身就是独立可交付的价值——哪怕用户不继续，体检报告也有用。

### Phase 3 分诊（四分类，借 aes-interview）

| 类别 | 例子 |
|---|---|
| Fact | 「仓库没有 CI」——查出来直接写进上下文 |
| User decision | 阻断强度（硬阻断还是先 advisory）；覆盖率阈值；性能预算——**团队风险偏好，不能替用户定** |
| Agent-owned | 文件放哪、脚本命名、workflow 拆分 |
| Blocked | 没有 branch protection 权限 → 显式降级（本地 hooks + 协议约定，并诚实登记「靠约定」，学 opencodex） |

### Phase 4 组装（从模式库选型，不发明）

**模式库**是 Skill 的 references/：把调研报告里每个已核查机制整理成一页——做什么 / 抄谁（文件级出处）/ 适用条件 / 代价 / 反例。首批模式：

| 模式 | 出处 | 生成物 |
|---|---|---|
| 聚合 required check | codex `blocking-ci.yml` | 一个聚合 job + 稳定 check 名，后续加 lane 不改 GitHub 设置 |
| 结构守卫 | haha `change-policy.ts` / open-design `guard.ts` | 本仓的结构断言脚本（如目录约定、manifest 校验） |
| 棘轮 | orca `check-max-lines-ratchet.mjs` | 基线文件 + 只许缩小的检查脚本 |
| 覆盖率门禁 | haha `coverage-thresholds.json` | 逐模块阈值 + 改动行覆盖率 + allowedDrop |
| 生成物漂移防线 | codex `check-clean-worktree` | CI 尾部校验 worktree 干净 |
| eval 接线 | gstack `evals.yml` | EVALS_TIER:gate 小套件起步（先 sentinel） |
| AGENTS.md 验证协议 | codex / haha / oh-my-openagent | 「改 X 必须跑 Y」「完成必须附结构化证据」 |
| PreToolUse 拦截 | gstack `careful`/`guard` | 危险命令拦截 + 冻结目录写入拦截 |
| 架构适应度函数 | codex `verify_tui_core_boundary.py` | 本仓的 import/依赖边界断言 |

每件生成物必须带两行头注释：**抄的哪个模式 + 为本仓适配了什么**。这就是「通用方法论、仓库特异性落地」的落点。

### Phase 5 自举（门禁自身被测试——cbm license-selftest 模式）

生成的每个 gate 脚本都带 selftest：**植入一个已知违规，必须被检出，selftest 才算过**。这是对「模板抄错/适配错」的机器兜底——模板化生成的最大风险是生成物本身是坏的，selftest 让坏生成物当场暴露。selftest 挂进同一条 CI。

### Phase 6 复诊（持续演进——Skill 的差异点）

| 机制 | 做法 |
|---|---|
| 登记簿 | `gate-registry.json`（orca reliability-gates 模式）：每门的红绿/flake 档位/保护级别/最近证据，Skill 每次进入先读它 |
| 棘轮收紧 | 每次复诊提议 1-3 个可收紧项（基线缩小、阈值上调、豁免删除），生成 diff 让用户确认 |
| 复诊触发 | 新增 lane / 门禁连续红 / flake 出现 / 定期（月或季） |
| 幂等 | 再次进入 = 读登记簿增量改进，永不推倒重来 |

---

## 3. CI + AI 双底座分工

| 职责 | CI（确定性轨） | AI（语义轨） |
|---|---|---|
| 结构/格式/漂移/测试 | 机器阻断，不可绕过 | — |
| 行为回归 | 跑 eval 矩阵、贴成本表 | LLM-as-judge 只看验收标准判行为 |
| 「完成」声明 | 确定性校验证据文件存在且合 schema | 产出结构化验证证据（oh-my-codex `hasStructuredVerificationEvidence` 形态） |
| 写代码时实时拦截 | 够不着（push 前无法介入） | PreToolUse 钩子挡危险命令/冻结目录 |
| flake 与成本 | 登记簿追踪、quarantine 限期 | sentinel 小套件快筛 |

两轨的**接口就是结构化证据合同**（twe-gate 的 structured-evidence schema 是现成参考）：AI 在流程内产出证据，CI 后置断言证据——superpowers-evals 的双轨判定（judge 看不到检查脚本 + final=pass 双条件）证明了这个形态可行。任何一轨红都算红。

采用阶梯（三档光谱作为落地顺序，不是三选一）：

```
advisory（零成本起步：AI 评论 + AGENTS.md 约定）
   → evidence（协议强制：结构化证据 + 校验脚本）
      → gating（eval 进 CI 阻断 + branch protection 收口）
```

---

## 4. Skill 自身的建设路线

| 里程碑 | 交付 | 依赖 | 验收 |
|---|---|---|---|
| **M0 模式库** | references/ 下每机制一页（出处、适用条件、代价、反例） | 调研报告 v2（已完成） | 每页出处可点开复核 |
| **M1 体检** | Phase 1+2：只读调查 + 5 维打分报告，不写任何文件 | M0 | 拿 2-3 个已知仓库跑体检，分数与人工判断一致；对 parking-agents 自己跑一次的结论是「无 CI + 本地门禁红着 = 纸面门禁」这类可复核断言 |
| **M2 组装** | Phase 3-5：生成最小 gate（CI 一条聚合 check + 1 个结构守卫 + 1 个棘轮 + selftest） | M1 | 生成的 gate 在目标仓库 CI 真的红绿可控；selftest 能抓住植入违规 |
| **M3 复诊** | Phase 6：登记簿 + 棘轮收紧 + 幂等再入 | M2 | 二次进入只增量改；棘轮只紧不松 |
| **M4 AI 档** | eval 接线（sentinel 起步）+ AGENTS.md 验证协议模板 + PreToolUse 拦截 | M2 | 在一个真仓库把 advisory 走到 evidence |
| **M5 引擎对接**（可选） | aes-gate 作为高可信底座的适配器：生成 gate.toml 声明而非原生脚本 | aes-gate 孵化成熟 | 同一仓库两种底座结论一致 |

M1 先行是刻意的：只读、零风险、独立有价值，还能在真实仓库上校准评分体系，再决定生成器细节。

---

## 5. 反模板保险（对「通用方案无效」的结构性防御）

1. **无调查不生成**：SKILL.md 硬规则——Phase 1 事实清单为空时拒绝进入 Phase 4。
2. **生成物全部标注出处与适配点**：审阅者一眼看出哪是抄的、哪是为本仓改的。
3. **selftest 兜底**：适配错误当场暴露，不等到第一次误放行。
4. **User decision 显式化**：阻断强度、阈值、预算永远列为用户裁决，Skill 只给选项和代价。
5. **Blocked 诚实登记**：降级方案写明「靠约定」，不伪装成硬门禁（学 opencodex 的诚实，反例是 everywhere-claude-code 的死配置）。
