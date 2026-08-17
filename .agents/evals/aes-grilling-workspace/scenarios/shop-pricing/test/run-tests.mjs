import assert from 'node:assert';
import { finalPrice } from '../src/pricing.mjs';

assert.equal(finalPrice({ items: [{ price: 300, qty: 1 }], member: false }), 260);
assert.equal(finalPrice({ items: [{ price: 299, qty: 1 }], member: false }), 299);
assert.equal(finalPrice({ items: [{ price: 100, qty: 2 }], member: true }), 200);
console.log('ok - 3 assertions');
