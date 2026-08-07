import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { loadNotes } from '../store.mjs';

createServer(async (req, res) => {
  if (req.url === '/api/notes') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(await loadNotes()));
    return;
  }
  res.setHeader('content-type', 'text/html');
  res.end(await readFile(new URL('public/index.html', import.meta.url)));
}).listen(process.env.PORT ?? 4174);
