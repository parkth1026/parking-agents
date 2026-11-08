import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function desktopRunning() {
  if (process.platform !== 'win32') throw new Error('This launcher requires Windows desktop process detection.');
  // Match the backend guard: CLI/app-server processes named codex.exe are retained.
  const command = "@(Get-Process -Name ChatGPT,Codex -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq 'ChatGPT' -or -not $_.Path -or (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $_.Path) 'resources\\app.asar')) }).Count";
  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command],
    { encoding: 'utf8', windowsHide: true, timeout: 20000 }).trim();
  if (!/^\d+$/.test(output)) throw new Error('Cannot verify desktop shutdown.');
  return Number(output) > 0;
}

export async function runOnce(folder, overrides = {}) {
  const config = read(path.join(folder, 'config.json'));
  const deps = {
    detect: desktopRunning,
    now: () => Date.now(),
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    log: console.log,
    apply: () => JSON.parse(execFileSync(config.python, ['-B', path.join(folder, 'projects.py'),
      'apply', '--home', config.home, '--plan', path.join(folder, 'plan.json'),
      '--backup-dir', path.join(folder, 'backup')],
    { encoding: 'utf8', windowsHide: true, timeout: 300000, maxBuffer: 1024 * 1024 })),
    ...overrides,
  };
  // Persistent exclusive claim: even a crash or a failed attempt cannot replay this bundle.
  const claim = openSync(path.join(folder, 'run-once.claim.json'), 'wx');
  try { writeFileSync(claim, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); }
  finally { closeSync(claim); }
  const resultPath = path.join(folder, 'result.json');
  const result = { status: 'WAITING_FOR_DESKTOP_EXIT', project: config.project, home: config.home,
    backup: 'NOT_RUN', fileMerge: 'NOT_RUN', postRestartPersistence: 'NOT_RUN',
    uiGrouping: 'NOT_RUN', chatContinuation: 'NOT_RUN', sqliteModified: false };
  const save = () => writeFileSync(resultPath, JSON.stringify(result, null, 2));
  try {
    for (const name of ['plan.json', 'projects.py']) {
      if (sha256(readFileSync(path.join(folder, name))) !== config.hashes[name]) {
        throw new Error('Prepared bundle changed: ' + name);
      }
    }
    save();
    deps.log('Quit Codex completely. Keep it closed until this window reports success.');
    deps.log('Waiting for 5 consecutive seconds without the desktop process...');
    const deadline = deps.now() + config.timeoutMs;
    let stoppedSince = null;
    let ready = false;
    while (deps.now() < deadline) {
      if (deps.detect()) stoppedSince = null;
      else if (stoppedSince === null) stoppedSince = deps.now();
      else if (deps.now() - stoppedSince >= 5000) { ready = true; break; }
      await deps.sleep(1000);
    }
    if (!ready) throw new Error('Timed out waiting for Codex to exit; no restore attempted.');
    deps.log('Desktop stopped. Backing up and restoring once. Do not reopen Codex yet.');
    // Backend rechecks process, account, source and file fingerprints before both writes.
    const receipt = deps.apply();
    if (receipt.status !== 'RESTORED_ON_DISK') throw new Error('Backend did not confirm restoration.');
    Object.assign(result, { status: 'RESTORED_ON_DISK', backup: 'PASS', fileMerge: 'PASS',
      counts: receipt.counts, assignmentConflictsKeptTarget: receipt.assignmentConflictsKeptTarget,
      backupDirectory: path.join(folder, 'backup') });
    save();
    deps.log('PASS: backup and file merge verified. You may now reopen Codex.');
    deps.log('Restart persistence and project sidebar still need verification. Result: ' + resultPath);
    return result;
  } catch (error) {
    result.status = 'FAILED';
    result.error = error.message;
    save();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runOnce(path.dirname(fileURLToPath(import.meta.url))).catch(error => {
    console.error('Recovery did not complete:', error.message);
    console.error('This bundle is single-use. Generate a new bundle after resolving the cause.');
    process.exitCode = 1;
  });
}
