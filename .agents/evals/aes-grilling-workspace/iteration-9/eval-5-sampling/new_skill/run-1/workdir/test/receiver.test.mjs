import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createReceiver } from '../src/receiver.mjs';
import { resetForTests, snapshot } from '../src/metrics.mjs';

function fakeReq(body, headers) {
  const r = Readable.from([Buffer.from(JSON.stringify(body))]);
  r.headers = headers;
  return r;
}

function fakeRes() {
  return {
    code: null,
    body: '',
    writeHead(code) {
      this.code = code;
    },
    end(chunk) {
      this.body = chunk ?? '';
    },
  };
}

function harness() {
  resetForTests();
  const written = [];
  const forwarded = [];
  const cfg = { validate: { maxEventBytes: 8192 } };
  const handle = createReceiver({
    cfg,
    store: { write: (e) => written.push(...e) },
    forwarder: { add: (e) => forwarded.push(...e) },
  });
  return { handle, written, forwarded };
}

export async function testRejectsUnknownApp() {
  const { handle, written } = harness();
  const res = fakeRes();
  await handle(fakeReq({ event: 'x', ts: 1 }, { 'x-app-id': 'nope' }), res);
  assert.equal(res.code, 401);
  assert.equal(written.length, 0);
}

export async function testAcceptsSingleEvent() {
  const { handle, written, forwarded } = harness();
  const res = fakeRes();
  await handle(fakeReq({ event: 'page_view', ts: 1754697600 }, { 'x-app-id': 'web-portal' }), res);
  assert.equal(res.code, 202);
  assert.equal(written.length, 1);
  assert.equal(forwarded.length, 1);
  assert.equal(written[0].app, 'web-portal');
  assert.equal(snapshot().events_total, 1);
}

export async function testAcceptsArrayAndPartialFailure() {
  const { handle, written } = harness();
  const res = fakeRes();
  const body = [
    { event: 'a', ts: 1 },
    { event: 'b' },
    { event: 'c', ts: 3 },
  ];
  await handle(fakeReq(body, { 'x-app-id': 'ios-app' }), res);
  assert.equal(res.code, 207);
  assert.equal(written.length, 2);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.accepted, 2);
  assert.equal(parsed.rejected.length, 1);
  assert.equal(parsed.rejected[0].index, 1);
}

export async function testServerOverwritesAppField() {
  const { handle, written } = harness();
  const res = fakeRes();
  await handle(fakeReq({ event: 'x', ts: 1, app: 'lying' }, { 'x-app-id': 'crm-sync' }), res);
  assert.equal(written[0].app, 'crm-sync');
}
