#!/usr/bin/env node
// Read-only multi-worktree inventory for orchestrate-worktree-loop-zcode.
// Zero-dependency (Node builtins only). Output: JSON array (always an array).
// Usage: node inspect-worktrees.mjs --paths "D:\wt1,D:\wt2" --integration dev
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const out = { paths: [], integration: 'dev' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--paths') {
      const raw = argv[++i] ?? '';
      for (const candidate of raw.split(/[;,]/)) {
        const trimmed = candidate.trim().replace(/^['"]|['"]$/g, '');
        if (trimmed) out.paths.push(trimmed);
      }
    } else if (a === '--integration') {
      out.integration = argv[++i] ?? out.integration;
    } else if (a === '--help' || a === '-h') {
      process.stdout.write('Usage: node inspect-worktrees.mjs --paths "path1,path2" --integration dev\n');
      process.exit(0);
    }
  }
  if (out.paths.length === 0) {
    process.stderr.write('error: --paths is required\n');
    process.exit(2);
  }
  return out;
}

function git(repo, args, allowFailure = false) {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0 && !allowFailure) {
    throw new Error(`git -C '${repo}' ${args.join(' ')} failed with exit code ${r.status}`);
  }
  return { code: r.status, text: String(r.stdout ?? '').trim() };
}

function inspect(rawPath) {
  const repository = resolve(rawPath);
  const inside = git(repository, ['rev-parse', '--is-inside-work-tree']);
  if (inside.text !== 'true') throw new Error(`Not a Git worktree: ${repository}`);

  const branch = git(repository, ['branch', '--show-current']).text;
  const head = git(repository, ['rev-parse', 'HEAD']).text;
  const upstream = git(repository, ['rev-parse', '--abbrev-ref', '@{upstream}'], true);
  const status = git(repository, ['status', '--porcelain=v1', '--untracked-files=all']).text;
  const lastCommit = git(repository, ['log', '-1', '--pretty=format:%H%x09%s%x09%cI']).text;

  let ahead = null;
  let behind = null;
  if (upstream.code === 0 && upstream.text) {
    const counts = git(repository, ['rev-list', '--left-right', '--count', `${upstream.text}...HEAD`]).text;
    const parts = counts.split(/\s+/);
    if (parts.length >= 2) {
      behind = Number(parts[0]);
      ahead = Number(parts[1]);
    }
  }

  const dirty = status.length > 0;
  const integrationRef = `refs/heads/${integrationBranch}`;
  const integrationExists = git(repository, ['show-ref', '--verify', '--quiet', integrationRef], true).code === 0;
  let headMergedToIntegration = null;
  if (integrationExists) {
    headMergedToIntegration =
      git(repository, ['merge-base', '--is-ancestor', head, integrationRef], true).code === 0;
  }

  const operation = [];
  for (const [marker, label] of [
    ['MERGE_HEAD', 'merge'],
    ['REBASE_HEAD', 'rebase'],
    ['CHERRY_PICK_HEAD', 'cherry-pick'],
  ]) {
    const gitPath = git(repository, ['rev-parse', '--git-path', marker], true);
    if (gitPath.code !== 0 || !gitPath.text) continue;
    // rev-parse may return a path relative to the repo root; resolve it there.
    const abs = isAbsolute(gitPath.text) ? gitPath.text : repository + sep + gitPath.text;
    if (existsSync(abs)) operation.push(label);
  }

  const commitParts = lastCommit.split('\t', 3);
  return {
    path: repository,
    branch: branch || '(detached)',
    head,
    headShort: head.slice(0, Math.min(8, head.length)),
    subject: commitParts.length >= 2 ? commitParts[1] : '',
    committedAt: commitParts.length >= 3 ? commitParts[2] : '',
    dirty,
    changedEntries: dirty ? status.split(/\r?\n/).length : 0,
    upstream: upstream.code === 0 ? upstream.text : null,
    ahead,
    behind,
    integrationBranch,
    integrationExists,
    headMergedToIntegration,
    deliverableMergedToIntegration: dirty ? false : headMergedToIntegration,
    gitOperation: operation.length > 0 ? operation.join(',') : 'none',
  };
}

const { paths, integration: integrationBranch } = parseArgs(process.argv.slice(2));
const rows = [];
const errors = [];
for (const p of paths) {
  try {
    rows.push(inspect(p));
  } catch (err) {
    errors.push({ path: p, error: String(err.message ?? err) });
  }
}
process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
if (errors.length > 0) {
  process.stderr.write(JSON.stringify(errors, null, 2) + '\n');
  process.exit(1);
}
