#!/usr/bin/env node
// run-tests.mjs — offline regression gate for orchestrate-worktree-loop-zcode.
// Covers what can be verified WITHOUT a running ZCode app-server / model provider:
// syntax of all scripts, inspect-worktrees black-box behavior on a throwaway git fixture,
// driver CLI guards (no-daemon error, unsupported --title), and static protocol-shape
// assertions guarding known-fixed defects (session/resume workspace object; no title passthrough).
// Full protocol/e2e probes (real sessions) live in the eval workspace and are run manually:
//   probe-mcp.mjs (12 checks) + delivery-loop e2e per SKILL.md. See references/design.md AC table.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(ROOT, 'scripts');
const driver = join(SCRIPTS, 'zcode-session-driver.mjs');
const mcp = join(SCRIPTS, 'zcode-threads-mcp.mjs');
const inspect = join(SCRIPTS, 'inspect-worktrees.mjs');

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, detail); }
};
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });

// --- T1 syntax: all three scripts parse ---
for (const s of [driver, mcp, inspect]) {
  const r = run(process.execPath, ['--check', s]);
  check(`T1 syntax ${join('scripts', s.split(/[\\/]/).pop())}`, r.status === 0, r.stderr?.slice(0, 200));
}

// --- T2 inspect-worktrees on a throwaway git fixture ---
const tmp = mkdtempSync(join(tmpdir(), 'owt-regress-'));
try {
  const repo = join(tmp, 'repo');
  mkdirSync(repo);
  const git = (...a) => run('git', ['-C', repo, ...a], { cwd: repo });
  git('init', '-b', 'main');
  git('config', 'user.name', 'T');
  git('config', 'user.email', 't@t');
  writeFileSync(join(repo, 'a.txt'), 'a\n');
  git('add', '-A');
  git('commit', '-qm', 'init');
  git('branch', 'dev');
  git('worktree', 'add', '-q', '-b', 'feature', join(tmp, 'wt'), 'dev');
  writeFileSync(join(tmp, 'wt', 'user.txt'), 'user\n'); // untracked dirt

  const r1 = run(process.execPath, [inspect, '--paths', `${join(tmp, 'wt')};${join(tmp, 'repo')}`, '--integration', 'dev']);
  const rows = r1.status === 0 ? JSON.parse(r1.stdout) : [];
  check('T2.1 happy path exit 0 + 2 rows', r1.status === 0 && rows.length === 2, r1.stderr?.slice(0, 150));
  const wtRow = rows.find((x) => x.path === join(tmp, 'wt'));
  const repoRow = rows.find((x) => x.path === join(repo));
  check('T2.2 branch/dirty/integration fields', wtRow?.branch === 'feature' && wtRow?.dirty === true && wtRow?.integrationExists === true && repoRow?.dirty === false, JSON.stringify(wtRow)?.slice(0, 200));
  check('T2.3 same-base branch is integration ancestor', wtRow?.headMergedToIntegration === true && wtRow?.deliverableMergedToIntegration === false);

  const r2 = run(process.execPath, [inspect, '--paths', tmp]); // temp dir is not a repo
  check('T2.4 non-repo path -> stdout [] + exit 1', r2.status === 1 && JSON.parse(r2.stdout).length === 0 && r2.stderr.includes('error'));
  const r3 = run(process.execPath, [inspect]);
  check('T2.5 missing --paths -> exit 2', r3.status === 2);
  const r4 = run(process.execPath, [inspect, '--help']);
  check('T2.6 --help -> exit 0', r4.status === 0);

  const r5 = run(process.execPath, [inspect, '--paths', join(tmp, 'wt'), '--integration', 'nope']);
  check('T2.7 missing integration branch -> integrationExists false, merged null', r5.status === 0 && JSON.parse(r5.stdout)[0].integrationExists === false && JSON.parse(r5.stdout)[0].headMergedToIntegration === null);
} finally {
  // worktrees hold locks; use git worktree remove --force is not available post-hoc — plain rm is enough for tmp
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
}

// --- T3 driver CLI guards without a daemon ---
const r6 = run(process.execPath, [driver, 'list']);
check('T3.1 no daemon -> clean error exit 1', r6.status === 1 && /bridge not running/.test(r6.stderr + r6.stdout), (r6.stderr || '').slice(0, 150));
const r7 = run(process.execPath, [driver, 'create', '--workspace', 'D:\\x', '--title', 't']);
check('T3.2 create --title rejected before bridge call (defect #1 regression)', r7.status === 1 && /--title is not supported/.test(r7.stderr), (r7.stderr || '').slice(0, 150));

// --- T4 static protocol-shape guards (defect #3 regression: resume must pass workspace OBJECT) ---
for (const [label, file] of [['driver', driver], ['mcp', mcp]]) {
  const src = readFileSync(file, 'utf8');
  check(`T4.1 ${label}: session/resume sends workspace object`, /session\/resume"?,\s*\{\s*sessionId,\s*workspace:\s*\{\s*workspacePath:\s*reg\.workspace,\s*workspaceKey:\s*reg\.workspace,/.test(src.replace(/\r/g, '')) || src.includes('workspace: { workspacePath: reg.workspace, workspaceKey: reg.workspace }'));
  check(`T4.2 ${label}: no title passthrough to session/create`, !/params\.title\s*=/.test(src));
}
const mcpSrc = readFileSync(mcp, 'utf8');
const toolNames = [...mcpSrc.matchAll(/name: "([a-z_]+)", description:/g)].map((m) => m[1]).sort();
check('T4.3 mcp exposes exactly the 9 documented tools', JSON.stringify(toolNames) === JSON.stringify(['approve', 'close', 'create_session', 'list', 'result', 'send', 'status', 'stop', 'wait']), toolNames.join(','));
const driverSrc = readFileSync(driver, 'utf8');
check('T4.4 driver usage docs advertise only supported flags', !/--title/.test(driverSrc.split('// Usage:')[1]?.split('// Env:')[0] ?? 'x') && !driverSrc.includes('--prompt-file'));
check('T4.5 skill SKILL.md exists alongside scripts', existsSync(join(ROOT, 'SKILL.md')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
