// quality.mjs — quality-plan validation and evidence-aware quality verdicts.
// Static writing review records hypotheses; only comparable runs can support a claim.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { sha256Json, validateReplayAudit } from "./evidence.mjs";

export const QUALITY_STATUSES = new Set(["SUPPORTED", "INCONCLUSIVE", "REGRESSED", "BLOCKED", "unassessed"]);
const REQUIRED_HYPOTHESIS_FIELDS = ["id", "lever", "risk", "expected_behavior", "assertions", "gates"];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertionMatches(ref, assertion) {
  if (!assertion || !isObject(assertion)) return false;
  return ref === assertion.name || ref === assertion.text || ref === assertion.ac;
}

function inferComparators(gates) {
  if (gates.includes("old_skill")) return ["old_skill"];
  if (gates.includes("without_skill")) return ["without_skill"];
  return [];
}

function normalizeNotApplicable(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) return { error: "not_applicable 必须是数组" };
  const result = [];
  for (const item of value) {
    if (!isObject(item) || !nonEmpty(item.lever) || !nonEmpty(item.reason)) {
      return { error: "not_applicable 每项必须含 lever 与 reason，不能为无理由的 checklist" };
    }
    result.push({ lever: item.lever, reason: item.reason });
  }
  return result;
}

function normalizePolicy(metadata, assertions, gates) {
  const configured = metadata?.quality?.policy ?? metadata?.quality_policy ?? {};
  const types = assertions.map((a) => a?.type);
  const defaultRuns = assertions.length > 0 && types.some((type) => type !== "script") ? 3 : 1;
  const runs = configured.stability_runs ?? defaultRuns;
  if (!Number.isInteger(runs) || runs < 1) return { error: "quality policy stability_runs 必须是正整数" };
  const requiredComparators = Array.isArray(configured.required_comparators)
    ? [...new Set(configured.required_comparators.filter(nonEmpty))]
    : inferComparators(gates);
  const costBudget = configured.cost_budget ?? null;
  if (costBudget !== null && !isObject(costBudget)) return { error: "quality policy cost_budget 必须是对象" };
  return {
    stability_runs: runs,
    required_comparators: requiredComparators,
    ...(costBudget ? { cost_budget: costBudget } : {}),
  };
}

function normalizeHypothesis(raw, assertions, index) {
  if (!isObject(raw)) return { error: `quality hypothesis ${index + 1} 必须是对象` };
  for (const field of REQUIRED_HYPOTHESIS_FIELDS) {
    if (field === "assertions" || field === "gates") continue;
    if (!nonEmpty(raw[field])) return { error: `quality hypothesis ${raw.id ?? index + 1} 缺少 ${field}` };
  }
  if (!Array.isArray(raw.assertions) || raw.assertions.length === 0) return { error: `quality hypothesis ${raw.id} 缺少 assertions` };
  if (!Array.isArray(raw.gates) || raw.gates.length < 2) return { error: `quality hypothesis ${raw.id} 至少需要两个 gate 对照` };
  for (const ref of raw.assertions) {
    if (!nonEmpty(ref) || !assertions.some((assertion) => assertionMatches(ref, assertion))) {
      return { error: `quality hypothesis ${raw.id} 绑定了未登记 assertion: ${String(ref)}` };
    }
  }
  const gates = [...new Set(raw.gates.filter(nonEmpty))];
  if (!gates.includes("with_skill")) return { error: `quality hypothesis ${raw.id} 缺少 with_skill gate` };
  return {
    id: raw.id,
    lever: raw.lever,
    risk: raw.risk,
    expected_behavior: raw.expected_behavior,
    assertions: [...new Set(raw.assertions)],
    gates,
  };
}

/** Validate a static review and convert only bound findings into hypotheses. */
export function buildQualityPlan({ skillDir, metadata, review = {} }) {
  const guidePath = join(skillDir, "references", "writing-guide.md");
  if (!existsSync(guidePath) || !statSync(guidePath).isFile()) return { ok: false, code: "LOCAL_WRITING_GUIDE_MISSING", detail: guidePath };
  // Reading this one local guide is the only writing reference in the Creator path.
  readFileSync(guidePath, "utf8");
  const assertions = Array.isArray(metadata?.assertions)
    ? metadata.assertions.map((item) => typeof item === "string" ? { name: item } : item)
    : [];
  const findings = review?.findings ?? [];
  if (!Array.isArray(findings)) return { ok: false, code: "QUALITY_FINDINGS_INVALID", detail: "findings 必须是数组" };
  const existing = metadata?.quality?.hypotheses ?? metadata?.quality_hypotheses ?? [];
  const rawHypotheses = findings.length > 0 ? findings : existing;
  const hypotheses = [];
  for (let i = 0; i < rawHypotheses.length; i++) {
    const normalized = normalizeHypothesis(rawHypotheses[i], assertions, i);
    if (normalized.error) return { ok: false, code: "UNBOUND_QUALITY_FINDING", detail: normalized.error };
    hypotheses.push(normalized);
  }
  const notApplicable = normalizeNotApplicable(review?.not_applicable ?? metadata?.not_applicable);
  if (notApplicable.error) return { ok: false, code: "QUALITY_NOT_APPLICABLE_INVALID", detail: notApplicable.error };
  const gates = [...new Set(hypotheses.flatMap((hypothesis) => hypothesis.gates))];
  const policy = normalizePolicy(metadata, assertions, gates);
  if (policy.error) return { ok: false, code: "QUALITY_POLICY_INVALID", detail: policy.error };
  if (hypotheses.length > 0 && policy.required_comparators.length === 0) {
    return { ok: false, code: "QUALITY_COMPARATOR_MISSING", detail: "每个质量 hypothesis 至少需要一个相关 comparator" };
  }
  const missingComparators = policy.required_comparators.filter((gate) => !gates.includes(gate));
  if (missingComparators.length > 0) return { ok: false, code: "QUALITY_COMPARATOR_MISSING", detail: `缺少 required comparator: ${missingComparators.join(", ")}` };
  const unboundComparators = hypotheses.filter((hypothesis) => !policy.required_comparators.some((gate) => hypothesis.gates.includes(gate)));
  if (unboundComparators.length > 0) {
    return { ok: false, code: "QUALITY_HYPOTHESIS_UNCOVERED", detail: `hypothesis 未绑定相关 comparator: ${unboundComparators.map((hypothesis) => hypothesis.id).join(", ")}` };
  }
  return {
    ok: true,
    kind: "agent-document-review",
    source: "references/writing-guide.md",
    quality_hypotheses: hypotheses,
    not_applicable: notApplicable,
    quality_policy: policy,
    verdict: "FINDINGS_RECORDED_NOT_PROVEN",
    unbound_findings: 0,
  };
}

function lineCount(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).length - (text.endsWith("\n") || text.endsWith("\r") ? 1 : 0);
}

function filesUnder(dir) {
  const files = [];
  const walk = (current) => {
    if (!existsSync(current) || !statSync(current).isDirectory()) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  walk(dir);
  return files;
}

/** Audit the fixed, user-confirmed context budgets without adding a new reference. */
export function auditCreatorContext(creatorDir) {
  const allFiles = filesUnder(creatorDir);
  const forbiddenNames = [
    ["writing", "for", "agents"].join("-"),
    ["writing", "for", "agents"].join(" "),
  ];
  const externalSkillDependencies = [];
  for (const path of allFiles) {
    let text;
    try { text = readFileSync(path, "utf8"); } catch { continue; }
    if (forbiddenNames.some((name) => text.includes(name))) externalSkillDependencies.push(relative(creatorDir, path));
  }
  const skillPath = join(creatorDir, "SKILL.md");
  const guidePath = join(creatorDir, "references", "writing-guide.md");
  const skillText = existsSync(skillPath) ? readFileSync(skillPath, "utf8") : "";
  const guideText = existsSync(guidePath) ? readFileSync(guidePath, "utf8") : "";
  const alwaysLoaded = {
    files: ["SKILL.md"],
    utf8_bytes: Buffer.byteLength(skillText, "utf8"),
    max_utf8_bytes: 31415,
    lines: lineCount(skillText),
    max_lines: 312,
  };
  const createOrEdit = {
    files: ["SKILL.md", "references/writing-guide.md"],
    utf8_bytes: Buffer.byteLength(skillText, "utf8") + Buffer.byteLength(guideText, "utf8"),
    max_utf8_bytes: 40364,
    lines: lineCount(skillText) + lineCount(guideText),
    max_lines: 475,
  };
  alwaysLoaded.status = alwaysLoaded.utf8_bytes <= alwaysLoaded.max_utf8_bytes && alwaysLoaded.lines <= alwaysLoaded.max_lines ? "PASS" : "FAIL";
  createOrEdit.status = createOrEdit.utf8_bytes <= createOrEdit.max_utf8_bytes && createOrEdit.lines <= createOrEdit.max_lines ? "PASS" : "FAIL";
  const packageStandalone = externalSkillDependencies.length === 0;
  return {
    kind: "creator-context-audit",
    independence: { external_skill_dependencies: externalSkillDependencies, package_standalone: packageStandalone },
    always_loaded: alwaysLoaded,
    create_or_edit_branch: createOrEdit,
    status: packageStandalone && alwaysLoaded.status === "PASS" && createOrEdit.status === "PASS" ? "PASS" : "FAIL",
  };
}

function auditForEval(evalEntry) {
  return evalEntry.evidence_audit ?? null;
}

/** Summarize explicit evidence declarations; legacy evals remain unmanaged. */
export function summarizeEvidence(evals) {
  const declared = evals.filter((entry) => isObject(entry.evidence));
  if (declared.length === 0) return { managed: false, status: "unmanaged", mode: "unmanaged", audit: "unknown", compatibility: "legacy" };
  const modes = new Set(declared.map((entry) => entry.evidence.mode));
  if (modes.size !== 1 || !modes.has("replay")) {
    return { managed: true, blocking: true, status: "BLOCKED", code: "EVIDENCE_MODE_INVALID", mode: [...modes][0] ?? "unknown", live_calls: 0 };
  }
  const audits = declared.map(auditForEval);
  if (audits.some((audit) => !isObject(audit))) return { managed: true, blocking: true, status: "BLOCKED", code: "EVIDENCE_AUDIT_MISSING", mode: "replay", live_calls: 0 };
  const validations = audits.map((audit) => validateReplayAudit(audit, {
    expectedDigest: audit.evidence_digest,
    expectedHits: Number.isInteger(audit.hits) ? audit.hits : undefined,
  }));
  const invalid = validations.find((validation) => !validation.ok);
  if (invalid) return { managed: true, blocking: true, status: invalid.status, code: invalid.code ?? "EVIDENCE_AUDIT_FAILED", reasons: invalid.reasons, mode: "replay", live_calls: 0 };
  const digests = [...new Set(audits.map((audit) => audit.evidence_digest).filter(Boolean))].sort();
  const epochs = [...new Set(audits.map((audit) => audit.evidence_epoch ?? audit.epoch).filter((epoch) => epoch != null))].sort((a, b) => a - b);
  const perEval = declared.map((entry, index) => ({
    eval: entry.name,
    mode: entry.evidence.mode,
    provider: entry.evidence.provider,
    evidence_epoch: audits[index].evidence_epoch ?? audits[index].epoch ?? null,
    evidence_digest: audits[index].evidence_digest,
    hits: audits[index].hits ?? 0,
    misses: audits[index].misses ?? 0,
    live_calls: audits[index].live_calls ?? 0,
    network_isolation: audits[index].network_isolation,
    gate_digest_consistent: audits[index].gate_digest_consistent,
  }));
  return {
    managed: true,
    blocking: false,
    status: "PASS",
    mode: "replay",
    provider: declared[0].evidence.provider,
    evidence_epoch: epochs.length === 1 ? epochs[0] : null,
    evidence_epochs: epochs,
    evidence_digest: digests.length === 1 ? digests[0] : "multiple",
    evidence_digests: digests,
    per_eval: perEval,
    hits: audits.reduce((sum, audit) => sum + Number(audit.hits ?? 0), 0),
    misses: audits.reduce((sum, audit) => sum + Number(audit.misses ?? 0), 0),
    live_calls: audits.reduce((sum, audit) => sum + Number(audit.live_calls ?? 0), 0),
    network_isolation: "verified",
    gate_digest_consistent: true,
    validation: { status: "PASS", reasons: [] },
  };
}

export function harnessDigest(evals) {
  return sha256Json(evals.map((evalEntry) => ({
    name: evalEntry.name,
    prompt: evalEntry.prompt,
    assertions: evalEntry.assertion_specs ?? [],
    evidence: evalEntry.evidence ?? { mode: "unmanaged" },
    quality: evalEntry.quality ?? null,
  })));
}

function allHypotheses(evals) {
  return evals.flatMap((evalEntry) => {
    const quality = evalEntry.quality ?? {};
    const hypotheses = quality.hypotheses ?? quality.quality_hypotheses ?? [];
    return Array.isArray(hypotheses) ? hypotheses.map((hypothesis) => ({ evalEntry, hypothesis })) : [];
  });
}

function runAssertionRate(evalEntry, gate, ref) {
  const runs = evalEntry.configs?.[gate] ?? [];
  const values = [];
  for (const run of runs) {
    const result = (run.results ?? []).find((item) => assertionMatches(ref, item) || item?.name === ref || item?.text === ref);
    if (result && typeof result.passed === "boolean") values.push(result.passed ? 1 : 0);
  }
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function completedRuns(evals, gate) {
  return evals.reduce((sum, evalEntry) => sum + (evalEntry.configs?.[gate]?.length ?? 0), 0);
}

function aggregateDeltas(entries) {
  const scopes = new Map();
  for (const entry of entries) {
    const key = entry.assertion;
    const scope = `${entry.eval}::${entry.hypothesis}::${entry.comparator}`;
    if (!scopes.has(key)) scopes.set(key, new Set());
    scopes.get(key).add(scope);
  }
  const deltas = {};
  for (const entry of entries) {
    const key = scopes.get(entry.assertion)?.size === 1
      ? entry.assertion
      : `${entry.eval}::${entry.hypothesis}::${entry.comparator}::${entry.assertion}`;
    deltas[key] = entry.delta;
  }
  return deltas;
}

function meanTokens(evalEntry, gate) {
  const values = (evalEntry.configs?.[gate] ?? []).map((run) => run.tokens).filter((value) => typeof value === "number");
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function requiredRunsFor(evalEntry) {
  const configured = evalEntry.quality?.policy?.stability_runs;
  if (Number.isInteger(configured) && configured > 0) return configured;
  const assertions = evalEntry.assertion_specs ?? [];
  return assertions.length > 0 && assertions.some((assertion) => assertion?.type !== "script") ? 3 : 1;
}

function comparatorFor(evalEntry, policy, hypothesis) {
  return policy.required_comparators?.find((gate) => hypothesis?.gates?.includes(gate))
    ?? policy.required_comparators?.find((gate) => gate !== "with_skill")
    ?? (evalEntry.configs?.old_skill ? "old_skill" : "without_skill");
}

/** Derive an honest quality claim from comparable, repeated, hypothesis-bound runs. */
export function buildQualityVerdict({ evals, benchmark, evidenceAudit }) {
  const pairs = allHypotheses(evals);
  if (!evidenceAudit?.managed && pairs.length === 0) {
    return {
      quality_audit: {
        hypotheses_total: 0,
        hypotheses_covered: 0,
        required_runs: null,
        completed_runs: {},
        required_comparators: [],
        assertion_delta: {},
        cost_budget_status: "unknown",
        comparison_epoch_consistent: null,
      },
      quality_verdict: {
        status: "unassessed",
        reasons: ["legacy eval 未声明 evidence/quality schema"],
        forbidden_claims: ["legacy 记录不能声称 zero-live、固定 evidence 或质量增益"],
        next_safe_action: "首次 opt-in 时开启新的质量比较纪元",
      },
    };
  }
  if (!evidenceAudit?.managed) {
    return {
      quality_audit: {
        hypotheses_total: pairs.length,
        hypotheses_covered: 0,
        required_runs: null,
        completed_runs: {},
        required_comparators: [],
        assertion_delta: {},
        cost_budget_status: "unknown",
        comparison_epoch_consistent: false,
      },
      quality_verdict: {
        status: "INCONCLUSIVE",
        reasons: ["evidence mode unmanaged，质量 hypothesis 没有可比的固定输入"],
        forbidden_claims: ["不能把 legacy/unmanaged 记录升级为质量增益证明"],
        next_safe_action: "为同一题面显式开启 replay/record/live contract 后重跑",
      },
    };
  }
  const hypothesesTotal = pairs.length;
  const policies = evals.map((evalEntry) => evalEntry.quality?.policy ?? {}).filter(isObject);
  const requiredRuns = Math.max(1, ...evals.map(requiredRunsFor));
  const inferredGates = Object.keys(benchmark.configs ?? {});
  const requiredComparators = [...new Set(policies.flatMap((policy) => Array.isArray(policy.required_comparators) ? policy.required_comparators : []))];
  if (requiredComparators.length === 0) requiredComparators.push(inferredGates.includes("old_skill") ? "old_skill" : "without_skill");
  const completed = Object.fromEntries(["with_skill", ...requiredComparators].map((gate) => [gate, completedRuns(evals, gate)]));
  const assertionEntries = [];
  let covered = 0;
  const missing = [];
  for (const { evalEntry, hypothesis } of pairs) {
    const policy = evalEntry.quality?.policy ?? {};
    const comparator = comparatorFor(evalEntry, { ...policy, required_comparators: requiredComparators }, hypothesis);
    const withRate = hypothesis.assertions.map((ref) => runAssertionRate(evalEntry, "with_skill", ref));
    const comparatorRate = hypothesis.assertions.map((ref) => runAssertionRate(evalEntry, comparator, ref));
    const valid = withRate.every((value) => value !== null) && comparatorRate.every((value) => value !== null)
      && hypothesis.gates?.includes(comparator)
      && (evalEntry.configs?.with_skill?.length ?? 0) >= requiredRunsFor(evalEntry)
      && (evalEntry.configs?.[comparator]?.length ?? 0) >= requiredRunsFor(evalEntry);
    if (valid) covered++;
    else missing.push(`${hypothesis.id}: runs/comparator/assertion 不足`);
    for (let i = 0; i < hypothesis.assertions.length; i++) {
      if (withRate[i] !== null && comparatorRate[i] !== null) assertionEntries.push({ assertion: hypothesis.assertions[i], delta: withRate[i] - comparatorRate[i], eval: evalEntry.name, hypothesis: hypothesis.id, comparator });
    }
  }
  const assertionDelta = aggregateDeltas(assertionEntries);
  const negative = Object.values(assertionDelta).some((value) => value < 0);
  const positive = Object.values(assertionDelta).some((value) => value > 0);
  let costBudgetStatus = "not_declared";
  const costBudgetDetails = [];
  for (const evalEntry of evals) {
    const policy = evalEntry.quality?.policy ?? {};
    const budget = policy.cost_budget;
    if (!isObject(budget) || typeof budget.tokens_ratio_vs_old_max !== "number") continue;
    const comparator = comparatorFor(evalEntry, policy, null);
    const primaryTokens = meanTokens(evalEntry, "with_skill");
    const comparatorTokens = meanTokens(evalEntry, comparator);
    const ratio = primaryTokens != null && comparatorTokens > 0 ? primaryTokens / comparatorTokens : null;
    costBudgetDetails.push({
      eval: evalEntry.name,
      comparator,
      max_ratio: budget.tokens_ratio_vs_old_max,
      ratio,
      status: ratio === null ? "unknown" : ratio <= budget.tokens_ratio_vs_old_max ? "within_budget" : "exceeded",
    });
  }
  if (costBudgetDetails.length > 0) {
    costBudgetStatus = costBudgetDetails.some((detail) => detail.status === "exceeded")
      ? "exceeded"
      : costBudgetDetails.some((detail) => detail.status === "unknown") ? "unknown" : "within_budget";
  }
  const qualityAudit = {
    hypotheses_total: hypothesesTotal,
    hypotheses_covered: covered,
    required_runs: requiredRuns,
    completed_runs: completed,
    required_comparators: requiredComparators,
    assertion_delta: assertionDelta,
    cost_budget_status: costBudgetStatus,
    cost_budget_details: costBudgetDetails,
    required_runs_by_eval: Object.fromEntries(evals.map((evalEntry) => [evalEntry.name, requiredRunsFor(evalEntry)])),
    comparison_epoch_consistent: evidenceAudit?.managed ? !evidenceAudit.blocking : true,
  };
  let status = "SUPPORTED";
  const reasons = [];
  const forbiddenClaims = [];
  if (evidenceAudit?.blocking) {
    status = "BLOCKED";
    reasons.push(`证据前置 ${evidenceAudit.code ?? "不可用"}，没有进入质量比较`);
  } else if (hypothesesTotal === 0) {
    status = "INCONCLUSIVE";
    reasons.push("没有登记 quality_hypotheses，静态审查不能直接产生质量 PASS");
  } else if (covered < hypothesesTotal || requiredComparators.some((gate) => !inferredGates.includes(gate))) {
    status = "INCONCLUSIVE";
    reasons.push(...missing, "高风险假设尚未获得足量 runs 与相关 comparator 覆盖");
  } else if (costBudgetStatus === "exceeded" || negative) {
    status = "REGRESSED";
    if (negative) reasons.push("关键 assertion 相对 comparator 退步");
    if (costBudgetStatus === "exceeded") reasons.push("已声明 token 成本预算被突破");
  } else if (!positive) {
    status = "INCONCLUSIVE";
    reasons.push("with_skill 与相关 comparator 在关键 assertion 上全平，绝对高分没有区分度");
  } else if (costBudgetStatus === "unknown") {
    status = "INCONCLUSIVE";
    reasons.push("已声明成本预算但 timing/tokens 缺少可比样本");
  } else {
    reasons.push("所有高风险假设都有足量、可比的对照；关键 assertion 出现正向差异且成本在预算内");
  }
  if (evidenceAudit?.mode === "replay") forbiddenClaims.push("本轮 replay 不能证明当前外部来源新鲜或实时在售");
  if (status === "INCONCLUSIVE") forbiddenClaims.push("绝对 pass_rate=100% 不等于相对质量增益");
  if (status === "BLOCKED") forbiddenClaims.push("证据前置未通过时不能声称质量结论");
  return {
    quality_audit: qualityAudit,
    quality_verdict: {
      status,
      reasons: reasons.filter(Boolean),
      forbidden_claims: forbiddenClaims,
      next_safe_action: status === "SUPPORTED" ? "保留证据并进入下一发布门" : status === "REGRESSED" ? "回退候选或重新说明取舍并开新假设" : status === "BLOCKED" ? "修复 evidence/host 前置后重跑同一 contract" : "增强题面/断言/定向消融或补足 runs，不先迎合噪声改 skill",
    },
  };
}
