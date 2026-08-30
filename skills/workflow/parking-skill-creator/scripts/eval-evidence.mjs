#!/usr/bin/env node
// eval-evidence.mjs — fixed evidence preflight/materialize/replay and opt-in provider seam.
// It never turns a replay miss into a live call and never scores a record.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  auditGateDigests,
  exitCodeFor,
  liveAcceptance,
  materializeEvidence,
  preflightEvidence,
  recordEvidence,
  replayEvidence,
} from "./lib/evidence.mjs";

function usage() {
  console.log("用法: node eval-evidence.mjs <preflight|materialize|replay|audit-gates|record|live> [选项]");
  console.log("  --eval-metadata <path>  eval_metadata.json（preflight/replay/record/live）");
  console.log("  --eval-dir <path>       eval 目录（materialize/audit-gates）");
  console.log("  --skill-dir <path>      被评技能目录，解析相对 manifest");
  console.log("  --host-adapter <path>   host isolation adapter JSON");
  console.log("  --gates <a,b,c>         gate 名（materialize/audit-gates）");
  console.log("  --calls <path>          replay 的请求 JSON/JSONL");
  console.log("  --provider-fixture <path>  record/live 的 simulated provider JSON（不能产生真实 live PASS）");
  console.log("  --provider-adapter <path>  record/live 的可执行 provider adapter；stdin/stdout JSON seam");
  console.log("  --output-dir <path>     record 新 epoch 的父目录");
  console.log("  --audit-path <path>     live 审计输出路径");
  console.log("  --concurrency 1 --max-calls N --authorize-live  受控 record/live 参数");
  process.exit(2);
}

const argv = process.argv.slice(2);
const command = argv.shift();
if (!command || command === "--help") usage();
const flag = (name) => {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
};
const has = (name) => argv.includes(name);
const required = (name) => {
  const value = flag(name);
  if (!value || value.startsWith("--")) usage();
  return resolve(value);
};
const integerFlag = (name) => {
  const value = flag(name);
  if (!/^\d+$/.test(value ?? "")) return null;
  return Number(value);
};

let result;
try {
  if (command === "preflight" || command === "replay" || command === "record" || command === "live") {
    const metadataPath = required("--eval-metadata");
    const skillDir = flag("--skill-dir") ? resolve(flag("--skill-dir")) : undefined;
    const hostAdapter = flag("--host-adapter") ? resolve(flag("--host-adapter")) : undefined;
    if (command === "preflight") {
      result = preflightEvidence({ metadataPath, skillDir, hostAdapter });
    } else if (command === "replay") {
      result = replayEvidence({
        metadataPath,
        skillDir,
        hostAdapter,
        callsPath: flag("--calls") ? resolve(flag("--calls")) : undefined,
        runDir: flag("--run-dir") ? resolve(flag("--run-dir")) : undefined,
      });
    } else if (command === "record") {
      const outputDir = flag("--output-dir") ? resolve(flag("--output-dir")) : null;
      if (!outputDir) usage();
      result = recordEvidence({
        metadataPath,
        skillDir,
        outputDir,
        providerPath: flag("--provider-fixture") ? resolve(flag("--provider-fixture")) : undefined,
        providerAdapterPath: flag("--provider-adapter") ? resolve(flag("--provider-adapter")) : undefined,
        authorized: has("--authorize-live"),
        concurrency: integerFlag("--concurrency"),
        maxCalls: integerFlag("--max-calls"),
      });
    } else {
      result = liveAcceptance({
        metadataPath,
        skillDir,
        providerPath: flag("--provider-fixture") ? resolve(flag("--provider-fixture")) : undefined,
        providerAdapterPath: flag("--provider-adapter") ? resolve(flag("--provider-adapter")) : undefined,
        authorized: has("--authorize-live"),
        concurrency: integerFlag("--concurrency"),
        maxCalls: integerFlag("--max-calls"),
        auditPath: flag("--audit-path") ? resolve(flag("--audit-path")) : undefined,
      });
    }
  } else if (command === "materialize") {
    const evalDir = required("--eval-dir");
    result = materializeEvidence({
      evalDir,
      skillDir: flag("--skill-dir") ? resolve(flag("--skill-dir")) : undefined,
      hostAdapter: flag("--host-adapter") ? resolve(flag("--host-adapter")) : undefined,
      gates: flag("--gates"),
    });
  } else if (command === "audit-gates") {
    const evalDir = required("--eval-dir");
    result = auditGateDigests({ evalDir, gates: flag("--gates") });
  } else {
    usage();
  }
} catch (error) {
  result = { ok: false, status: "FAIL", code: "EVIDENCE_COMMAND_ERROR", detail: error.message, live_calls: 0 };
}

if (result?.ok) {
  const label = command === "record" ? "RECORD" : command === "live" ? "LIVE" : command.toUpperCase();
  console.log(`${label} ${result.status ?? "PASS"}`);
} else {
  console.log(`${result?.status ?? "FAIL"} ${result?.code ?? "EVIDENCE_COMMAND_ERROR"}`);
}
console.log(JSON.stringify(result));
process.exit(exitCodeFor(result));
