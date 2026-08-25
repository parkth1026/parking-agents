#!/usr/bin/env node
// 在指定同级 worktree 启动 headless agent；prompt 只经 stdin 进入 agent。
// PID 锁、任务三件套与干净 worktree 的成功输出保持 v1 兼容。
import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync, mkdirSync, openSync, readFileSync, unlinkSync,
} from 'node:fs';
import { join, resolve, sep } from 'node:path';
import {
  collectStatus, listWorktrees, loadConfig, REPO_ROOT, RUNTIME_DIR, TASKS_DIR,
} from './collect.mjs';
import { resolveCommand } from './command.mjs';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';
import { githubIdentityPrompt, prepareGithubAccess } from './github-identity.mjs';
import {
  completeFallbackDispatch, markFallbackStarted, registerFallbackDispatch,
} from './orchestrate.mjs';
import { withRuntimeLock, writeJsonAtomic, writeTextAtomic } from './runtime-store.mjs';

function fail(error, exitCode = 1, extra = {}) {
  if (registered && taskId) {
    try {
      completeFallbackDispatch(taskId, { exitCode, preflightFailure: true, error });
    } catch {
      // 原始 preflight 错误优先；registry 若已由其他路径收敛则保持其结果。
    }
  }
  console.error(JSON.stringify({ ok: false, error, ...extra }));
  process.exit(exitCode);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { input += chunk; });
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

const argv = process.argv.slice(2);
let agentName = null;
let taskId = null;
let promptFile = null;
let promptStdin = false;
let deletePromptFile = false;
let confirmDirty = false;
let fallbackAuthorized = null;
let githubAccess = false;
let githubAccount = null;
let githubHost = null;
let registered = false;
const positional = [];
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === '--agent') agentName = argv[++index];
  else if (argv[index] === '--task-id') taskId = argv[++index];
  else if (argv[index] === '--prompt-file') promptFile = argv[++index];
  else if (argv[index] === '--prompt-stdin') promptStdin = true;
  else if (argv[index] === '--delete-prompt-file') deletePromptFile = true;
  else if (argv[index] === '--confirm-dirty') confirmDirty = true;
  else if (argv[index] === '--fallback-authorized') fallbackAuthorized = argv[++index];
  else if (argv[index] === '--github-access') githubAccess = true;
  else if (argv[index] === '--github-account') githubAccount = argv[++index];
  else if (argv[index] === '--github-host') githubHost = argv[++index];
  else if (argv[index] === '--registered') registered = true;
  else positional.push(argv[index]);
}
const worktreeArg = positional.shift();
if (!worktreeArg) {
  fail('用法: node dispatch.mjs <worktree> [--agent X] [--confirm-dirty] [--prompt-file f] [prompt...]', 1, { code: 'BAD_REQUEST' });
}

const config = loadConfig();
agentName = agentName || config.defaultAgent;
const agentArgv = config.agents[agentName];
if (!agentArgv) {
  fail(`未知 agent "${agentName}"，可用: ${Object.keys(config.agents).join(', ')}`, 1, { code: 'BAD_REQUEST' });
}
if (agentName !== 'test' && !fallbackAuthorized) {
  fail('cli-fallback 需显式授权：加 --fallback-authorized "<用户原话>"；正常路径是 Desktop create_thread。', 2, {
    code: 'FALLBACK_AUTH_REQUIRED',
  });
}
const rawPrompt = promptStdin
  ? await readStdin()
  : promptFile
    ? readFileSync(promptFile, 'utf8')
    : positional.join(' ');
if (deletePromptFile && promptFile) {
  const requestRoot = resolve(RUNTIME_DIR, '.requests');
  const requestPath = resolve(promptFile);
  withRuntimeLock(RUNTIME_DIR, () => {
    if (requestPath.startsWith(`${requestRoot}${sep}`) && existsSync(requestPath)) unlinkSync(requestPath);
  });
}
if (!rawPrompt.trim()) fail('prompt 为空：请以位置参数、stdin 或 --prompt-file 提供任务内容', 1, { code: 'BAD_REQUEST' });

// 真实 fallback agent 默认需要显式绑定 GitHub viewer；test agent 只有在
// --github-access 下才走这条边界，保持离线 selftest 的假 agent 不触网。
const requiresGithub = agentName !== 'test' || githubAccess;
let githubAuth = null;
if (requiresGithub) {
  try {
    githubAuth = await prepareGithubAccess({
      config,
      issueRepo: config.issueRepo,
      account: githubAccount,
      host: githubHost,
      cwd: REPO_ROOT,
    });
  } catch (error) {
    fail(error.message, error.exitCode || 2, { code: error.code || 'NETWORK_FAILURE', ...(error.details || {}) });
  }
}
const prompt = `${rawPrompt}${githubIdentityPrompt(githubAuth)}`;

const { siblings } = await listWorktrees();
const target = siblings.find((entry) => {
  const name = entry.path.split('/').pop();
  return name === worktreeArg || name.endsWith(`-${worktreeArg}`);
});
if (!target) {
  fail(
    `worktree "${worktreeArg}" 不在同级列表中，可用: ${siblings.map((entry) => entry.path.split('/').pop()).join(', ')}`,
    1,
    { code: 'BAD_REQUEST' },
  );
}
const targetName = target.path.split('/').pop();

const statusOutput = execFileSync('git', ['-C', target.path, 'status', '--porcelain'], {
  ...HEADLESS_CHILD_OPTIONS,
  encoding: 'utf8',
})
  .replace(/\r\n/g, '\n').trimEnd();
const statusLines = statusOutput ? statusOutput.split('\n') : [];
const dirty = {
  modified: statusLines.filter((line) => !line.startsWith('??')).length,
  untracked: statusLines.filter((line) => line.startsWith('??')).length,
};
if (!confirmDirty && dirty.modified + dirty.untracked > 0) {
  fail('dirty_confirm_required', 3, {
    code: 'DIRTY',
    dirty,
    hint: '该 worktree 可能有人正在干活；加 --confirm-dirty 重试即执行',
  });
}

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
taskId = taskId || `${targetName.replace(/^.*-(dev\d+)$/, '$1')}-${stamp}`;
mkdirSync(TASKS_DIR, { recursive: true });
const taskJsonPath = join(TASKS_DIR, `${taskId}.json`);
const logPath = join(TASKS_DIR, `${taskId}.log`);
const promptPath = join(TASKS_DIR, `${taskId}.prompt.txt`);
if (existsSync(taskJsonPath)) fail(`任务 id 已存在: ${taskId}`, 1, { code: 'BAD_REQUEST' });

let finalArgv;
try {
  finalArgv = resolveCommand(agentArgv);
} catch (error) {
  fail(error.message, 1, { code: 'BAD_REQUEST' });
}
if (!registered) {
  try {
    registerFallbackDispatch({
      worktree: targetName, taskId, agent: agentName, prompt, fallbackAuthorized,
    });
  } catch (error) {
    fail(error.message, error.exitCode || 1, { code: error.code || 'INTERNAL', ...(error.details || {}) });
  }
}
withRuntimeLock(RUNTIME_DIR, () => writeTextAtomic(promptPath, prompt));
const logFd = openSync(logPath, 'a');
const child = spawn(finalArgv[0], finalArgv.slice(1), {
  ...HEADLESS_CHILD_OPTIONS,
  cwd: target.path,
  stdio: ['pipe', logFd, logFd],
  env: { ...(githubAuth?.env || process.env), FORCE_COLOR: '0', NO_COLOR: '1' },
});
const task = {
  id: taskId,
  worktree: targetName,
  path: target.path,
  agent: agentName,
  prompt: prompt.length > 500 ? `${prompt.slice(0, 500)}…` : prompt,
  promptFile: promptPath,
  log: logPath,
  status: 'starting',
  pid: child.pid,
  startedAt: new Date().toISOString(),
  endedAt: null,
  exitCode: null,
};
let childSettled = false;
let agentStarted = false;

function settleSpawnFailure(error) {
  if (childSettled) return;
  childSettled = true;
  task.status = 'failed';
  task.endedAt = new Date().toISOString();
  task.error = String(error.message).slice(0, 300);
  withRuntimeLock(RUNTIME_DIR, () => writeJsonAtomic(taskJsonPath, task));
  completeFallbackDispatch(taskId, {
    exitCode: 1, preflightFailure: !agentStarted, error: task.error,
  });
  console.error(JSON.stringify({ ok: false, taskId, error: task.error }));
  process.exitCode = 1;
}

child.once('error', settleSpawnFailure);

child.once('close', async (code) => {
  if (childSettled) return;
  childSettled = true;
  task.status = code === 0 ? 'done' : 'failed';
  task.exitCode = code;
  task.endedAt = new Date().toISOString();
  withRuntimeLock(RUNTIME_DIR, () => writeJsonAtomic(taskJsonPath, task));
  completeFallbackDispatch(taskId, { exitCode: code });
  try {
    await collectStatus({ skipGh: true });
  } catch {
    // 快照刷新失败不改写 headless 任务的真实退出状态。
  }
  console.log(JSON.stringify({ ok: code === 0, taskId, exitCode: code, log: logPath }));
  process.exitCode = code === 0 ? 0 : 1;
});

if (!Number.isInteger(child.pid) || child.pid <= 0) {
  // Windows spawn ENOENT 异步发 error；等待统一 settlement，不能先伪造 executing。
} else {
  task.status = 'running';
  withRuntimeLock(RUNTIME_DIR, () => writeJsonAtomic(taskJsonPath, task));
  try {
    markFallbackStarted(taskId, child.pid);
    agentStarted = true;
  } catch (error) {
    child.kill();
    settleSpawnFailure(error);
  }
  if (agentStarted) {
    console.log(JSON.stringify({ ok: true, taskId, worktree: targetName, pid: child.pid, log: logPath }));
    child.stdin.write(prompt);
    child.stdin.end();
  }
}
