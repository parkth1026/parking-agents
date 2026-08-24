// runtime v3 的唯一持久化原语：同一 runtime 一把跨进程互斥锁，所有可变文件
// 都经 tmp + rename 原子替换。JSONL 在语义上 append-only，物理写入仍走原子替换。
import {
  existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const LOCK_NAME = '.control.lock';
const DEFAULT_LOCK_TIMEOUT_MS = 10_000;
const STALE_LOCK_MS = 60_000;
const WAIT_ARRAY = new Int32Array(new SharedArrayBuffer(4));
export const TERMINAL_TASK_STATES = Object.freeze(['merged', 'parked', 'handoff-required']);

export function canonicalWorktreeKey(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.includes('/') || raw.includes('\\') || raw === '.' || raw === '..' || raw.startsWith('.')) {
    const error = new Error(`非法 worktree 标识: ${raw || '(空)'}`);
    error.code = 'BAD_WORKTREE';
    throw error;
  }
  const short = raw.match(/(?:^|-)(dev\d+|test)$/i)?.[1];
  return (short || raw).toLowerCase();
}

function pause(milliseconds) {
  Atomics.wait(WAIT_ARRAY, 0, 0, milliseconds);
}

function lockPath(runtimeDir) {
  return join(resolve(runtimeDir), LOCK_NAME);
}

export function withRuntimeLock(runtimeDir, operation, { timeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = {}) {
  const root = resolve(runtimeDir);
  const lock = lockPath(root);
  mkdirSync(root, { recursive: true });
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, 'owner.json'), `${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        if (Date.now() - statSync(lock).mtimeMs > STALE_LOCK_MS) {
          // 只回收当前 runtime 内、超过一分钟的精确锁目录；业务数据从不删除。
          rmSync(lock, { recursive: true, force: true });
          continue;
        }
      } catch (statError) {
        if (statError.code === 'ENOENT') continue;
        throw statError;
      }
      if (Date.now() >= deadline) {
        const busy = new Error(`runtime 互斥锁超时: ${lock}`);
        busy.code = 'LOCK_TIMEOUT';
        throw busy;
      }
      pause(20);
    }
  }
  try {
    return operation();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

export function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

export function readJsonLines(path) {
  try {
    return readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export function writeTextAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  writeFileSync(temporary, value);
  let lastError = null;
  for (let attempt = 0; attempt < 250; attempt += 1) {
    try {
      renameSync(temporary, path);
      return;
    } catch (error) {
      lastError = error;
      // Windows 上并发只读句柄/杀软扫描会让同卷 replace 瞬时 EPERM；不 unlink 目标，
      // 只等待原子 rename 成功，读者因此始终只能看到完整旧版或完整新版。
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error;
      pause(20);
    }
  }
  rmSync(temporary, { force: true });
  throw lastError;
}

export function writeJsonAtomic(path, value) {
  writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function appendJsonLineAtomic(path, value) {
  const previous = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const prefix = previous && !previous.endsWith('\n') ? `${previous}\n` : previous;
  writeTextAtomic(path, `${prefix}${JSON.stringify(value)}\n`);
}

export function emptyRegistry(now = new Date().toISOString()) {
  return {
    schemaVersion: 3,
    orchestration: {
      state: 'running', reason: null, recordedAt: null, evaluatedAt: now,
    },
    leases: {},
    tasks: {},
    actions: {},
    actionReceipts: {},
    claimReservations: {},
    verificationRuns: {},
    unclassifiedFinals: {},
    goal: null,
  };
}

export function readRegistry(runtimeDir) {
  const registry = readJson(join(runtimeDir, 'registry.json'), null) || emptyRegistry();
  if (registry.schemaVersion !== 3) throw new Error(`registry.json schemaVersion 必须为 3，实际为 ${registry.schemaVersion}`);
  registry.leases ||= {};
  registry.tasks ||= {};
  registry.actions ||= {};
  registry.actionReceipts ||= {};
  registry.claimReservations ||= {};
  registry.verificationRuns ||= {};
  registry.unclassifiedFinals ||= {};
  registry.goal ||= null;
  registry.orchestration ||= emptyRegistry().orchestration;
  const leases = {};
  for (const [worktree, lease] of Object.entries(registry.leases)) {
    const key = canonicalWorktreeKey(worktree);
    if (leases[key] && leases[key].owner !== lease.owner) {
      const error = new Error(`registry 存在冲突 worktree alias 租约: ${worktree} -> ${key}`);
      error.code = 'LEASE_ALIAS_CONFLICT';
      throw error;
    }
    leases[key] = lease;
  }
  registry.leases = leases;
  for (const task of Object.values(registry.tasks)) {
    task.worktree = canonicalWorktreeKey(task.worktree);
    // v3 additive compatibility: old TaskRecords used createdAt/updatedAt only.
    task.startedAt ||= task.createdAt || null;
    if (task.finishedAt === undefined) {
      task.finishedAt = TERMINAL_TASK_STATES.includes(task.state) ? task.updatedAt || task.startedAt : null;
    }
  }
  return registry;
}

export function updateRegistry(runtimeDir, mutate) {
  return withRuntimeLock(runtimeDir, () => {
    const registry = readRegistry(runtimeDir);
    const result = mutate(registry);
    writeJsonAtomic(join(runtimeDir, 'registry.json'), registry);
    return result;
  });
}
