// 出站队列（#142）：把 GitHub 侧的写操作从交付主链上摘下来。
//
// 设计判据一句话：**registry 记意图、Git 记事实，GitHub 两者都不是**。
// GitHub 只是把结果广播出去的副作用面，凭什么让它有权阻断交付并扣住 slot。
// 所以 close 落账即终局，出站动作入队；送不出去是队列的问题，不是交付的问题。
//
// 队列是通用基建（kind 为开放枚举），但本轮只接 issue-close 一个生产者。
// 落盘沿用 runtime-v4 目录既有的 append-only 三条流同款语义：状态推进靠追加新行，
// 读取时按 entryId 取最后一行为准，任何一行都不覆盖、不删除。
import { join, resolve } from 'node:path';
import {
  appendJsonLineAtomic, readJsonLines, withRuntimeLock,
} from './runtime-store.mjs';
import { nowIso, shortDigest, storeError, V4_DIR } from './job-store.mjs';

export const OUTBOX_ENTRY_SCHEMA = 'aes.worktree-board.outbox-entry/v1';
// state 闭集：pending / succeeded / abandoned / acknowledged。
// 这些值只在本模块内产生，不从外部报文解析，所以不需要一份运行时闭集去校验它。

// 门槛尺子锁在这里：跨 flush 调用累计的尝试次数，不是单次 flush 内的重试。
// 单次内重试会把网络抖动误判成永久失败——那是最常见的误伤。
export const MAX_ATTEMPTS = 3;

export function outboxPath(dir = V4_DIR) { return join(resolve(dir), 'outbox.jsonl'); }

function appendEntry(dir, entry) {
  appendJsonLineAtomic(outboxPath(dir), entry);
  return entry;
}

// 按 entryId 折叠成当前视图：同一 entryId 的最后一行即当前状态。
export function readOutbox(dir = V4_DIR) {
  const byId = new Map();
  for (const line of readJsonLines(outboxPath(dir))) {
    if (line && line.entryId) byId.set(line.entryId, line);
  }
  return [...byId.values()];
}

function findEntry(dir, entryId) {
  return readOutbox(dir).find((entry) => entry.entryId === entryId) || null;
}

// close 的入队口。幂等锚点是 commentDigest：同一份 close 评论不会入两次队
// （对应契约边界值 E4「close 幂等不得重复入队」）。
export function enqueueIssueClose(dir, { jobId, issue, repo, comment, commentDigest }) {
  if (!jobId) throw storeError('BAD_REQUEST', 'enqueueIssueClose 缺 jobId');
  if (!commentDigest) throw storeError('BAD_REQUEST', 'enqueueIssueClose 缺 commentDigest');
  const root = resolve(dir || V4_DIR);
  return withRuntimeLock(root, () => {
    const existing = readOutbox(root).find(
      (entry) => entry.kind === 'issue-close' && entry.commentDigest === commentDigest,
    );
    if (existing) return { entryId: existing.entryId, state: existing.state, enqueued: false };
    const entryId = `ob-${jobId}-${shortDigest(commentDigest)}`;
    appendEntry(root, {
      schemaVersion: OUTBOX_ENTRY_SCHEMA,
      entryId,
      kind: 'issue-close',
      jobId,
      issue,
      repo: repo || null,
      commentDigest,
      payload: { comment, closeIssue: true },
      state: 'pending',
      attempts: [],
      createdAt: nowIso(),
    });
    return { entryId, state: 'pending', enqueued: true };
  });
}

// 送达一条 issue-close：comment 与 close 两次 gh 调用当作一个原子动作处理，
// 中途失败整条算失败（下一轮从头重来；重复 comment 由 GitHub 侧幂等性兜不住，
// 但重复评论的代价远小于漏关票，且 commentDigest 让人能看出是同一份）。
async function deliver(entry, gh) {
  await gh(['issue', 'comment', String(entry.issue), '--body', entry.payload.comment]);
  if (entry.payload.closeIssue) await gh(['issue', 'close', String(entry.issue)]);
}

function errorOf(error) {
  return {
    code: error?.code || 'GH_COMMAND_FAILED',
    stderr: String(error?.details?.stderr || error?.message || '').slice(0, 400),
  };
}

// flush 的五种结局全在这里：成功 / 可重试失败 / 累计满 MAX_ATTEMPTS 转 abandoned /
// 已 succeeded 幂等跳过 / 空队列。**退出码恒 0**——积压不是失败，它是待办。
// 让 CI 因积压变红会逼人去清队列而不是去修真正的问题，而积压的可见性
// 已由 gate 的 outboxWarning 单点承担。
export async function flushOutbox(dir, { gh, maxAttempts = MAX_ATTEMPTS } = {}) {
  if (typeof gh !== 'function') throw storeError('BAD_REQUEST', 'flushOutbox 需要 gh 执行器');
  const root = resolve(dir || V4_DIR);
  // 取件在锁内，送达在锁外：gh 是慢 IO，占着锁会把并发 flush 变成串行等待。
  // 同一条目不会被送两次——取件时即就地标记 in-flight（写一行 pending + inFlightAt）。
  const claimed = withRuntimeLock(root, () => {
    const now = nowIso();
    const taken = [];
    for (const entry of readOutbox(root)) {
      if (entry.state !== 'pending') continue;
      if (entry.inFlightAt) continue;
      const marked = { ...entry, inFlightAt: now };
      appendEntry(root, marked);
      taken.push(marked);
    }
    return taken;
  });

  const results = [];
  for (const entry of claimed) {
    let outcome;
    let error = null;
    try {
      await deliver(entry, gh);
      outcome = 'SUCCEEDED';
    } catch (caught) {
      outcome = 'FAILED';
      error = errorOf(caught);
    }
    const settled = withRuntimeLock(root, () => {
      const current = findEntry(root, entry.entryId) || entry;
      const attempts = [...(current.attempts || []), { at: nowIso(), outcome, error }];
      const next = { ...current, attempts };
      delete next.inFlightAt;
      if (outcome === 'SUCCEEDED') {
        next.state = 'succeeded';
        next.settledAt = nowIso();
      } else if (attempts.length >= maxAttempts) {
        next.state = 'abandoned';
        next.abandonReason = 'ISSUE_UNREACHABLE';
        next.settledAt = nowIso();
      } else {
        next.state = 'pending';
      }
      appendEntry(root, next);
      return next;
    });
    results.push({
      entryId: settled.entryId,
      issue: settled.issue,
      outcome: settled.state === 'succeeded' ? 'SUCCEEDED'
        : settled.state === 'abandoned' ? 'ABANDONED' : 'FAILED',
      attempt: settled.attempts.length,
      ...(settled.state === 'abandoned' ? { abandonReason: settled.abandonReason } : {}),
      ...(error && settled.state !== 'abandoned' ? { error } : {}),
    });
  }

  const view = readOutbox(root);
  return {
    ok: true,
    flushed: results.filter((r) => r.outcome === 'SUCCEEDED').length,
    skipped: view.filter((e) => e.state === 'succeeded').length - results.filter((r) => r.outcome === 'SUCCEEDED').length,
    failed: results.filter((r) => r.outcome === 'FAILED').length,
    abandoned: results.filter((r) => r.outcome === 'ABANDONED').length,
    remaining: view.filter((e) => e.state === 'pending').length,
    entries: results,
  };
}

// 人工签收：只对 abandoned 生效，必须带理由。
// 理由是硬要求而不是礼节——没有理由的签收就是静默删除，而静默删除正是本设计要防的。
// 签收改的是告警噪音，条目本身永不物理删除（补偿审计）。
export function acknowledgeEntry(dir, { entryId, reason, actor = 'human' } = {}) {
  if (!entryId) throw storeError('BAD_REQUEST', 'acknowledge 缺 --entry');
  const root = resolve(dir || V4_DIR);
  return withRuntimeLock(root, () => {
    const entry = findEntry(root, entryId);
    if (!entry) throw storeError('ENTRY_NOT_FOUND', `出站条目不存在: ${entryId}`, { entryId });
    if (entry.state === 'acknowledged') {
      return { ok: true, outcome: 'ALREADY_ACKNOWLEDGED', entryId };
    }
    if (entry.state !== 'abandoned') {
      return { ok: false, code: 'NOT_ABANDONED', entryId, state: entry.state };
    }
    if (!reason || !String(reason).trim()) {
      return { ok: false, code: 'REASON_REQUIRED', entryId };
    }
    const acknowledgedAt = nowIso();
    appendEntry(root, {
      ...entry,
      state: 'acknowledged',
      acknowledgedAt,
      acknowledgedBy: actor,
      reason: String(reason),
    });
    return {
      ok: true, outcome: 'ACKNOWLEDGED', entryId, issue: entry.issue,
      acknowledgedBy: actor, acknowledgedAt,
    };
  });
}

export function outboxStatus(dir = V4_DIR) {
  const view = readOutbox(dir);
  const by = (state) => view.filter((entry) => entry.state === state);
  return {
    ok: true,
    pending: by('pending').length,
    failed: by('pending').filter((entry) => (entry.attempts || []).length > 0).length,
    abandoned: by('abandoned').length,
    acknowledged: by('acknowledged').length,
    entries: view.map((entry) => ({
      entryId: entry.entryId,
      issue: entry.issue,
      state: entry.state,
      attempts: (entry.attempts || []).length,
      ...(entry.abandonReason ? { abandonReason: entry.abandonReason } : {}),
      ...(entry.acknowledgedBy ? { acknowledgedBy: entry.acknowledgedBy, reason: entry.reason } : {}),
    })),
  };
}

// gate 侧的可观测性字段。**只念未签收的积压**：已签收的条目留档但不再计入告警，
// 否则永不删除的补偿审计记录会把警告位永久占满，退化成背景噪音。
// 它不参与 mayMerge——机械门恒为六项，可观测性不是第七道门。
export function outboxWarning(dir = V4_DIR, now = Date.now()) {
  const view = readOutbox(dir);
  const pending = view.filter((entry) => entry.state === 'pending');
  const unacked = view.filter((entry) => entry.state === 'abandoned');
  if (!pending.length && !unacked.length) return null;
  const stamps = [...pending, ...unacked]
    .map((entry) => Date.parse(entry.createdAt || '') || now)
    .filter((value) => Number.isFinite(value));
  return {
    pending: pending.length,
    abandoned: unacked.length,
    oldestAgeMs: stamps.length ? Math.max(0, now - Math.min(...stamps)) : 0,
  };
}
