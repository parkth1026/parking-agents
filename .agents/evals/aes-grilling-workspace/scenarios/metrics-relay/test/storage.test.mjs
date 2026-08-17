import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../src/storage.mjs';
import { resetForTests, snapshot } from '../src/metrics.mjs';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'relay-store-'));
}

export function testWritesOneJsonPerLine() {
  resetForTests();
  const dir = tmp();
  try {
    const store = createStore({ dir, rotateBytes: 1024 * 1024 });
    store.write([
      { event: 'a', ts: 1, app: 'web-portal' },
      { event: 'b', ts: 2, app: 'web-portal' },
    ]);
    const lines = readFileSync(store.path, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).event, 'a');
    assert.ok(snapshot().storage_bytes_total > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function testEmptyWriteIsNoop() {
  resetForTests();
  const dir = tmp();
  try {
    const store = createStore({ dir, rotateBytes: 1024 });
    assert.equal(store.write([]), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function testRotatesWhenOverSize() {
  resetForTests();
  const dir = tmp();
  try {
    const store = createStore({ dir, rotateBytes: 40 });
    store.write([{ event: 'first', ts: 1, app: 'web-portal' }]);
    store.write([{ event: 'second', ts: 2, app: 'web-portal' }]);
    const rotated = readFileSync(`${store.path}.1`, 'utf8');
    assert.ok(rotated.includes('first'));
    const active = readFileSync(store.path, 'utf8');
    assert.ok(active.includes('second'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
