#!/usr/bin/env node
// 主 agent 写入对某个 worktree 的评估结论（正在做什么、是否完成、是否建议合并）。
// 用法：
//   node assess.mjs <worktree> --merge recommend|not-yet|blocked --done true|false|unknown \
//     --task "一句话描述当前任务" --reason "判断依据" [--by claude-main]
// 只更新 status.json 中该节点的 assessment 字段并同步 status.js；事实字段一律不碰。
import { existsSync } from 'node:fs';
import { join } from 'node:path';
// #14: runtime 选址与 collect 同一条 env/cwd 解析链（目标仓根下 .aes-worktree-board/runtime）。
import { RUNTIME_DIR } from './collect.mjs';
import { readJson, withRuntimeLock, writeJsonAtomic, writeTextAtomic } from './runtime-store.mjs';

const STATUS_JSON = join(RUNTIME_DIR, 'status.json');
const STATUS_JS = join(RUNTIME_DIR, 'status.js');

function fail(msg) {
  const error = new Error(msg);
  error.code = 'ASSESS_FAILED';
  throw error;
}
function reject(msg) { console.error(JSON.stringify({ ok: false, error: msg })); process.exit(1); }

const argv = process.argv.slice(2);
const opts = {};
const positional = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith('--')) opts[argv[i].slice(2)] = argv[++i];
  else positional.push(argv[i]);
}
const worktreeArg = positional[0];
if (!worktreeArg) reject('用法: node assess.mjs <worktree> --merge X --done X --task "…" --reason "…"');
if (!existsSync(STATUS_JSON)) reject('status.json 不存在，先运行 node collect.mjs');
if (opts.merge && !['recommend', 'not-yet', 'blocked'].includes(opts.merge)) {
  reject('--merge 只接受 recommend | not-yet | blocked');
}

try {
  const result = withRuntimeLock(RUNTIME_DIR, () => {
    const status = readJson(STATUS_JSON);
    const target = status.worktrees.find(
      (w) => w.name === worktreeArg || w.name.endsWith(`-${worktreeArg}`),
    );
    if (!target) fail(`worktree "${worktreeArg}" 不在 status.json 中，可用: ${status.worktrees.map((w) => w.name).join(', ')}`);

    let merge = opts.merge ?? target.assessment?.merge ?? 'not-yet';
    let reason = opts.reason ?? target.assessment?.reason ?? null;
    if (merge === 'recommend' && target.ahead > 0 && (target.trail?.length || 0) === 0) {
      merge = 'not-yet';
      reason = reason?.includes('需先补 issue') ? reason : `${reason ? `${reason}；` : ''}独立任务分支需先补 issue`;
    }

    target.assessment = {
      currentTask: opts.task ?? target.assessment?.currentTask ?? null,
      done: opts.done === 'true' ? true : opts.done === 'false' ? false : opts.done === 'unknown' ? null : target.assessment?.done ?? null,
      merge,
      reason,
      assessedAt: new Date().toISOString(),
      assessedBy: opts.by ?? 'claude-main',
      stale: false,
    };
    writeJsonAtomic(STATUS_JSON, status);
    writeTextAtomic(STATUS_JS, `window.WORKBOARD = ${JSON.stringify(status)};\n`);
    return { ok: true, worktree: target.name, assessment: target.assessment };
  });
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
}
