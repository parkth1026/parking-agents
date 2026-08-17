import assert from 'node:assert/strict';
import { createForwarder } from '../src/forwarder.mjs';
import { resetForTests, snapshot } from '../src/metrics.mjs';

const cfg = { enabled: true, endpoint: 'http://x', batchSize: 3, flushMs: 10000, maxRetries: 2 };

export async function testFlushesWhenBatchFull() {
  resetForTests();
  const seen = [];
  const f = createForwarder(cfg, { post: async (_e, body) => seen.push(body) });
  f.add([{ event: 'a' }, { event: 'b' }]);
  assert.equal(seen.length, 0);
  f.add([{ event: 'c' }]);
  await new Promise((r) => setImmediate(r));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].events.length, 3);
}

export async function testManualFlushSendsPartialBatch() {
  resetForTests();
  const seen = [];
  const f = createForwarder(cfg, { post: async (_e, body) => seen.push(body) });
  f.add([{ event: 'only' }]);
  const r = await f.flush();
  assert.equal(r.sent, 1);
  assert.equal(seen[0].events.length, 1);
}

export async function testDropsBatchAfterMaxRetries() {
  resetForTests();
  let calls = 0;
  const f = createForwarder(cfg, {
    post: async () => {
      calls += 1;
      throw new Error('boom');
    },
  });
  f.add([{ event: 'a' }]);
  const r = await f.flush();
  assert.equal(r.dropped, 1);
  assert.equal(calls, cfg.maxRetries + 1);
  assert.equal(snapshot().forward_failures_total, 1);
}

export async function testDisabledForwarderKeepsNothing() {
  resetForTests();
  const f = createForwarder({ ...cfg, enabled: false }, { post: async () => {} });
  f.add([{ event: 'a' }]);
  assert.equal(f.pending(), 0);
}
