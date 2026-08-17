import { appendFileSync, mkdirSync, statSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { countStorageBytes } from './metrics.mjs';

// 事件按 ndjson 追加，一行一个事件。超过 rotateBytes 就滚一个 .1 出去。
// 下游有从这些文件回捞的工具，所以文件名和一行一个 JSON 的格式不要随便改。
export function createStore(cfg) {
  mkdirSync(cfg.dir, { recursive: true });
  const active = join(cfg.dir, 'events.ndjson');

  function rotateIfNeeded() {
    if (!existsSync(active)) return;
    if (statSync(active).size < cfg.rotateBytes) return;
    renameSync(active, `${active}.1`);
  }

  return {
    path: active,
    write(events) {
      if (events.length === 0) return 0;
      rotateIfNeeded();
      const payload = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
      appendFileSync(active, payload);
      const bytes = Buffer.byteLength(payload);
      countStorageBytes(bytes);
      return bytes;
    },
  };
}
