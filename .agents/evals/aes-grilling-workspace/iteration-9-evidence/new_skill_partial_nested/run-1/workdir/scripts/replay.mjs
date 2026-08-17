// 从落盘的 ndjson 里回捞事件重新转发给下游。下游出故障丢批之后用它补数。
// 用法：node scripts/replay.mjs data/events.ndjson [--from 1754697600] [--to ...]
import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.mjs';
import { createForwarder } from '../src/forwarder.mjs';

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  process.stderr.write('usage: replay.mjs <ndjson> [--from ts] [--to ts]\n');
  process.exit(2);
}

function flag(name) {
  const i = rest.indexOf(name);
  return i >= 0 ? Number(rest[i + 1]) : null;
}

const from = flag('--from');
const to = flag('--to');

const cfg = loadConfig();
const forwarder = createForwarder(cfg.forward);

let replayed = 0;
for (const line of readFileSync(file, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const event = JSON.parse(line);
  if (from !== null && event.ts < from) continue;
  if (to !== null && event.ts > to) continue;
  forwarder.add([event]);
  replayed += 1;
}

await forwarder.flush();
process.stdout.write(`replayed ${replayed} events\n`);
