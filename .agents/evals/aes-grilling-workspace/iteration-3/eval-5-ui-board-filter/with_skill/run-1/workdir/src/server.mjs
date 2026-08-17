import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const TASKS = [
  { id: 1, title: '整理季度目标', assignee: 'ayan', status: 'todo' },
  { id: 2, title: '客户回访记录', assignee: 'bo', status: 'doing' },
  { id: 3, title: '发布说明草稿', assignee: 'ayan', status: 'doing' },
  { id: 4, title: '归档旧项目', assignee: 'chen', status: 'done' }
];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

createServer(async (req, res) => {
  if (req.url === '/api/tasks') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(TASKS));
    return;
  }
  const file = req.url === '/' ? 'index.html' : req.url.slice(1);
  try {
    const body = await readFile(join('public', file));
    res.setHeader('content-type', MIME[extname(file)] ?? 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
}).listen(process.env.PORT ?? 4173);
