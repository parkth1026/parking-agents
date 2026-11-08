import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sha256 } from './run-once.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export function prepare({ project = process.cwd(), home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
  out, source, python = 'python', timeoutMs = 1800000 } = {}) {
  project = realpathSync(project);
  home = realpathSync(home);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 6000) throw new Error('timeout must be at least 6000 ms');
  let skillScanRoot = path.resolve(scriptDir);
  while (path.basename(skillScanRoot) !== 'skills' && path.dirname(skillScanRoot) !== skillScanRoot) {
    skillScanRoot = path.dirname(skillScanRoot);
  }
  if (path.basename(skillScanRoot) !== 'skills') throw new Error('Cannot locate skill scan root');
  out = path.resolve(out || path.join(project, 'outputs', 'codex-project-repair-' + new Date().toISOString().replace(/[:.]/g, '-')));
  const executable = execFileSync(python, ['-B', '-c', 'import sys; print(sys.executable)'],
    { encoding: 'utf8', windowsHide: true, timeout: 20000 }).trim();
  // The existing Python stdlib backend provides SQLite's consistent backup API.
  // New orchestration uses Node builtins; no downloaded packages or shell interpolation.
  mkdirSync(path.dirname(out), { recursive: true });
  const parent = realpathSync(path.dirname(out));
  const relative = path.relative(skillScanRoot, path.join(parent, path.basename(out)));
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('Output and private backups must be outside the skill scan root');
  }
  mkdirSync(out); // Refuse an existing bundle, including one already claimed.
  const args = ['-B', path.join(scriptDir, 'projects.py'), 'plan', '--home', home,
    '--out', path.join(out, 'plan.json'), '--local-only'];
  if (source) args.push('--source', source);
  execFileSync(executable, args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  copyFileSync(path.join(scriptDir, 'projects.py'), path.join(out, 'projects.py'));
  copyFileSync(path.join(scriptDir, 'run-once.mjs'), path.join(out, 'run-once.mjs'));
  const hashes = Object.fromEntries(['projects.py', 'plan.json'].map(name => [name, sha256(readFileSync(path.join(out, name)))]));
  writeFileSync(path.join(out, 'config.json'), JSON.stringify({ schemaVersion: 1, project, home,
    python: executable, timeoutMs, hashes }, null, 2));
  if (/[\r\n"]/.test(process.execPath)) throw new Error('Unsupported Node executable path');
  const node = process.execPath.replaceAll('%', '%%');
  writeFileSync(path.join(out, 'run-repair.cmd'),
    `@echo off\r\n"${node}" "%~dp0run-once.mjs"\r\nset "repair_exit=%ERRORLEVEL%"\r\npause\r\nexit /b %repair_exit%\r\n`, 'utf8');
  writeFileSync(path.join(out, 'README.txt'),
    '双击 run-repair.cmd，然后彻底退出 Codex。保持关闭，等脚本提示成功后再打开。\n' +
    '也可以先退出 Codex，再双击脚本。程序不会关闭、结束进程或重启应用。\n' +
    '本脚本包只执行一次，等待超时或失败后也不能复用；解决原因后重新生成。\n' +
    '生成脚本不等于恢复成功；结果见 result.json，独立备份和恢复凭据见 backup/。\n' +
    '恢复当前账号的本地项目；当前项目路径只决定输出位置，不限制恢复为一个项目。\n' +
    '会话正文和数据库不修改；远程会话归属保留在来源存档，不导入。\n' +
    '重启后持久化、界面分组和原会话续用须另行验收。\n', 'utf8');
  return { status: 'PREPARED_NOT_APPLIED', folder: out, launcher: path.join(out, 'run-repair.cmd'),
    result: path.join(out, 'result.json') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = {};
    for (let i = 2; i < process.argv.length; i += 2) {
      const key = { '--project': 'project', '--home': 'home', '--out': 'out', '--source': 'source', '--python': 'python' }[process.argv[i]];
      if (!key || !process.argv[i + 1]) throw new Error('Usage: prepare.mjs [--project DIR] [--home DIR] [--out NEW_DIR] [--source ID] [--python EXE]');
      options[key] = process.argv[i + 1];
    }
    console.log(JSON.stringify(prepare(options), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
