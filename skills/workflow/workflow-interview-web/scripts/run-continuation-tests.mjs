#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import {
  armDeferredContinuation,
  failDeferredContinuation,
  readAgentRecoveryPayload,
  readPublicContinuation,
  readTargetedHistory,
  readRuntimeFiles,
  readConsumptionRecords,
  resumeDeferredContinuation,
  waitForDeferredSubmission,
} from './lib/continuation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, 'server.mjs');
const PUBLISH = join(HERE, 'publish.mjs');
const WAIT = join(HERE, 'wait-submit.mjs');
const workRoot = mkdtempSync(join(tmpdir(), 'workflow-interview-web-continuation-'));
let checks = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function check(message) {
  checks += 1;
  console.log(`check ${checks}  ${message}`);
}

function run(script, args, options = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: workRoot,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, ...options.env },
    timeout: options.timeout ?? 12_000,
  });
}

function parseJsonOutput(result, label) {
  assert(result.status === 0, `${label} 退出码 ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  try { return JSON.parse(lines.at(-1)); }
  catch { throw new Error(`${label} 没有输出合法 JSON：${result.stdout}`); }
}

function issueFixture(label) {
  const root = mkdtempSync(join(workRoot, `${label}-`));
  const issueDir = join(root, 'issue');
  mkdirSync(join(issueDir, '1-interview'), { recursive: true });
  writeFileSync(join(issueDir, '1-interview', 'context.md'), '# Context Snapshot\n\ncontinuation test\n', 'utf8');
  return { root, issueDir };
}

function roundInput(id, no = 1) {
  return {
    opening: 'continuation runtime test',
    phases: [
      { id: '1-interview', label: '访谈·拷问', status: 'active' },
      { id: '2-prototype', label: '原型确认', status: 'pending' },
      { id: '3-contract', label: '交付标准·契约', status: 'pending' },
    ],
    open_ambiguities: 1,
    round: {
      id,
      no,
      stage: '1-interview',
      title: `continuation ${id}`,
      status: 'pending',
      continuation: { mode: 'current_turn_deferred', status: 'awaiting_submission' },
      items: [{
        q_id: 'Q1',
        tier: 'ask',
        question: '是否继续当前 turn？',
        options: [
          { key: 'A', text: '继续', pct: 60, recommended: true },
          { key: 'B', text: '人工恢复', pct: 40 },
        ],
      }],
    },
  };
}

function publish(fixture, id, no = 1) {
  const inputPath = join(fixture.root, `${id}.json`);
  writeFileSync(inputPath, `${JSON.stringify(roundInput(id, no), null, 2)}\n`, 'utf8');
  parseJsonOutput(run(PUBLISH, ['round', '--issue-dir', fixture.issueDir, '--file', inputPath]), `publish ${id}`);
}

function startServer(fixture, port = 0) {
  const result = run(SERVER, ['start', '--issue-dir', fixture.issueDir, '--port', String(port)], {
    env: { WI_WEB_IDLE_TIMEOUT_MS: '120000' },
  });
  const info = parseJsonOutput(result, 'server start');
  assert(info.type === 'server-started' && info.port > 0 && info.url === `http://127.0.0.1:${info.port}/` && info.token === undefined, 'server info 仍要求 token 或缺 plain URL');
  return info;
}

async function assertServerAlive(info, label) {
  try {
    const response = await fetch(plainUrl(info, '/api/state'));
    assert(response.ok, `${label} HTTP ${response.status}`);
  } catch (error) {
    throw new Error(`${label} server 不可达：${error.cause?.code ?? error.message}`);
  }
}

async function stopServer(info, fixture) {
  if (!info) return;
  try {
    await fetch(plainUrl(info, '/shutdown'));
  } catch { /* The server may already have exited during a failure injection. */ }
  const marker = join(fixture.issueDir, 'web', 'server-stopped');
  for (let attempt = 0; attempt < 100 && !existsSync(marker); attempt += 1) await delay(10);
}

function plainUrl(info, pathname) {
  return new URL(pathname, `http://127.0.0.1:${info.port}`);
}

async function jsonFetch(info, pathname, options = {}) {
  const response = await fetch(plainUrl(info, pathname), options);
  let body = null;
  try { body = await response.json(); } catch { /* non-JSON error bodies are reported by status */ }
  return { response, body };
}

async function postAnswer(info, round, answer = { q_id: 'Q1', type: 'choice', choice: 'A' }) {
  return jsonFetch(info, '/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round, answers: [answer] }),
  });
}

async function publicState(info) {
  try {
    return (await jsonFetch(info, '/api/state')).body;
  } catch (error) {
    throw new Error(`GET /api/state 失败：${error.cause?.code ?? error.message} (port=${info?.port})`);
  }
}

function spawnWait(fixture, round, extraArgs = []) {
  const child = spawn(process.execPath, [WAIT, '--issue-dir', fixture.issueDir, '--round', round, ...extraArgs], {
    cwd: workRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdoutText = '';
  child.stderrText = '';
  child.stdout.on('data', (chunk) => { child.stdoutText += chunk; });
  child.stderr.on('data', (chunk) => { child.stderrText += chunk; });
  return child;
}

function waitChild(child, timeoutMs = 5_000) {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      child.kill();
      rejectPromise(new Error('continuation waiter 等待超时'));
    }, timeoutMs);
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolvePromise({ code, signal, stdout: child.stdoutText, stderr: child.stderrText });
    });
  });
}

async function waitUntil(predicate, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(15);
  }
  throw new Error('等待确定性状态超时');
}

async function withFixture(label, callback) {
  const fixture = issueFixture(label);
  let info = null;
  try {
    info = startServer(fixture);
    await assertServerAlive(info, `${label} start`);
    return await callback(fixture, info, (nextInfo) => { info = nextInfo; });
  } finally {
    await stopServer(info, fixture);
    // Windows can release an fs.watch handle slightly after the child exits.
    // Give the OS a short grace period before removing the isolated fixture.
    await delay(80);
    rmSync(fixture.root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  }
}

async function caseSubmissionDurability() {
  await withFixture('durability', async (fixture, info, replaceInfo) => {
    let currentInfo = info;
    publish(fixture, 'r1');
    const storedRound = JSON.parse(readFileSync(join(fixture.issueDir, 'web', 'state.json'), 'utf8')).rounds[0];
    assert(storedRound.continuation === undefined && storedRound.mode === undefined, 'round JSON 伪造了 continuation projection');
    const legacy = await publicState(currentInfo);
    assert(legacy.state.schema_version === 3 && legacy.state.continuation.mode === 'manual_followup'
      && legacy.state.continuation.status === 'awaiting_submission'
      && legacy.state.continuation.next_user_action === 'submit', 'legacy state 没有投影为可提交 manual 状态');

    await armDeferredContinuation(fixture.issueDir, 'r1', { leaseTtlMs: 60_000 });
    const arming = await publicState(currentInfo);
    assert(arming.state.continuation.mode === 'current_turn_deferred'
      && arming.state.continuation.status === 'arming'
      && arming.state.continuation.next_user_action === 'submit', 'arming 没有保持提交可用');

    const submitted = await postAnswer(currentInfo, 'r1');
    const submissionPath = join(fixture.issueDir, 'web', 'submissions', 'r1.json');
    assert(submitted.response.status === 200 && submitted.body.continuation.receipt_stage === 'persisted'
      && existsSync(submissionPath), '首次 POST 没有以 persisted 回执确认且先落盘');
    assert(!JSON.stringify(submitted.body).includes('owner_nonce'), 'POST 回执泄露 runtime owner nonce');

    const beforeRestart = await publicState(currentInfo);
    assert(beforeRestart.state.continuation.status === 'submitted'
      && beforeRestart.state.continuation.receipt_stage === 'persisted', '提交后不能提前显示 Agent 已恢复');
    const stableUrl = currentInfo.url;
    await stopServer(info, fixture);
    currentInfo = startServer(fixture, info.port);
    replaceInfo(currentInfo);
    assert(currentInfo.url === stableUrl && currentInfo.token === undefined, 'server 重启改变了本地 URL 或重新引入 token');
    const afterRestart = await publicState(currentInfo);
    assert(afterRestart.dossier.submissions.r1.answers[0].choice === 'A', '重启后没有从盘上读取答案');
    assert(afterRestart.state.continuation.status === 'manual_recovery_required'
      && afterRestart.state.continuation.next_user_action === 'send_message', 'server 重启/停止后的状态不诚实降级');

    const duplicate = await postAnswer(currentInfo, 'r1');
    assert(duplicate.response.status === 409 && duplicate.body.error === 'duplicate_round', '重复提交没有保持 409');
    check('submission durability：无登录提交、固定 URL 重启恢复、200 前落盘、409 与 persisted 分层');
  });
}

async function caseManualDefault() {
  await withFixture('manual-default', async (fixture, info) => {
    publish(fixture, 'r1');
    const child = spawnWait(fixture, 'r1', ['--timeout-ms', '5_000']);
    try {
      await waitUntil(async () => {
        const projected = await publicState(info);
        return projected.state.continuation.mode === 'manual_followup'
          && projected.state.continuation.status === 'awaiting_submission'
          && projected.state.continuation.next_user_action === 'submit';
      });
      const runtime = readRuntimeFiles(fixture.issueDir);
      assert(runtime.lease === null && runtime.receipt === null, '普通 wait-submit 不得创建 continuation authority');

      const submitted = await postAnswer(info, 'r1');
      assert(submitted.response.status === 200
        && submitted.body.continuation.mode === 'manual_followup'
        && submitted.body.continuation.status === 'manual_recovery_required'
        && submitted.body.continuation.receipt_stage === 'persisted'
        && submitted.body.continuation.next_user_action === 'send_message', '提交后没有明确提示回 Codex 输入请继续');
      const waited = await waitChild(child);
      assert(waited.code === 0 && JSON.parse(waited.stdout).round === 'r1', 'transport waiter 没有输出已持久化 submission');

      const scan = parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--scan']), 'manual default scan');
      assert(scan.pending.some((entry) => entry.round === 'r1'), '请继续前 scan 没有发现 pending submission');
      const consumed = parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--mark-consumed', 'r1']), 'manual default consume');
      assert(consumed.consumed === true, '请继续后的人工消费没有成功');
      publish(fixture, 'r2', 2);
      const next = await publicState(info);
      assert(next.state.continuation.round === 'r2'
        && next.state.continuation.mode === 'manual_followup'
        && next.state.continuation.status === 'awaiting_submission', '人工消费后没有发布下一轮 manual round');
      check('manual default：不保持模型 turn，提交后明确提示请继续，scan/consume 后发布下一轮');
    } finally {
      if (child.exitCode === null) {
        child.kill();
        await waitChild(child).catch(() => {});
      }
    }
  });
}

async function assertManualFixture(label, prepare, expectedReason = null) {
  await withFixture(label, async (fixture, info) => {
    publish(fixture, 'r1');
    await prepare(fixture, info);
    const before = await publicState(info);
    assert(before.state.continuation.status === 'awaiting_submission'
      && before.state.continuation.mode === 'manual_followup'
      && before.state.continuation.next_user_action === 'submit', `${label} 提交前没有 manual/submit`);
    const submitted = await postAnswer(info, 'r1');
    assert(submitted.response.status === 200 && submitted.body.continuation.status === 'manual_recovery_required'
      && submitted.body.continuation.next_user_action === 'send_message', `${label} 提交没有诚实转人工`);
    if (expectedReason) assert(submitted.body.continuation.reason === expectedReason, `${label} reason 不匹配`);
    const after = await publicState(info);
    assert(after.dossier.submissions.r1.answers.length === 1, `${label} submission 没有保存`);
    parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--scan']), `${label} scan`);
    parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--mark-consumed', 'r1']), `${label} consume`);
    const consumed = await publicState(info);
    assert(consumed.state.continuation.status === 'consumed'
      && consumed.state.continuation.next_user_action === 'none', `${label} 人工恢复后没有进入 consumed`);
  });
}

async function caseManualFallback() {
  await assertManualFixture('not-ready', async () => {}, 'legacy_state_without_runtime_receipt');

  await assertManualFixture('establishment-failure', async (fixture) => {
    const authority = await armDeferredContinuation(fixture.issueDir, 'r1', { leaseTtlMs: 60_000 });
    await assertRejects(
      waitForDeferredSubmission(authority, { watchFactory: () => { throw new Error('injected_watch_failure'); } }),
      'wait_setup_failed',
    );
  }, 'wait_setup_failed');

  await assertManualFixture('cancelled', async (fixture) => {
    const authority = await armDeferredContinuation(fixture.issueDir, 'r1', { leaseTtlMs: 60_000 });
    await assertRejects(
      waitForDeferredSubmission(authority, { timeoutMs: 80 }),
      'wait_timeout',
    );
  }, 'wait_timeout');

  await assertManualFixture('lease-expired', async (fixture) => {
    const authority = await armDeferredContinuation(fixture.issueDir, 'r1', { leaseTtlMs: 20 });
    await assertRejects(waitForDeferredSubmission(authority), 'lease_expired');
  }, 'lease_expired');

  const earlyExit = issueFixture('server-early-exit');
  let earlyInfo = null;
  try {
    publish(earlyExit, 'r1');
    earlyInfo = startServer(earlyExit);
    await armDeferredContinuation(earlyExit.issueDir, 'r1', { leaseTtlMs: 60_000 });
    const accepted = await postAnswer(earlyInfo, 'r1');
    assert(accepted.response.status === 200 && accepted.body.continuation.mode === 'current_turn_deferred', 'server 停止前未形成自动 persisted 回执');
    await stopServer(earlyInfo, earlyExit);
    earlyInfo = startServer(earlyExit, earlyInfo.port);
    const projected = await publicState(earlyInfo);
    assert(projected.state.continuation.status === 'manual_recovery_required'
      && projected.state.continuation.reason === 'server_stopped', 'server 提前退出没有转人工恢复');
  } finally {
    await stopServer(earlyInfo, earlyExit);
    await delay(80);
    rmSync(earlyExit.root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  }
  check('manual fallback：未就绪、建立失败、取消、lease 过期、server 提前退出五类故障均保留提交并转人工');
}

async function assertRejects(promise, expected) {
  let rejected = false;
  try {
    await promise;
  } catch (error) {
    rejected = true;
    assert(String(error.message).includes(expected) || error.code === expected, `拒绝原因不是 ${expected}：${error.message}`);
  }
  assert(rejected, `应拒绝：${expected}`);
}

async function caseExactlyOnce() {
  await withFixture('exactly-once', async (fixture, info) => {
    publish(fixture, 'r1');
    const authority = await armDeferredContinuation(fixture.issueDir, 'r1', { leaseTtlMs: 60_000 });
    const waiting = waitForDeferredSubmission(authority);
    await waitUntil(() => Boolean(readRuntimeFiles(fixture.issueDir).receipt?.generation));
    const raced = await postAnswer(info, 'r1');
    assert(raced.response.status === 200, 'watch barrier race 的 POST 失败');
    const submission = await waiting;
    assert(submission.round === 'r1', 'watch barrier 没有被事件或 recheck 命中');
    await resumeDeferredContinuation(authority);
    const resumed = readPublicContinuation(fixture.issueDir);
    assert(resumed.status === 'resuming' && resumed.receipt_stage === 'agent_resumed', 'waiter 返回前没有写 agent_resumed');
    const resumedPublic = await publicState(info);
    assert(resumedPublic.state.continuation.status === 'resuming'
      && resumedPublic.state.continuation.receipt_stage === 'agent_resumed', 'server 没有投影 agent_resumed');
    const runtimeNonce = readRuntimeFiles(fixture.issueDir).lease.owner_nonce;
    const publicPayload = JSON.stringify(await publicState(info));
    assert(runtimeNonce && !publicPayload.includes(runtimeNonce) && !publicPayload.includes('owner_nonce')
      && !publicPayload.includes('owner_pid'), 'API/dossier 泄露 raw runtime capability');
    const exportResponse = await fetch(plainUrl(info, '/export'));
    const exportHtml = await exportResponse.text();
    assert(exportResponse.ok && exportHtml.includes('current_turn_deferred')
      && !exportHtml.includes(runtimeNonce) && !exportHtml.includes('owner_nonce'), '静态 dossier 泄露 raw runtime capability');

    const firstMark = parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--mark-consumed', 'r1']), 'first mark');
    const secondMark = parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--mark-consumed', 'r1']), 'second mark');
    assert(firstMark.consumed === true && secondMark.replay === true, '重复 completion 没有命中持久幂等');
    const records = readConsumptionRecords(fixture.issueDir);
    assert(records.filter((record) => record.round === 'r1' && record.status === 'committed').length === 1, 'committed consumption record 重复');
    const ledger = readFileSync(join(fixture.issueDir, 'web', 'decision-ledger.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
    const summary = ledger.filter((event) => event.entity?.id === 'r1').map((event) => event.type);
    assert(JSON.stringify(summary) === JSON.stringify(['round_published', 'round_submitted', 'submission_consumed']), 'ledger 摘要链顺序错误');
    const consumed = readPublicContinuation(fixture.issueDir);
    assert(consumed.status === 'consumed' && consumed.next_user_action === 'none', 'consumed 投影不正确');

    publish(fixture, 'r2', 2);
    const submittedTwo = await postAnswer(info, 'r2');
    assert(submittedTwo.response.status === 200, 'crash/restart fixture submission 失败');
    const claim = parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--claim-consume', 'r2']), 'first claim');
    const replayClaim = parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--claim-consume', 'r2']), 'replay claim');
    assert(claim.replay === false && replayClaim.replay === true && replayClaim.status === 'processing', 'processing claim 没有跨进程持久恢复');
    parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--mark-consumed', 'r2']), 'commit after crash');
    const recordsAfterCrash = readConsumptionRecords(fixture.issueDir);
    assert(recordsAfterCrash.filter((record) => record.round === 'r2' && record.status === 'committed').length === 1, '崩溃恢复重复 committed');

    publish(fixture, 'r3', 3);
    const oldOwner = await armDeferredContinuation(fixture.issueDir, 'r3', { leaseTtlMs: 60_000 });
    const newOwner = await armDeferredContinuation(fixture.issueDir, 'r3', { leaseTtlMs: 60_000 });
    await assertRejects(failDeferredContinuation(oldOwner, 'stale_owner'), 'STALE_CONTINUATION_OWNER');
    const runtime = readRuntimeFiles(fixture.issueDir);
    assert(runtime.receipt.generation === newOwner.generation && runtime.receipt.status === 'arming', '旧 generation owner 改写了新 receipt');
    const projected = readPublicContinuation(fixture.issueDir);
    assert(projected.mode === 'current_turn_deferred' && projected.status === 'arming', 'generation fencing 后新 owner 不可用');
    check('exactly once：watch barrier、重复 completion、processing 崩溃恢复、重复人工恢复、旧 generation fencing');
  });
}

async function caseBoundedPayload() {
  const longAnswer = '当前答案原文'.repeat(300);
  let oneRoundBytes = 0;
  await withFixture('bounded-one', async (fixture, info) => {
    publish(fixture, 'current', 1);
    const submitted = await postAnswer(info, 'current', { q_id: 'Q1', type: 'custom', text: longAnswer });
    assert(submitted.response.status === 200 && !submitted.body.truncated, '单 round 长答案不应被静默截断');
    const payload = readAgentRecoveryPayload(fixture.issueDir, 'current');
    oneRoundBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    assert(payload.answers.length === 1 && payload.answers[0].text === longAnswer, '单 round recovery payload 没有保留答案原文');
  });

  await withFixture('bounded-ten', async (fixture, info) => {
    for (let no = 1; no <= 9; no += 1) publish(fixture, `old-${no}`, no);
    publish(fixture, 'current', 10);
    const submitted = await postAnswer(info, 'current', { q_id: 'Q1', type: 'custom', text: longAnswer });
    assert(submitted.response.status === 200, '10 round 当前答案提交失败');
    const payload = readAgentRecoveryPayload(fixture.issueDir, 'current');
    const payloadText = JSON.stringify(payload);
    const forbidden = ['rounds', 'submissions', 'ledger', 'history_window'];
    assert(JSON.stringify(Object.keys(payload).sort()) === JSON.stringify(['answers', 'digest', 'kind', 'questions', 'revision', 'round', 'schema_version', 'session_slug']), 'recovery payload 字段超出最小封装');
    assert(payload.questions.length === 1 && payload.answers.length === 1, 'recovery payload 不是当前 round 单份问题/答案');
    assert(payload.answers[0].text === longAnswer, '10 round recovery payload 静默截断当前答案');
    assert(forbidden.every((field) => !Object.hasOwn(payload, field)), 'recovery payload 带入了全量历史字段');
    assert(!payloadText.includes('old-'), 'recovery payload 带入了旧 round 标识');
    const tenRoundBytes = Buffer.byteLength(payloadText, 'utf8');
    assert(tenRoundBytes <= oneRoundBytes + 512, `recovery payload 随 round 数增长：${oneRoundBytes} → ${tenRoundBytes}`);
  });
  check('bounded recovery payload：当前问答原文保真，10 round 字段与大小均保持 O(1)');
}

async function caseHistoryWindow() {
  await withFixture('history-window', async (fixture, info) => {
    for (let no = 1; no <= 10; no += 1) publish(fixture, `r${no}`, no);
    for (let no = 1; no <= 9; no += 1) {
      const submitted = await postAnswer(info, `r${no}`);
      assert(submitted.response.status === 200, `r${no} 提交失败`);
      const consumed = run(WAIT, ['--issue-dir', fixture.issueDir, '--mark-consumed', `r${no}`]);
      assert(consumed.status === 0, `r${no} 消费失败`);
    }

    const projected = await publicState(info);
    assert(JSON.stringify(projected.state.rounds.map((round) => round.id)) === JSON.stringify(['r7', 'r8', 'r9', 'r10']), '默认状态没有投影当前+上3 round');
    assert(projected.state.history_window.current_round === 'r10'
      && projected.state.history_window.older_before === 'r7'
      && projected.state.history_window.total_rounds === 10, 'history window 边界元数据不正确');
    assert(projected.state.rounds.find((round) => round.id === 'r9').status === 'submitted'
      && projected.state.rounds.find((round) => round.id === 'r10').status === 'pending', '提交 round 没有保持锁定而当前 round 没有保持可编辑');
    assert(JSON.stringify(projected.dossier.state.rounds.map((round) => round.id)) === JSON.stringify(['r7', 'r8', 'r9', 'r10']), '默认 dossier 携带了全量 round');
    assert(!projected.dossier.submissions.r1 && projected.dossier.submissions.r9, '默认 dossier 携带了窗口外 submission');
    assert(!(projected.dossier.sources ?? []).some((source) => source.path === '1-interview/rounds.jsonl'), '默认 dossier 携带了全量 rounds.jsonl');
    assert(!JSON.stringify(projected).includes('"r1"'), '默认 /api/state 响应泄露窗口外 round');

    const cursor = projected.state.history_window.older_before;
    const pageResult = await jsonFetch(info, `/api/history?before=${encodeURIComponent(cursor)}&limit=3`);
    assert(pageResult.response.status === 200
      && JSON.stringify(pageResult.body.history.rounds.map((round) => round.id)) === JSON.stringify(['r4', 'r5', 'r6'])
      && pageResult.body.history.history_window.older_before === 'r4', '显式历史分页没有包含窗口边界 round');
    const firstPage = await jsonFetch(info, '/api/history?before=r4&limit=3');
    assert(firstPage.response.status === 200
      && JSON.stringify(firstPage.body.history.rounds.map((round) => round.id)) === JSON.stringify(['r1', 'r2', 'r3'])
      && firstPage.body.history.history_window.older_available === false, '历史分页无法读到最早 round');
    const invalid = await jsonFetch(info, '/api/history?before=bad%20cursor');
    assert(invalid.response.status === 400 && invalid.body.error === 'history_cursor_invalid', '非法历史 cursor 没有被拒绝');

    const exportResponse = await fetch(plainUrl(info, '/export'));
    const exportHtml = await exportResponse.text();
    assert(exportResponse.ok && exportHtml.includes('continuation r1') && exportHtml.includes('continuation r10'), '完整 export 没有保留全量历史');
  });
  check('history window：默认当前+上3、提交即锁定、显式分页读取旧档案、export 保留全量');
}

async function caseBoundedHistory() {
  await caseBoundedPayload();
  await caseHistoryWindow();
}

async function caseRecoveryBoundaries() {
  await withFixture('recovery-boundaries', async (fixture, info) => {
    publish(fixture, 'r1', 1);
    publish(fixture, 'r2', 2);
    const laterAuthority = await armDeferredContinuation(fixture.issueDir, 'r2', { leaseTtlMs: 60_000 });
    const beforeAnySubmission = await publicState(info);
    assert(beforeAnySubmission.state.continuation.round === 'r1', '后续 round 的 deferred authority 不得抢占最早 pending');
    await failDeferredContinuation(laterAuthority, 'later_round_not_oldest');
    const original = '冲突时仍保留的当前 submission 原文'.repeat(40);
    const firstSubmission = await postAnswer(info, 'r1', { q_id: 'Q1', type: 'custom', text: original });
    const secondSubmission = await postAnswer(info, 'r2');
    assert(firstSubmission.response.status === 200 && secondSubmission.response.status === 200, '多 pending submission 没有都落盘');

    const projected = await publicState(info);
    assert(projected.state.continuation.round === 'r1', '多 pending 没有选择最早待恢复 round');
    const oldest = parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--scan', '--oldest']), 'oldest scan');
    assert(oldest.pending.length === 1 && oldest.pending[0].round === 'r1'
      && oldest.pending[0].answer_count === 1 && !Object.hasOwn(oldest.pending[0], 'answers')
      && oldest.pending_count === 2 && oldest.has_more === true, 'oldest scan 没有只返回最早 pending 身份');

    const payload = parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--recovery-payload', 'r1']), 'recovery payload');
    assert(payload.round === 'r1' && payload.answers[0].text === original, 'recovery payload 没有保留当前 submission');
    const targeted = parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--history', 'r1', '--q-id', 'Q1']), 'targeted history');
    assert(targeted.round.id === 'r1' && targeted.round.questions.length === 1
      && targeted.answers.length === 1 && targeted.answers[0].text === original, 'targeted history 没有只读取指定 round/q_id');

    const failedHistory = run(WAIT, ['--issue-dir', fixture.issueDir, '--history', 'r1', '--q-id', 'MISSING']);
    const failedRecovery = run(WAIT, ['--issue-dir', fixture.issueDir, '--recovery-payload', 'missing-round']);
    assert(failedHistory.status === 1 && failedRecovery.status === 1, '恢复查询失败没有诚实返回失败');
    assert(existsSync(join(fixture.issueDir, 'web', 'submissions', 'r1.json'))
      && !existsSync(join(fixture.issueDir, 'web', 'consumed', 'r1.json')), '恢复查询失败错误删除或假消费 submission');
    const duplicate = await postAnswer(info, 'r1');
    assert(duplicate.response.status === 409, 'persisted round 在人工恢复前没有保持只读/409');

    parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--mark-consumed', 'r1']), 'consume oldest');
    const next = await publicState(info);
    assert(next.state.continuation.round === 'r2', '最早 round 消费后没有转到下一 pending');
    const nextOldest = parseJsonOutput(run(WAIT, ['--issue-dir', fixture.issueDir, '--scan', '--oldest']), 'next oldest scan');
    assert(nextOldest.pending.length === 1 && nextOldest.pending[0].round === 'r2', '下一次人工恢复没有继续 oldest-first');
  });
  check('recovery boundaries：oldest-first、targeted history、失败保留 submission、消费后顺序推进');
}

async function main() {
  const argv = process.argv.slice(2);
  const at = argv.indexOf('--case');
  const selected = at >= 0 ? argv[at + 1] : 'all';
  const cases = {
    'submission-durability': caseSubmissionDurability,
    'manual-default': caseManualDefault,
    'manual-fallback': caseManualFallback,
    'exactly-once': caseExactlyOnce,
    'bounded-payload': caseBoundedPayload,
    'history-window': caseHistoryWindow,
    'bounded-history': caseBoundedHistory,
    'recovery-boundaries': caseRecoveryBoundaries,
    all: async () => {
      await caseManualDefault();
      await caseSubmissionDurability();
      await caseManualFallback();
      await caseExactlyOnce();
      await caseBoundedPayload();
      await caseHistoryWindow();
      await caseRecoveryBoundaries();
    },
  };
  if (!cases[selected]) throw new Error(`未知 continuation case：${selected}`);
  await cases[selected]();
  console.log(`${checks}/${checks} passed`);
}

try {
  await main();
} catch (error) {
  console.error(`FAIL after ${checks} checks: ${error.stack ?? error.message}`);
  process.exitCode = 1;
} finally {
  await delay(120);
  try { rmSync(workRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); }
  catch (error) { console.error(`cleanup warning: ${basename(workRoot)}: ${error.message}`); }
}
