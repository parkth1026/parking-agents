import assert from 'node:assert/strict';
import { validateEvent } from '../src/validate.mjs';

export function testAcceptsMinimalEvent() {
  const r = validateEvent({ event: 'page_view', ts: 1754697600 }, {});
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
}

export function testRejectsMissingRequired() {
  const r = validateEvent({ event: 'page_view' }, {});
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('ts')));
}

export function testRejectsNonIntegerTs() {
  const r = validateEvent({ event: 'x', ts: 1.5 }, {});
  assert.equal(r.ok, false);
}

export function testUnknownFieldsPassByDefault() {
  const r = validateEvent({ event: 'x', ts: 1, whatever: 1 }, {});
  assert.equal(r.ok, true);
}

export function testUnknownFieldsRejectedWhenConfigured() {
  const r = validateEvent({ event: 'x', ts: 1, whatever: 1 }, { rejectUnknownFields: true });
  assert.equal(r.ok, false);
}

export function testTooLargeEvent() {
  const r = validateEvent({ event: 'x', ts: 1, props: { blob: 'y'.repeat(200) } }, { maxEventBytes: 100 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('too large')));
}
