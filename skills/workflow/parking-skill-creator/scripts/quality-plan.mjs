#!/usr/bin/env node
// quality-plan.mjs — turn document-review findings into falsifiable hypotheses.
// It records a plan; it does not grade outputs or claim that a skill is good.
import { resolve } from "node:path";
import { buildQualityPlan, auditCreatorContext } from "./lib/quality.mjs";
import { readJson, writeJson } from "./lib/jsonio.mjs";

function usage() {
  console.log("用法: node quality-plan.mjs <plan|audit-context> [选项]");
  console.log("  plan --skill-dir <dir> --eval-metadata <path> [--findings-file <path>] [--output <path>]");
  console.log("  audit-context --creator-dir <dir>");
  process.exit(2);
}

const argv = process.argv.slice(2);
const command = argv.shift();
if (!command || command === "--help") usage();
const flag = (name) => {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
};
const required = (name) => {
  const value = flag(name);
  if (!value || value.startsWith("--")) usage();
  return resolve(value);
};
try {
  if (command === "audit-context") {
    const result = auditCreatorContext(required("--creator-dir"));
    console.log(result.status);
    console.log(JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exit(result.status === "PASS" ? 0 : 1);
  }
  if (command !== "plan") usage();
  const skillDir = required("--skill-dir");
  const metadata = readJson(required("--eval-metadata"));
  const findingsPath = flag("--findings-file");
  const review = findingsPath ? readJson(resolve(findingsPath)) : {};
  const result = buildQualityPlan({ skillDir, metadata, review });
  const outputPath = flag("--output");
  if (outputPath) writeJson(resolve(outputPath), result);
  console.log(result.ok ? result.verdict : `${result.code}: ${result.detail ?? "失败关闭"}`);
  console.log(JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
} catch (error) {
  console.log(JSON.stringify({ ok: false, code: "QUALITY_PLAN_COMMAND_ERROR", detail: error.message }));
  process.exit(1);
}
