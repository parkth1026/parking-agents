import { execFileSync } from 'node:child_process';

function concreteWindowsCommand(candidates) {
  return candidates.find((candidate) => /\.(?:cmd|bat|exe)$/i.test(candidate));
}

export function resolveCommand(command, options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== 'win32') return [...command];

  const commandName = command[0];
  let candidates;
  try {
    candidates = execFileSync('where.exe', [commandName], {
      encoding: 'utf8',
      env: options.env || process.env,
    }).split(/\r?\n/).filter(Boolean);
  } catch {
    throw new Error(`找不到命令 "${commandName}"，请确认已安装并在 PATH 中`);
  }

  // #4: where.exe 可能先返回无法由 spawn 启动的无扩展名 npm/AppX shim。
  const resolved = concreteWindowsCommand(candidates);
  if (!resolved) {
    throw new Error(`命令 "${commandName}" 没有可执行的 .cmd、.bat 或 .exe 候选`);
  }
  return /\.(?:cmd|bat)$/i.test(resolved)
    ? ['cmd.exe', '/d', '/s', '/c', resolved, ...command.slice(1)]
    : [resolved, ...command.slice(1)];
}
