# 组装模式库（最小集四件）

> 每件生成物必须带两行头注释：**抄的哪个模式 + 为本仓适配了什么**（反模板保险第 2 条）。
> 出处均为已核查仓库（`docs/research/ref-repos-gate-research.md`）；「无调查不生成」是硬规则——
> Phase 1 盘点事实为空时拒绝组装。本库只收最小集四件，其余归通用 gate-builder（出界）。

## 模式一：聚合 required check（aggregate-check）

- **出处**：codex 仓库 `blocking-ci.yml`——一条聚合 job 产出稳定 check 名，后续加 lane 不改 GitHub 设置；cbm 仓库 branch protection + 单一稳定 `ci-ok`。
- **做什么**：把全部 `kind=gate` 动作聚合进一个 CI job，产出一个**稳定名字**的 required check。
- **适用条件**：托管在 GitHub/GitLab 且有开 branch protection 权限；目标仓已有 run.toml 注册门。
- **代价**：需要账号级操作（开 Actions、protection）——步骤生成给用户执行，agent 不代开。
- **反例**：只建 workflow 不开 required checks + protection = **纸面**（四路验证修订①：git 官方坐实本地/无保护门禁可绕过；本轮结论必须记「未完成（纸面）」，不降级为提示）。
- **硬前提**：本模式组装的完成判据 = required checks + branch protection 接通；完成后用户确认、agent 写 `.aes-gate/protection.json`，复跑检测应见 `protection=ci-protected`。

## 模式二：结构守卫（structure-guard）

- **出处**：haha 仓库 `change-policy.ts` / open-design 仓库 `guard.ts`。
- **做什么**：对本仓结构约定做机器断言（如：`.agents/skills/<name>/SKILL.md` 存在且 scripts 全 `.mjs`、发布树与真源一致）。
- **适用条件**：盘点发现结构约定只活在 AGENTS.md 文字里（约定级），踩过目录结构类的坑。
- **代价**：约定变更时守卫要同步改；断言面过宽会误伤合法重构。
- **反例**：把「业务规则」写进结构守卫（那是测试的职责）；只查存在性不查内容（漂移检不出）。
- **适配示范**（本仓）：断言自研技能 `scripts/` 下无 `.ps1`、发布树由 build-release 生成无手改痕迹。

## 模式三：棘轮（ratchet）

- **出处**：orca 仓库 `check-max-lines-ratchet.mjs`——基线文件 + 只许缩小的检查脚本。
- **做什么**：给某指标（行数/门数/文件数）立基线，只许收紧不许放松。
- **适用条件**：有单调恶化倾向、又不必一步到位的指标。
- **代价**：基线阻碍合法删码/重构时需要泄压阀。
- **泄压阀（修订④，必须带）**：显式豁免须记录原因与重置后基线；豁免清单**只许缩小、不许变永久豁免**；不当 KPI（Goodhart）。
- **反例**：给业务指标上棘轮（那是产品决策）；无豁免通道的死棘轮（Fowler 与 Google 都反对绝对数值目标）。

## 模式四：eval 接线（eval-wiring）

- **出处**：gstack 仓库 `evals.yml`——EVALS_TIER:gate 小套件起步（先 sentinel）。
- **做什么**：把最小 eval 套件接进验证链，从 advisory 走向 evidence/gating。
- **适用条件**：仓库已有 evals 基建（如 `.agents/evals/`）；本技能机械面只识别「eval 命令在场」。
- **代价**：LLM judge 有偏差（AgentRewardBench：30% 轨迹误判成功），gating 前必须校准。
- **反例**：把未校准的 LLM judge 直接接成阻断门；eval 全量跑拖死反馈（先 sentinel 小套件）。
- **边界**：本技能对 AI 门禁**只检测不组装**（G4 出界，归通用 gate-builder）；本页仅作出处参考。

## 两范例四机制（吸收不搬本体）

范例仓库（aes-agents-v2 的 aes-gate-autopilot / aes-gate-goal-contract）不在本仓依赖面，按四机制名吸收进技能纪律：

| 机制 | 落点 |
| --- | --- |
| 证据档位 | 一切结论带证据链：文件/命令/退出码（本技能报告与 registry 的 evidence 字段） |
| verdict 纪律 | 状态只用锁定枚举 green/red/missing/stale；超时/不确定归红，绝不猜 |
| 固化优先 | 踩坑先想「能不能固化为机器门」，判例答不出才降约定级并明示 |
| 防滞留 | 缺口必须有 owner；组装分诊用户不答=BLOCKED，不自动选、不静默搁置 |
