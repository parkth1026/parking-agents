import { readFile } from 'node:fs/promises';

export async function loadNotes() {
  const raw = await readFile('data/notes.jsonl', 'utf8');
  return raw.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}
