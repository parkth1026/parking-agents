// evidence.mjs — external-evidence contract, provider seam, and replay guard.
// The module is deliberately dependency-free: the evidence plane is a local,
// auditable boundary, not a web client or a second scoring implementation.
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { readJson, writeJson } from "./jsonio.mjs";

export const EVIDENCE_MODES = new Set(["replay", "record", "live", "unmanaged"]);
export const EVIDENCE_RULESET = "external-evidence-v1";

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const GATE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const FORBIDDEN_KEY = /(?:api[_-]?key|access[_-]?token|auth(?:orization)?|cookie|credential|password|secret|session(?:[_-]?id)?|private[_-]?key|user[_-]?(?:id|path|home|dir))/i;
const SECRET_VALUE = /(?:(?:^|[^A-Za-z0-9_])sk-[A-Za-z0-9_-]{12,}|(?:^|[^A-Za-z0-9_])gh[pousr]_[A-Za-z0-9_-]{12,}|\bbearer\s+[A-Za-z0-9._~+/=-]{12,})/i;
const ABSOLUTE_USER_PATH = /(?:[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/]|(?:^|[\\/])(?:Users|home|root)[\\/])/i;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Deterministic JSON used for content addressing; object key order is semantic noise. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Bytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function sha256Text(text) {
  return sha256Bytes(Buffer.from(text, "utf8"));
}

export function sha256Json(value) {
  return sha256Text(canonicalJson(value));
}

export function manifestDigest(manifest) {
  if (!isObject(manifest)) return null;
  const copy = { ...manifest };
  delete copy.manifest_sha256;
  return sha256Json(copy);
}

function failure(status, code, extra = {}) {
  return { ok: false, status, code, live_calls: 0, ...extra };
}

export function exitCodeFor(result) {
  if (result?.ok) return 0;
  return result?.status === "BLOCKED" ? 3 : 1;
}

function safeRelativePath(value) {
  if (typeof value !== "string" || !value || isAbsolute(value)) return false;
  const parts = value.replaceAll("\\", "/").split("/");
  return !parts.includes("..") && parts.every((part) => part !== "");
}

function resolveManifestPath(manifestRef, metadataPath, skillDir) {
  if (!safeRelativePath(manifestRef)) return null;
  const candidates = [];
  if (skillDir) candidates.push(resolve(skillDir, manifestRef));
  candidates.push(resolve(dirname(metadataPath), manifestRef));
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

/**
 * The only replay PASS predicate.  Consumers must use this normalized result
 * instead of independently inferring a green evidence state from a subset of
 * fields.  `expectedHits` is the number of manifest entries for a complete
 * replay; a zero/partial call log is not evidence of a successful replay.
 */
export function validateReplayAudit(audit, { expectedDigest, expectedHits, requireExecuted = true } = {}) {
  const reasons = [];
  let status = "PASS";
  let code = null;
  const block = (nextCode, reason) => {
    if (status === "PASS" || status === "INCONCLUSIVE") {
      status = "BLOCKED";
      code = nextCode;
    }
    reasons.push(reason);
  };
  const fail = (nextCode, reason) => {
    if (status === "PASS" || status === "INCONCLUSIVE") {
      status = "FAIL";
      code = nextCode;
    }
    reasons.push(reason);
  };

  if (!isObject(audit)) {
    block("EVIDENCE_AUDIT_MISSING", "缺少 replay evidence-audit");
  } else {
    if (audit.status !== "PASS") {
      const inherited = audit.status === "FAIL" ? "FAIL" : "BLOCKED";
      if (inherited === "FAIL") fail(audit.code ?? "EVIDENCE_AUDIT_FAILED", `已有 replay 终态 ${audit.status}`);
      else block(audit.code ?? "EVIDENCE_AUDIT_FAILED", `已有 replay 终态 ${audit.status}`);
    }
    if (audit.mode !== "replay") fail("EVIDENCE_MODE_INVALID", "evidence-audit.mode 必须为 replay");
    if (audit.misses !== 0) fail("REPLAY_MISS_RECORDED", "replay audit 仍有 miss");
    if (audit.live_calls !== 0) fail("REPLAY_LIVE_CALLS_NONZERO", "replay audit live_calls 必须为 0");
    if (audit.network_isolation !== "verified") block("BLOCKED_NETWORK_ISOLATION_UNAVAILABLE", "replay audit 未证明 host isolation");
    if (audit.gate_digest_consistent !== true) block("EVIDENCE_DIGEST_MISMATCH", "replay audit 未证明 gate digest 一致");
    if (!DIGEST.test(audit.evidence_digest ?? "")) block("EVIDENCE_DIGEST_INVALID", "replay audit 缺少完整 evidence digest");
    if (expectedDigest && audit.evidence_digest !== expectedDigest) block("EVIDENCE_DIGEST_MISMATCH", "replay audit digest 与 manifest 不一致");
    if (requireExecuted && (!Number.isInteger(audit.hits) || audit.hits < 1)) fail("REPLAY_NOT_EXECUTED", "没有可审计的 replay 调用");
    if (expectedHits != null && (!Number.isInteger(audit.hits) || audit.hits !== expectedHits)) {
      fail("REPLAY_COVERAGE_INCOMPLETE", `replay hits=${String(audit.hits)} 不等于 manifest entries=${expectedHits}`);
    }
    if (isObject(audit.gates)) {
      const gateDigests = Object.values(audit.gates).map((gate) => gate?.evidence_digest);
      if (gateDigests.length === 0 || gateDigests.some((digest) => digest !== audit.evidence_digest) || new Set(gateDigests).size > 1) {
        block("EVIDENCE_DIGEST_MISMATCH", "audit.gates 中存在不同 evidence digest");
      }
    }
  }
  return {
    ok: status === "PASS",
    status,
    code,
    reasons,
    ...(isObject(audit) ? { audit } : {}),
  };
}

export function scanSanitization(value, path = "$") {
  const findings = [];
  const visit = (current, currentPath) => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
      return;
    }
    if (isObject(current)) {
      for (const [key, child] of Object.entries(current)) {
        if (FORBIDDEN_KEY.test(key)) findings.push(`${currentPath}.${key}: forbidden secret/session field`);
        visit(child, `${currentPath}.${key}`);
      }
      return;
    }
    if (typeof current === "string") {
      if (SECRET_VALUE.test(current)) findings.push(`${currentPath}: secret-like value`);
      if (ABSOLUTE_USER_PATH.test(current)) findings.push(`${currentPath}: absolute user path`);
      if (/^\s*(?:[A-Za-z]:[\\/]|\\\\)/.test(current)) findings.push(`${currentPath}: absolute path`);
    }
  };
  visit(value, path);
  return findings;
}

export function validateSanitizedPayload(bytes) {
  const text = Buffer.from(bytes).toString("utf8");
  let value = text;
  try { value = JSON.parse(text); } catch { /* plain text evidence is allowed */ }
  const findings = scanSanitization(value);
  return { ok: findings.length === 0, findings };
}

function validateManifestShape(manifest, expectedEval) {
  if (!isObject(manifest) || manifest.schema_version !== 1 || manifest.kind !== "eval-evidence-manifest") {
    return "manifest schema/kind 不符合 eval-evidence-manifest/v1";
  }
  if (typeof manifest.eval !== "string" || !manifest.eval) return "manifest 缺少 eval";
  if (expectedEval && manifest.eval !== expectedEval) return `manifest eval=${manifest.eval} 与题目 ${expectedEval} 不一致`;
  if (!Number.isInteger(manifest.epoch) || manifest.epoch < 1) return "manifest epoch 必须是正整数";
  if (manifest.sanitization?.status !== "passed" || manifest.sanitization?.ruleset !== EVIDENCE_RULESET) {
    return "manifest 未通过固定脱敏规则 external-evidence-v1";
  }
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) return "manifest entries 不能为空";
  const ids = new Set();
  for (const entry of manifest.entries) {
    if (!isObject(entry) || typeof entry.id !== "string" || !entry.id || ids.has(entry.id)) return "manifest entry id 缺失或重复";
    ids.add(entry.id);
    if (typeof entry.intent !== "string" || !entry.intent) return `entry ${entry.id} 缺少 intent`;
    if (typeof entry.query !== "string" || !entry.query) return `entry ${entry.id} 缺少 query`;
    if (!safeRelativePath(entry.payload)) return `entry ${entry.id} payload 必须是安全相对路径`;
    if (!DIGEST.test(entry.sha256 ?? "")) return `entry ${entry.id} sha256 不是完整 sha256 摘要`;
  }
  if (!DIGEST.test(manifest.manifest_sha256 ?? "")) return "manifest_sha256 不是完整 sha256 摘要";
  return null;
}

function loadMetadata(metadataPath) {
  const metadata = readJson(metadataPath);
  if (!isObject(metadata)) return { error: `eval_metadata.json 不可解析: ${metadataPath}` };
  const evidence = metadata.evidence;
  if (!isObject(evidence)) return { error: "eval_metadata.json 缺少 evidence 对象" };
  if (!EVIDENCE_MODES.has(evidence.mode)) return { error: `evidence.mode 不在闭集内: ${String(evidence.mode)}` };
  return { metadata, evidence, evalName: basenameSafe(dirname(metadataPath)) };
}

function basenameSafe(path) {
  const pieces = path.replaceAll("\\", "/").split("/");
  return pieces[pieces.length - 1] || "";
}

function hostState(hostAdapter) {
  if (!hostAdapter) return { network_isolation: "unverified", live_calls: 0 };
  const state = typeof hostAdapter === "string" ? readJson(hostAdapter) : hostAdapter;
  if (!isObject(state)) return { network_isolation: "unverified", live_calls: 0 };
  const isolation = state.network_isolation ?? state.networkIsolation
    ?? (state.external_tools_disabled === true && state.audit_supported === true ? "verified" : "unverified");
  return { network_isolation: isolation, live_calls: 0, host: state.host };
}

export function loadAndVerifyManifest({ metadataPath, skillDir }) {
  const loaded = loadMetadata(metadataPath);
  if (loaded.error) return failure("FAIL", "EVIDENCE_DECLARATION_INVALID", { detail: loaded.error });
  const { metadata, evidence, evalName } = loaded;
  if (evidence.mode === "unmanaged") {
    return { ok: true, mode: "unmanaged", audit: "unknown", compatibility: "legacy" };
  }
  if (!safeRelativePath(evidence.manifest)) {
    return failure("BLOCKED", "BLOCKED_EVIDENCE_UNAVAILABLE", { eval: evalName, detail: "manifest 必须是技能内安全相对路径" });
  }
  const manifestPath = resolveManifestPath(evidence.manifest, metadataPath, skillDir);
  if (!manifestPath) {
    return failure("BLOCKED", "BLOCKED_EVIDENCE_UNAVAILABLE", {
      eval: evalName,
      manifest: evidence.manifest,
      next_safe_action: "显式运行 record/live 补齐新 epoch；当前 replay 不自动联网",
    });
  }
  const manifest = readJson(manifestPath);
  const shapeError = validateManifestShape(manifest, evalName);
  if (shapeError) return failure("FAIL", "EVIDENCE_MANIFEST_INVALID", { eval: evalName, detail: shapeError });
  const manifestFindings = scanSanitization(manifest);
  if (manifestFindings.length > 0) return failure("FAIL", "EVIDENCE_SANITIZATION_FAILED", { eval: evalName, findings: manifestFindings });
  const actualManifestDigest = manifestDigest(manifest);
  if (manifest.manifest_sha256 !== actualManifestDigest || evidence.manifest_sha256 !== actualManifestDigest) {
    return failure("FAIL", "EVIDENCE_INTEGRITY_MISMATCH", {
      eval: evalName,
      expected_sha256: evidence.manifest_sha256,
      actual_sha256: actualManifestDigest,
      next_safe_action: "保留旧文件供审计；不得自动覆盖或重签摘要",
    });
  }
  if (evidence.schema_version !== 1 || evidence.epoch !== manifest.epoch) {
    return failure("FAIL", "EVIDENCE_DECLARATION_INVALID", {
      eval: evalName,
      declared_epoch: evidence.epoch,
      manifest_epoch: manifest.epoch,
      detail: "evidence schema_version/epoch 与 manifest 不一致",
    });
  }
  const manifestDir = dirname(manifestPath);
  for (const entry of manifest.entries) {
    const payloadPath = resolve(manifestDir, entry.payload);
    const payloadBytes = (() => { try { return readFileSync(payloadPath); } catch { return null; } })();
    if (!payloadBytes) {
      return failure("BLOCKED", "BLOCKED_EVIDENCE_UNAVAILABLE", {
        eval: evalName,
        entry_id: entry.id,
        expected_sha256: entry.sha256,
        next_safe_action: "显式运行 record/live 补齐新 epoch；当前 replay 不自动联网",
      });
    }
    const actual = sha256Bytes(payloadBytes);
    if (actual !== entry.sha256) {
      return failure("FAIL", "EVIDENCE_INTEGRITY_MISMATCH", {
        eval: evalName,
        entry_id: entry.id,
        expected_sha256: entry.sha256,
        actual_sha256: actual,
        next_safe_action: "保留旧文件供审计；不得自动覆盖或重签摘要",
      });
    }
    const sanitized = validateSanitizedPayload(payloadBytes);
    if (!sanitized.ok) {
      return failure("FAIL", "EVIDENCE_SANITIZATION_FAILED", { eval: evalName, entry_id: entry.id, findings: sanitized.findings });
    }
  }
  return {
    ok: true,
    mode: evidence.mode,
    provider: evidence.provider,
    eval: evalName,
    epoch: manifest.epoch,
    evidence_digest: actualManifestDigest,
    manifest_path: manifestPath,
    manifest,
    entries: manifest.entries.length,
    hits: manifest.entries.length,
    misses: 0,
    live_calls: 0,
  };
}

export function preflightEvidence({ metadataPath, skillDir, hostAdapter }) {
  const base = loadAndVerifyManifest({ metadataPath, skillDir });
  if (!base.ok) return base;
  if (base.mode === "unmanaged") return base;
  const metadata = readJson(metadataPath);
  const evidence = metadata.evidence;
  if (evidence.mode !== "replay") {
    return failure("FAIL", "EVIDENCE_MODE_NOT_REPLAY", { mode: evidence.mode, eval: base.eval });
  }
  if (evidence.miss_policy !== "fail") {
    return failure("FAIL", "REPLAY_MISS_POLICY_INVALID", { eval: base.eval, live_calls: 0 });
  }
  const host = hostState(hostAdapter);
  if (host.network_isolation !== "verified") {
    return failure("BLOCKED", "BLOCKED_NETWORK_ISOLATION_UNAVAILABLE", {
      eval: base.eval,
      host: host.host ?? "current-agent-host",
      required_capability: "disable_or_audit_external_tools",
      next_safe_action: "换用可隔离 host；或只作 exploratory 运行且不计入主 benchmark",
    });
  }
  return {
    ...base,
    network_isolation: "verified",
    gate_digest_consistent: true,
  };
}

let stageCounter = 0;

function stageName(targetDir) {
  stageCounter += 1;
  return `${targetDir}.tmp-${process.pid}-${stageCounter}-${randomUUID()}`;
}

/** Prepare a complete pack, then let the caller commit it as one directory. */
function stagePack(targetDir, manifest, sourceManifestDir) {
  const manifestTarget = join(targetDir, "evidence-pack.json");
  if (existsSync(targetDir)) {
    if (!statSync(targetDir).isDirectory()) throw new Error(`目标 evidence-pack 不是目录: ${targetDir}`);
    const existing = readJson(manifestTarget);
    if (manifestDigest(existing) !== manifestDigest(manifest)) throw new Error(`目标 evidence-pack 已存在但摘要不同: ${manifestTarget}`);
    for (const entry of manifest.entries) {
      const target = join(targetDir, entry.payload);
      if (!existsSync(target) || sha256Bytes(readFileSync(target)) !== entry.sha256) {
        throw new Error(`目标 payload 已存在但摘要不同或缺失: ${target}`);
      }
    }
    return { targetDir, stageDir: null };
  }

  const stageDir = stageName(targetDir);
  try {
    mkdirSync(join(stageDir, "payloads"), { recursive: true });
    for (const entry of manifest.entries) {
      const source = resolve(sourceManifestDir, entry.payload);
      const target = join(stageDir, entry.payload);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
    writeJson(join(stageDir, "evidence-pack.json"), manifest);
    return { targetDir, stageDir };
  } catch (error) {
    rmSync(stageDir, { recursive: true, force: true });
    throw error;
  }
}

export function materializeEvidence({ evalDir, skillDir, hostAdapter, gates }) {
  const metadataPath = join(evalDir, "eval_metadata.json");
  const preflight = preflightEvidence({ metadataPath, skillDir, hostAdapter });
  if (!preflight.ok) return preflight;
  if (preflight.mode !== "replay") return failure("FAIL", "EVIDENCE_MODE_NOT_REPLAY", { mode: preflight.mode });
  const gateList = Array.isArray(gates) ? gates : String(gates ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (gateList.length === 0 || gateList.some((gate) => !GATE_NAME.test(gate))) {
    return failure("FAIL", "EVIDENCE_GATES_INVALID", { detail: "gates 不能为空且必须是安全目录名" });
  }
  const gateResults = {};
  const staged = [];
  try {
    for (const gate of gateList) {
      const gateDir = join(evalDir, gate);
      const existingRuns = existsSync(gateDir) && statSync(gateDir).isDirectory()
        ? readdirSync(gateDir).filter((name) => /^run-\d+$/.test(name)).sort()
        : [];
      const runNames = existingRuns.length > 0 ? existingRuns : ["run-1"];
      const targets = [];
      for (const runName of runNames) {
        const target = join(gateDir, runName, "inputs", "evidence-pack");
        staged.push(stagePack(target, preflight.manifest, dirname(preflight.manifest_path)));
        targets.push(target);
      }
      gateResults[gate] = { evidence_digest: preflight.evidence_digest, target: targets[0], targets };
    }
    for (const item of staged) if (item.stageDir) {
      mkdirSync(dirname(item.targetDir), { recursive: true });
      renameSync(item.stageDir, item.targetDir);
    }
  } catch (err) {
    for (const item of staged) if (item.stageDir) rmSync(item.stageDir, { recursive: true, force: true });
    return failure("BLOCKED", "EVIDENCE_MATERIALIZATION_FAILED", { detail: err.message, eval: preflight.eval });
  }
  const result = {
    ok: true,
    kind: "evidence-materialized",
    mode: "replay",
    eval: preflight.eval,
    epoch: preflight.epoch,
    evidence_digest: preflight.evidence_digest,
    entries: preflight.entries,
    hits: preflight.hits,
    misses: 0,
    live_calls: 0,
    network_isolation: "verified",
    gate_digest_consistent: new Set(Object.values(gateResults).map((x) => x.evidence_digest)).size === 1,
    gates: gateResults,
  };
  writeJson(join(evalDir, "evidence-audit.json"), {
    schema_version: 1,
    status: "PASS",
    mode: "replay",
    eval: preflight.eval,
    evidence_epoch: preflight.epoch,
    evidence_digest: preflight.evidence_digest,
    hits: preflight.hits,
    misses: 0,
    live_calls: 0,
    network_isolation: "verified",
    gate_digest_consistent: result.gate_digest_consistent,
    gates: gateResults,
  });
  return result;
}

export function auditGateDigests({ evalDir, gates }) {
  const gateList = Array.isArray(gates) ? gates : String(gates ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const values = [];
  for (const gate of gateList) {
    const gateDir = join(evalDir, gate);
    const runNames = existsSync(gateDir) && statSync(gateDir).isDirectory()
      ? readdirSync(gateDir).filter((name) => /^run-\d+$/.test(name)).sort()
      : [];
    const runValues = runNames.map((run) => {
      const runPath = join(gateDir, run, "inputs", "evidence-pack", "evidence-pack.json");
      const pack = existsSync(runPath) ? readJson(runPath) : null;
      return { gate, run, evidence_digest: pack?.manifest_sha256, path: runPath, pack };
    });
    if (runValues.length === 0 || runValues.some((item) => !isObject(item.pack))) {
      return failure("BLOCKED", "BLOCKED_EVIDENCE_UNAVAILABLE", { eval: basenameSafe(evalDir), gate, live_calls: 0 });
    }
    for (const item of runValues) {
      const shapeError = validateManifestShape(item.pack, basenameSafe(evalDir));
      if (shapeError) return failure("FAIL", "EVIDENCE_MANIFEST_INVALID", { eval: basenameSafe(evalDir), gate: item.gate, run: item.run, detail: shapeError, live_calls: 0 });
      const actualManifestDigest = manifestDigest(item.pack);
      if (item.pack.manifest_sha256 !== actualManifestDigest) {
        return failure("BLOCKED", "EVIDENCE_DIGEST_MISMATCH", { eval: basenameSafe(evalDir), gate: item.gate, run: item.run, expected_sha256: item.pack.manifest_sha256, actual_sha256: actualManifestDigest });
      }
      const packDir = dirname(join(gateDir, item.run, "inputs", "evidence-pack", "evidence-pack.json"));
      for (const entry of item.pack.entries) {
        const payloadPath = join(packDir, entry.payload);
        if (!existsSync(payloadPath)) return failure("BLOCKED", "BLOCKED_EVIDENCE_UNAVAILABLE", { eval: basenameSafe(evalDir), gate: item.gate, run: item.run, entry_id: entry.id, live_calls: 0 });
        const bytes = readFileSync(payloadPath);
        if (sha256Bytes(bytes) !== entry.sha256) return failure("FAIL", "EVIDENCE_INTEGRITY_MISMATCH", { eval: basenameSafe(evalDir), gate: item.gate, run: item.run, entry_id: entry.id, expected_sha256: entry.sha256, actual_sha256: sha256Bytes(bytes), live_calls: 0 });
        const sanitized = validateSanitizedPayload(bytes);
        if (!sanitized.ok) return failure("FAIL", "EVIDENCE_SANITIZATION_FAILED", { eval: basenameSafe(evalDir), gate: item.gate, run: item.run, entry_id: entry.id, findings: sanitized.findings, live_calls: 0 });
      }
    }
    if (runValues.some((item) => !DIGEST.test(item.evidence_digest ?? ""))) {
      return failure("BLOCKED", "EVIDENCE_DIGEST_INVALID", { eval: basenameSafe(evalDir), gate, live_calls: 0 });
    }
    const gateDigests = new Set(runValues.map((item) => item.evidence_digest));
    if (gateDigests.size !== 1) {
      return failure("BLOCKED", "EVIDENCE_DIGEST_MISMATCH", { eval: basenameSafe(evalDir), gate, gates: runValues.map(({ gate: gateName, run, evidence_digest, path }) => ({ gate: gateName, run, evidence_digest, path })), live_calls: 0 });
    }
    values.push(...runValues.map(({ gate: gateName, run, evidence_digest, path }) => ({ gate: gateName, run, evidence_digest, path })));
  }
  const consistent = new Set(values.map((x) => x.evidence_digest)).size === 1;
  if (!consistent) {
    return failure("BLOCKED", "EVIDENCE_DIGEST_MISMATCH", {
      eval: basenameSafe(evalDir),
      gates: values,
      next_safe_action: "终止整组比较；重新从同一 evidence pack 物化全部 gate",
    });
  }
  return { ok: true, evidence_digest: values[0]?.evidence_digest ?? null, gate_digest_consistent: true, live_calls: 0, gates: values };
}

function readCalls(path) {
  if (!path) return failure("FAIL", "REPLAY_NOT_EXECUTED", { detail: "replay 必须提供可审计 calls JSON/JSONL" });
  let text;
  try { text = readFileSync(path, "utf8").trim(); } catch (error) {
    return failure("BLOCKED", "BLOCKED_REPLAY_CALLS_UNAVAILABLE", { detail: error.message });
  }
  if (!text) return failure("FAIL", "REPLAY_NOT_EXECUTED", { detail: "replay calls 为空" });
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? { ok: true, calls: parsed } : failure("FAIL", "REPLAY_CALLS_INVALID", { detail: "calls JSON 必须是数组" });
  } catch {
    try {
      return { ok: true, calls: text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) };
    } catch (error) {
      return failure("FAIL", "REPLAY_CALLS_INVALID", { detail: error.message });
    }
  }
}

export function replayEvidence({ metadataPath, skillDir, hostAdapter, callsPath, runDir }) {
  const preflight = preflightEvidence({ metadataPath, skillDir, hostAdapter });
  if (!preflight.ok) return preflight;
  const loadedCalls = readCalls(callsPath);
  if (!loadedCalls.ok) return { ...loadedCalls, eval: preflight.eval, live_calls: 0 };
  const calls = loadedCalls.calls;
  const byId = new Map(preflight.manifest.entries.map((entry) => [entry.id, entry]));
  const byQuery = new Map(preflight.manifest.entries.map((entry) => [entry.query, entry]));
  const seen = new Set();
  for (const call of calls) {
    const entry = call?.entry_id ? byId.get(call.entry_id) : (call?.query ? byQuery.get(call.query) : null);
    if (!entry || (call?.query && call.query !== entry.query)) {
      const result = failure("FAIL", "REPLAY_QUERY_MISS", {
        eval: preflight.eval,
        intent: call?.intent,
        query_sha256: call?.query ? sha256Text(call.query) : null,
        misses: 1,
        next_safe_action: "终止本 run；由独立 record 流程裁定是否扩 manifest",
      });
      if (runDir) writeJson(join(runDir, "evidence-audit.json"), { ...result, mode: "replay", network_isolation: "verified" });
      return result;
    }
    seen.add(entry.id);
  }
  const missingEntryIds = preflight.manifest.entries.filter((entry) => !seen.has(entry.id)).map((entry) => entry.id);
  if (missingEntryIds.length > 0) {
    const result = failure("FAIL", "REPLAY_COVERAGE_INCOMPLETE", {
      eval: preflight.eval,
      misses: missingEntryIds.length,
      missing_entry_ids: missingEntryIds,
      next_safe_action: "为每个 manifest entry 执行 replay；不要以空或部分 calls 进入 benchmark",
    });
    if (runDir) writeJson(join(runDir, "evidence-audit.json"), { ...result, mode: "replay", network_isolation: "verified" });
    return result;
  }
  const result = {
    ok: true,
    status: "PASS",
    mode: "replay",
    eval: preflight.eval,
    evidence_epoch: preflight.epoch,
    evidence_digest: preflight.evidence_digest,
    hits: calls.length,
    misses: 0,
    live_calls: 0,
    network_isolation: "verified",
    gate_digest_consistent: true,
  };
  if (runDir) writeJson(join(runDir, "evidence-audit.json"), result);
  return result;
}

function controlledPolicy(metadata, { authorized, concurrency, maxCalls }) {
  const policy = metadata?.evidence?.live_policy;
  if (authorized !== true) return failure("BLOCKED", "LIVE_AUTHORIZATION_REQUIRED", { next_safe_action: "由用户显式授权后再运行 record/live" });
  if (concurrency !== 1) return failure("BLOCKED", "LIVE_CONCURRENCY_UNSAFE", { concurrency, required_concurrency: 1 });
  const freshnessDeclared = (typeof policy?.freshness === "string" && policy.freshness.trim())
    || (typeof policy?.freshness_policy === "string" && policy.freshness_policy.trim())
    || (typeof policy?.freshness_days === "number" && Number.isFinite(policy.freshness_days) && policy.freshness_days >= 0);
  if (!isObject(policy) || policy.concurrency !== 1 || !Number.isInteger(policy.max_calls) || policy.max_calls < 1
    || !freshnessDeclared) {
    return failure("BLOCKED", "LIVE_POLICY_UNDECLARED", { next_safe_action: "逐题声明 concurrency、max_calls 与 freshness policy" });
  }
  if (!Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls !== policy.max_calls) {
    return failure("BLOCKED", "LIVE_POLICY_MISMATCH", { max_calls: maxCalls, declared_max_calls: policy.max_calls });
  }
  return { ok: true, policy };
}

/**
 * A JSON fixture is intentionally a simulated seam.  Only an executable
 * provider adapter is allowed to produce a real live-acceptance PASS; this
 * prevents a hand-authored fixture from being mistaken for a web proof.
 * The adapter receives a sanitized request list on stdin and must return
 * `{entries: ...}` or `{responses: ...}` as JSON on stdout.
 */
function providerEntries({ providerPath, providerAdapterPath }) {
  if (providerAdapterPath) {
    return { execution: "live", adapter: providerAdapterPath };
  }
  const provider = providerPath ? readJson(providerPath) : null;
  if (!isObject(provider)) return null;
  const entries = provider.entries ?? provider.responses;
  if (!Array.isArray(entries) && !isObject(entries)) return null;
  return { entries, execution: "simulated", fixture: providerPath };
}

function providerResponse(provider, entry) {
  if (provider.execution === "live") {
    const child = spawnSync(process.execPath, [provider.adapter], {
      input: JSON.stringify({
        schema_version: 1,
        kind: "external-evidence-provider-request",
        concurrency: 1,
        requests: [{ entry_id: entry.id, intent: entry.intent, query: entry.query }],
      }),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    if (child.error || child.status !== 0) return { error: `provider adapter 失败: ${child.error?.message ?? `exit ${child.status}`}` };
    let responseBody;
    try { responseBody = JSON.parse(String(child.stdout ?? "").trim()); } catch (error) {
      return { error: `provider adapter 输出不可解析: ${error.message}` };
    }
    const responseEntries = responseBody?.entries ?? responseBody?.responses;
    if (!isObject(responseBody) || (!Array.isArray(responseEntries) && !isObject(responseEntries))) return { error: "provider adapter 必须返回 entries/responses" };
    const response = Array.isArray(responseEntries)
      ? responseEntries.find((item) => item?.entry_id === entry.id)
      : responseEntries[entry.id];
    return response == null ? { error: `provider adapter 未返回 entry: ${entry.id}` } : { response };
  }
  const response = Array.isArray(provider.entries)
    ? provider.entries.find((item) => item?.entry_id === entry.id) ?? null
    : isObject(provider.entries) ? provider.entries[entry.id] ?? null : null;
  return { response };
}

function nextEpoch(outputDir) {
  if (!existsSync(outputDir)) return 1;
  const epochs = readdirSync(outputDir).filter((name) => /^epoch-\d+$/.test(name)).map((name) => Number(name.slice(6)));
  return epochs.length ? Math.max(...epochs) + 1 : 1;
}

function evidenceContentDigest(manifest) {
  return sha256Json({
    eval: manifest.eval,
    entries: (manifest.entries ?? []).map((entry) => ({
      id: entry.id,
      intent: entry.intent,
      query: entry.query,
      sha256: entry.sha256,
      source_count: entry.source_count ?? 0,
      tool: entry.tool ?? null,
      source_digest: entry.source_digest ?? null,
      captured_at: entry.captured_at ?? null,
    })),
  });
}

function templateManifest(metadataPath, skillDir) {
  const loaded = loadMetadata(metadataPath);
  if (loaded.error) return { error: loaded.error };
  const manifestPath = resolveManifestPath(loaded.evidence.manifest, metadataPath, skillDir);
  const manifest = manifestPath ? readJson(manifestPath) : null;
  if (!manifest || !Array.isArray(manifest.entries)) return { error: "record/live 缺少可扩展的 manifest entries" };
  return { metadata: loaded.metadata, evidence: loaded.evidence, manifest, evalName: loaded.evalName };
}

function capturedPayload(response) {
  if (isObject(response) && Object.prototype.hasOwnProperty.call(response, "payload")) return response.payload;
  return response;
}

export function recordEvidence({ metadataPath, skillDir, outputDir, providerPath, providerAdapterPath, authorized, concurrency, maxCalls }) {
  const template = templateManifest(metadataPath, skillDir);
  if (template.error) return failure("BLOCKED", "BLOCKED_EVIDENCE_UNAVAILABLE", { detail: template.error });
  const policy = controlledPolicy(template.metadata, { authorized, concurrency, maxCalls });
  if (!policy.ok) return policy;
  if (template.manifest.entries.length > maxCalls) {
    return failure("BLOCKED", "LIVE_BUDGET_EXHAUSTED", {
      eval: template.evalName,
      max_calls: maxCalls,
      completed_calls: maxCalls,
      remaining_entries: template.manifest.entries.length - maxCalls,
      epoch_promoted: false,
    });
  }
  const verifiedTemplate = loadAndVerifyManifest({ metadataPath, skillDir });
  if (!verifiedTemplate.ok) return { ...verifiedTemplate, epoch_promoted: false };
  template.manifest = verifiedTemplate.manifest;
  const provider = providerEntries({
    providerPath,
    providerAdapterPath,
  });
  if (!provider || provider.error) return failure("BLOCKED", "LIVE_PROVIDER_UNAVAILABLE", { detail: provider?.error, next_safe_action: "显式提供可审计 provider seam；不从 replay fallback" });
  const captured = [];
  for (const entry of template.manifest.entries) {
    const providerResult = providerResponse(provider, entry);
    if (providerResult.error) return failure("BLOCKED", "LIVE_PROVIDER_UNAVAILABLE", { eval: template.evalName, entry_id: entry.id, detail: providerResult.error, completed_calls: captured.length, epoch_promoted: false });
    const response = providerResult.response;
    if (response == null) return failure("BLOCKED", "LIVE_CAPTURE_INCOMPLETE", { eval: template.evalName, entry_id: entry.id, completed_calls: captured.length, epoch_promoted: false });
    const responseFindings = scanSanitization(response);
    if (responseFindings.length > 0) return failure("BLOCKED", "EVIDENCE_SANITIZATION_FAILED", { eval: template.evalName, entry_id: entry.id, findings: responseFindings, epoch_promoted: false });
    if (response.query !== entry.query) return failure("BLOCKED", "LIVE_QUERY_PLAN_FAILED", { eval: template.evalName, entry_id: entry.id, expected_query: entry.query, actual_query: response.query, completed_calls: captured.length, epoch_promoted: false });
    if (typeof response.tool !== "string" || !response.tool || !Array.isArray(response.sources) || response.sources.length === 0 || response.sources.some((source) => source?.reachable === false || typeof source?.url !== "string") || typeof response.captured_at !== "string" || !response.captured_at) {
      return failure("BLOCKED", "LIVE_CAPTURE_AUDIT_INCOMPLETE", { eval: template.evalName, entry_id: entry.id, completed_calls: captured.length, epoch_promoted: false });
    }
    const payload = capturedPayload(response);
    const text = JSON.stringify(payload, null, 2) + "\n";
    const sanitized = validateSanitizedPayload(Buffer.from(text, "utf8"));
    if (!sanitized.ok) return failure("BLOCKED", "EVIDENCE_SANITIZATION_FAILED", { eval: template.evalName, entry_id: entry.id, findings: sanitized.findings, epoch_promoted: false });
    captured.push({ entry, response, bytes: Buffer.from(text, "utf8") });
  }
  const epoch = nextEpoch(outputDir);
  const base = {
    schema_version: 1,
    kind: "eval-evidence-manifest",
    eval: template.manifest.eval,
    epoch,
    captured_at: captured[0]?.response?.captured_at ?? new Date().toISOString(),
    sanitization: { status: "passed", ruleset: EVIDENCE_RULESET },
    entries: captured.map(({ entry, response, bytes }) => ({
      id: entry.id,
      intent: entry.intent,
      query: entry.query,
      payload: `payloads/${entry.id}.json`,
      sha256: sha256Bytes(bytes),
      source_count: Array.isArray(response?.sources) ? response.sources.length : (entry.source_count ?? 0),
      tool: response.tool,
      source_digest: sha256Json(response.sources),
      captured_at: response.captured_at,
    })),
  };
  const manifest = { ...base, manifest_sha256: manifestDigest(base) };
  const contentDigest = evidenceContentDigest(manifest);
  const existingEpochs = existsSync(outputDir)
    ? readdirSync(outputDir).filter((name) => /^epoch-\d+$/.test(name)) : [];
  for (const existingName of existingEpochs) {
    const existing = readJson(join(outputDir, existingName, "evidence-pack.json"));
    if (existing && evidenceContentDigest(existing) === contentDigest) {
      return { ok: true, status: "PASS", mode: "record", execution: provider.execution, eval: template.evalName, evidence_epoch: existing.epoch, evidence_digest: existing.manifest_sha256, entries: captured.length, calls: captured.length, live_calls: captured.length, epoch_promoted: false, reused_epoch: true };
    }
  }
  const epochDir = join(outputDir, `epoch-${epoch}`);
  const stagingDir = `${epochDir}.tmp-${process.pid}-${randomUUID()}`;
  try {
    mkdirSync(join(stagingDir, "payloads"), { recursive: true });
    for (const item of captured) writeFileSync(join(stagingDir, `payloads/${item.entry.id}.json`), item.bytes);
    writeJson(join(stagingDir, "evidence-pack.json"), manifest);
    const stagedManifest = readJson(join(stagingDir, "evidence-pack.json"));
    if (manifestDigest(stagedManifest) !== stagedManifest?.manifest_sha256) throw new Error("staged evidence-pack manifest 摘要校验失败");
    for (const item of captured) {
      const stagedPayload = join(stagingDir, `payloads/${item.entry.id}.json`);
      const expectedPayloadDigest = stagedManifest.entries.find((entry) => entry.id === item.entry.id)?.sha256;
      if (!existsSync(stagedPayload) || sha256Bytes(readFileSync(stagedPayload)) !== expectedPayloadDigest) {
        throw new Error(`staged payload 摘要校验失败: ${item.entry.id}`);
      }
    }
    writeJson(join(stagingDir, "record-audit.json"), {
      schema_version: 1,
      status: "PASS",
      mode: "record",
      execution: provider.execution,
      eval: template.evalName,
      evidence_epoch: epoch,
      evidence_digest: manifest.manifest_sha256,
      calls: captured.map(({ entry, response }) => ({ entry_id: entry.id, query: entry.query, tool: response.tool, sources: response.sources.length, captured_at: response?.captured_at ?? null })),
      live_calls: captured.length,
      epoch_promoted: true,
    });
    if (existsSync(epochDir)) throw new Error(`目标 epoch 已存在: ${epochDir}`);
    renameSync(stagingDir, epochDir);
  } catch (err) {
    rmSync(stagingDir, { recursive: true, force: true });
    return failure("BLOCKED", "LIVE_EPOCH_WRITE_FAILED", { detail: err.message, epoch_promoted: false });
  }
  return { ok: true, status: "PASS", mode: "record", execution: provider.execution, eval: template.evalName, evidence_epoch: epoch, evidence_digest: manifest.manifest_sha256, entries: captured.length, calls: captured.length, live_calls: captured.length, epoch_promoted: true };
}

export function liveAcceptance({ metadataPath, skillDir, providerPath, providerAdapterPath, authorized, concurrency, maxCalls, auditPath }) {
  const template = templateManifest(metadataPath, skillDir);
  if (template.error) return failure("BLOCKED", "BLOCKED_EVIDENCE_UNAVAILABLE", { detail: template.error });
  const policy = controlledPolicy(template.metadata, { authorized, concurrency, maxCalls });
  if (!policy.ok) return policy;
  const verifiedTemplate = loadAndVerifyManifest({ metadataPath, skillDir });
  if (!verifiedTemplate.ok) return verifiedTemplate;
  template.manifest = verifiedTemplate.manifest;
  const provider = providerEntries({
    providerPath,
    providerAdapterPath,
  });
  if (!provider || provider.error) return failure("BLOCKED", "LIVE_PROVIDER_UNAVAILABLE", { detail: provider?.error });
  const checks = [];
  const finishFailure = (result, attemptedCalls = checks.length) => {
    const audited = {
      ...result,
      mode: "live",
      execution: provider.execution,
      real_provider_verified: provider.execution === "live",
      calls: attemptedCalls,
      max_calls: maxCalls,
      concurrency: 1,
      replay_comparison: "incomparable",
      live_calls: attemptedCalls,
      audit: checks,
    };
    if (auditPath) writeJson(auditPath, audited);
    return audited;
  };
  for (const entry of template.manifest.entries) {
    if (checks.length >= maxCalls) return finishFailure(failure("BLOCKED", "LIVE_BUDGET_EXHAUSTED", { eval: template.evalName, max_calls: maxCalls, completed_calls: checks.length, remaining_entries: template.manifest.entries.length - checks.length }));
    const providerResult = providerResponse(provider, entry);
    if (providerResult.error) return finishFailure(failure("BLOCKED", "LIVE_PROVIDER_UNAVAILABLE", { eval: template.evalName, entry_id: entry.id, detail: providerResult.error, completed_calls: checks.length }), checks.length + 1);
    const response = providerResult.response;
    if (!response) return finishFailure(failure("FAIL", "LIVE_QUERY_PLAN_FAILED", { eval: template.evalName, entry_id: entry.id, completed_calls: checks.length + 1 }), checks.length + 1);
    const sanitized = scanSanitization(response);
    if (sanitized.length > 0) return finishFailure(failure("FAIL", "LIVE_SANITIZATION_FAILED", { eval: template.evalName, entry_id: entry.id, findings: sanitized, completed_calls: checks.length + 1 }), checks.length + 1);
    if (response.query !== entry.query) return finishFailure(failure("FAIL", "LIVE_QUERY_PLAN_FAILED", { eval: template.evalName, entry_id: entry.id, expected_query: entry.query, actual_query: response.query, completed_calls: checks.length + 1 }), checks.length + 1);
    if (typeof response.tool !== "string" || !response.tool) return finishFailure(failure("FAIL", "LIVE_TOOL_PATH_FAILED", { eval: template.evalName, entry_id: entry.id, completed_calls: checks.length + 1 }), checks.length + 1);
    if (!Array.isArray(response.sources) || response.sources.length === 0 || response.sources.some((source) => source?.reachable === false || typeof source?.url !== "string")) {
      return finishFailure(failure("FAIL", "LIVE_SOURCE_REACHABILITY_FAILED", { eval: template.evalName, entry_id: entry.id, completed_calls: checks.length + 1 }), checks.length + 1);
    }
    if (response.freshness_ok !== true && response.freshness !== "PASS") return finishFailure(failure("FAIL", "LIVE_FRESHNESS_FAILED", { eval: template.evalName, entry_id: entry.id, completed_calls: checks.length + 1 }), checks.length + 1);
    checks.push({ entry_id: entry.id, query: entry.query, tool: response.tool, sources: response.sources.length, freshness: "PASS" });
  }
  const result = {
    ok: true,
    // Fixture acceptance is useful for the deterministic lifecycle matrix but
    // is never a real web acceptance.  A real PASS requires an executable
    // provider adapter and is explicitly marked as such in the audit.
    status: provider.execution === "live" ? "PASS" : "SIMULATED_PASS",
    mode: "live",
    execution: provider.execution,
    real_provider_verified: provider.execution === "live",
    eval: template.evalName,
    query_plan: "PASS",
    tool_path: "PASS",
    source_reachability: "PASS",
    freshness: "PASS",
    calls: checks.length,
    max_calls: maxCalls,
    concurrency: 1,
    replay_comparison: "incomparable",
    live_calls: checks.length,
    audit: checks,
  };
  if (auditPath) writeJson(auditPath, result);
  return result;
}
