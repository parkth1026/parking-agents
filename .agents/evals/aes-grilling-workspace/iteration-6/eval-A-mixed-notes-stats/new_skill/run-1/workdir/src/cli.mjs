import { appendFile } from 'node:fs/promises';
import { loadNotes } from './store.mjs';

const [command, ...rest] = process.argv.slice(2);

if (command === 'add') {
  const [category, ...words] = rest;
  const note = { category, text: words.join(' '), created: new Date().toISOString() };
  await appendFile('data/notes.jsonl', JSON.stringify(note) + '\n');
  console.log('added');
} else if (command === 'list') {
  for (const note of await loadNotes()) {
    console.log(`[${note.category}] ${note.text}`);
  }
} else {
  console.log('usage: notes <add|list>');
}
