// GitHub CLI 的显式身份边界。
// 只在当前进程/子进程注入凭据；任何返回值、错误和可持久化投影都不得包含 token。
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';

const pExecFile = promisify(execFile);
const DEFAULT_HOST = 'github.com';
const GH_COMMAND_ENV = 'AES_WORKTREE_BOARD_GH_COMMAND';
const TOKEN_ENV_NAMES = ['GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN'];

export const GITHUB_ERROR_CODES = Object.freeze([
  'IDENTITY_REQUIRED',
  'IDENTITY_MISMATCH',
  'PERMISSION_DENIED',
  'REPO_NOT_FOUND',
  'NETWORK_FAILURE',
]);

const AUTH_TOKEN = Symbol('github-auth-token');

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalized(value) {
  return text(value).toLowerCase();
}

function safeHost(value) {
  const candidate = text(value).replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return candidate || DEFAULT_HOST;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function githubOptions(config = {}, overrides = {}, env = process.env) {
  const nested = isRecord(config.github) ? config.github : {};
  const host = safeHost(
    overrides.host
      ?? config.githubHost
      ?? nested.host
      ?? env.AES_WORKTREE_BOARD_GITHUB_HOST
      ?? env.GH_HOST
      ?? DEFAULT_HOST,
  );
  const account = text(
    overrides.account
      ?? config.githubAccount
      ?? nested.account
      ?? config.targetGithubAccount
      ?? env.AES_WORKTREE_BOARD_GITHUB_ACCOUNT,
  );
  return { host, account };
}

function repositoryName(value, host) {
  const raw = text(value);
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) {
      const parsed = new URL(raw);
      if (normalized(parsed.hostname) !== normalized(host)) return '';
      return parsed.pathname.replace(/^\/+|\/+$/g, '');
    }
  } catch {
    return '';
  }
  const hostPrefix = `${host}/`;
  return raw.toLowerCase().startsWith(hostPrefix.toLowerCase()) ? raw.slice(hostPrefix.length) : raw;
}

function tokenFromEnvironment(env, host) {
  const names = normalized(host) === DEFAULT_HOST
    ? ['GH_TOKEN', 'GITHUB_TOKEN']
    : ['GH_ENTERPRISE_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'];
  for (const name of names) {
    const value = text(env?.[name]);
    if (value) return { name, value };
  }
  return null;
}

function withoutCredentials(env, host) {
  const result = { ...env, GH_HOST: host };
  for (const name of TOKEN_ENV_NAMES) delete result[name];
  return result;
}

function redactSecrets(value, token = '') {
  let result = String(value ?? '');
  if (token) result = result.split(token).join('[REDACTED]');
  return result.replace(/\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]+\b/g, '[REDACTED]');
}

export function redactGithubSecrets(value) {
  return redactSecrets(value);
}

function errorWithCode(code, message, details = {}, cause = undefined) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  error.exitCode = 2;
  error.details = details;
  return error;
}

function commandSpec(env) {
  const configured = text(env?.[GH_COMMAND_ENV]);
  if (configured.startsWith('[')) {
    try {
      const parsed = JSON.parse(configured);
      if (Array.isArray(parsed) && parsed.length && parsed.every((value) => typeof value === 'string' && value)) {
        return { file: parsed[0], prefix: parsed.slice(1) };
      }
    } catch {
      // 不是 JSON command spec 时按普通可执行文件路径处理。
    }
  }
  return { file: configured || 'gh', prefix: [] };
}

async function invokeGh(args, { env = process.env, cwd, timeout = 60_000, maxBuffer = 64 * 1024 * 1024 } = {}) {
  try {
    const command = commandSpec(env);
    const result = await pExecFile(command.file, [...command.prefix, ...args], {
      ...HEADLESS_CHILD_OPTIONS,
      cwd,
      env,
      timeout,
      maxBuffer,
      encoding: 'utf8',
    });
    return { status: 0, stdout: String(result.stdout || ''), stderr: String(result.stderr || ''), error: null };
  } catch (cause) {
    return {
      status: Number.isInteger(cause?.status) ? cause.status : null,
      stdout: String(cause?.stdout || ''),
      stderr: String(cause?.stderr || cause?.message || ''),
      error: cause,
    };
  }
}

function responseStatus(result) {
  if (Number.isInteger(result.status)) return result.status;
  const source = `${result.stderr}\n${result.stdout}`;
  const match = source.match(/(?:HTTP|status(?: code)?)\s*[:=]?\s*([45]\d\d)\b/i);
  return match ? Number(match[1]) : null;
}

function remoteError(result, context, details = {}, token = '') {
  const status = responseStatus(result);
  // Never use stdout as a diagnostic fallback: `gh auth token` is intentionally
  // stdout-only, and a failed credential command must not echo a secret.
  const safeDetail = redactSecrets(result.stderr, token).replace(/\s+/g, ' ').trim().slice(0, 240);
  const merged = { ...details, status: status ?? undefined };
  if (status === 401) {
    return errorWithCode(
      'IDENTITY_MISMATCH',
      `${context} 的 GitHub 凭据未通过 viewer identity 验证${safeDetail ? `: ${safeDetail}` : ''}`,
      merged,
    );
  }
  if (status === 403) {
    return errorWithCode(
      'PERMISSION_DENIED',
      `${context} 的 GitHub 仓库权限不足${safeDetail ? `: ${safeDetail}` : ''}`,
      merged,
    );
  }
  if (status === 404) {
    return errorWithCode(
      'REPO_NOT_FOUND',
      `${context} 的 GitHub 仓库不存在或当前 viewer 不可见${safeDetail ? `: ${safeDetail}` : ''}`,
      merged,
    );
  }
  const unavailable = result.error?.code === 'ENOENT'
    ? 'gh CLI 不存在'
    : safeDetail || 'GitHub CLI/网络请求失败';
  return errorWithCode('NETWORK_FAILURE', `${context} 的 GitHub 请求失败: ${unavailable}`, merged);
}

function parseJson(value, context, token = '') {
  try {
    return JSON.parse(value);
  } catch (cause) {
    throw errorWithCode(
      'NETWORK_FAILURE',
      `${context} 返回了不可解析的 GitHub JSON: ${redactSecrets(value, token).replace(/\s+/g, ' ').trim().slice(0, 180)}`,
      {},
      cause,
    );
  }
}

function authEntries(payload, host) {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  const hosts = payload.hosts;
  if (Array.isArray(hosts)) return hosts;
  if (isRecord(hosts)) {
    const exact = hosts[host] || hosts[Object.keys(hosts).find((key) => normalized(key) === normalized(host))];
    return Array.isArray(exact) ? exact : [];
  }
  return [];
}

function configuredAccounts(payload, host) {
  const byLogin = new Map();
  for (const entry of authEntries(payload, host)) {
    const login = text(entry?.login || entry?.user || entry?.username);
    const state = normalized(entry?.state);
    if (!login || (state && !['success', 'configured', 'authenticated'].includes(state))) continue;
    byLogin.set(normalized(login), login);
  }
  return [...byLogin.values()];
}

function permissionAllowed(permission, requiredPermission) {
  const value = normalized(permission).toUpperCase();
  if (!value) return false;
  if (requiredPermission === 'write') return ['WRITE', 'MAINTAIN', 'ADMIN'].includes(value);
  return ['READ', 'TRIAGE', 'WRITE', 'MAINTAIN', 'ADMIN'].includes(value);
}

function authFailureMessage(host, account, issueRepo) {
  return `请在 board 配置或 AES_WORKTREE_BOARD_GITHUB_ACCOUNT 显式声明 ${host} 的目标账号${
    account ? `（当前声明为 ${account}）` : ''
  }；不要依据 remote URL 用户名或 gh 默认 active account 猜测。目标仓库: ${issueRepo}`;
}

function publicAuthEnv(host, token, baseEnv = process.env) {
  const env = { ...baseEnv, GH_HOST: host };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  delete env.GH_ENTERPRISE_TOKEN;
  if (normalized(host) === DEFAULT_HOST) env.GH_TOKEN = token;
  else env.GH_ENTERPRISE_TOKEN = token;
  return env;
}

export async function prepareGithubAccess({
  config = {},
  issueRepo,
  account,
  host,
  cwd = process.cwd(),
  requiredPermission = 'read',
  env = process.env,
} = {}) {
  if (!['read', 'write'].includes(requiredPermission)) {
    throw new TypeError(`未知 GitHub 权限级别: ${requiredPermission}`);
  }
  const target = githubOptions(config, { account, host }, env);
  const repo = repositoryName(issueRepo, target.host);
  if (!/^\w[\w.-]*\/\w[\w.-]*$/.test(repo)) {
    throw errorWithCode('REPO_NOT_FOUND', `GitHub issueRepo 无效: ${issueRepo || '(empty)'}`, {
      host: target.host,
      issueRepo: text(issueRepo),
    });
  }

  const supplied = tokenFromEnvironment(env, target.host);
  const statusEnv = withoutCredentials(env, target.host);
  const statusResult = await invokeGh([
    'auth', 'status', '--hostname', target.host, '--json', 'hosts',
  ], { env: statusEnv, cwd, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
  let accounts = [];
  if (statusResult.stdout.trim()) {
    try {
      accounts = configuredAccounts(parseJson(statusResult.stdout, 'gh auth status', supplied?.value), target.host);
    } catch (error) {
      if (!supplied) throw error;
    }
  } else if (statusResult.error?.code === 'ENOENT') {
    throw remoteError(statusResult, 'gh auth status', { host: target.host, issueRepo: repo }, supplied?.value);
  }

  const declared = text(target.account);
  if (!declared && accounts.length > 1) {
    throw errorWithCode('IDENTITY_REQUIRED', authFailureMessage(target.host, '', repo), {
      host: target.host,
      issueRepo: repo,
      accounts: accounts.map((value) => value),
    });
  }
  if (declared && accounts.length && !accounts.some((value) => normalized(value) === normalized(declared)) && !supplied) {
    throw errorWithCode(
      'IDENTITY_MISMATCH',
      `目标 GitHub 账号 ${declared} 未在 ${target.host} 的 gh 凭据中配置；可用账号: ${accounts.join(', ')}`,
      { host: target.host, issueRepo: repo, targetAccount: declared, accounts },
    );
  }

  let token = supplied?.value || '';
  const expectedAccount = declared || (accounts.length === 1 ? accounts[0] : '');
  if (!token) {
    if (!expectedAccount) {
      throw errorWithCode('IDENTITY_REQUIRED', authFailureMessage(target.host, declared, repo), {
        host: target.host,
        issueRepo: repo,
        accounts,
      });
    }
    const tokenResult = await invokeGh([
      'auth', 'token', '--hostname', target.host, '--user', expectedAccount,
    ], { env: statusEnv, cwd, timeout: 30_000, maxBuffer: 128 * 1024 });
    if (tokenResult.status !== 0 || !text(tokenResult.stdout)) {
      throw remoteError(tokenResult, `读取 GitHub 账号 ${expectedAccount} 的凭据`, {
        host: target.host,
        issueRepo: repo,
        targetAccount: expectedAccount,
      });
    }
    token = text(tokenResult.stdout);
  }

  const childEnv = publicAuthEnv(target.host, token, env);
  const viewerResult = await invokeGh([
    'api', 'user', '--hostname', target.host, '--jq', '.login',
  ], { env: childEnv, cwd, timeout: 30_000, maxBuffer: 256 * 1024 });
  if (viewerResult.status !== 0 || !text(viewerResult.stdout)) {
    throw remoteError(viewerResult, 'GitHub viewer identity', {
      host: target.host,
      issueRepo: repo,
      targetAccount: expectedAccount || undefined,
    }, token);
  }
  const viewer = text(viewerResult.stdout).split(/\r?\n/, 1)[0];
  if (expectedAccount && normalized(viewer) !== normalized(expectedAccount)) {
    throw errorWithCode(
      'IDENTITY_MISMATCH',
      `GitHub viewer identity 不匹配：目标账号 ${expectedAccount}，实际 viewer ${viewer}`,
      { host: target.host, issueRepo: repo, targetAccount: expectedAccount, viewer },
    );
  }

  const repoResult = await invokeGh([
    'repo', 'view', repo, '--json', 'nameWithOwner,viewerPermission,isPrivate',
  ], { env: childEnv, cwd, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
  if (repoResult.status !== 0) {
    throw remoteError(repoResult, `验证 GitHub 仓库 ${repo}`, {
      host: target.host,
      issueRepo: repo,
      targetAccount: expectedAccount || viewer,
      viewer,
    }, token);
  }
  const repository = parseJson(repoResult.stdout, `GitHub 仓库 ${repo}`, token);
  const returnedRepo = text(repository?.nameWithOwner);
  if (returnedRepo && normalized(returnedRepo) !== normalized(repo)) {
    throw errorWithCode(
      'REPO_NOT_FOUND',
      `GitHub 返回了错误的目标仓库：expected ${repo}, actual ${returnedRepo}`,
      { host: target.host, issueRepo: repo, returnedRepo, viewer },
    );
  }
  const permission = text(repository?.viewerPermission).toUpperCase();
  if (!permissionAllowed(permission, requiredPermission)) {
    throw errorWithCode(
      'PERMISSION_DENIED',
      `GitHub viewer ${viewer} 对 ${repo} 的权限不足：需要 ${requiredPermission}，实际 ${permission || '(unknown)'}`,
      { host: target.host, issueRepo: repo, targetAccount: expectedAccount || viewer, viewer, permission, requiredPermission },
    );
  }

  const auth = {
    host: target.host,
    issueRepo: repo,
    targetAccount: expectedAccount || viewer,
    viewer,
    permission,
    env: childEnv,
  };
  Object.defineProperty(auth, AUTH_TOKEN, { value: token, enumerable: false });
  return Object.freeze(auth);
}

function authToken(auth) {
  return auth && typeof auth === 'object' ? auth[AUTH_TOKEN] || '' : '';
}

export async function runGithubCommand(args, { auth, env = process.env, cwd = process.cwd(), ...options } = {}) {
  const activeEnv = auth?.env || env;
  const result = await invokeGh(args, { ...options, env: activeEnv, cwd });
  if (result.status !== 0) {
    throw remoteError(result, `gh ${args.join(' ')}`, {
      host: auth?.host,
      issueRepo: auth?.issueRepo,
      targetAccount: auth?.targetAccount,
      viewer: auth?.viewer,
    }, authToken(auth));
  }
  return {
    stdout: redactSecrets(result.stdout, authToken(auth)),
    stderr: redactSecrets(result.stderr, authToken(auth)),
  };
}

export async function runGithubJson(args, options = {}) {
  const result = await runGithubCommand(args, options);
  return parseJson(result.stdout, `gh ${args.join(' ')}`, authToken(options.auth));
}

export function githubIdentityPrompt(auth) {
  if (!auth) return '';
  return [
    '',
    '[GitHub identity contract]',
    `Target GitHub host/account: ${auth.host}/${auth.targetAccount}`,
    `Target repository: ${auth.issueRepo}`,
    'Credentials are injected only by the host process. Do not run gh auth switch, gh auth login, or guess the default active account; never request, print, or persist a token.',
  ].join('\n');
}
