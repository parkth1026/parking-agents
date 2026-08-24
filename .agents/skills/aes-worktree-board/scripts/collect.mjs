#!/usr/bin/env node
// 采集同级既有 worktree 与全仓 issue 事实，写入 status.json v2 和 file:// 快照。
// assessment 是主 agent 的判断；采集只保留它并计算 stale，不替 agent 作合并决定。
import { execFile } from 'node:child_process';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';
import { promisify } from 'node:util';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pExecFile = promisify(execFile);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const SKILL_DIR = dirname(SCRIPT_DIR);
// 默认沿用调用方当前目录，显式环境变量可把看板指向另一个同级 worktree 仓库。
// skill 本身可以放在独立的工具仓库中，不再把 skill 目录误当成目标仓库根。
export const REPO_ROOT = resolve(process.env.AES_WORKTREE_BOARD_REPO_ROOT || process.cwd());
export const DEFAULT_RUNTIME_DIR = join(SKILL_DIR, 'runtime');
export const RUNTIME_DIR = resolve(process.env.AES_WORKTREE_BOARD_RUNTIME_DIR || DEFAULT_RUNTIME_DIR);
export const TASKS_DIR = join(RUNTIME_DIR, 'tasks');

function runtimePaths(runtimeDir = RUNTIME_DIR) {
  return {
    runtimeDir,
    tasksDir: join(runtimeDir, 'tasks'),
    statusJson: join(runtimeDir, 'status.json'),
    statusJs: join(runtimeDir, 'status.js'),
  };
}

export function loadConfig() {
  return JSON.parse(readFileSync(join(SKILL_DIR, 'board.config.json'), 'utf8'));
}

async function git(args, opts = {}) {
  const { stdout } = await pExecFile('git', args, {
    ...HEADLESS_CHILD_OPTIONS,
    cwd: REPO_ROOT,
    maxBuffer: 16 * 1024 * 1024,
    ...opts,
  });
  return stdout.replace(/\r\n/g, '\n').trimEnd();
}

function norm(path) {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

function parseWorktreeList(output) {
  const entries = [];
  let current = null;
  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      current = { path: norm(line.slice(9)), branch: null, head: null };
      entries.push(current);
    } else if (current && line.startsWith('HEAD ')) {
      current.head = line.slice(5);
    } else if (current && line.startsWith('branch ')) {
      current.branch = line.slice(7).replace('refs/heads/', '');
    }
  }
  return entries;
}

// 仅保留主仓同级的既有 worktree；Temp、嵌套目录和主仓自身均排除。
export async function listWorktrees() {
  let repoRoot;
  try {
    repoRoot = norm(await git(['rev-parse', '--show-toplevel']));
  } catch (error) {
    throw new Error(`目标仓根不是有效的 Git worktree: ${norm(REPO_ROOT)}`, { cause: error });
  }
  const entries = parseWorktreeList(await git(['worktree', 'list', '--porcelain']));
  const main = entries.find((entry) => entry.path.toLowerCase() === repoRoot.toLowerCase())
    || entries[0];
  if (!main) throw new Error('git worktree list 没有返回主 worktree');
  const mainParent = norm(dirname(main.path)).toLowerCase();
  const siblings = entries.filter((entry) => (
    entry !== main
    && norm(dirname(entry.path)).toLowerCase() === mainParent
    && existsSync(entry.path)
  ));
  return { main, siblings };
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readTasks(runtimeDir = RUNTIME_DIR) {
  const { tasksDir } = runtimePaths(runtimeDir);
  const byWorktree = new Map();
  if (!existsSync(tasksDir)) return byWorktree;
  for (const file of readdirSync(tasksDir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const task = JSON.parse(readFileSync(join(tasksDir, file), 'utf8'));
      if (task.status === 'running' && !pidAlive(task.pid)) task.status = 'stale';
      const list = byWorktree.get(task.worktree) || [];
      list.push(task);
      byWorktree.set(task.worktree, list);
    } catch {
      // 单条损坏的历史记录不能阻塞其余 worktree 巡检。
    }
  }
  for (const list of byWorktree.values()) {
    list.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  }
  return byWorktree;
}

function loadPrevious(runtimeDir) {
  try {
    return JSON.parse(readFileSync(runtimePaths(runtimeDir).statusJson, 'utf8'));
  } catch {
    return null;
  }
}

function extractIssueNumbers(subjects) {
  const numbers = new Set();
  for (const subject of subjects) {
    for (const match of subject.matchAll(/#(\d{1,6})/g)) numbers.add(Number(match[1]));
  }
  return [...numbers];
}

function claimedIssueFrom(activeTask, headSubject) {
  const promptMatch = activeTask?.prompt?.match(/#(\d{1,6})/);
  if (promptMatch) return Number(promptMatch[1]);
  const commitMatch = headSubject.match(/\(#(\d{1,6})\)/);
  return commitMatch ? Number(commitMatch[1]) : null;
}

function parseBlockedBy(body, knownNumbers) {
  const dependencies = new Set();
  for (const line of String(body || '').split(/\r?\n/)) {
    const dependencyLine = /\bblocked\s+by\b|\bdepends?\s+on\b|依赖(?:于)?/i.test(line);
    const taskLine = /^\s*[-*+]\s+\[[ xX]\]/.test(line);
    if (!dependencyLine && !taskLine) continue;
    for (const match of line.matchAll(/#(\d{1,6})/g)) {
      const number = Number(match[1]);
      if (knownNumbers.has(number)) dependencies.add(number);
    }
  }
  return [...dependencies].sort((a, b) => a - b);
}

async function fetchIssueList(issueRepo) {
  const { stdout } = await pExecFile('gh', [
    'issue', 'list', '--repo', issueRepo, '--state', 'all', '--limit', '1000',
    '--json', 'number,title,state,url,body,closedAt,updatedAt',
  ], { ...HEADLESS_CHILD_OPTIONS, timeout: 60_000, maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function timelineHasReopen(issueRepo, number) {
  const { stdout } = await pExecFile('gh', [
    'api', '--paginate', '--slurp', `repos/${issueRepo}/issues/${number}/timeline`,
    '-H', 'Accept: application/vnd.github+json',
  ], { ...HEADLESS_CHILD_OPTIONS, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
  const pages = JSON.parse(stdout);
  return pages.flat().some((event) => event.event === 'reopened');
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function fetchIssueSources(issueRepo, previous) {
  const listed = await fetchIssueList(issueRepo);
  const known = new Set(listed.map((issue) => issue.number));
  const previousWarn = new Map(
    (previous?.graph?.issues || []).map((issue) => [issue.number, Boolean(issue.derived?.warn)]),
  );
  const closed = listed.filter((issue) => issue.state === 'CLOSED');
  const warned = new Map(await mapConcurrent(closed, 6, async (issue) => {
    try {
      return [issue.number, await timelineHasReopen(issueRepo, issue.number)];
    } catch {
      return [issue.number, previousWarn.get(issue.number) || false];
    }
  }));
  return listed.map((issue) => ({
    ...issue,
    blockedBy: parseBlockedBy(issue.body, known).filter((number) => number !== issue.number),
    warn: issue.state === 'CLOSED' && (warned.get(issue.number) || false),
  }));
}

function cachedIssueSources(previous) {
  return (previous?.graph?.issues || []).map((issue) => ({
    number: issue.number,
    title: issue.title,
    state: issue.state,
    url: issue.url,
    blockedBy: [...issue.blockedBy],
    warn: Boolean(issue.derived?.warn),
    closedAt: null,
    updatedAt: null,
  }));
}

async function mergeCheck(mainBranch, branch, ahead) {
  if (!branch) return { result: 'detached', conflictFiles: [] };
  if (ahead === 0) return { result: 'up-to-date', conflictFiles: [] };
  try {
    await git(['merge-tree', '--write-tree', '--name-only', mainBranch, branch]);
    return { result: 'clean', conflictFiles: [] };
  } catch (error) {
    if (error.code === 1) {
      const lines = String(error.stdout || '').replace(/\r\n/g, '\n').split('\n');
      const conflictFiles = [];
      for (const line of lines.slice(1)) {
        if (!line.trim()) break;
        conflictFiles.push(line.trim());
      }
      return { result: 'conflict', conflictFiles };
    }
    return {
      result: 'unknown',
      conflictFiles: [],
      error: String(error.stderr || error.message).slice(0, 200),
    };
  }
}

function assessmentWithStale(previousAssessment, lastCommitAt, worktreeTasks) {
  if (!previousAssessment) return null;
  const evidenceTimes = [lastCommitAt, ...worktreeTasks.map((task) => task.endedAt).filter(Boolean)]
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  const assessedAt = Date.parse(previousAssessment.assessedAt);
  const latestEvidence = evidenceTimes.length ? Math.max(...evidenceTimes) : Number.NEGATIVE_INFINITY;
  return {
    ...previousAssessment,
    stale: !Number.isFinite(assessedAt) || assessedAt < latestEvidence,
  };
}

function buildGraph(sources, claims) {
  const sourceByNumber = new Map(sources.map((issue) => [issue.number, issue]));
  const claimedBy = new Map();
  for (const claim of claims) {
    if (claim.issue && sourceByNumber.has(claim.issue) && !claimedBy.has(claim.issue)) {
      claimedBy.set(claim.issue, claim.worktree);
    }
  }
  const edges = [];
  const edgeKeys = new Set();
  for (const issue of sources) {
    for (const dependency of issue.blockedBy) {
      const key = `${dependency}:${issue.number}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({
        from: dependency,
        to: issue.number,
        satisfied: sourceByNumber.get(dependency)?.state === 'CLOSED',
      });
    }
  }
  const degree = new Map(sources.map((issue) => [issue.number, 0]));
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
  }
  const issues = sources.map((issue) => {
    const worker = claimedBy.get(issue.number) || null;
    const blocked = issue.state === 'OPEN'
      && issue.blockedBy.some((number) => sourceByNumber.get(number)?.state !== 'CLOSED');
    const status = issue.state === 'CLOSED'
      ? 'resolved'
      : worker
        ? 'claimed'
        : blocked
          ? 'blocked'
          : 'frontier';
    return {
      number: issue.number,
      title: issue.title,
      state: issue.state,
      url: issue.url,
      blockedBy: issue.blockedBy,
      claimedBy: worker,
      derived: {
        status,
        degree: degree.get(issue.number) || 0,
        warn: issue.state === 'CLOSED' && Boolean(issue.warn),
      },
    };
  }).sort((a, b) => a.number - b.number);
  edges.sort((a, b) => a.to - b.to || a.from - b.from);
  const stats = {
    total: issues.length,
    open: issues.filter((issue) => issue.state === 'OPEN').length,
    closed: issues.filter((issue) => issue.state === 'CLOSED').length,
    frontier: issues.filter((issue) => issue.derived.status === 'frontier').length,
    edges: edges.length,
    warned: issues.filter((issue) => issue.derived.warn).length,
  };
  return { issues, edges, stats };
}

function buildTrail(issueNumbers, claimedIssue, sourceByNumber, previousTrail = []) {
  const resolved = issueNumbers
    .filter((number) => sourceByNumber.get(number)?.state === 'CLOSED')
    .sort((a, b) => {
      const left = Date.parse(sourceByNumber.get(a)?.closedAt || '') || 0;
      const right = Date.parse(sourceByNumber.get(b)?.closedAt || '') || 0;
      return left - right || a - b;
    });
  const base = resolved.length
    ? resolved
    : previousTrail.filter((number) => sourceByNumber.get(number)?.state === 'CLOSED');
  if (claimedIssue && !base.includes(claimedIssue)) base.push(claimedIssue);
  return [...new Set(base)];
}

export async function collectStatus({ skipGh = false, runtimeDir = RUNTIME_DIR } = {}) {
  const config = loadConfig();
  const { main, siblings } = await listWorktrees();
  const previous = loadPrevious(runtimeDir);
  const previousWorktrees = new Map((previous?.worktrees || []).map((worker) => [worker.name, worker]));
  const tasks = readTasks(runtimeDir);
  const mainHead = await git(['rev-parse', '--short', config.mainBranch]);

  let issueSources;
  if (skipGh) {
    issueSources = cachedIssueSources(previous);
  } else {
    try {
      issueSources = await fetchIssueSources(config.issueRepo, previous);
    } catch (error) {
      issueSources = cachedIssueSources(previous);
      if (!issueSources.length) {
        console.error(`gh issue 采集不可用且没有快照可沿用: ${String(error.message).slice(0, 200)}`);
      }
    }
  }
  const sourceByNumber = new Map(issueSources.map((issue) => [issue.number, issue]));

  const facts = await Promise.all(siblings.map(async (entry) => {
    const name = basename(entry.path);
    const head = await git(['-C', entry.path, 'rev-parse', '--short', 'HEAD']);
    const headSubject = await git(['-C', entry.path, 'log', '-1', '--format=%s']);
    const lastCommitAt = await git(['-C', entry.path, 'log', '-1', '--format=%cI']);
    let ahead = 0;
    let behind = 0;
    if (entry.branch) {
      const counts = await git(['rev-list', '--left-right', '--count', `${entry.branch}...${config.mainBranch}`]);
      [ahead, behind] = counts.split(/\s+/).map(Number);
    }
    const statusOutput = await git(['-C', entry.path, 'status', '--porcelain']);
    const statusLines = statusOutput ? statusOutput.split('\n') : [];
    const dirty = {
      modified: statusLines.filter((line) => !line.startsWith('??')).length,
      untracked: statusLines.filter((line) => line.startsWith('??')).length,
    };
    let subjects = [];
    if (entry.branch && ahead > 0) {
      subjects = (await git(['log', `${config.mainBranch}..${entry.branch}`, '--format=%s'])).split('\n');
    }
    const issueNumbers = extractIssueNumbers(subjects.filter(Boolean));
    const worktreeTasks = tasks.get(name) || [];
    const activeTask = worktreeTasks.find((task) => task.status === 'running') || null;
    const claimedIssue = claimedIssueFrom(activeTask, headSubject);
    return {
      name,
      path: norm(entry.path),
      branch: entry.branch,
      head,
      headSubject,
      lastCommitAt,
      ahead,
      behind,
      dirty,
      issueNumbers,
      claimedIssue,
      mergeCheck: await mergeCheck(config.mainBranch, entry.branch, ahead),
      assessment: assessmentWithStale(previousWorktrees.get(name)?.assessment, lastCommitAt, worktreeTasks),
      activeTask,
      recentTasks: worktreeTasks.filter((task) => task.status !== 'running').slice(0, 5),
    };
  }));

  const graph = buildGraph(issueSources, facts.map((worker) => ({
    issue: worker.claimedIssue,
    worktree: worker.name,
  })));
  const worktrees = facts.map((worker) => {
    const previousWorker = previousWorktrees.get(worker.name);
    const hasPosition = worker.claimedIssue && sourceByNumber.has(worker.claimedIssue);
    return {
      name: worker.name,
      path: worker.path,
      branch: worker.branch,
      head: worker.head,
      headSubject: worker.headSubject,
      lastCommitAt: worker.lastCommitAt,
      ahead: worker.ahead,
      behind: worker.behind,
      dirty: worker.dirty,
      mode: worker.activeTask ? 'running' : hasPosition ? 'manual' : 'idle',
      position: hasPosition ? { kind: 'issue', issue: worker.claimedIssue } : { kind: 'none' },
      trail: buildTrail(
        worker.issueNumbers,
        hasPosition ? worker.claimedIssue : null,
        sourceByNumber,
        skipGh ? previousWorker?.trail || [] : [],
      ),
      mergeCheck: worker.mergeCheck,
      assessment: worker.assessment,
      activeTask: worker.activeTask,
      recentTasks: worker.recentTasks,
    };
  });
  const status = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    repo: {
      root: norm(main.path),
      name: basename(main.path),
      mainBranch: config.mainBranch,
      mainHead,
      issueRepo: config.issueRepo,
    },
    graph,
    worktrees,
  };
  const paths = runtimePaths(runtimeDir);
  mkdirSync(paths.tasksDir, { recursive: true });
  writeFileSync(paths.statusJson, `${JSON.stringify(status, null, 2)}\n`);
  writeFileSync(paths.statusJs, `window.WORKBOARD = ${JSON.stringify(status)};\n`);
  return status;
}

function positionLabel(worker) {
  if (worker.position.kind === 'none') return '未在场';
  return `#${worker.position.issue} ${worker.mode === 'running' ? '运行中' : '手动推进'}`;
}

if (norm(process.argv[1] || '') === norm(fileURLToPath(import.meta.url))) {
  const skipGh = process.argv.includes('--no-gh');
  const status = await collectStatus({ skipGh });
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    const stats = status.graph.stats;
    console.log(
      `图谱: ${stats.total} issue (${stats.open} OPEN / ${stats.closed} CLOSED)`
      + ` · frontier ${stats.frontier} · 依赖边 ${stats.edges} · ⚠回归 ${stats.warned}`,
    );
    for (const worker of status.worktrees) {
      const assessment = worker.assessment
        ? ` · ${worker.assessment.merge}: ${worker.assessment.reason}`
        : '';
      console.log(
        `${worker.name}  ${worker.branch ?? '(detached)'}@${worker.head}`
        + `  +${worker.ahead}/-${worker.behind}`
        + `  dirty:${worker.dirty.modified}+${worker.dirty.untracked}?`
        + `  ${positionLabel(worker)}  merge:${worker.mergeCheck.result}${assessment}`,
      );
    }
    console.log(`\n已写入 ${runtimePaths().statusJson}`);
  }
}
