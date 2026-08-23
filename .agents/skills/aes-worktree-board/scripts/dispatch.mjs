#!/usr/bin/env node
// 在指定同级 worktree 启动 headless agent；prompt 只经 stdin 进入 agent。
// PID 锁、任务三件套与干净 worktree 的成功输出保持 v1 兼容。
import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync, mkdirSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join, resolve, sep } from 'node:path';
import {
  collectStatus, listWorktrees, loadConfig, RUNTIME_DIR, TASKS_DIR,
} from './collect.mjs';

function fail(error, exitCode = 1, extra = {}) {
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
const positional = [];
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === '--agent') agentName = argv[++index];
  else if (argv[index] === '--task-id') taskId = argv[++index];
  else if (argv[index] === '--prompt-file') promptFile = argv[++index];
  else if (argv[index] === '--prompt-stdin') promptStdin = true;
  else if (argv[index] === '--delete-prompt-file') deletePromptFile = true;
  else if (argv[index] === '--confirm-dirty') confirmDirty = true;
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
const prompt = promptStdin
  ? await readStdin()
  : promptFile
    ? readFileSync(promptFile, 'utf8')
    : positional.join(' ');
if (deletePromptFile && promptFile) {
  const requestRoot = resolve(RUNTIME_DIR, '.requests');
  const requestPath = resolve(promptFile);
  if (requestPath.startsWith(`${requestRoot}${sep}`) && existsSync(requestPath)) unlinkSync(requestPath);
}
if (!prompt.trim()) fail('prompt 为空：请以位置参数、stdin 或 --prompt-file 提供任务内容', 1, { code: 'BAD_REQUEST' });

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

mkdirSync(TASKS_DIR, { recursive: true });
for (const fileName of readdirSync(TASKS_DIR)) {
  if (!fileName.endsWith('.json')) continue;
  const taskPath = join(TASKS_DIR, fileName);
  let task;
  try {
    task = JSON.parse(readFileSync(taskPath, 'utf8'));
  } catch {
    continue;
  }
  if (task.worktree !== targetName || task.status !== 'running') continue;
  let alive = false;
  try {
    process.kill(task.pid, 0);
    alive = true;
  } catch {
    // 死锁记录在本次派发前收敛为 stale。
  }
  if (alive) {
    fail(`${targetName} 已有运行中任务 ${task.id}`, 2, { code: 'LOCKED' });
  }
  task.status = 'stale';
  task.endedAt = new Date().toISOString();
  writeFileSync(taskPath, `${JSON.stringify(task, null, 2)}\n`);
}

const statusOutput = execFileSync('git', ['-C', target.path, 'status', '--porcelain'], { encoding: 'utf8' })
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
const taskJsonPath = join(TASKS_DIR, `${taskId}.json`);
const logPath = join(TASKS_DIR, `${taskId}.log`);
const promptPath = join(TASKS_DIR, `${taskId}.prompt.txt`);
if (existsSync(taskJsonPath)) fail(`任务 id 已存在: ${taskId}`, 1, { code: 'BAD_REQUEST' });
writeFileSync(promptPath, prompt);

function resolveCommand(command) {
  if (process.platform !== 'win32') return command;
  let resolved;
  try {
    resolved = execFileSync('where.exe', [command[0]], { encoding: 'utf8' })
      .split(/\r?\n/).filter(Boolean)[0];
  } catch {
    fail(`找不到命令 "${command[0]}"，请确认已安装并在 PATH 中`, 1, { code: 'BAD_REQUEST' });
  }
  return /\.(cmd|bat)$/i.test(resolved)
    ? ['cmd.exe', '/d', '/s', '/c', resolved, ...command.slice(1)]
    : [resolved, ...command.slice(1)];
}

const finalArgv = resolveCommand(agentArgv);
const logFd = openSync(logPath, 'a');
const child = spawn(finalArgv[0], finalArgv.slice(1), {
  cwd: target.path,
  stdio: ['pipe', logFd, logFd],
  env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
});
const task = {
  id: taskId,
  worktree: targetName,
  path: target.path,
  agent: agentName,
  prompt: prompt.length > 500 ? `${prompt.slice(0, 500)}…` : prompt,
  promptFile: promptPath,
  log: logPath,
  status: 'running',
  pid: child.pid,
  startedAt: new Date().toISOString(),
  endedAt: null,
  exitCode: null,
};
writeFileSync(taskJsonPath, `${JSON.stringify(task, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, taskId, worktree: targetName, pid: child.pid, log: logPath }));
child.stdin.write(prompt);
child.stdin.end();

child.on('error', (error) => {
  task.status = 'failed';
  task.endedAt = new Date().toISOString();
  task.error = String(error.message).slice(0, 300);
  writeFileSync(taskJsonPath, `${JSON.stringify(task, null, 2)}\n`);
  console.error(JSON.stringify({ ok: false, taskId, error: task.error }));
  process.exit(1);
});

child.on('close', async (code) => {
  task.status = code === 0 ? 'done' : 'failed';
  task.exitCode = code;
  task.endedAt = new Date().toISOString();
  writeFileSync(taskJsonPath, `${JSON.stringify(task, null, 2)}\n`);
  try {
    await collectStatus({ skipGh: true });
  } catch {
    // 快照刷新失败不改写 headless 任务的真实退出状态。
  }
  console.log(JSON.stringify({ ok: code === 0, taskId, exitCode: code, log: logPath }));
  process.exit(code === 0 ? 0 : 1);
});
