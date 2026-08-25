#!/usr/bin/env node
// Issue tracker 的受控 gh 入口：先绑定 viewer identity/仓库权限，再执行 issue 读写。
// 凭据只存在当前 Node 进程与 gh 子进程环境中，不经过 argv、prompt、runtime 或日志。
import { loadConfig, REPO_ROOT } from './collect.mjs';
import { prepareGithubAccess, runGithubCommand } from './github-identity.mjs';

function option(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value === '--') throw new Error(`${name} 需要参数`);
  args.splice(index, 2);
  return value;
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
  const repo = option(argv, '--repo') || config.issueRepo;
  const account = option(argv, '--account');
  const host = option(argv, '--hostname');
  const separator = argv.indexOf('--');
  const command = separator >= 0 ? argv.slice(separator + 1) : argv;
  if (command[0] !== 'issue') {
    throw Object.assign(new Error(
      '用法: node github-issue.mjs [--repo owner/name] [--account login] [--hostname host] -- issue <view|list|create|edit|comment|close|reopen> ...',
    ), { code: 'IDENTITY_REQUIRED', exitCode: 2 });
  }
  const write = new Set(['create', 'edit', 'comment', 'close', 'reopen']).has(command[1]);
  const auth = await prepareGithubAccess({
    config,
    issueRepo: repo,
    account,
    host,
    cwd: REPO_ROOT,
    requiredPermission: write ? 'write' : 'read',
  });
  const result = await runGithubCommand(command, { auth, cwd: REPO_ROOT });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
} catch (error) {
  fail(error);
}
