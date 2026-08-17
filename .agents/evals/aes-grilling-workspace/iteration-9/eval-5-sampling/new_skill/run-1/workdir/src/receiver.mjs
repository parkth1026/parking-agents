import { isRegistered } from './auth.mjs';
import { validateEvent } from './validate.mjs';
import { countAccepted, countRejected } from './metrics.mjs';
import { log } from './logger.mjs';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// 一次请求可以带单个事件或事件数组。整批里有坏事件时，好的照收、坏的单独退回，
// 不整批失败——业务方普遍不重试，整批退回等于直接丢数据。
export function createReceiver({ cfg, store, forwarder }) {
  return async function handle(req, res) {
    const appId = req.headers['x-app-id'];
    if (!isRegistered(appId)) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'unknown app id' }));
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(await readBody(req));
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'body is not valid json' }));
      return;
    }

    const incoming = Array.isArray(parsed) ? parsed : [parsed];
    const accepted = [];
    const rejected = [];
    for (const [i, raw] of incoming.entries()) {
      const result = validateEvent(raw, cfg.validate);
      if (result.ok) {
        accepted.push({ ...raw, app: appId });
      } else {
        rejected.push({ index: i, errors: result.errors });
      }
    }

    if (accepted.length > 0) {
      store.write(accepted);
      forwarder.add(accepted);
      countAccepted(appId, accepted.length);
    }
    if (rejected.length > 0) {
      countRejected(rejected.length);
      log.warn('rejected events', { app: appId, count: rejected.length });
    }

    res.writeHead(rejected.length > 0 ? 207 : 202, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ accepted: accepted.length, rejected }));
  };
}
