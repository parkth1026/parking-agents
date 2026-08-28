#!/usr/bin/env node
// runner slot 生命周期（AC-001）：Git 忽略的本机 allowlist、identity/dirty 隔离、baseline 同步。
// 强约束：绝不 reset/clean 用户现场；隔离只是「不领取」，不是「清理」。
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';
import { readJson, writeJsonAtomic } from './runtime-store.mjs';
import { nowIso, REPO_ROOT, storeError } from './job-store.mjs';

export const SLOTS_SCHEMA = 'aes.worktree-board.runner-slots/v1';
export const DEFAULT_SLOTS_PATH = join(REPO_ROOT, '.aes-worktree-board', 'runner-slots.local.json');
export const SLOTS_PATH = resolve(process.env.AES_WORKTREE_BOARD_SLOTS_PATH || DEFAULT_SLOTS_PATH);
export const CAPABILITIES = Object.freeze(['code', 'test', 'browser', 'live-github']);

function git(cwd, args) {
  return spawnSync('git', args, { ...HEADLESS_CHILD_OPTIONS, cwd, encoding: 'utf8' });
}

function gitOut(cwd, args) {
  const result = git(cwd, args);
  if (result.status !== 0) return null;
  return String(result.stdout || '').trim();
}

export function normalizePath(value) {
  return resolve(String(value || '')).replaceAll('\\', '/');
}

// slot 配置是 schema 校验的闭集；任何未知取值或缺字段都 fail closed，不从自然语言补猜。
export function validateSlotsConfig(config, { path = SLOTS_PATH } = {}) {
  if (!config || typeof config !== 'object') {
    throw storeError('RUNNER_SLOTS_MISSING', `runner slot 配置缺失或非法: ${path}`, { path });
  }
  if (config.schemaVersion !== SLOTS_SCHEMA) {
    throw storeError('RUNNER_SLOTS_SCHEMA', `runner slot schemaVersion 必须为 ${SLOTS_SCHEMA}`, {
      path, actual: config.schemaVersion || null,
    });
  }
  const identity = config.repoIdentity;
  for (const key of ['root', 'integrationBranch', 'issueRepo']) {
    if (!identity || typeof identity[key] !== 'string' || !identity[key]) {
      throw storeError('RUNNER_SLOTS_IDENTITY', `runner slot repoIdentity.${key} 缺失`, { path, key });
    }
  }
  // 增补字段：identity 锚点与 merge host 是两件事。
  // identity 必须锚在共享仓根（git-common-dir 的上级），否则任何 worktree 都会被判成漂移；
  // 而 host merge 必须发生在「实际检出了 integration branch」的那个 worktree 里。
  // 不分开的话，Master 就被迫要求用户的主检出常年停在 integration branch 上。
  if (config.hostWorktree !== undefined && (typeof config.hostWorktree !== 'string' || !config.hostWorktree)) {
    throw storeError('RUNNER_SLOTS_SCHEMA', 'hostWorktree 若出现必须是非空字符串', { path });
  }
  if (!Array.isArray(config.slots)) {
    throw storeError('RUNNER_SLOTS_SCHEMA', 'runner slot slots 必须是数组', { path });
  }
  const seen = new Set();
  for (const slot of config.slots) {
    for (const key of ['slotId', 'worktreePath', 'projectId', 'branch']) {
      if (typeof slot?.[key] !== 'string' || !slot[key]) {
        throw storeError('RUNNER_SLOTS_SCHEMA', `slot 缺少字段 ${key}`, { path, slot: slot?.slotId || null, key });
      }
    }
    if (seen.has(slot.slotId)) {
      throw storeError('RUNNER_SLOTS_DUPLICATE', `slotId 重复: ${slot.slotId}`, { path, slotId: slot.slotId });
    }
    seen.add(slot.slotId);
    if (typeof slot.enabled !== 'boolean') {
      throw storeError('RUNNER_SLOTS_SCHEMA', `slot ${slot.slotId} 缺少布尔 enabled`, { path, slotId: slot.slotId });
    }
    if (!Number.isInteger(slot.concurrency) || slot.concurrency < 1) {
      throw storeError('RUNNER_SLOTS_SCHEMA', `slot ${slot.slotId} concurrency 必须是正整数`, { path, slotId: slot.slotId });
    }
    if (!Array.isArray(slot.capabilities) || slot.capabilities.some((value) => !CAPABILITIES.includes(value))) {
      throw storeError('RUNNER_SLOTS_SCHEMA', `slot ${slot.slotId} capabilities 含闭集外取值`, {
        path, slotId: slot.slotId, allowed: CAPABILITIES,
      });
    }
  }
  return config;
}

export function loadSlotsConfig(path = SLOTS_PATH) {
  const config = readJson(resolve(path), null);
  if (!config) {
    throw storeError('RUNNER_SLOTS_MISSING', `未找到 runner slot 配置: ${path}；先运行 runner init`, { path });
  }
  return validateSlotsConfig(config, { path: resolve(path) });
}

// E1: slot 配置为空 → Master Goal 不启动，退出非零；不由 LLM 自动补 slot。
export function assertStartable(config, { path = SLOTS_PATH } = {}) {
  const enabled = config.slots.filter((slot) => slot.enabled);
  if (!enabled.length) {
    throw storeError('RUNNER_SLOTS_EMPTY', 'runner slot allowlist 为空，Master Goal 拒绝启动；先运行 runner init', {
      path, slots: config.slots.length, enabled: 0,
    });
  }
  return enabled;
}

function canonicalConfig(repoIdentity, slots, hostWorktree) {
  return {
    schemaVersion: SLOTS_SCHEMA,
    ...(hostWorktree ? { hostWorktree: normalizePath(hostWorktree) } : {}),
    repoIdentity: {
      root: normalizePath(repoIdentity.root),
      integrationBranch: repoIdentity.integrationBranch,
      issueRepo: repoIdentity.issueRepo,
    },
    slots: slots.map((slot) => ({
      slotId: slot.slotId,
      worktreePath: normalizePath(slot.worktreePath),
      projectId: slot.projectId,
      branch: slot.branch,
      enabled: slot.enabled !== false,
      concurrency: slot.concurrency || 1,
      capabilities: slot.capabilities || ['code', 'test'],
    })),
  };
}

// B1: 确定性生成，不由 LLM 临场决定。重复运行必须是幂等 NOOP。
export function initSlots({ path = SLOTS_PATH, repoIdentity, slots, hostWorktree = null, force = false } = {}) {
  const target = resolve(path);
  const next = validateSlotsConfig(canonicalConfig(repoIdentity, slots, hostWorktree), { path: target });
  const existing = readJson(target, null);
  if (existing && !force) {
    if (JSON.stringify(existing) === JSON.stringify(next)) {
      return { ok: true, outcome: 'NOOP', path: target, slots: next.slots.length };
    }
    throw storeError('RUNNER_SLOTS_CONFLICT', '已存在不同的 runner slot 配置；只有显式 runner update 可修改', {
      path: target,
    });
  }
  writeJsonAtomic(target, next);
  return { ok: true, outcome: existing ? 'UPDATED' : 'CREATED', path: target, slots: next.slots.length };
}

export function updateSlots({ path = SLOTS_PATH, repoIdentity, slots, hostWorktree = null } = {}) {
  return initSlots({ path, repoIdentity, slots, hostWorktree, force: true });
}

// 每个 slot 的真实工作区探测。事实采集与判定分离，便于 selftest 单独断言两侧。
export function probeSlot(slot, { integrationBranch, expectedRoot }) {
  const worktreePath = resolve(slot.worktreePath);
  const facts = {
    slotId: slot.slotId,
    worktreePath: normalizePath(worktreePath),
    exists: existsSync(worktreePath),
    repoRoot: null,
    commonRoot: null,
    head: null,
    branch: null,
    dirtyEntries: [],
    integrationHead: null,
    ahead: null,
    behind: null,
    syncedToIntegration: false,
  };
  if (!facts.exists) return facts;
  const top = gitOut(worktreePath, ['rev-parse', '--show-toplevel']);
  facts.repoRoot = top ? normalizePath(top) : null;
  // worktree 与主仓共享 .git；identity 以 git-common-dir 的上级为准，才能识别「同名但另一个仓」。
  const commonDir = gitOut(worktreePath, ['rev-parse', '--git-common-dir']);
  facts.commonRoot = commonDir ? normalizePath(resolve(worktreePath, commonDir, '..')) : null;
  facts.head = gitOut(worktreePath, ['rev-parse', 'HEAD']);
  facts.branch = gitOut(worktreePath, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const status = gitOut(worktreePath, ['status', '--porcelain=v1', '--untracked-files=all']);
  facts.dirtyEntries = status ? status.split(/\r?\n/).filter(Boolean) : [];
  facts.integrationHead = gitOut(worktreePath, ['rev-parse', integrationBranch])
    || gitOut(resolve(expectedRoot), ['rev-parse', integrationBranch]);
  const topology = facts.head && facts.integrationHead && facts.head !== facts.integrationHead
    ? gitOut(worktreePath, ['rev-list', '--left-right', '--count', `${facts.integrationHead}...${facts.head}`])
    : null;
  if (facts.head && facts.head === facts.integrationHead) {
    facts.ahead = 0;
    facts.behind = 0;
  } else if (topology) {
    const [behind, ahead] = topology.split(/\s+/).map(Number);
    facts.ahead = ahead;
    facts.behind = behind;
  }
  facts.syncedToIntegration = Boolean(facts.head && facts.integrationHead && facts.head === facts.integrationHead);
  return facts;
}

// B2/B4: identity 漂移与 dirty 分别隔离；两者都不领取 job，都不触碰用户现场。
export function classifySlot(facts, { expectedRoot }) {
  if (!facts.exists) {
    return {
      state: 'QUARANTINED_MISSING',
      reason: `slot 路径不存在: ${facts.worktreePath}`,
      recovery: '确认 worktree 存在后运行 runner update',
      claimable: false,
    };
  }
  const expected = normalizePath(expectedRoot);
  const actual = facts.commonRoot || facts.repoRoot;
  if (!actual || actual !== expected) {
    return {
      state: 'QUARANTINED_CONFIG_DRIFT',
      reason: `repo identity 漂移：期望 ${expected}，实际 ${actual || '(非 Git worktree)'}`,
      recovery: '只有显式 runner update/init 可修复配置',
      claimable: false,
      expectedRepoRoot: expected,
      actualRepoRoot: actual,
    };
  }
  if (facts.dirtyEntries.length) {
    return {
      state: 'QUARANTINED_DIRTY',
      reason: `工作区存在 ${facts.dirtyEntries.length} 项 dirty/untracked 改动`,
      recovery: '由用户自行处理现场；编排绝不 reset/clean',
      claimable: false,
      dirtySample: facts.dirtyEntries.slice(0, 5),
    };
  }
  // B3: clean 且 identity 正确，但 branch 未同步到 integration HEAD 时不允许 claim，先同步 baseline。
  if (!facts.syncedToIntegration) {
    return {
      state: 'idle',
      reason: `worker branch 未同步到 integration HEAD（${facts.head || 'unknown'} != ${facts.integrationHead || 'unknown'}）`,
      recovery: 'runner sync 将 worker branch 快进到 integration HEAD',
      claimable: false,
      needsBaselineSync: true,
    };
  }
  return { state: 'idle', reason: 'clean 且已同步到 integration HEAD', claimable: true, needsBaselineSync: false };
}

// baseline 同步的前置条件是 clean + identity 正确，dirty slot 永远走不到这里，
// 因此不存在覆盖用户现场的路径（不变清单：不自动清理 dirty/untracked）。
export function syncSlotBaseline(slot, { integrationBranch, expectedRoot }) {
  const facts = probeSlot(slot, { integrationBranch, expectedRoot });
  const verdict = classifySlot(facts, { expectedRoot });
  if (verdict.state !== 'idle') {
    throw storeError('SLOT_NOT_SYNCABLE', `slot ${slot.slotId} 处于 ${verdict.state}，不同步 baseline`, {
      slotId: slot.slotId, state: verdict.state, reason: verdict.reason,
    });
  }
  if (facts.syncedToIntegration) {
    return { ok: true, outcome: 'NOOP', slotId: slot.slotId, head: facts.head };
  }
  const target = facts.integrationHead;
  if (!target) {
    throw storeError('INTEGRATION_HEAD_UNKNOWN', `无法解析 integration branch ${integrationBranch}`, {
      slotId: slot.slotId, integrationBranch,
    });
  }
  const reset = git(resolve(slot.worktreePath), ['reset', '--hard', target]);
  if (reset.status !== 0) {
    throw storeError('SLOT_SYNC_FAILED', `slot ${slot.slotId} baseline 同步失败`, {
      slotId: slot.slotId, stderr: String(reset.stderr || '').slice(0, 400),
    });
  }
  return { ok: true, outcome: 'SYNCED', slotId: slot.slotId, head: target };
}

// 把 slot 配置 + 真实探测结果投影成 registry 中的 runner 记录。
// 隔离状态优先于 lease：污染的现场即使持有 lease 也不再被当作可派发容量。
export function projectRunners(config, registry, { probe = probeSlot } = {}) {
  const expectedRoot = config.repoIdentity.root;
  const integrationBranch = config.repoIdentity.integrationBranch;
  const projected = {};
  for (const slot of config.slots) {
    const previous = registry.runners[slot.slotId] || null;
    const lease = previous?.lease || null;
    if (!slot.enabled) {
      projected[slot.slotId] = {
        slotId: slot.slotId,
        worktreePath: normalizePath(slot.worktreePath),
        projectId: slot.projectId,
        branch: slot.branch,
        capabilities: slot.capabilities,
        state: 'draining',
        reason: 'slot 在 allowlist 中被禁用',
        recovery: '在 runner-slots.local.json 中重新 enable',
        claimable: false,
        needsBaselineSync: false,
        lease,
        head: previous?.head || null,
        integrationHead: previous?.integrationHead || null,
        ahead: previous?.ahead ?? null,
        behind: previous?.behind ?? null,
        dirtyCount: previous?.dirtyCount ?? 0,
        evaluatedAt: nowIso(),
      };
      continue;
    }
    const facts = probe(slot, { integrationBranch, expectedRoot });
    const verdict = classifySlot(facts, { expectedRoot });
    const quarantined = verdict.state.startsWith('QUARANTINED_');
    projected[slot.slotId] = {
      slotId: slot.slotId,
      worktreePath: normalizePath(slot.worktreePath),
      projectId: slot.projectId,
      branch: slot.branch,
      capabilities: slot.capabilities,
      state: quarantined ? verdict.state : (lease ? 'leased' : verdict.state),
      reason: !quarantined && lease ? `已租给 ${lease.jobId}` : verdict.reason,
      recovery: verdict.recovery || null,
      claimable: verdict.claimable && !lease,
      needsBaselineSync: Boolean(verdict.needsBaselineSync),
      lease,
      head: facts.head,
      integrationHead: facts.integrationHead,
      ahead: facts.ahead,
      behind: facts.behind,
      dirtyCount: facts.dirtyEntries.length,
      evaluatedAt: nowIso(),
    };
  }
  return projected;
}

export function slotById(config, slotId) {
  const slot = config.slots.find((entry) => entry.slotId === slotId);
  if (!slot) throw storeError('UNKNOWN_SLOT', `allowlist 无此 slot: ${slotId}`, { slotId });
  return slot;
}

// 枚举同一个仓的全部 worktree，不限于与主仓同级。
//
// 历史口径把「候选 worker」定义成主仓的同级目录，于是把 worker 放进
// <parent>/<repo>-worker/ 这类子目录后，自动发现结果为空。目录摆放方式不该决定
// 一个 worktree 是不是本仓的 worktree —— `git worktree list` 才是权威。
export function discoverWorktrees(repoRoot) {
  const porcelain = gitOut(resolve(repoRoot), ['worktree', 'list', '--porcelain']);
  if (!porcelain) return [];
  return porcelain.split(/\r?\n/)
    .filter((line) => line.startsWith('worktree '))
    .map((line) => normalizePath(line.slice('worktree '.length).trim()))
    .filter((path) => existsSync(path));
}

// 从 worktree 列表推导 slot allowlist。
// 排除两类：主仓自身（它是 host，不是 worker），以及不属于本仓的路径 —— 后者用
// git-common-dir 判定，与 classifySlot 的漂移判定同一口径，不靠路径前缀猜。
export function defaultSlotsFromWorktrees(entries, { repoRoot, prefix = 'worker' }) {
  const expected = normalizePath(repoRoot);
  const seen = new Set();
  const candidates = [];
  for (const entry of entries) {
    const path = normalizePath(entry.path || entry);
    if (path === expected || seen.has(path)) continue;
    seen.add(path);
    if (!existsSync(path)) continue;
    const commonDir = gitOut(path, ['rev-parse', '--git-common-dir']);
    const commonRoot = commonDir ? normalizePath(resolve(path, commonDir, '..')) : null;
    if (commonRoot !== expected) continue;
    candidates.push(path);
  }
  return candidates.map((path, index) => ({
    slotId: `${prefix}-${index + 1}`,
    worktreePath: path,
    projectId: `project-${prefix}-${index + 1}`,
    branch: basename(path),
    enabled: true,
    concurrency: 1,
    capabilities: ['code', 'test'],
  }));
}
