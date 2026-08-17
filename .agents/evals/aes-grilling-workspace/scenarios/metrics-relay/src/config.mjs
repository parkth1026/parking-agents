import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function deepMerge(base, override) {
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object'
      ? deepMerge(base[k], v)
      : v;
  }
  return out;
}

let cached = null;

// 配置文件是部署时渲染出来的，进程只读一次，不监听变更。
// 想改配置要重新部署，不能热更新。
export function loadConfig() {
  if (cached) return cached;
  const base = JSON.parse(readFileSync(join(root, 'config', 'default.json'), 'utf8'));
  const env = process.env.NODE_ENV;
  if (!env || env === 'development') {
    cached = base;
    return cached;
  }
  const overridePath = join(root, 'config', `${env}.json`);
  cached = deepMerge(base, JSON.parse(readFileSync(overridePath, 'utf8')));
  return cached;
}

export function resetConfigForTests() {
  cached = null;
}
