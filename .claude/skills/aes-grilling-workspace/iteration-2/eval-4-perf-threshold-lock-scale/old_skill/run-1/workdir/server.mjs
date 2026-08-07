import { createServer } from 'node:http';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

createServer(async (req, res) => {
  if (req.url === '/summary') {
    // 三段串行聚合，各自模拟一次慢查询
    await sleep(180); await sleep(160); await sleep(150);
    res.end(JSON.stringify({ items: 12, total: 3200 }));
    return;
  }
  res.end('ok');
}).listen(3000, () => console.log('listening :3000'));
