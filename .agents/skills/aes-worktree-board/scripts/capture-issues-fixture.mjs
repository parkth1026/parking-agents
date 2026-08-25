#!/usr/bin/env node
// 把 GitHub issue 星图保存为可离线复现的页面/collect 测试 fixture。
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadConfig, REPO_ROOT, SKILL_DIR } from './collect.mjs';
import { prepareGithubAccess, runGithubJson } from './github-identity.mjs';

const DEFAULT_OUTPUT = join(SKILL_DIR, 'fixtures', 'aes-agent-issues.json');
const ISSUE_FIELDS = [
  'assignees', 'author', 'blockedBy', 'blocking', 'body', 'closed', 'closedAt',
  'closedByPullRequestsReferences', 'comments', 'createdAt', 'id', 'isPinned',
  'issueType', 'labels', 'milestone', 'number', 'parent', 'state', 'stateReason',
  'subIssues', 'title', 'updatedAt', 'url',
].join(',');

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function ghJson(args, auth) {
  return runGithubJson(args, { auth, cwd: REPO_ROOT, timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
}

async function reopened(issueRepo, number, auth) {
  const pages = await ghJson([
    'api', '--hostname', auth.host, '--paginate', '--slurp', `repos/${issueRepo}/issues/${number}/timeline`,
    '-H', 'Accept: application/vnd.github+json',
  ], auth);
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

function numbers(nodes) {
  return (Array.isArray(nodes) ? nodes : [])
    .map((node) => Number(node.number))
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
}

function issueNumbersDigest(issueNumbers) {
  return createHash('sha256').update(JSON.stringify(issueNumbers)).digest('hex');
}

async function main() {
  const config = loadConfig();
  const issueRepo = option('--repo', config.issueRepo);
  const output = resolve(option('--output', DEFAULT_OUTPUT));
  const auth = await prepareGithubAccess({
    config,
    issueRepo,
    account: option('--account', undefined),
    host: option('--hostname', undefined),
    cwd: REPO_ROOT,
  });
  const listed = await ghJson([
    'issue', 'list', '--repo', issueRepo, '--state', 'all', '--limit', '1000',
    '--json', ISSUE_FIELDS,
  ], auth);
  const closed = listed.filter((issue) => issue.state === 'CLOSED');
  const reopenedFlags = new Map(await mapConcurrent(closed, 6, async (issue) => {
    try {
      return [issue.number, await reopened(issueRepo, issue.number, auth)];
    } catch (error) {
      if (error?.code) throw error;
      return [issue.number, false];
    }
  }));
  const issues = listed
    .map((issue) => {
      const blockedByNumbers = numbers(issue.blockedBy?.nodes);
      const blockingNumbers = numbers(issue.blocking?.nodes);
      const reopenedBeforeClose = Boolean(reopenedFlags.get(issue.number));
      return {
        ...issue,
        blockedByNumbers,
        blockingNumbers,
        reopenedBeforeClose,
        warn: issue.state === 'CLOSED' && reopenedBeforeClose,
      };
    })
    .sort((left, right) => left.number - right.number);
  const fixture = {
    schemaVersion: 1,
    kind: 'github-issue-fixture',
    capturedAt: new Date().toISOString(),
    repo: issueRepo,
    query: { state: 'all', limit: 1000, fields: ISSUE_FIELDS.split(',') },
    issueCount: issues.length,
    integrity: {
      issueCount: issues.length,
      issueNumbers: issues.map((issue) => issue.number),
      issueNumbersSha256: issueNumbersDigest(issues.map((issue) => issue.number)),
    },
    issues,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, output, repo: issueRepo, issueCount: issues.length }));
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.stack || error.message }));
  process.exitCode = 1;
}
