// 极简自查：不引 eslint，只挡几条本仓库反复出过问题的写法。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const RULES = [
  { re: /console\.log\(/, msg: '用 logger 而不是 console.log' },
  { re: /require\(/, msg: '本仓库是 ESM，不要用 require' },
  { re: /process\.env\.[A-Z_]+\s*\|\|/, msg: '配置默认值写进 config/*.json，不要散在代码里' },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'data' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.mjs')) out.push(p);
  }
  return out;
}

let problems = 0;
for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    if (line.trimStart().startsWith('//')) return;
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        process.stdout.write(`${file}:${i + 1}: ${rule.msg}\n`);
        problems += 1;
      }
    }
  });
}

process.stdout.write(problems === 0 ? 'lint ok\n' : `${problems} problem(s)\n`);
process.exit(problems === 0 ? 0 : 1);
