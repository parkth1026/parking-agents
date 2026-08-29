// ledger.mjs — Web 侧事件账本写入器
//
// decision-ledger.jsonl 是 Web 提交事件的证据链，写入权留在 web 层；读取与投影由
// 家族的决策档案投影库（workflow-interview/scripts/lib/dossier.mjs）负责。
// sha256Json 的稳定序列化格式与家族投影库一致，digest 语义两边同源。

import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

export function readLedger(webDir) {
  const pathname = join(webDir, 'decision-ledger.jsonl');
  if (!existsSync(pathname)) return [];
  return readFileSync(pathname, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

export function appendLedgerEvent(webDir, event) {
  mkdirSync(webDir, { recursive: true });
  const ledger = readLedger(webDir);
  const entry = {
    schema_version: 2,
    event_id: `evt-${Date.now()}-${randomBytes(4).toString('hex')}`,
    at: new Date().toISOString(),
    actor: { type: 'software-agent', id: 'workflow-interview-web' },
    previous_event_digest: ledger.at(-1)?.event_digest ?? null,
    ...event,
  };
  entry.event_digest = sha256Json(entry);
  const pathname = join(webDir, 'decision-ledger.jsonl');
  appendFileSync(pathname, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
  try { chmodSync(pathname, 0o600); } catch { /* Windows ACLs are the effective boundary. */ }
  return entry;
}
