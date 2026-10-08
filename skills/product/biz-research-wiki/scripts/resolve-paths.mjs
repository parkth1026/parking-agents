import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function normalize(value) {
  return path.resolve(value.replace(/^~(?=[\\/]|$)/, homedir()));
}

function merge(base, overlay) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? merge(base[key] && typeof base[key] === 'object' ? base[key] : {}, value)
      : value;
  }
  return result;
}

function readConfig(file) {
  const value = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`配置必须是 JSON 对象：${file}`);
  }
  return value;
}

try {
  const defaults = fileURLToPath(new URL('../config.json', import.meta.url));
  const envConfig = normalize(process.env.SKILL_ENV || path.join(homedir(), '.config/parking-agents/skill-env.json'));
  if (process.env.SKILL_ENV && !existsSync(envConfig)) {
    throw new Error(`SKILL_ENV 配置文件不存在：${envConfig}`);
  }
  const config = merge(readConfig(defaults), existsSync(envConfig) ? readConfig(envConfig) : {});
  const configuredRoot = config.bizResearchWiki?.rootDir;
  if (typeof configuredRoot !== 'string' || !configuredRoot.trim()) {
    throw new Error('未配置 bizResearchWiki.rootDir；请写入环境层配置，不会回退到当前仓库。');
  }
  const rootDir = normalize(configuredRoot);
  const paths = {
    rootDir,
    wikiDir: path.join(rootDir, 'wiki'),
    rawDir: path.join(rootDir, 'raw'),
    runsDir: path.join(rootDir, 'runs'),
  };
  console.log(JSON.stringify({ envConfig, ...paths, exists: Object.fromEntries(
    Object.entries(paths).map(([key, value]) => [key, existsSync(value)])
  ) }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
