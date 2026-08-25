#!/usr/bin/env node
// Issue tracker 的受控 gh 入口：先绑定 viewer identity/仓库权限，再执行 issue 读写。
// 凭据只存在当前 Node 进程与 gh 子进程环境中，不经过 argv、prompt、runtime 或日志。
import { loadConfig, REPO_ROOT } from './collect.mjs';
import { prepareGithubAccess, runGithubCommand } from './github-identity.mjs';

const ISSUE_READ_COMMANDS = new Set(['list', 'status', 'view']);
const ISSUE_WRITE_COMMANDS = new Set([
  'close', 'comment', 'create', 'delete', 'develop', 'edit', 'lock', 'pin', 'reopen',
  'transfer', 'unlock', 'unpin',
]);

function option(args, name) {
  const index = args.indexOf(name);
  const inlinePrefix = `${name}=`;
  const inlineIndex = args.findIndex((value) => value.startsWith(inlinePrefix));
  const selectedIndex = index >= 0 ? index : inlineIndex;
  if (selectedIndex < 0) return undefined;
  const inline = selectedIndex === inlineIndex && index < 0;
  const value = inline ? args[selectedIndex].slice(inlinePrefix.length) : args[selectedIndex + 1];
  if (!value || value === '--') throw new Error(`${name} 需要参数`);
  args.splice(selectedIndex, inline ? 1 : 2);
  return value;
}

function usageError(message) {
  const error = new Error(message);
  error.code = 'BAD_REQUEST';
  error.exitCode = 2;
  return error;
}

function splitInvocation(argv) {
  const separator = argv.indexOf('--');
  if (separator >= 0) return { wrapper: argv.slice(0, separator), command: argv.slice(separator + 1) };
  const commandStart = argv.indexOf('issue');
  if (commandStart < 0) return { wrapper: [...argv], command: [] };
  return { wrapper: argv.slice(0, commandStart), command: argv.slice(commandStart) };
}

function assertIssueCommand(command) {
  if (command[0] !== 'issue' || !command[1]) {
    throw usageError(
      '用法: node github-issue.mjs [--repo owner/name] [--account login] [--hostname host] -- issue <list|status|view|create|edit|close|reopen|comment|delete|lock|unlock|pin|unpin|transfer|develop> ...',
    );
  }
  if (command.some((argument) => argument === '-R' || argument === '--repo' || argument.startsWith('--repo=') || /^-R.+/.test(argument))) {
    throw usageError('Issue 命令不得覆盖已校验的目标仓库：请移除 -R/--repo/--repo= 参数');
  }
  if (ISSUE_READ_COMMANDS.has(command[1])) return 'read';
  if (ISSUE_WRITE_COMMANDS.has(command[1])) return 'write';
  throw usageError(`未知或不支持的 Issue 子命令: ${command[1]}；为避免绕过权限校验已拒绝执行`);
}

function fail(error) {
  console.error(JSON.stringify({
    ok: false,
    code: error.code || 'NETWORK_FAILURE',
    message: String(error.message || error),
    ...(error.details || {}),
  }));
  process.exitCode = error.exitCode || 2;
}

const argv = process.argv.slice(2);
try {
  const config = loadConfig();
  const invocation = splitInvocation(argv);
  const repo = option(invocation.wrapper, '--repo') || config.issueRepo;
  const account = option(invocation.wrapper, '--account');
  const host = option(invocation.wrapper, '--hostname');
  const access = assertIssueCommand(invocation.command);
  const auth = await prepareGithubAccess({
    config,
    issueRepo: repo,
    account,
    host,
    cwd: REPO_ROOT,
    requiredPermission: access,
  });
  const result = await runGithubCommand([...invocation.command, '--repo', auth.issueRepo], { auth, cwd: REPO_ROOT });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
} catch (error) {
  fail(error);
}
