const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

let threshold = LEVELS.info;

export function setLevel(level) {
  threshold = LEVELS[level] ?? LEVELS.info;
}

function emit(level, msg, fields) {
  if (LEVELS[level] < threshold) return;
  const line = { level, msg, ...fields };
  process.stderr.write(JSON.stringify(line) + '\n');
}

export const log = {
  debug: (msg, fields) => emit('debug', msg, fields),
  info: (msg, fields) => emit('info', msg, fields),
  warn: (msg, fields) => emit('warn', msg, fields),
  error: (msg, fields) => emit('error', msg, fields),
};
