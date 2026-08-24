#!/usr/bin/env node
// Goal Contract AC-006：联网读取 GitHub 原生 parent / blocked-by 图并 fail closed。
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';

const pExecFile = promisify(execFile);
const repoIndex = process.argv.indexOf('--repo');
const REPO = repoIndex >= 0 ? process.argv[repoIndex + 1] : 'parkth1026/parking-agents';
const failures = [];

function fail(message) { failures.push(message); }
function numbers(connection) { return (connection?.nodes || []).map((node) => Number(node.number)).sort((a, b) => a - b); }
function labels(issue) { return (issue.labels || []).map((label) => label.name); }
function sameNumbers(actual, expected) {
  return JSON.stringify([...actual].sort((a, b) => a - b)) === JSON.stringify([...expected].sort((a, b) => a - b));
}

async function ghJson(args) {
  const { stdout } = await pExecFile('gh', args, {
    ...HEADLESS_CHILD_OPTIONS,
    timeout: 60_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

if (!REPO) {
  console.error('用法: node check-issue-graph.mjs [--repo owner/name]');
  process.exit(2);
}

try {
  const listed = await ghJson([
    'issue', 'list', '--repo', REPO, '--state', 'all', '--limit', '300',
    '--json', 'number,title,state,body,labels,parent,blockedBy,blocking',
  ]);
  const byNumber = new Map(listed.map((issue) => [Number(issue.number), issue]));
  const titleByNumber = {
    26: 'aes-worktree-board: runtime v3 schema 与原子读写互斥（收编 #25）',
    27: 'aes-worktree-board: Task Registry、worktree 租约与 generation（收编 #23）',
    28: 'aes-worktree-board: 事件 inbox 与 consume/pending 幂等消费',
    29: 'aes-worktree-board: 三维 verdict、15 态状态机与三次 BLOCK 熔断',
    30: 'aes-worktree-board: create_thread preflight 与 cli-fallback 显式授权',
    31: 'aes-worktree-board: 全局停止评估器 stop eval',
    32: 'aes-worktree-board: board.html v3 渲染与 v2 兼容（Map/List 改名）',
    33: 'aes-worktree-board: selftest 编排回归域 orchestration（十场景）',
    34: 'aes-worktree-board: SKILL.md 契约同步与 check-issue-graph 断言脚本',
    35: 'aes-worktree-board [backlog]: progress/stall 协议（P1.2）',
    36: 'aes-worktree-board [backlog]: reviewer 临时资源协议（P1.3）',
    37: 'aes-worktree-board [backlog]: 可解释模型路由评分（P1.4）',
    38: 'aes-worktree-board [backlog]: merge handler 固定门禁（P1.5）',
    39: 'aes-worktree-board [backlog]: listener 恢复 automation（P1.6）',
    40: 'aes-worktree-board [backlog]: board 全量状态机展示（P2.1）',
  };
  const dependencies = {
    22: [26], 24: [], 26: [], 27: [26], 28: [26], 29: [27], 30: [27],
    31: [27, 29], 32: [26], 33: [26, 27, 28, 29, 30, 31],
    34: [26, 27, 28, 29, 30, 31, 32, 33],
    35: [27], 36: [27], 37: [27], 38: [29], 39: [28], 40: [32],
  };
  const children = [22, 24, ...Object.keys(titleByNumber).map(Number)];

  const map = byNumber.get(5);
  if (!map) fail('#5 wayfinder map 不存在');
  else {
    if (map.state !== 'OPEN') fail('#5 必须保持 OPEN，作为 wayfinder 父节点');
    if (!labels(map).includes('wayfinder:map')) fail('#5 缺少 wayfinder:map label');
    const marker = map.body.indexOf('WAYFINDER-CONTROL-PLANE-2026-08-24');
    const acceptance = map.body.indexOf('## 验收条件');
    if (marker < 0) fail('#5 缺少控制面重排追加段 marker');
    if (acceptance < 0 || marker >= acceptance) fail('#5 控制面追加段必须位于「验收条件」之前');
    const supplement = marker >= 0 && acceptance > marker ? map.body.slice(marker, acceptance) : '';
    for (const required of ['cursor / inbox', 'BLOCK 熔断', '全局停止', 'heartbeat / 恢复边界']) {
      if (!supplement.includes(required)) fail(`#5 控制面追加段缺少验收条目: ${required}`);
    }
  }

  for (const [numberText, title] of Object.entries(titleByNumber)) {
    const number = Number(numberText);
    const issue = byNumber.get(number);
    if (!issue) { fail(`#${number} 节点不存在: ${title}`); continue; }
    if (issue.title !== title) fail(`#${number} 标题漂移: ${issue.title}`);
    if (!labels(issue).includes('wayfinder:task')) fail(`#${number} 缺少 wayfinder:task label`);
    const expectedTriage = number <= 34 ? 'ready-for-agent' : 'needs-triage';
    if (!labels(issue).includes(expectedTriage)) fail(`#${number} 缺少 ${expectedTriage} label`);
  }

  for (const number of children) {
    const issue = byNumber.get(number);
    if (!issue) { fail(`#${number} 缺失，无法检查 parent`); continue; }
    if (Number(issue.parent?.number) !== 5) fail(`#${number} 不是 #5 的原生 sub-issue`);
  }

  for (const [numberText, expected] of Object.entries(dependencies)) {
    const number = Number(numberText);
    const issue = byNumber.get(number);
    if (!issue) continue;
    const actual = numbers(issue.blockedBy);
    if (!sameNumbers(actual, expected)) fail(`#${number} blocked-by 漂移: expected [${expected}], actual [${actual}]`);
    if (actual.includes(number)) fail(`#${number} 存在自依赖`);
  }

  for (const [closedNumber, incorporatedNumber] of [[23, 27], [25, 26]]) {
    const closed = byNumber.get(closedNumber);
    const incorporated = byNumber.get(incorporatedNumber);
    if (!closed || closed.state !== 'CLOSED') fail(`#${closedNumber} 必须 CLOSED（已被 #${incorporatedNumber} 收编）`);
    if (!closed?.body.includes(`#${incorporatedNumber}`)) fail(`#${closedNumber} 正文缺少指向 #${incorporatedNumber} 的收编链接`);
    if (!incorporated?.body.includes(`#${closedNumber}`)) fail(`#${incorporatedNumber} 正文缺少指向 #${closedNumber} 的反向链接`);
  }

  for (const bugNumber of [22, 24]) {
    const bug = byNumber.get(bugNumber);
    if (!bug) fail(`#${bugNumber} 控制面 bug 不存在`);
    else {
      if (Number(bug.parent?.number) !== 5) fail(`#${bugNumber} 未挂到 #5`);
      if (!labels(bug).includes('ready-for-agent')) fail(`#${bugNumber} 缺少 ready-for-agent label`);
      if (!labels(bug).includes('wayfinder:task')) fail(`#${bugNumber} 缺少 wayfinder:task label`);
    }
  }

  if (failures.length) {
    for (const failure of failures) console.error(`[issue-graph] ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      ok: true, repo: REPO, map: 5, implementationNodes: 11, backlogNodes: 6,
      incorporatedClosed: [23, 25], checkedEdges: Object.values(dependencies).reduce((sum, values) => sum + values.length, 0),
    }));
  }
} catch (error) {
  console.error(`[issue-graph] 读取 GitHub 图失败: ${error.stack || error.message}`);
  process.exitCode = 1;
}
