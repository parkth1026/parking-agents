#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = dirname(fileURLToPath(import.meta.url));
const script = join(skillDir, "scripts", "count-log-lines.mjs");
const fixture = join(skillDir, "fixtures", "sample.log");
const expected = readFileSync(join(skillDir, "fixtures", "sample.expected.md"), "utf8");

let pass = 0;
let fail = 0;
function check(name, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? `: ${detail}` : ""}`);
  }
}

function run(args) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: skillDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const stdout = run([fixture]);
check("fixture renders exact Markdown", stdout === expected);
check("fixture count invariant holds", /Total lines \| 6/.test(stdout) && /Empty lines \| 1/.test(stdout) && /Non-empty lines \| 5/.test(stdout));

const tempDir = mkdtempSync(join(skillDir, ".tmp-test-"));
try {
  const mixedInput = join(tempDir, "mixed.log");
  const mixedOutput = join(tempDir, "mixed.md");
  writeFileSync(mixedInput, "alpha\r\n\r\nbeta\r \ngamma\r\n", "utf8");
  run([mixedInput, mixedOutput]);
  const mixedReport = readFileSync(mixedOutput, "utf8");
  check("mixed LF CRLF and CR count correctly", /Total lines \| 5/.test(mixedReport) && /Empty lines \| 1/.test(mixedReport) && /Non-empty lines \| 4/.test(mixedReport));

  const emptyInput = join(tempDir, "empty.log");
  const emptyOutput = join(tempDir, "empty.md");
  writeFileSync(emptyInput, "", "utf8");
  run([emptyInput, emptyOutput]);
  const emptyReport = readFileSync(emptyOutput, "utf8");
  check("empty file reports zero lines", /Total lines \| 0/.test(emptyReport) && /Empty lines \| 0/.test(emptyReport) && /Non-empty lines \| 0/.test(emptyReport));
  check("file output uses exact Markdown shape", emptyReport.startsWith("# Log line count\n\n| Metric | Count |\n") && emptyReport.endsWith("\n"));

  let missingFailed = false;
  try {
    run([join(tempDir, "missing.log")]);
  } catch (error) {
    missingFailed = error.status === 1 && /log-line-counter:/.test(String(error.stderr));
  }
  check("missing input exits 1 with an error", missingFailed);

  const invalidInput = join(tempDir, "invalid.log");
  writeFileSync(invalidInput, Buffer.from([0xc3, 0x28]));
  let invalidFailed = false;
  try {
    run([invalidInput]);
  } catch (error) {
    invalidFailed = error.status === 1 && /log-line-counter:/.test(String(error.stderr));
  }
  check("invalid UTF-8 exits 1 with an error", invalidFailed);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
