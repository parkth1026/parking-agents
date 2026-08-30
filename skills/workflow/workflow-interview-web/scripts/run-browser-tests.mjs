#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, 'server.mjs');
const PUBLISH = join(HERE, 'publish.mjs');
const WAIT = join(HERE, 'wait-submit.mjs');
const evidenceArgIndex = process.argv.indexOf('--evidence-dir');
const evidenceDir = evidenceArgIndex >= 0 && process.argv[evidenceArgIndex + 1]
  ? resolve(process.argv[evidenceArgIndex + 1])
  : mkdtempSync(join(tmpdir(), 'workflow-interview-web-evidence-'));
const workDir = mkdtempSync(join(tmpdir(), 'workflow-interview-web-browser-'));
let browserSession = null;
let browserToken = null;
let checks = 0;
let PLAYWRIGHT_CLI = null;
const evidence = {
  command: [process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2)],
  evidence_dir: evidenceDir,
  exit_code: null,
  transcript: [],
  observations: [],
  screenshots: [],
};

function findPlaywrightCli() {
  const defaultRoot = process.platform === 'win32' && process.env.APPDATA
    ? join(process.env.APPDATA, 'npm', 'node_modules')
    : null;
  const defaultCliPath = defaultRoot && join(defaultRoot, '@playwright', 'cli', 'playwright-cli.js');
  if (defaultCliPath && existsSync(defaultCliPath)) return defaultCliPath;

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['root', '-g'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    windowsHide: true,
    timeout: 10_000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`无法定位全局 Playwright CLI：${result.error?.message ?? result.stderr}`);
  }
  const cliPath = join(result.stdout.trim(), '@playwright', 'cli', 'playwright-cli.js');
  if (!existsSync(cliPath)) throw new Error(`找不到 Playwright CLI：${cliPath}`);
  return cliPath;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function check(message) {
  checks += 1;
  const line = `check ${checks}  ${message}`;
  evidence.transcript.push(line);
  writeEvidence();
  console.log(line);
}

function writeEvidence() {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, 'browser-dom-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

function recordEvidence(name, result) {
  evidence.observations.push({ name, ...result });
  writeEvidence();
}

function redact(value) {
  const output = String(value ?? '');
  return browserToken ? output.replaceAll(browserToken, '<REDACTED>') : output;
}

function runNode(script, args, label) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: workDir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15_000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed (${result.status}): ${redact(`${result.stdout}\n${result.stderr}`)}`);
  }
  return result;
}

function parseLastJson(output, label) {
  const lines = String(output).trim().split(/\r?\n/).filter(Boolean);
  for (const line of [...lines].reverse()) {
    try { return JSON.parse(line); } catch { /* Playwright CLI adds status/code fences. */ }
  }
  throw new Error(`${label} 没有输出合法 JSON：${redact(output)}`);
}

function browserRun(args, label) {
  const result = spawnSync(process.execPath, [PLAYWRIGHT_CLI, ...args], {
    cwd: workDir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed (${result.status}): ${redact(`${result.stdout}\n${result.stderr}`)}`);
  }
  return `${result.stdout}\n${result.stderr}`;
}

function browserCode(code, label) {
  return parseLastJson(browserRun([`-s=${browserSession}`, 'run-code', code], label), label);
}

function screenshot(name) {
  if (!evidenceDir) return;
  const filename = join(evidenceDir, `${name}.png`);
  browserRun([`-s=${browserSession}`, 'screenshot', `--filename=${filename}`], `${name} screenshot`);
  evidence.screenshots.push(filename);
  writeEvidence();
}

function createIssue(name) {
  const issueDir = join(workDir, name);
  mkdirSync(join(issueDir, '1-interview'), { recursive: true });
  writeFileSync(join(issueDir, '1-interview', 'context.md'), '# Context Snapshot\n\n浏览器回归测试。\n', 'utf8');
  return issueDir;
}

function publish(issueDir, input, name) {
  const inputPath = join(workDir, `${name}.json`);
  writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`, 'utf8');
  return parseLastJson(
    runNode(PUBLISH, ['round', '--issue-dir', issueDir, '--file', inputPath], `publish ${name}`).stdout,
    `publish ${name}`,
  );
}

function contractRound(subtitle) {
  return {
    round: {
      id: 'contract-final-r2',
      no: 2,
      stage: '3-contract',
      title: '最终契约确认',
      status: 'pending',
      view: 'contract',
      items: [{ q_id: 'C-FINAL', tier: 'confirm', line: '确认这份 Goal Contract' }],
    },
    final: {
      round: 'contract-final-r2',
      title: '目标契约',
      subtitle,
      sections: [{ title: '目标', body: '保持目标' }],
    },
    open_ambiguities: 1,
  };
}

const ordinaryRound = {
  round: {
    id: 'interview-r1',
    no: 1,
    stage: '1-interview',
    title: '访谈问题',
    status: 'pending',
    items: [{
      q_id: 'Q1',
      tier: 'ask',
      question: '普通访谈问题',
      options: [
        { key: 'A', text: '选项 A', pct: 60 },
        { key: 'B', text: '选项 B', pct: 40 },
      ],
    }],
  },
  open_ambiguities: 1,
};

async function startServer(issueDir) {
  const result = runNode(SERVER, ['start', '--issue-dir', issueDir, '--port', '0'], 'server start');
  return parseLastJson(result.stdout, 'server start');
}

async function submitRound(info, payload) {
  const url = new URL('/api/submit', info.url);
  url.searchParams.set('key', info.token);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert(response.ok, `普通 round 提交失败：${response.status}`);
}

function markConsumed(issueDir, roundId) {
  parseLastJson(
    runNode(WAIT, ['--issue-dir', issueDir, '--mark-consumed', roundId], `mark consumed ${roundId}`).stdout,
    `mark consumed ${roundId}`,
  );
}

function assertManualTabPreserved(issueDir, tabName, subtitle, publishName) {
  browserCode(`async page => {
    await page.getByRole('tab', { name: ${JSON.stringify(tabName)} }).click();
    return { selected: await page.getByRole('tab', { name: ${JSON.stringify(tabName)} }).getAttribute('aria-selected') };
  }`, `${tabName} tab selection`);
  publish(issueDir, contractRound(subtitle), publishName);
  const result = browserCode(`async page => {
    await page.waitForFunction(() => document.querySelector('.contract-subtitle')?.textContent === ${JSON.stringify(subtitle)}, undefined, { timeout: 5000 });
    return {
      selected: await page.getByRole('tab', { name: ${JSON.stringify(tabName)} }).getAttribute('aria-selected'),
      subtitle: await page.locator('.contract-subtitle').textContent(),
    };
  }`, `${tabName} focus preservation`);
  recordEvidence(`${publishName}-${tabName}`, result);
  assert(result.selected === 'true' && result.subtitle === subtitle,
    `普通重渲染抢回${tabName}焦点：${JSON.stringify(result)}`);
}

async function stopServer(info) {
  if (!info?.port || !info?.token) return;
  const url = new URL(`/shutdown?key=${info.token}`, `http://127.0.0.1:${info.port}`);
  const stoppedPath = join(info.web_dir, 'server-stopped');
  let shutdownError = null;
  if (!existsSync(stoppedPath)) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (!response.ok) shutdownError = new Error(`shutdown returned ${response.status}`);
    } catch (error) {
      shutdownError = error;
    }
  }
  let stopped = await waitForServerStopped(stoppedPath);
  if (!stopped && info.pid) {
    try { process.kill(info.pid); } catch (error) { shutdownError ??= error; }
    stopped = await waitForServerStopped(stoppedPath);
  }
  if (!stopped) {
    throw new Error(`server teardown failed${shutdownError ? `: ${shutdownError.message}` : ''}`);
  }
}

async function waitForServerStopped(stoppedPath) {
  for (let attempt = 0; attempt < 40 && !existsSync(stoppedPath); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return existsSync(stoppedPath);
}

async function cleanupCase(info, label) {
  const errors = [];
  if (browserSession) {
    try { browserRun([`-s=${browserSession}`, 'close'], `${label} browser close`); }
    catch (error) { errors.push(error); }
  }
  try { await stopServer(info); } catch (error) { errors.push(error); }
  browserSession = null;
  browserToken = null;
  if (errors.length > 0) throw new Error(`${label} cleanup failed:\n${errors.map((error) => error.message).join('\n')}`);
}

async function withBrowserCase(issueDir, label, callback) {
  const info = await startServer(issueDir);
  browserSession = `workflow-browser-${basename(issueDir)}-${process.pid}`;
  browserToken = info.token;
  try {
    browserRun([`-s=${browserSession}`, 'open', info.url], `${label} open`);
    await callback(info);
  } finally {
    await cleanupCase(info, label);
  }
}

async function runFreshContractCase() {
  const issueDir = createIssue('fresh-contract');
  publish(issueDir, contractRound('revision-1'), 'fresh-contract');
  await withBrowserCase(issueDir, 'fresh contract', async () => {
    const result = browserCode(`async page => {
      await page.waitForFunction(() => document.querySelector('.contract-subtitle')?.textContent === 'revision-1');
      const tab = page.getByRole('tab', { name: '契约视图' });
      return {
        selected: await tab.getAttribute('aria-selected'),
        confirmVisible: await page.getByTestId('contract-confirm').isVisible(),
      };
    }`, 'fresh contract DOM assertion');
    recordEvidence('fresh-load-contract', result);
    screenshot('fresh-load-contract');
    assert(result.selected === 'true' && result.confirmVisible === true,
      `fresh contract DOM 未选中契约视图或确认按钮不可见：${JSON.stringify(result)}`);
    check('fresh load 的 contract round 自动选中契约视图且确认按钮可见');
  });
}

async function runWebSocketAndManualFocusCase() {
  const issueDir = createIssue('websocket-contract');
  publish(issueDir, ordinaryRound, 'ordinary');
  await withBrowserCase(issueDir, 'WebSocket contract', async (info) => {
    const initial = browserCode(`async page => {
      await page.getByRole('tab', { name: '访谈视图' }).waitFor();
      return { selected: await page.getByRole('tab', { name: '访谈视图' }).getAttribute('aria-selected') };
    }`, 'ordinary round DOM assertion');
    assert(initial.selected === 'true', `普通 round 默认未选中访谈视图：${JSON.stringify(initial)}`);

    await submitRound(info, { round: ordinaryRound.round.id, answers: [{ q_id: 'Q1', type: 'choice', choice: 'A' }] });
    browserCode(`async page => {
      await page.waitForFunction(() => document.querySelector('[data-testid="round-interview-r1"]')?.classList.contains('submitted'));
      return { submitted: true };
    }`, 'ordinary round submission sync');
    markConsumed(issueDir, ordinaryRound.round.id);

    publish(issueDir, contractRound('revision-1'), 'contract-r1');
    const transitioned = browserCode(`async page => {
      await page.waitForFunction(() => document.querySelector('.contract-subtitle')?.textContent === 'revision-1');
      const tab = page.getByRole('tab', { name: '契约视图' });
      return {
        selected: await tab.getAttribute('aria-selected'),
        confirmVisible: await page.getByTestId('contract-confirm').isVisible(),
      };
    }`, 'WebSocket contract DOM assertion');
    recordEvidence('websocket-contract-transition', transitioned);
    screenshot('websocket-contract-transition');
    assert(transitioned.selected === 'true' && transitioned.confirmVisible === true,
      `WebSocket contract 更新未自动切到契约视图：${JSON.stringify(transitioned)}`);
    check('普通 round 经 WebSocket 更新为 contract round 后自动切换且确认按钮可见');

    assertManualTabPreserved(issueDir, '访谈视图', 'revision-2', 'contract-r2');
    assertManualTabPreserved(issueDir, '完整轨迹', 'revision-3', 'contract-r3');
    check('用户主动切到访谈视图或完整轨迹后，contract revision 重渲染不抢回焦点');
  });
}

let testError = null;
const cleanupErrors = [];
try {
  PLAYWRIGHT_CLI = findPlaywrightCli();
  await runFreshContractCase();
  await runWebSocketAndManualFocusCase();
} catch (error) {
  testError = error;
} finally {
  if (browserSession) {
    try { browserRun([`-s=${browserSession}`, 'close'], 'final browser cleanup'); }
    catch (error) { cleanupErrors.push(error); }
    browserSession = null;
    browserToken = null;
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  try {
    rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  } catch (error) {
    cleanupErrors.push(error);
  }
}

const failures = [testError, ...cleanupErrors].filter(Boolean);
if (failures.length > 0) {
  evidence.outcome = 'failed';
  evidence.exit_code = 1;
  evidence.error = failures.map((error) => redact(error.stack ?? error.message)).join('\n');
  evidence.transcript.push(`FAIL after ${checks} checks: ${evidence.error}`);
  writeEvidence();
  console.error(`FAIL after ${checks} checks: ${evidence.error}`);
  console.error(`evidence: ${evidenceDir}`);
  process.exitCode = 1;
} else {
  evidence.outcome = 'passed';
  evidence.exit_code = 0;
  evidence.transcript.push(`${checks}/${checks} passed`);
  writeEvidence();
  console.log(`${checks}/${checks} passed`);
  console.log(`evidence: ${evidenceDir}`);
}
