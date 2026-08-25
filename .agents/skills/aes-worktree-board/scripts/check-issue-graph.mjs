#!/usr/bin/env node
// Goal Contract AC-006：联网读取 GitHub 原生 parent / blocked-by 图并 fail closed。
// --issues-fixture 提供同一份完整 issue-list 的可重复离线 seam；默认仍走 gh live。
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';

const pExecFile = promisify(execFile);
const REPO = option('--repo', 'parkth1026/parking-agents');
const ISSUES_FIXTURE = option('--issues-fixture', null);
const failures = [];

const GRAPH_FIELDS = [
  'number', 'title', 'state', 'body', 'labels', 'parent', 'subIssues', 'blockedBy', 'blocking',
].join(',');
const MAP_NUMBER = 5;
const CONTROL_MARKER = '<!-- WAYFINDER-CONTROL-PLANE-2026-08-24 -->';
const ACCEPTANCE_HEADING = '## 验收条件';
const REQUIRED_SUPPLEMENT_ACCEPTANCE = [
  'cursor / inbox',
  'BLOCK 熔断',
  '全局停止',
  'heartbeat / 恢复边界',
];
const IMPLEMENTATION_TITLES = {
  22: 'aes-worktree-board：server /api/dispatch 缺跨源防护，恶意网页可 drive-by 派发 skip-permissions agent',
  24: 'aes-worktree-board：board.config.json 锚在技能目录，issueRepo/mainBranch 与目标仓错配（输入侧 #14）',
  26: 'aes-worktree-board: runtime v3 schema 与原子读写互斥（收编 #25）',
  27: 'aes-worktree-board: Task Registry、worktree 租约与 generation（收编 #23）',
  28: 'aes-worktree-board: 事件 inbox 与 consume/pending 幂等消费',
  29: 'aes-worktree-board: 三维 verdict、15 态状态机与三次 BLOCK 熔断',
  30: 'aes-worktree-board: create_thread preflight 与 cli-fallback 显式授权',
  31: 'aes-worktree-board: 全局停止评估器 stop eval',
  32: 'aes-worktree-board: board.html v3 渲染与 v2 兼容（Map/List 改名）',
  33: 'aes-worktree-board: selftest 编排回归域 orchestration（十场景）',
  34: 'aes-worktree-board: SKILL.md 契约同步与 check-issue-graph 断言脚本',
};
const BACKLOG_TITLES = {
  35: 'aes-worktree-board [backlog]: progress/stall 协议（P1.2）',
  36: 'aes-worktree-board [backlog]: reviewer 临时资源协议（P1.3）',
  37: 'aes-worktree-board [backlog]: 可解释模型路由评分（P1.4）',
  38: 'aes-worktree-board [backlog]: merge handler 固定门禁（P1.5）',
  39: 'aes-worktree-board [backlog]: listener 恢复 automation（P1.6）',
  40: 'aes-worktree-board [backlog]: board 全量状态机展示（P2.1）',
};
const CHILDREN = Object.keys({ ...IMPLEMENTATION_TITLES, ...BACKLOG_TITLES }).map(Number);
const EXPECTED_BLOCKED_BY = {
  22: [26],
  24: [],
  26: [],
  27: [26],
  28: [26],
  29: [27],
  30: [27],
  31: [27, 29],
  32: [26],
  33: [26, 27, 28, 29, 30, 31],
  34: [26, 27, 28, 29, 30, 31, 32, 33],
  35: [27],
  36: [27],
  37: [27],
  38: [29],
  39: [28],
  40: [32],
};

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} 需要参数`);
  return value;
}

function fail(message) {
  failures.push(message);
}

function numbers(connection, fallback) {
  const source = Array.isArray(connection)
    ? connection
    : Array.isArray(connection?.nodes)
      ? connection.nodes
      : Array.isArray(fallback)
        ? fallback
        : [];
  return source
    .map((node) => Number(typeof node === 'object' ? node.number : node))
    .filter(Number.isInteger)
    .sort((left, right) => left - right);
}

function issueNumbers(issue, relation, fallbackKey) {
  return numbers(issue?.[relation], issue?.[fallbackKey]);
}

function labels(issue) {
  return (issue?.labels || [])
    .map((label) => typeof label === 'object' ? label.name : label)
    .filter(Boolean);
}

function sameNumbers(actual, expected) {
  return JSON.stringify(numbers(actual)) === JSON.stringify(numbers(expected));
}

function parseFixture(fixturePath) {
  const path = resolve(fixturePath);
  let payload;
  try {
    payload = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`读取 fixture 失败: ${path}: ${error.message}`, { cause: error });
  }
  if (!payload || Array.isArray(payload) || !Array.isArray(payload.issues) || !payload.issues.length) {
    throw new Error(`fixture 必须是完整 github-issue-fixture 对象且包含非空 issues 数组: ${path}`);
  }
  if (payload.kind !== 'github-issue-fixture') {
    throw new Error(`fixture kind 必须为 github-issue-fixture: ${path}`);
  }
  if (String(payload.repo || '').toLowerCase() !== REPO.toLowerCase()) {
    throw new Error(`fixture repo 与 --repo 不一致: expected ${REPO}, actual ${payload.repo || '<missing>'}`);
  }
  if (Number(payload.issueCount) !== payload.issues.length) {
    throw new Error(`fixture issueCount 不等于 issues 数量: ${payload.issueCount} != ${payload.issues.length}`);
  }
  if (payload.query?.state !== 'all' || Number(payload.query?.limit) < 1000) {
    throw new Error('fixture 必须来自 state=all、limit>=1000 的完整 issue-list 查询');
  }
  const requiredFields = ['body', 'labels', 'parent', 'subIssues', 'blockedBy', 'blocking'];
  const missingFields = requiredFields.filter((field) => !payload.query.fields?.includes(field));
  if (missingFields.length) throw new Error(`fixture 缺少图断言字段: ${missingFields.join(', ')}`);
  return { issues: payload.issues, source: `fixture:${path}` };
}

async function ghJson(args) {
  const { stdout } = await pExecFile('gh', args, {
    ...HEADLESS_CHILD_OPTIONS,
    timeout: 60_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

async function loadIssues() {
  if (ISSUES_FIXTURE) return parseFixture(ISSUES_FIXTURE);
  const issues = await ghJson([
    'issue', 'list', '--repo', REPO, '--state', 'all', '--limit', '1000',
    '--json', GRAPH_FIELDS,
  ]);
  if (!Array.isArray(issues) || !issues.length) throw new Error(`gh 返回空 issue 图: ${REPO}`);
  return { issues, source: 'live:gh issue list' };
}

function inverseDependencies() {
  const inverse = new Map();
  for (const [numberText, blockedBy] of Object.entries(EXPECTED_BLOCKED_BY)) {
    const number = Number(numberText);
    for (const dependency of blockedBy) {
      const list = inverse.get(dependency) || [];
      list.push(number);
      inverse.set(dependency, list);
    }
  }
  return inverse;
}

function assertMap(byNumber) {
  const map = byNumber.get(MAP_NUMBER);
  if (!map) {
    fail('#5 wayfinder map 不存在');
    return;
  }
  if (map.title !== 'aes-worktree-board：改为 Orchestrator Agent + create_thread 的 Issue × Worktree 编排') {
    fail(`#5 标题漂移: ${map.title}`);
  }
  if (map.state !== 'OPEN') fail('#5 必须保持 OPEN，作为 wayfinder 父节点');
  if (!labels(map).includes('wayfinder:map')) fail('#5 缺少 wayfinder:map label');

  const actualChildren = issueNumbers(map, 'subIssues', 'subIssueNumbers');
  if (!sameNumbers(actualChildren, CHILDREN)) {
    fail(`#5 sub-issues 漂移: expected [${CHILDREN.join(',')}], actual [${actualChildren.join(',')}]`);
  }

  const body = String(map.body || '');
  const marker = body.indexOf(CONTROL_MARKER);
  const acceptance = body.indexOf(ACCEPTANCE_HEADING);
  if (marker < 0) fail(`#5 缺少控制面重排追加段 marker: ${CONTROL_MARKER}`);
  if (acceptance < 0) fail(`#5 缺少正文段落: ${ACCEPTANCE_HEADING}`);
  if (marker >= 0 && acceptance >= 0 && marker >= acceptance) {
    fail('#5 控制面追加段必须位于「验收条件」之前');
  }
  const supplement = marker >= 0 && acceptance > marker ? body.slice(marker, acceptance) : '';
  if (!supplement.includes('### 本轮新增验收条目')) fail('#5 控制面追加段缺少「本轮新增验收条目」标题');
  for (const required of REQUIRED_SUPPLEMENT_ACCEPTANCE) {
    if (!supplement.includes(required)) fail(`#5 控制面追加段缺少验收条目: ${required}`);
  }
}

function assertIssueNodes(byNumber) {
  const titles = { ...IMPLEMENTATION_TITLES, ...BACKLOG_TITLES };
  for (const [numberText, title] of Object.entries(titles)) {
    const number = Number(numberText);
    const issue = byNumber.get(number);
    if (!issue) {
      fail(`#${number} 节点不存在: ${title}`);
      continue;
    }
    if (issue.title !== title) fail(`#${number} 标题漂移: ${issue.title}`);
    if (!labels(issue).includes('wayfinder:task')) fail(`#${number} 缺少 wayfinder:task label`);
    const expectedTriage = number <= 34 ? 'ready-for-agent' : 'needs-triage';
    if (!labels(issue).includes(expectedTriage)) fail(`#${number} 缺少 ${expectedTriage} label`);
    if (Number(issue.parent?.number ?? issue.parentNumber) !== MAP_NUMBER) {
      fail(`#${number} 不是 #5 的原生 sub-issue`);
    }
  }
}

function assertDependencies(byNumber) {
  const inverse = inverseDependencies();
  for (const number of [MAP_NUMBER, ...CHILDREN]) {
    const issue = byNumber.get(number);
    if (!issue) {
      fail(`#${number} 缺失，无法检查 blocked-by / blocking 闭合`);
      continue;
    }
    const expectedBlockedBy = EXPECTED_BLOCKED_BY[number] || [];
    const actualBlockedBy = issueNumbers(issue, 'blockedBy', 'blockedByNumbers');
    if (!sameNumbers(actualBlockedBy, expectedBlockedBy)) {
      fail(`#${number} blocked-by 漂移: expected [${expectedBlockedBy.join(',')}], actual [${actualBlockedBy.join(',')}]`);
    }
    if (actualBlockedBy.includes(number)) fail(`#${number} 存在自依赖`);

    const expectedBlocking = inverse.get(number) || [];
    const actualBlocking = issueNumbers(issue, 'blocking', 'blockingNumbers');
    if (!sameNumbers(actualBlocking, expectedBlocking)) {
      fail(`#${number} blocking 反向边未闭合: expected [${expectedBlocking.join(',')}], actual [${actualBlocking.join(',')}]`);
    }
  }
}

function assertIncorporation(byNumber, closedNumber, incorporatedNumber) {
  const closed = byNumber.get(closedNumber);
  const incorporated = byNumber.get(incorporatedNumber);
  if (!closed || closed.state !== 'CLOSED') fail(`#${closedNumber} 必须 CLOSED（已被 #${incorporatedNumber} 收编）`);
  if (!String(closed?.body || '').includes(`#${incorporatedNumber}`)) {
    fail(`#${closedNumber} 正文缺少指向 #${incorporatedNumber} 的收编链接`);
  }
  if (!String(incorporated?.body || '').includes(`#${closedNumber}`)) {
    fail(`#${incorporatedNumber} 正文缺少指向 #${closedNumber} 的反向链接`);
  }
}

function assertGraph(issues) {
  const byNumber = new Map();
  for (const issue of issues) {
    const number = Number(issue.number);
    if (!Number.isInteger(number)) {
      fail(`存在无效 Issue number: ${issue.number}`);
      continue;
    }
    if (byNumber.has(number)) fail(`#${number} 在 issue 图中重复出现`);
    byNumber.set(number, issue);
  }
  assertMap(byNumber);
  assertIssueNodes(byNumber);
  assertDependencies(byNumber);
  assertIncorporation(byNumber, 23, 27);
  assertIncorporation(byNumber, 25, 26);
  for (const bugNumber of [22, 24]) {
    const bug = byNumber.get(bugNumber);
    if (!bug) {
      fail(`#${bugNumber} 控制面 bug 不存在`);
      continue;
    }
    if (Number(bug.parent?.number ?? bug.parentNumber) !== MAP_NUMBER) fail(`#${bugNumber} 未挂到 #5`);
    if (!labels(bug).includes('ready-for-agent')) fail(`#${bugNumber} 缺少 ready-for-agent label`);
    if (!labels(bug).includes('wayfinder:task')) fail(`#${bugNumber} 缺少 wayfinder:task label`);
  }
  return byNumber;
}

try {
  if (process.argv.includes('--help')) {
    console.log('用法: node check-issue-graph.mjs [--repo owner/name] [--issues-fixture path]');
    process.exit(0);
  }
  const { issues, source } = await loadIssues();
  assertGraph(issues);
  if (failures.length) {
    for (const failure of failures) console.error(`[issue-graph] ${failure}`);
    process.exitCode = 1;
  } else {
    const checkedEdges = Object.values(EXPECTED_BLOCKED_BY).reduce((sum, values) => sum + values.length, 0);
    console.log(JSON.stringify({
      ok: true,
      repo: REPO,
      source,
      issueCount: issues.length,
      map: MAP_NUMBER,
      implementationNodes: Object.keys(IMPLEMENTATION_TITLES).length,
      backlogNodes: Object.keys(BACKLOG_TITLES).length,
      incorporatedClosed: [23, 25],
      checkedEdges,
    }));
  }
} catch (error) {
  console.error(`[issue-graph] ${error.stack || error.message}`);
  process.exitCode = 1;
}
