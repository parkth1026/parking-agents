import { readFile, appendFile } from 'node:fs/promises';
import { handle } from './handler.mjs';

// 已知问题：handle 抛错时该事件被直接丢弃，没有重试也没有留痕。
const lines = (await readFile('data/events.jsonl', 'utf8')).trim().split('\n');
for (const line of lines) {
  const event = JSON.parse(line);
  try {
    await handle(event);
    await appendFile('data/ledger.jsonl', JSON.stringify({ id: event.id, ok: true }) + '\n');
  } catch (error) {
    console.error(`drop event ${event.id}: ${error.message}`);
  }
}
