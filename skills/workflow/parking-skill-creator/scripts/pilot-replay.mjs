#!/usr/bin/env node
// pilot-replay.mjs — materialize and execute the evidence-only half of a pilot.
// It creates a disposable eval workspace; it never runs the production skill
// and never contacts a provider.  aggregate-benchmark owns history writes.
import { existsSync, mkdirSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { readJson, writeJson } from "./lib/jsonio.mjs";
import { exitCodeFor, materializeEvidence, preflightEvidence, replayEvidence } from "./lib/evidence.mjs";

function usage() {
  console.log("用法: node pilot-replay.mjs --skill-dir <skill> --workspace <temporary iteration> --host-adapter <verified-host.json> [--gates with_skill,old_skill,without_skill]");
  process.exit(2);
}

const argv = process.argv.slice(2);
const flag = (name) => {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
};
const required = (name) => {
  const value = flag(name);
  if (!value || value.startsWith("--")) usage();
  return resolve(value);
};

const skillDir = required("--skill-dir");
const workspace = required("--workspace");
const hostAdapter = required("--host-adapter");
const gates = String(flag("--gates") ?? "with_skill,old_skill,without_skill").split(",").map((value) => value.trim()).filter(Boolean);
const iterationDir = join(workspace, "iteration-pilot");
const outputEvals = readJson(join(skillDir, "output-evals.json"));
if (!Array.isArray(outputEvals?.evals) || outputEvals.evals.length === 0) {
  console.log("FAIL PILOT_EVALS_MISSING");
  process.exit(1);
}
if (!existsSync(skillDir) || !statSync(skillDir).isDirectory() || !existsSync(hostAdapter)) {
  console.log("BLOCKED PILOT_INPUT_UNAVAILABLE");
  process.exit(3);
}

mkdirSync(iterationDir, { recursive: true });
const results = [];
for (const evalSpec of outputEvals.evals) {
  if (typeof evalSpec?.name !== "string" || !evalSpec.name || isAbsolute(evalSpec.name) || evalSpec.name.includes("..") || /[\\/]/.test(evalSpec.name)) {
    results.push({ eval: String(evalSpec?.name ?? ""), status: "FAIL", code: "PILOT_EVAL_NAME_INVALID", live_calls: 0 });
    continue;
  }
  const evalDir = join(iterationDir, evalSpec.name);
  mkdirSync(evalDir, { recursive: true });
  // Copy only the public eval definition plus its explicit evidence/quality
  // declarations.  Calls and audits stay in the disposable harness workspace.
  writeJson(join(evalDir, "eval_metadata.json"), {
    name: evalSpec.name,
    prompt: evalSpec.prompt,
    assertions: evalSpec.assertions ?? [],
    ...(evalSpec.quality ? { quality: evalSpec.quality } : {}),
    ...(evalSpec.evidence ? { evidence: evalSpec.evidence } : {}),
  });
  const metadataPath = join(evalDir, "eval_metadata.json");
  const preflight = preflightEvidence({ metadataPath, skillDir, hostAdapter });
  if (!preflight.ok) {
    results.push({ eval: evalSpec.name, status: preflight.status, code: preflight.code, live_calls: 0 });
    continue;
  }
  const materialized = materializeEvidence({ evalDir, skillDir, hostAdapter, gates });
  if (!materialized.ok) {
    results.push({ eval: evalSpec.name, status: materialized.status, code: materialized.code, live_calls: 0 });
    continue;
  }
  const callsPath = join(evalDir, "replay-calls.json");
  writeJson(callsPath, preflight.manifest.entries.map(({ id, query, intent }) => ({ entry_id: id, query, intent })));
  const replays = [];
  for (const gate of gates) {
    const runDir = join(evalDir, gate, "run-1");
    replays.push(replayEvidence({ metadataPath, skillDir, hostAdapter, callsPath, runDir }));
  }
  const failed = replays.find((result) => !result.ok);
  results.push({
    eval: evalSpec.name,
    status: failed?.status ?? "PASS",
    code: failed?.code ?? null,
    evidence_epoch: preflight.epoch,
    evidence_digest: preflight.evidence_digest,
    gates: gates.length,
    hits: failed ? 0 : preflight.entries,
    misses: failed ? (failed.misses ?? 0) : 0,
    live_calls: 0,
    network_isolation: "verified",
  });
}

const failed = results.find((result) => result.status !== "PASS");
const summary = { ok: !failed, status: failed?.status ?? "PASS", iteration_dir: iterationDir, evaluations: results };
console.log(`${summary.status} PILOT_REPLAY`);
console.log(JSON.stringify(summary));
process.exit(failed ? (failed.status === "BLOCKED" ? 3 : 1) : exitCodeFor(summary));
