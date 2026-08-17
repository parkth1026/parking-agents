// 服务自身指标。进程内累加，重启归零；/metrics 以纯文本暴露。
const counters = {
  events_total: 0,
  events_rejected_total: 0,
  events_by_app: new Map(),
  forward_batches_total: 0,
  forward_failures_total: 0,
  storage_bytes_total: 0,
};

export function countAccepted(appId, n = 1) {
  counters.events_total += n;
  counters.events_by_app.set(appId, (counters.events_by_app.get(appId) ?? 0) + n);
}

export function countRejected(n = 1) {
  counters.events_rejected_total += n;
}

export function countForwardBatch(ok) {
  counters.forward_batches_total += 1;
  if (!ok) counters.forward_failures_total += 1;
}

export function countStorageBytes(n) {
  counters.storage_bytes_total += n;
}

export function render() {
  const lines = [
    `events_total ${counters.events_total}`,
    `events_rejected_total ${counters.events_rejected_total}`,
    `forward_batches_total ${counters.forward_batches_total}`,
    `forward_failures_total ${counters.forward_failures_total}`,
    `storage_bytes_total ${counters.storage_bytes_total}`,
  ];
  for (const [app, n] of [...counters.events_by_app].sort()) {
    lines.push(`events_by_app{app="${app}"} ${n}`);
  }
  return lines.join('\n') + '\n';
}

export function snapshot() {
  return { ...counters, events_by_app: new Map(counters.events_by_app) };
}

export function resetForTests() {
  counters.events_total = 0;
  counters.events_rejected_total = 0;
  counters.events_by_app = new Map();
  counters.forward_batches_total = 0;
  counters.forward_failures_total = 0;
  counters.storage_bytes_total = 0;
}
