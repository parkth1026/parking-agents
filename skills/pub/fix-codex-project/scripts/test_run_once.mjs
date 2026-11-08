import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { prepare } from './prepare.mjs';
import { runOnce } from './run-once.mjs';

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'codex-project-once-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'home'); mkdirSync(home);
  const source = { globals: { 'local-projects': { old: { id: 'old', name: 'old', rootPaths: [root] } },
    'thread-project-assignments': { chat: { projectKind: 'local', projectId: 'old' },
      remote: { projectKind: 'remote', projectId: 'remote' } } } };
  const state = { 'electron-account-renderer-state-v1': { owner: 'target', inactive: { source } }, keep: true };
  const file = path.join(home, '.codex-global-state.json');
  writeFileSync(file, JSON.stringify(state));
  const bundle = prepare({ project: root, home, source: 'source', python: process.env.PYTHON || 'python' });
  assert.deepEqual(JSON.parse(readFileSync(file)), state, 'preparation must not mutate the home');
  return { root, home, file, state, bundle, folder: bundle.folder };
}

function clock() {
  let time = 0;
  return { now: () => time, sleep: async ms => { time += ms; }, log: () => {} };
}

test('generated bundle restores a fixture once through the real Python backend', async t => {
  const f = fixture(t); const timer = clock();
  const backend = path.join(f.folder, 'projects.py');
  // Fixture-only process substitution. Production runner and backend keep both live guards.
  const code = `import importlib.util,json,sys\nfrom pathlib import Path\ns=importlib.util.spec_from_file_location('p',sys.argv[1]);p=importlib.util.module_from_spec(s);s.loader.exec_module(p)\np.desktop_running=lambda:False\nprint(json.dumps(p.apply(Path(sys.argv[2]),p.read(Path(sys.argv[3])),Path(sys.argv[4]))))`;
  let attempts = 0;
  const result = await runOnce(f.folder, { ...timer, detect: () => false, apply: () => {
    attempts++;
    return JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-B', '-c', code, backend,
      f.home, path.join(f.folder, 'plan.json'), path.join(f.folder, 'backup')], { encoding: 'utf8' }));
  } });
  assert.equal(result.fileMerge, 'PASS');
  const merged = JSON.parse(readFileSync(f.file));
  assert.ok(merged['local-projects'].old);
  assert.ok(merged['thread-project-assignments'].chat);
  assert.equal(merged['thread-project-assignments'].remote, undefined);
  assert.deepEqual(merged['electron-account-renderer-state-v1'], f.state['electron-account-renderer-state-v1']);
  assert.equal(JSON.parse(readFileSync(path.join(f.folder, 'backup', '.codex-global-state.json'))).keep, true);
  assert.equal(result.postRestartPersistence, 'NOT_RUN');
  await assert.rejects(runOnce(f.folder, { ...timer, detect: () => false }), /EEXIST/);
  assert.equal(attempts, 1);
});

test('reopening during the wait resets the five second quiet period', async t => {
  const f = fixture(t); const timer = clock(); let appliedAt;
  await runOnce(f.folder, { ...timer, detect: () => timer.now() === 2000,
    apply: () => { appliedAt = timer.now(); return { status: 'RESTORED_ON_DISK', counts: {} }; } });
  assert.equal(appliedAt, 8000);
});

test('reopening during backup fails once without retrying or reporting success', async t => {
  const f = fixture(t); let attempts = 0;
  await assert.rejects(runOnce(f.folder, { ...clock(), detect: () => false,
    apply: () => { attempts++; throw new Error('Desktop is still running; close it before mutation'); } }), /still running/);
  assert.equal(attempts, 1);
  const result = JSON.parse(readFileSync(path.join(f.folder, 'result.json')));
  assert.equal(result.status, 'FAILED'); assert.equal(result.fileMerge, 'NOT_RUN');
  assert.deepEqual(JSON.parse(readFileSync(f.file)), f.state);
  await assert.rejects(runOnce(f.folder), /EEXIST/);
});

test('detection failure and timeout never call the restore backend', async t => {
  for (const failure of ['detection', 'timeout']) {
    const f = fixture(t);
    const configPath = path.join(f.folder, 'config.json');
    const config = JSON.parse(readFileSync(configPath));config.timeoutMs = 6000;
    writeFileSync(configPath, JSON.stringify(config));
    await assert.rejects(runOnce(f.folder, { ...clock(), detect: () => {
      if (failure === 'detection') throw new Error('Cannot verify desktop shutdown');
      return true;
    }, apply: () => assert.fail('must not apply') }), failure === 'detection' ? /Cannot verify/ : /Timed out/);
    assert.deepEqual(JSON.parse(readFileSync(f.file)), f.state);
  }
});

test('tampered plan is rejected and existing bundle cannot be overwritten', async t => {
  const f = fixture(t);
  writeFileSync(path.join(f.folder, 'plan.json'), '{}');
  await assert.rejects(runOnce(f.folder, { ...clock(), detect: () => false }), /bundle changed/);
  assert.throws(() => prepare({ project: f.root, home: f.home, out: f.folder }), /EEXIST/);
});

test('concurrent launch cannot acquire an already running bundle', async t => {
  const f = fixture(t); const timer = clock(); let release;
  const paused = new Promise(resolve => { release = resolve; });
  let first = true;
  const execution = runOnce(f.folder, { ...timer, detect: () => false,
    sleep: async ms => { if (first) { first = false; await paused; } await timer.sleep(ms); },
    apply: () => ({ status: 'RESTORED_ON_DISK', counts: {} }) });
  await assert.rejects(runOnce(f.folder, { ...timer }), /EEXIST/);
  release();
  assert.equal((await execution).fileMerge, 'PASS');
});
