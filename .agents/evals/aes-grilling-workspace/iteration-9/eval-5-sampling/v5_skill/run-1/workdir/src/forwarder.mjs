import { countForwardBatch } from './metrics.mjs';
import { log } from './logger.mjs';

// 攒批转发给下游 analytics-ingest。批满或者到点就发。
// 下游只认 {events:[...]} 这一种 body 形状，改它要跟下游同步发版。
export function createForwarder(cfg, deps = {}) {
  const post = deps.post ?? defaultPost;
  let buffer = [];
  let timer = null;

  async function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (buffer.length === 0) return { sent: 0 };
    const batch = buffer;
    buffer = [];
    let attempt = 0;
    while (attempt <= cfg.maxRetries) {
      try {
        await post(cfg.endpoint, { events: batch });
        countForwardBatch(true);
        return { sent: batch.length };
      } catch (err) {
        attempt += 1;
        if (attempt > cfg.maxRetries) {
          countForwardBatch(false);
          log.error('forward failed, dropping batch', { size: batch.length, err: String(err) });
          return { sent: 0, dropped: batch.length };
        }
        await new Promise((r) => setTimeout(r, 50 * attempt));
      }
    }
    return { sent: 0 };
  }

  return {
    add(events) {
      if (!cfg.enabled) return;
      buffer.push(...events);
      if (buffer.length >= cfg.batchSize) {
        void flush();
        return;
      }
      if (!timer) timer = setTimeout(() => void flush(), cfg.flushMs);
    },
    flush,
    pending: () => buffer.length,
  };
}

async function defaultPost(endpoint, body) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`downstream ${res.status}`);
}
