import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const test = fileURLToPath(new URL('./scripts/test_projects.py', import.meta.url));
const run = spawnSync(process.env.PYTHON || 'python', ['-B', test], {
  stdio: 'inherit', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
});
if (run.error) console.error(run.error.message);
if (run.status !== 0) process.exit(run.status ?? 1);
const once = spawnSync(process.execPath, ['--test', fileURLToPath(new URL('./scripts/test_run_once.mjs', import.meta.url))], {
  stdio: 'inherit', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
});
if (once.error) console.error(once.error.message);
process.exit(once.status ?? 1);
