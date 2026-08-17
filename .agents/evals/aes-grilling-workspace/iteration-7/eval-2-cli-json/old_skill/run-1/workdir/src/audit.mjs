// minicli: 审计一份配置 JSON，输出文本报告
import { readFileSync } from 'node:fs';

export function audit(configPath) {
  const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
  const findings = [];
  if (!cfg.name) findings.push({ rule: 'has-name', level: 'error', message: 'missing name' });
  if (cfg.debug === true) findings.push({ rule: 'no-debug', level: 'warn', message: 'debug enabled' });
  return findings;
}

if (process.argv[2]) {
  const findings = audit(process.argv[2]);
  for (const f of findings) console.log(`[${f.level}] ${f.rule}: ${f.message}`);
  console.log(findings.length ? `${findings.length} finding(s)` : 'clean');
  process.exit(findings.some(f => f.level === 'error') ? 1 : 0);
}
