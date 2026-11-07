import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const test = fileURLToPath(new URL('./scripts/test_projects.py', import.meta.url));
const run = spawnSync(process.env.PYTHON || 'python', ['-B', test], {
  stdio: 'inherit', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
});
if (run.error) console.error(run.error.message);
process.exit(run.status ?? 1);
