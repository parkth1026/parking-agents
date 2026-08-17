import assert from 'node:assert';
import { handle } from '../src/handler.mjs';

await handle({ id: 'x', amount: 1 });
await assert.rejects(() => handle({ id: 'y', amount: 0 }), /invalid amount/);
console.log('ok - 2 assertions');
