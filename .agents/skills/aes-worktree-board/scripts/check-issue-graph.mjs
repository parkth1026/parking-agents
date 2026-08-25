#!/usr/bin/env node
// Goal Contract AC-006：联网读取 GitHub 原生 parent / blocked-by 图并 fail closed。
// --issues-fixture 提供同一份完整 issue-list 的可重复离线 seam；默认仍走 gh live。
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, REPO_ROOT } from './collect.mjs';
import { prepareGithubAccess, runGithubJson } from './github-identity.mjs';

const REPO = option('--repo', 'parkth1026/parking-agents');
const ISSUES_FIXTURE = option('--issues-fixture', null);
const failures = [];

const FIXTURE_ISSUE_COUNT = 45;
const FIXTURE_ISSUE_NUMBERS = Object.freeze(Array.from({ length: FIXTURE_ISSUE_COUNT }, (_, index) => index + 1));
const FIXTURE_ISSUE_NUMBERS_SHA256 = 'ab6cf16b6160344f12d9a043415b4c216d7825c1578152f2904de281e82d22bc';
const REQUIRED_ISSUE_FIELDS = ['number', 'title', 'state', 'body', 'labels', 'parent', 'subIssues', 'blockedBy', 'blocking'];
const REQUIRED_LABEL_FIELDS = ['id', 'name', 'description', 'color'];
const REQUIRED_RELATION_NODE_FIELDS = ['id', 'number', 'state', 'title', 'url'];
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

function hasOwn(value, field) {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function issueNumbersDigest(issueNumbers) {
  return createHash('sha256').update(JSON.stringify(issueNumbers)).digest('hex');
}

function validateStringField(owner, field, label, errors) {
  if (!hasOwn(owner, field)) {
    errors.push(`${label} 缺少字段: ${field}`);
  } else if (typeof owner[field] !== 'string') {
    errors.push(`${label}.${field} 类型错误: expected string`);
  }
}

function validateRelationNode(value, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} 结构错误: expected object`);
    return;
  }
  for (const field of REQUIRED_RELATION_NODE_FIELDS) {
    if (!hasOwn(value, field)) {
      errors.push(`${label} 缺少字段: ${field}`);
      continue;
    }
    if (field === 'number') {
      if (!Number.isInteger(value[field]) || value[field] < 1) errors.push(`${label}.number 类型错误: expected positive integer`);
    } else if (field === 'state' && !['OPEN', 'CLOSED'].includes(value[field])) {
      errors.push(`${label}.state 类型错误: expected OPEN or CLOSED`);
    } else if (typeof value[field] !== 'string') {
      errors.push(`${label}.${field} 类型错误: expected string`);
    }
  }
}

function validateRelation(value, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} 结构错误: expected object`);
    return;
  }
  if (!hasOwn(value, 'nodes')) errors.push(`${label} 缺少字段: nodes`);
  if (!hasOwn(value, 'totalCount')) errors.push(`${label} 缺少字段: totalCount`);
  if (!Array.isArray(value.nodes)) {
    if (hasOwn(value, 'nodes')) errors.push(`${label}.nodes 类型错误: expected array`);
  } else {
    for (const [index, node] of value.nodes.entries()) validateRelationNode(node, `${label}.nodes[${index}]`, errors);
  }
  if (hasOwn(value, 'totalCount') && (!Number.isInteger(value.totalCount) || value.totalCount < 0)) {
    errors.push(`${label}.totalCount 类型错误: expected non-negative integer`);
  }
  if (Array.isArray(value.nodes) && Number.isInteger(value.totalCount) && value.totalCount !== value.nodes.length) {
    errors.push(`${label}.totalCount 不等于 nodes 数量: ${value.totalCount} != ${value.nodes.length}`);
  }
}

function validateIssueShape(issue, index, errors) {
  const label = isRecord(issue) && Number.isInteger(issue.number) ? `#${issue.number}` : `issues[${index}]`;
  if (!isRecord(issue)) {
    errors.push(`${label} 类型错误: expected object`);
    return;
  }
  for (const field of REQUIRED_ISSUE_FIELDS) {
    if (!hasOwn(issue, field)) errors.push(`${label} 缺少字段: ${field}`);
  }
  if (hasOwn(issue, 'number') && (!Number.isInteger(issue.number) || issue.number < 1)) {
    errors.push(`${label}.number 类型错误: expected positive integer`);
  }
  validateStringField(issue, 'title', label, errors);
  validateStringField(issue, 'body', label, errors);
  if (hasOwn(issue, 'state') && !['OPEN', 'CLOSED'].includes(issue.state)) {
    errors.push(`${label}.state 类型错误: expected OPEN or CLOSED`);
  }
  if (hasOwn(issue, 'labels')) {
    if (!Array.isArray(issue.labels)) {
      errors.push(`${label}.labels 类型错误: expected array`);
    } else {
      for (const [labelIndex, issueLabel] of issue.labels.entries()) {
        const labelName = `${label}.labels[${labelIndex}]`;
        if (!isRecord(issueLabel)) {
          errors.push(`${labelName} 类型错误: expected object`);
          continue;
        }
        for (const field of REQUIRED_LABEL_FIELDS) validateStringField(issueLabel, field, labelName, errors);
      }
    }
  }
  for (const field of ['subIssues', 'blockedBy', 'blocking']) {
    if (hasOwn(issue, field)) validateRelation(issue[field], `${label}.${field}`, errors);
  }
  if (hasOwn(issue, 'parent') && issue.parent !== null) validateRelationNode(issue.parent, `${label}.parent`, errors);
}

function sortedIssueNumbers(issues) {
  return issues
    .map((issue) => issue?.number)
    .filter((number) => Number.isInteger(number))
    .sort((left, right) => left - right);
}

function numberSetDifference(expected, actual) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((number) => !actualSet.has(number)),
    extra: actual.filter((number, index) => !expectedSet.has(number) || actual.indexOf(number) !== index),
  };
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
  const integrityErrors = [];
  if (payload.issueCount !== FIXTURE_ISSUE_COUNT) {
    integrityErrors.push(`fixture issueCount 必须锁定为 ${FIXTURE_ISSUE_COUNT}: actual ${payload.issueCount}`);
  }
  if (payload.issues.length !== FIXTURE_ISSUE_COUNT) {
    integrityErrors.push(`fixture issueCount/实际 issues 数量不一致: declared ${payload.issueCount}, actual ${payload.issues.length}`);
  }
  const actualIssueNumbers = sortedIssueNumbers(payload.issues);
  const numberDifference = numberSetDifference(FIXTURE_ISSUE_NUMBERS, actualIssueNumbers);
  if (numberDifference.missing.length) integrityErrors.push(`fixture 缺失锁定 Issue: ${numberDifference.missing.map((number) => `#${number}`).join(', ')}`);
  if (numberDifference.extra.length) integrityErrors.push(`fixture 存在未知/重复 Issue: ${numberDifference.extra.map((number) => `#${number}`).join(', ')}`);
  if (issueNumbersDigest(actualIssueNumbers) !== FIXTURE_ISSUE_NUMBERS_SHA256) {
    integrityErrors.push('fixture 实际 Issue 集合 digest 不匹配锁定 Issue 集合');
  }
  if (!isRecord(payload.integrity)) {
    integrityErrors.push('fixture 缺少 integrity metadata');
  } else {
    if (payload.integrity.issueCount !== FIXTURE_ISSUE_COUNT) {
      integrityErrors.push(`fixture integrity.issueCount 必须锁定为 ${FIXTURE_ISSUE_COUNT}: actual ${payload.integrity.issueCount}`);
    }
    if (!Array.isArray(payload.integrity.issueNumbers)) {
      integrityErrors.push('fixture integrity.issueNumbers 类型错误: expected array');
    } else if (payload.integrity.issueNumbers.some((number) => !Number.isInteger(number))) {
      integrityErrors.push('fixture integrity.issueNumbers 类型错误: expected integer array');
    } else if (!sameNumbers(payload.integrity.issueNumbers, FIXTURE_ISSUE_NUMBERS)) {
      integrityErrors.push('fixture integrity.issueNumbers 不匹配锁定 Issue 集合');
    }
    if (payload.integrity.issueNumbersSha256 !== FIXTURE_ISSUE_NUMBERS_SHA256) {
      integrityErrors.push('fixture integrity.issueNumbersSha256 不匹配锁定 Issue 集合');
    }
  }
  if (payload.query?.state !== 'all' || Number(payload.query?.limit) < 1000) {
    integrityErrors.push('fixture 必须来自 state=all、limit>=1000 的完整 issue-list 查询');
  }
  const requiredFields = ['body', 'labels', 'parent', 'subIssues', 'blockedBy', 'blocking'];
  const missingFields = requiredFields.filter((field) => !payload.query.fields?.includes(field));
  if (missingFields.length) integrityErrors.push(`fixture 缺少图断言字段: ${missingFields.join(', ')}`);
  for (const [index, issue] of payload.issues.entries()) validateIssueShape(issue, index, integrityErrors);
  if (integrityErrors.length) throw new Error(`fixture 完整性失败:\n${integrityErrors.map((error) => `- ${error}`).join('\n')}`);
  return { issues: payload.issues, source: `fixture:${path}` };
}

async function loadIssues() {
  if (ISSUES_FIXTURE) return parseFixture(ISSUES_FIXTURE);
  const config = loadConfig();
  const auth = await prepareGithubAccess({
    config,
    issueRepo: REPO,
    account: option('--account', undefined),
    host: option('--hostname', undefined),
    cwd: REPO_ROOT,
  });
  const issues = await runGithubJson([
    'issue', 'list', '--repo', REPO, '--state', 'all', '--limit', '1000',
    '--json', GRAPH_FIELDS,
  ], { auth, cwd: REPO_ROOT, timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
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
