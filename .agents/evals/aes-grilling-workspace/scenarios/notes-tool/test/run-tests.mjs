import assert from 'node:assert';
import { loadNotes } from '../src/store.mjs';

const notes = await loadNotes();
assert.ok(notes.length >= 3);
assert.ok(notes.every((note) => note.category && note.created));
console.log('ok - 2 assertions');
