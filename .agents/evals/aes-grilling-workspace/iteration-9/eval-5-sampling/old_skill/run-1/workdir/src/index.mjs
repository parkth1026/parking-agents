import { createServer } from 'node:http';
import { loadConfig } from './config.mjs';
import { createStore } from './storage.mjs';
import { createForwarder } from './forwarder.mjs';
import { createReceiver } from './receiver.mjs';
import { render } from './metrics.mjs';
import { log, setLevel } from './logger.mjs';

const cfg = loadConfig();
setLevel(cfg.log.level);

const store = createStore(cfg.storage);
const forwarder = createForwarder(cfg.forward);
const receive = createReceiver({ cfg, store, forwarder });

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/v1/events') {
    void receive(req, res);
    return;
  }
  if (req.method === 'GET' && req.url === '/metrics') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(render());
    return;
  }
  if (req.method === 'GET' && req.url === '/healthz') {
    res.writeHead(200);
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(cfg.port, () => log.info('listening', { port: cfg.port }));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    log.info('draining', { pending: forwarder.pending() });
    await forwarder.flush();
    server.close(() => process.exit(0));
  });
}
