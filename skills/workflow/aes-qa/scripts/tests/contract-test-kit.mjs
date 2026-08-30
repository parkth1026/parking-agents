import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
export const SKILL_DIR = dirname(dirname(TESTS_DIR));
export const CLI = join(SKILL_DIR, 'scripts', 'screenshot-evidence.mjs');

export function runCli(args, options = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args, '--json'], {
    cwd: options.cwd ?? SKILL_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
    env: { ...process.env, ...(options.env || {}) },
  });
  let json = null;
  try { json = JSON.parse((result.stdout || '').trim()); } catch {}
  return { code: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '', json };
}

export function writeManifest(spool, overrides = {}) {
  mkdirSync(spool, { recursive: true });
  const manifest = {
    schema: 'aes.screenshot-capture-manifest/v1',
    qaRoundId: 'qa-contract-round',
    attemptId: 'attempt-1',
    evidenceTarget: {
      provider: 'gitlab', host: 'git.51vr.local', projectId: 2137,
      projectPath: 'neon/TWE/AesDataCenter', issueIid: 28,
    },
    codeState: {
      finality: 'final',
      headSha: '1111111111111111111111111111111111111111',
      candidateSha: '1111111111111111111111111111111111111111',
      worktreeDirty: false,
      patchDigest: null,
    },
    environment: {
      environmentDigest: `sha256:${'2'.repeat(64)}`,
      browser: 'contract-fixture', headed: true, appUrl: 'http://127.0.0.1:1',
    },
    terminal: null,
    requiredEvidence: [],
    captures: [],
    manifestRevision: 0,
    ...overrides,
  };
  writeFileSync(join(spool, 'capture-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function makeAsserter(contractCase) {
  const assertions = [];
  return {
    check(name, condition, detail = '') {
      assertions.push({ name, outcome: condition ? 'PASS' : 'FAIL', ...(condition || !detail ? {} : { detail }) });
    },
    finish(extra = {}) {
      const failures = assertions.filter((entry) => entry.outcome === 'FAIL');
      const payload = {
        schema: 'aes.screenshot-evidence-contract-result/v1',
        contract: 'screenshot-evidence',
        case: contractCase,
        outcome: failures.length ? 'FAIL' : 'PASS',
        passed: assertions.length - failures.length,
        total: assertions.length,
        failures,
        ...extra,
      };
      process.stdout.write(`${JSON.stringify(payload)}\n`);
      process.exit(failures.length ? 1 : 0);
    },
  };
}
