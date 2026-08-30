#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT = 'screenshot-evidence';
const CASES = new Map([
  ['terminal-boundary', 'terminal-boundary.contract.mjs'],
  ['claim-gate', 'claim-gate.contract.mjs'],
  ['preflight-bounds', 'preflight-bounds.contract.mjs'],
  ['recovery-cost-pilot', 'recovery-cost-pilot.contract.mjs'],
  ['live-u2-strict', 'live-u2-strict.contract.mjs'],
]);
const DEFAULT_CASES = [...CASES.keys()].filter((name) => name !== 'live-u2-strict');

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unexpected positional argument: ${token}`);
    const key = token.slice(2);
    if (key === 'json') {
      values.json = true;
      continue;
    }
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new Error(`missing value for --${key}`);
    values[key] = argv[index + 1];
    index += 1;
  }
  return values;
}

function emit(payload, json) {
  if (json) process.stdout.write(`${JSON.stringify(payload)}\n`);
  else process.stdout.write(`${payload.outcome} ${payload.case}: ${payload.passed}/${payload.total} assertions passed\n`);
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  emit({ schema: 'aes.screenshot-evidence-contract-result/v1', outcome: 'USAGE_ERROR', error: error.message }, true);
  process.exit(64);
}

if (args.contract !== CONTRACT || (args.case !== undefined && !CASES.has(args.case))) {
  emit({
    schema: 'aes.screenshot-evidence-contract-result/v1',
    contract: args.contract ?? null,
    case: args.case ?? null,
    outcome: 'USAGE_ERROR',
    error: args.contract !== CONTRACT ? 'unsupported contract' : 'unsupported case',
  }, args.json);
  process.exit(64);
}

const forwarded = [];
for (const [key, value] of Object.entries(args)) {
  if (key === 'contract' || key === 'case' || key === 'json') continue;
  forwarded.push(`--${key}`, value);
}
function runCase(name) {
  const result = spawnSync(process.execPath, [join(HERE, 'scripts', 'tests', CASES.get(name)), ...forwarded], {
    cwd: HERE, encoding: 'utf8', stdio: 'pipe', windowsHide: true,
  });
  try {
    const payload = JSON.parse((result.stdout || '').trim());
    return { result, payload };
  } catch {
    return {
      result,
      payload: {
        schema: 'aes.screenshot-evidence-contract-result/v1', contract: CONTRACT, case: name,
        outcome: 'FAIL', passed: 0, total: 1,
        failures: [{ name: 'contract process returned JSON', detail: (result.stderr || result.stdout || '').trim() }],
      },
    };
  }
}

if (args.case) {
  const { result, payload } = runCase(args.case);
  emit(payload, args.json);
  process.exit(result.status === 0 && payload.outcome === 'PASS' ? 0 : 1);
}

const results = DEFAULT_CASES.map((name) => runCase(name));
const payload = {
  schema: 'aes.screenshot-evidence-contract-suite-result/v1', contract: CONTRACT,
  outcome: results.every(({ result, payload: item }) => result.status === 0 && item.outcome === 'PASS') ? 'PASS' : 'FAIL',
  passed: results.reduce((sum, entry) => sum + (entry.payload.passed || 0), 0),
  total: results.reduce((sum, entry) => sum + (entry.payload.total || 0), 0),
  cases: results.map(({ payload: item }) => ({ case: item.case, outcome: item.outcome, passed: item.passed, total: item.total })),
  failures: results.flatMap(({ payload: item }) => item.failures || []),
};
emit(payload, args.json);
process.exit(payload.outcome === 'PASS' ? 0 : 1);
