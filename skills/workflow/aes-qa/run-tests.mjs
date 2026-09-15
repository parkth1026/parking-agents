#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// 合同注册表：新增合同走这里，保持统一的 usage/JSON 语义。
// - screenshot-evidence：截图证据协议契约（live-u2-strict 默认排除，需显式点名；
//   companion-shots-freeze 为 v4 伴随冻结新增，进默认套件）。
// - repository-gate-level：AES-QG repository gate 同一证据合同（生成= aes-gate 引擎，
//   消费= aes-worktree-board GATE-qa level 子门；缺同伴技能时如实 SKIPPED）。
//   v4 三 case：三态（AC-001）/ gate-shortfall（AC-002）/ 消费侧全套（AC-006）。
// - aes-qa-v4-schema：v4 报文自身契约（agent-live 托底 AC-003 / qa-report 渲染 AC-007）。
const CONTRACTS = {
  'screenshot-evidence': {
    resultSchema: 'aes.screenshot-evidence-contract-result/v1',
    suiteSchema: 'aes.screenshot-evidence-contract-suite-result/v1',
    cases: new Map([
      ['terminal-boundary', 'terminal-boundary.contract.mjs'],
      ['claim-gate', 'claim-gate.contract.mjs'],
      ['preflight-bounds', 'preflight-bounds.contract.mjs'],
      ['recovery-cost-pilot', 'recovery-cost-pilot.contract.mjs'],
      ['live-u2-strict', 'live-u2-strict.contract.mjs'],
      ['companion-shots-freeze', 'companion-shots.contract.mjs'],
    ]),
    defaultCases: ['terminal-boundary', 'claim-gate', 'preflight-bounds', 'recovery-cost-pilot', 'companion-shots-freeze'],
  },
  'repository-gate-level': {
    resultSchema: 'aes.repository-gate-level-contract-result/v1',
    suiteSchema: 'aes.repository-gate-level-contract-suite-result/v1',
    cases: new Map([
      ['generation-and-consumption', 'repository-gate.contract.mjs'],
      ['v4-gate-three-states', 'repository-gate-v4-three-states.contract.mjs'],
      ['v4-gate-shortfall', 'repository-gate-v4-shortfall.contract.mjs'],
      ['v4-consumer-gate-verdict', 'repository-gate-v4-consumer.contract.mjs'],
    ]),
    defaultCases: ['generation-and-consumption', 'v4-gate-three-states', 'v4-gate-shortfall', 'v4-consumer-gate-verdict'],
  },
  'aes-qa-v4-schema': {
    resultSchema: 'aes.qa-v4-schema-contract-result/v1',
    suiteSchema: 'aes.qa-v4-schema-contract-suite-result/v1',
    cases: new Map([
      ['agent-live-backing', 'agent-live-backing.contract.mjs'],
      ['qa-report-render', 'qa-report-render.contract.mjs'],
    ]),
    defaultCases: ['agent-live-backing', 'qa-report-render'],
  },
};

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
  else process.stdout.write(`${payload.outcome} ${payload.case ?? payload.contract}: ${payload.passed ?? 0}/${payload.total ?? 0} assertions passed\n`);
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  emit({ schema: 'aes.qa-contract-result/v1', outcome: 'USAGE_ERROR', error: error.message }, true);
  process.exit(64);
}

const contractName = args.contract ?? 'screenshot-evidence';
const contract = CONTRACTS[contractName];
if (!contract || (args.case !== undefined && !contract.cases.has(args.case))) {
  emit({
    schema: `${contract?.resultSchema ?? 'aes.qa-contract-result/v1'}`,
    contract: contractName,
    case: args.case ?? null,
    outcome: 'USAGE_ERROR',
    error: !contract ? `unsupported contract; available: ${Object.keys(CONTRACTS).join('|')}` : 'unsupported case',
  }, args.json);
  process.exit(64);
}

const forwarded = [];
for (const [key, value] of Object.entries(args)) {
  if (key === 'contract' || key === 'case' || key === 'json') continue;
  forwarded.push(`--${key}`, value);
}
function runCase(name) {
  const result = spawnSync(process.execPath, [join(HERE, 'scripts', 'tests', contract.cases.get(name)), ...forwarded], {
    cwd: HERE, encoding: 'utf8', stdio: 'pipe', windowsHide: true,
  });
  try {
    const payload = JSON.parse((result.stdout || '').trim());
    return { result, payload };
  } catch {
    return {
      result,
      payload: {
        schema: contract.resultSchema, contract: contractName, case: name,
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

const results = contract.defaultCases.map((name) => runCase(name));
const payload = {
  schema: contract.suiteSchema, contract: contractName,
  outcome: results.every(({ result, payload: item }) => result.status === 0 && item.outcome === 'PASS') ? 'PASS' : 'FAIL',
  passed: results.reduce((sum, entry) => sum + (entry.payload.passed || 0), 0),
  total: results.reduce((sum, entry) => sum + (entry.payload.total || 0), 0),
  cases: results.map(({ payload: item }) => ({ case: item.case, outcome: item.outcome, passed: item.passed, total: item.total })),
  failures: results.flatMap(({ payload: item }) => item.failures || []),
};
emit(payload, args.json);
process.exit(payload.outcome === 'PASS' ? 0 : 1);
