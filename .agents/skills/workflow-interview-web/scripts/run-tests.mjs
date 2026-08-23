#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, 'server.mjs');
const PUBLISH = join(HERE, 'publish.mjs');
const WAIT = join(HERE, 'wait-submit.mjs');
const EXPORT = join(HERE, 'export-static.mjs');
const SKILL_ROOT = dirname(HERE);
const workDir = mkdtempSync(join(tmpdir(), 'workflow-interview-web-'));
const issueDir = join(workDir, '2026-08-23-runtime-test');
mkdirSync(issueDir, { recursive: true });
mkdirSync(join(issueDir, '1-interview'), { recursive: true });
writeFileSync(join(issueDir, '1-interview', 'context.md'), '# Context Snapshot\n\n## 任务陈述\n\n测试上下文。\n', 'utf8');

let serverInfo = null;
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
    cwd: workDir,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, ...options.env },
    timeout: options.timeout ?? 10_000,
  });
}

function parseJsonOutput(result, label) {
  assert(result.status === 0, `${label} 退出码 ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  try { return JSON.parse(lines.at(-1)); }
  catch { throw new Error(`${label} 没有输出合法 JSON：${result.stdout}`); }
}

function writeJson(name, value) {
  const pathname = join(workDir, name);
  writeFileSync(pathname, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return pathname;
}

function keyUrl(pathname) {
  const url = new URL(pathname, `http://127.0.0.1:${serverInfo.port}`);
  url.searchParams.set('key', serverInfo.token);
  return url;
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { response, body };
}

function waitChild(child, timeoutMs = 5_000) {
  return new Promise((resolveChild, rejectChild) => {
    const timer = setTimeout(() => {
      child.kill();
      rejectChild(new Error('子进程等待超时'));
    }, timeoutMs);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolveChild({ code, signal, stdout: child.stdoutText, stderr: child.stderrText });
    });
  });
}

function spawnWait(args) {
  const child = spawn(process.execPath, [WAIT, ...args], { cwd: workDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdoutText = '';
  child.stderrText = '';
  child.stdout.on('data', (chunk) => { child.stdoutText += chunk; });
  child.stderr.on('data', (chunk) => { child.stderrText += chunk; });
  return child;
}

function badWebSocketUpgrade(port, token) {
  return new Promise((resolveSocket, rejectSocket) => {
    const socket = connect({ host: '127.0.0.1', port });
    let response = '';
    const timer = setTimeout(() => {
      socket.destroy();
      rejectSocket(new Error('WS upgrade 响应超时'));
    }, 2_000);
    socket.on('connect', () => socket.write([
      'GET /ws HTTP/1.1',
      `Host: 127.0.0.1:${port}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      'Sec-WebSocket-Version: 13',
      'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
      'Origin: http://evil.example',
      `Cookie: wi_web_key=${token}`,
      '',
      '',
    ].join('\r\n')));
    socket.on('data', (chunk) => { response += chunk.toString('utf8'); });
    socket.on('close', () => {
      clearTimeout(timer);
      resolveSocket(response);
    });
    socket.on('error', rejectSocket);
  });
}

const roundOne = {
  dossier: { title: 'Goal Contract 决策档案 · runtime test', summary: '静态导出后仍能独立阅读' },
  opening: '测试任务原文（只读）',
  phases: [
    { id: '1-interview', label: '访谈·拷问', status: 'active' },
    { id: '2-prototype', label: '原型确认', status: 'pending' },
    { id: '3-contract', label: '交付标准·契约', status: 'pending' },
  ],
  open_ambiguities: 2,
  locked: [{ ref: 'Q0', q: '交付范围', a: '完整技能+基础测试', round: 'r0', tier: 'ask' }],
  round: {
    id: 'r1', no: 1, stage: '1-interview', title: '一次问清', status: 'pending',
    items: [
      {
        q_id: 'Q1', tier: 'ask', question: '跨天提交采用哪条边界？', known_facts: '提交入口可独立存活。',
        irreversible: true, allow_custom: true,
        options: [
          { key: 'A', text: '48h 缓冲', pct: 65, recommended: true, covers: '提交入盘；不保活 Agent', pros: ['隔天可用'], cons: ['留驻进程'] },
          { key: 'B', text: '会话内存活', pct: 35, pros: ['收尾简单'], cons: ['关宿主后不可交互'] },
        ],
      },
      { q_id: 'D1', tier: 'default', line: '草稿 localStorage 保存 — 刷新恢复 — 代价：少量状态管理' },
      { q_id: 'C1', tier: 'confirm', line: '后台任务退出通知唤醒 — 宿主原生能力 — 代价：绑定宿主' },
    ],
  },
};

try {
  const start = run(SERVER, ['start', '--issue-dir', issueDir, '--port', '0'], {
    env: { WI_WEB_IDLE_TIMEOUT_MS: '120000' }, timeout: 12_000,
  });
  serverInfo = parseJsonOutput(start, 'server start');
  assert(serverInfo.type === 'server-started' && serverInfo.port > 0 && /^[a-f0-9]{64}$/.test(serverInfo.token), 'server-info 缺 URL/token/port');
  const infoOnDisk = JSON.parse(readFileSync(join(issueDir, 'web', 'server-info'), 'utf8'));
  assert(infoOnDisk.token === serverInfo.token && infoOnDisk.pid === serverInfo.pid, 'server-info 落盘内容不一致');
  check('server start → server-info 含 URL/token');

  const firstHop = await fetch(serverInfo.url, { redirect: 'manual' });
  const cookie = firstHop.headers.get('set-cookie') ?? '';
  assert(firstHop.status === 303 && firstHop.headers.get('location') === '/', '首跳没有 303 清除 query key');
  assert(/HttpOnly/i.test(cookie) && /SameSite=Strict/i.test(cookie), 'cookie 缺 HttpOnly/SameSite=Strict');
  const noKey = await jsonFetch(`http://127.0.0.1:${serverInfo.port}/api/state`);
  assert(noKey.response.status === 403 && noKey.body?.error === 'session_key_required', '无 key 访问未被拒绝');
  const malformedCookie = await jsonFetch(`http://127.0.0.1:${serverInfo.port}/api/state`, { headers: { Cookie: 'wi_web_key=%ZZ' } });
  assert(malformedCookie.response.status === 403, '畸形 cookie 没有稳定拒绝');
  const badWs = await badWebSocketUpgrade(serverInfo.port, serverInfo.token);
  assert(/^HTTP\/1\.1 403/m.test(badWs), '跨源 WS upgrade 未被拒绝');
  check('token 首跳/cookie/HTTP/WS 同源鉴权全链');

  const invalid = structuredClone(roundOne);
  invalid.round.items[0].options[1].pct = 20;
  const invalidResult = run(PUBLISH, ['round', '--issue-dir', issueDir, '--file', writeJson('invalid-round.json', invalid)]);
  assert(invalidResult.status === 1 && /100±2/.test(invalidResult.stderr), 'pct 和非法轮次未被拒绝');
  check('publish 拒绝 pct 和不在 100±2 的 round');

  const attachment = join(workDir, 'prototype.html');
  writeFileSync(attachment, '<!doctype html><title>prototype fixture</title>\n', 'utf8');
  const publishOne = run(PUBLISH, [
    'round', '--issue-dir', issueDir, '--file', writeJson('round-r1.json', roundOne),
    '--attach', `${attachment}=prototype.html`,
  ]);
  const publishOutput = parseJsonOutput(publishOne, 'publish r1');
  assert(publishOutput.round === 'r1' && publishOutput.items === 3, 'publish 输出不匹配');
  const stateResult = await jsonFetch(keyUrl('/api/state'));
  assert(stateResult.response.status === 200 && stateResult.body?.state?.rounds?.[0]?.id === 'r1', '/api/state 未返回新 round');
  const page = await fetch(keyUrl('/app.mjs'));
  assert(page.status === 200 && (await page.text()).includes('localStorage'), '单页静态资产不可读');
  check('合法 round 原子发布，/api/state 与单页资产可读');

  const originDenied = await jsonFetch(keyUrl('/api/submit'), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' },
    body: JSON.stringify({ round: 'r1', answers: [] }),
  });
  assert(originDenied.response.status === 403 && originDenied.body?.error === 'origin_forbidden', '跨源 POST 未被拒绝');
  const missing = await jsonFetch(keyUrl('/api/submit'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round: 'r1', answers: [] }),
  });
  assert(missing.response.status === 422 && missing.body?.q_ids?.includes('Q1') && missing.body.q_ids.includes('C1'), '必答缺失没有 422');
  check('POST 同源边界与必答缺失 422');

  const longOther = '跨天边界'.repeat(600);
  const submit = await jsonFetch(keyUrl('/api/submit'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round: 'r1', answers: [
      { q_id: 'Q1', type: 'custom', text: longOther },
      { q_id: 'C1', type: 'confirm' },
    ] }),
  });
  const submissionPath = join(issueDir, 'web', 'submissions', 'r1.json');
  assert(submit.response.status === 200 && submit.body?.truncated === true && existsSync(submissionPath), '提交未先落盘或未标 truncated');
  const submission = JSON.parse(readFileSync(submissionPath, 'utf8'));
  assert(submission.answers.find((answer) => answer.q_id === 'Q1').text.length === 2000, 'Other 没有截断到 2000');
  assert(submission.answers.some((answer) => answer.q_id === 'D1' && answer.type === 'accept'), '默认项未正规化为 accept');
  const submittedState = await jsonFetch(keyUrl('/api/state'));
  assert(submittedState.body?.state?.open_ambiguities === 0, '最后一个 pending round 提交后开放歧义未归零');
  check('提交先落盘再 200；Other 截断且默认项正规化');

  const immediateWait = run(WAIT, ['--issue-dir', issueDir, '--round', 'r1']);
  const waited = parseJsonOutput(immediateWait, 'wait existing');
  assert(waited.round === 'r1' && waited.answers.length === 3, 'wait-submit 没有打印提交 JSON');
  const duplicate = await jsonFetch(keyUrl('/api/submit'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round: 'r1', answers: [{ q_id: 'Q1', type: 'choice', choice: 'A' }, { q_id: 'C1', type: 'confirm' }] }),
  });
  assert(duplicate.response.status === 409 && duplicate.body?.error === 'duplicate_round', '重复提交没有返回 409 duplicate_round');
  check('wait-submit 立即输出；同 round 第二次提交固定 409');

  const scanBefore = parseJsonOutput(run(WAIT, ['--issue-dir', issueDir, '--scan']), 'scan before');
  assert(scanBefore.pending.some((entry) => entry.round === 'r1'), '未消化 submission 没被扫描到');
  parseJsonOutput(run(WAIT, ['--issue-dir', issueDir, '--mark-consumed', 'r1']), 'mark consumed');
  const scanAfter = parseJsonOutput(run(WAIT, ['--issue-dir', issueDir, '--scan']), 'scan after');
  assert(scanAfter.pending.length === 0, '已消化 submission 仍出现在扫描结果');
  check('续跑扫描与 consumed marker 协议');

  const roundTwo = {
    round: {
      id: 'r2', no: 2, stage: '2-prototype', title: '原型质疑', status: 'pending',
      items: [{ q_id: 'Q2', tier: 'ask', question: '对照物是否准确？', allow_custom: true, options: [
        { key: 'A', text: '准确', pct: 60, recommended: true },
        { key: 'B', text: '需修改', pct: 40 },
      ] }],
    },
    open_ambiguities: 1,
  };
  parseJsonOutput(run(PUBLISH, ['round', '--issue-dir', issueDir, '--file', writeJson('round-r2.json', roundTwo)]), 'publish r2');
  const waitingChild = spawnWait(['--issue-dir', issueDir, '--round', 'r2']);
  await delay(150);
  const submitTwo = await jsonFetch(keyUrl('/api/submit'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round: 'r2', answers: [{ q_id: 'Q2', type: 'choice', choice: 'A' }] }),
  });
  const childResult = await waitChild(waitingChild);
  assert(submitTwo.response.status === 200 && childResult.code === 0 && JSON.parse(childResult.stdout).round === 'r2', '文件事件没有唤醒 wait-submit');
  const timeoutWait = run(WAIT, ['--issue-dir', issueDir, '--round', 'never', '--timeout-ms', '120']);
  assert(timeoutWait.status === 2, '测试 timeout 没返回退出码 2');
  check('文件事件唤醒等待者；测试专用 timeout 退出码 2');

  const roundTypes = {
    round: {
      id: 'r3', no: 3, stage: '1-interview', title: '结构化回答类型', status: 'pending',
      items: [
        { q_id: 'M1', tier: 'ask', question: '哪些页面进入范围？', response: { type: 'multi_select', min_selections: 1, max_selections: 2, exclusive_keys: ['NONE'] }, options: [
          { key: 'WEB', text: 'Web', pct: 45, covers: 'Web 页面', pros: ['覆盖主流程'], cons: ['需要浏览器验收'] },
          { key: 'DESKTOP', text: 'Desktop', pct: 35, covers: 'Desktop 页面', pros: ['覆盖桌面端'], cons: ['需要安装态验收'] },
          { key: 'NONE', text: '都不包含', pct: 20, covers: '只做协议', pros: ['范围最小'], cons: ['没有界面交付'] },
        ] },
        { q_id: 'B1', tier: 'ask', question: '是否允许外部读取？', response: { type: 'boolean' }, options: [
          { key: 'YES', text: '允许', value: true, pct: 60 }, { key: 'NO', text: '不允许', value: false, pct: 40 },
        ] },
        { q_id: 'S1', tier: 'ask', question: '目标命令是什么？', response: { type: 'short_text', max_length: 80 } },
        { q_id: 'L1', tier: 'ask', question: '补充完整边界', response: { type: 'long_text', max_length: 2000 } },
        { q_id: 'N1', tier: 'ask', question: '最长等待多少天？', response: { type: 'number', min: 1, max: 30, unit: '天' } },
        { q_id: 'DT1', tier: 'ask', question: '截止日期', response: { type: 'date_time', format: 'date' } },
        { q_id: 'R1', tier: 'ask', question: '优先级排序', response: { type: 'ranking' }, options: [
          { key: 'A', text: '兼容' }, { key: 'B', text: '速度' }, { key: 'C', text: '易用' },
        ] },
        { q_id: 'E1', tier: 'ask', question: '证据在哪？', response: { type: 'evidence' } },
      ],
    },
    open_ambiguities: 8,
  };
  const typesPublished = parseJsonOutput(run(PUBLISH, ['round', '--issue-dir', issueDir, '--file', writeJson('round-r3.json', roundTypes)]), 'publish r3');
  assert(typesPublished.round === 'r3' && typesPublished.items === 8, 'v2 结构化 round 未发布');
  const invalidMulti = await jsonFetch(keyUrl('/api/submit'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round: 'r3', answers: [
      { q_id: 'M1', type: 'multi', choices: ['NONE', 'WEB'] },
      { q_id: 'B1', type: 'boolean', value: true }, { q_id: 'S1', type: 'text', value: 'node cli.mjs' },
      { q_id: 'L1', type: 'text', value: '边界' }, { q_id: 'N1', type: 'number', value: 7 },
      { q_id: 'DT1', type: 'date_time', value: '2026-09-01' }, { q_id: 'R1', type: 'ranking', choices: ['A', 'B', 'C'] },
      { q_id: 'E1', type: 'evidence', values: ['docs/evidence.md'] },
    ] }),
  });
  assert(invalidMulti.response.status === 400, '排他多选组合没有被拒绝');
  const submitTypes = await jsonFetch(keyUrl('/api/submit'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round: 'r3', answers: [
      { q_id: 'M1', type: 'multi', choices: ['WEB'], custom: 'CLI 摘要页' },
      { q_id: 'B1', type: 'boolean', value: true }, { q_id: 'S1', type: 'text', value: 'node cli.mjs' },
      { q_id: 'L1', type: 'text', value: '完整记录必须可离线阅读' }, { q_id: 'N1', type: 'number', value: 7 },
      { q_id: 'DT1', type: 'date_time', value: '2026-09-01' }, { q_id: 'R1', type: 'ranking', choices: ['A', 'C', 'B'] },
      { q_id: 'E1', type: 'evidence', values: ['docs/evidence.md', 'https://example.test/proof'] },
    ] }),
  });
  assert(submitTypes.response.status === 200, 'v2 结构化回答提交失败');
  const typeSubmission = JSON.parse(readFileSync(join(issueDir, 'web', 'submissions', 'r3.json'), 'utf8'));
  assert(typeSubmission.schema_version === 2 && typeSubmission.answers.find((answer) => answer.q_id === 'M1').choices[0] === 'WEB', 'v2 多选没有正规化落盘');
  assert(typeSubmission.answers.find((answer) => answer.q_id === 'N1').unit === '天', '数字回答没有保留单位');
  const dossierState = await jsonFetch(keyUrl('/api/state'));
  assert(dossierState.body?.dossier?.submissions?.r3?.answers?.length === 8, '/api/state 没有返回权威决策档案');
  assert(dossierState.body.dossier.title === 'Goal Contract 决策档案 · runtime test', '决策档案没有保留发布标题');
  assert(dossierState.body.dossier.ledger.some((event) => event.type === 'round_published') && dossierState.body.dossier.ledger.some((event) => event.type === 'round_submitted'), '决策账本缺发布或提交事件');
  check('v2 多选、布尔、文本、数字、日期、排序与证据回答全链');

  const exportPath = join(workDir, 'decision-dossier.html');
  const exported = parseJsonOutput(run(EXPORT, ['--issue-dir', issueDir, '--output', exportPath]), 'static export');
  const exportHtml = readFileSync(exportPath, 'utf8');
  assert(exported.type === 'decision-dossier-exported' && existsSync(exportPath), '静态导出没有生成');
  assert(exportHtml.includes('goal-contract-decision-dossier') && exportHtml.includes('decision-dossier-data') && exportHtml.includes('哪些页面进入范围？') && exportHtml.includes('Goal Contract 决策档案 · runtime test'), '静态导出缺标题、完整轨迹或机器 JSON');
  assert(exportHtml.includes('<div class="markdown"><h2>Context Snapshot') && !exportHtml.includes('<h2>原始请求与上下文</h2><pre>'), '静态档案主上下文仍在展示原始 Markdown 标记');
  assert(exportHtml.includes('<link rel="icon" href="data:,">') && !exportHtml.includes('<span>%</span>'), '静态档案有无意义的百分号或离线 favicon 请求');
  assert(exportHtml.includes('prototype fixture') && !exportHtml.includes(serverInfo.token), '静态导出没有内嵌来源或泄露 session token');
  const exportResponse = await fetch(keyUrl('/export'));
  assert(exportResponse.status === 200 && /attachment/.test(exportResponse.headers.get('content-disposition') ?? '') && (await exportResponse.text()).includes('追踪矩阵'), '浏览器导出端点不可用');
  check('自包含静态决策档案、来源内嵌、机器 JSON 与下载端点');

  const allowedFile = await fetch(keyUrl('/files/prototype.html'));
  assert(allowedFile.status === 200 && (await allowedFile.text()).includes('prototype fixture'), '白名单附件不可读');
  const traversal = await jsonFetch(keyUrl('/files/%2e%2e%2fsecret.txt'));
  assert(traversal.response.status === 404, '/files/ 越权路径没有 404');
  const malformedPath = await jsonFetch(keyUrl('/files/%ZZ'));
  assert(malformedPath.response.status === 404, '/files/ 畸形编码没有 404');
  check('/files/ 仅允许 assets basename，越权路径 404');

  const docContractRound = {
    round: {
      id: 'r4', no: 4, stage: '1-interview', title: '协议文档契约形态', status: 'pending',
      items: [
        { q_id: 'DM1', tier: 'ask', question: '哪些模块进入范围？', required: true, response: { type: 'multi_select', min: 2, max: 2 }, options: [
          { key: 'A', text: '甲' }, { key: 'B', text: '乙' }, { key: 'C', text: '丙' },
        ] },
        { q_id: 'DB1', tier: 'ask', question: '是否启用守护进程？', required: false, response: { type: 'boolean', true_label: '启用', false_label: '停用' } },
      ],
    },
    open_ambiguities: 2,
  };
  parseJsonOutput(run(PUBLISH, ['round', '--issue-dir', issueDir, '--file', writeJson('round-r4.json', docContractRound)]), 'publish r4 doc-contract');
  const normalizedState = JSON.parse(readFileSync(join(issueDir, 'web', 'state.json'), 'utf8'));
  const normalizedRound = normalizedState.rounds.find((candidate) => candidate.id === 'r4');
  const normalizedItem = normalizedRound.items.find((item) => item.q_id === 'DM1');
  assert(normalizedItem.response.min_selections === 2 && normalizedItem.response.max_selections === 2 && normalizedItem.response.min === undefined, '文档 min/max 没有正规化为 min_selections/max_selections');
  assert(normalizedRound.items.find((item) => item.q_id === 'DB1').options === undefined, 'boolean 无 options 形态不应被塞入 options');
  const tooFew = await jsonFetch(keyUrl('/api/submit'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round: 'r4', answers: [
      { q_id: 'DM1', type: 'multi', choices: ['A'] },
      { q_id: 'DB1', type: 'boolean', value: true },
    ] }),
  });
  assert(tooFew.response.status === 400, '文档 min/max 边界没有被服务端强制');
  const docSubmit = await jsonFetch(keyUrl('/api/submit'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round: 'r4', answers: [
      { q_id: 'DM1', type: 'multi', choices: ['A', 'B'] },
      { q_id: 'DB1', type: 'boolean', value: false },
    ] }),
  });
  assert(docSubmit.response.status === 200, '文档契约形态提交失败');
  check('文档契约形态（无 pct 多选 + true_label 布尔）可发布，min/max 正规化且服务端强制');

  const runtimeSources = ['server.mjs', 'publish.mjs', 'wait-submit.mjs', 'export-static.mjs'].map((name) => readFileSync(join(HERE, name), 'utf8'));
  assert(runtimeSources.every((source) => !/from\s+['"][^'"]*workflow-interview/.test(source)), 'runtime import 了 workflow-interview 家族');
  assert(!runtimeSources[0].includes('.aes-workflow') && !runtimeSources[0].includes('repoRootFrom'), 'server 仍向 issue 目录外写 .aes-workflow 或保留 repoRootFrom');
  const skill = readFileSync(join(SKILL_ROOT, 'SKILL.md'), 'utf8');
  assert(skill.includes('宿主无后台任务能力 → 回合模式') && skill.includes('Node 不可用 → 纯文本') && skill.includes('浏览器不可用 → 纯文本'), 'SKILL.md 三级降级不完整');
  assert(skill.includes('仅当用户显式调用 $workflow-interview-web') && !skill.includes('disable-model-invocation:'), 'SKILL.md 显式调用边界或标准 frontmatter 不正确');
  const openaiMetadata = readFileSync(join(SKILL_ROOT, 'agents', 'openai.yaml'), 'utf8');
  assert(/allow_implicit_invocation:\s*false/.test(openaiMetadata), 'openai.yaml 没有关闭隐式调用');
  const app = readFileSync(join(HERE, 'web', 'app.mjs'), 'utf8');
  assert(app.includes('localStorage') && app.includes('new WebSocket') && app.includes('contract-revision-input'), '单页缺草稿/WS/契约修改能力');
  assert(app.includes('renderSingleDetails') && app.includes('renderMultiChoice') && app.includes('decision-detail-stack'), '紧凑问卷缺逐题固定详情槽或多选能力');
  assert(app.includes('true_label') && app.includes('false_label'), 'boolean 无 options 时不读 true_label/false_label');
  assert(app.includes('dossierData?.submissions') && app.includes('renderDossier') && app.includes('markdownBlock(dossierData.context_markdown)'), '提交后没有从权威决策档案回看、缺完整轨迹或上下文仍为原始 Markdown');
  const style = readFileSync(join(HERE, 'web', 'style.css'), 'utf8');
  assert(style.includes('position: sticky') && style.includes('flex-wrap: wrap') && style.includes('max-width: 1180px') && style.includes('.decision-detail-stack'), '紧凑问卷缺 sticky 摘要、pill 换行、阅读宽度上限或逐题固定详情槽');
  assert(style.includes('grid-area: 1 / 1') && style.includes('visibility: hidden'), '详情槽没有通过同格叠放预留最大内容高度');
  assert(app.includes("'/export'") || readFileSync(join(HERE, 'web', 'index.html'), 'utf8').includes('href="/export"'), '页面缺静态导出入口');
  check('薄层依赖、显式调用策略、三级降级、结构化问卷与完整轨迹静态检查');

  const stickyPath = join(issueDir, 'web', '.last-port');
  assert(existsSync(stickyPath) && Number.parseInt(readFileSync(stickyPath, 'utf8').trim(), 10) === serverInfo.port, 'sticky 端口没有落在 <issue>/web/.last-port');
  check('sticky 端口写入 issue 自己的 web/，不再外溢 .aes-workflow');

  const shutdown = await jsonFetch(keyUrl('/shutdown'));
  assert(shutdown.response.status === 200 && shutdown.body?.stopped === true, 'shutdown 没有成功回执');
  for (let attempt = 0; attempt < 50 && !existsSync(join(issueDir, 'web', 'server-stopped')); attempt += 1) await delay(50);
  assert(existsSync(join(issueDir, 'web', 'server-stopped')), 'server-stopped 标记没有写出');
  assert(!existsSync(join(issueDir, 'web', 'server-info')), 'shutdown 后 server-info 仍存在');
  assert(!existsSync(join(issueDir, 'web', '.session-token')), 'shutdown 后 token 文件仍存在');
  check('shutdown 回执、进程收尾与 server-stopped 标记');

  console.log(`${checks}/${checks} passed`);
} catch (error) {
  console.error(`FAIL after ${checks} checks: ${error.stack ?? error.message}`);
  process.exitCode = 1;
} finally {
  if (serverInfo) {
    try { await fetch(keyUrl('/shutdown'), { signal: AbortSignal.timeout(500) }); } catch { /* already stopped */ }
  }
  await delay(80);
  try { rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); }
  catch (error) { console.error(`cleanup warning: ${basename(workDir)}: ${error.message}`); }
}
