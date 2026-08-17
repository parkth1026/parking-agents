const REQUIRED = ['event', 'ts'];
const KNOWN = new Set(['event', 'ts', 'app', 'user_id', 'session_id', 'props']);

export function validateEvent(raw, opts) {
  const errors = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['event must be a JSON object'] };
  }
  for (const key of REQUIRED) {
    if (raw[key] === undefined) errors.push(`missing required field: ${key}`);
  }
  if (raw.event !== undefined && typeof raw.event !== 'string') {
    errors.push('event must be a string');
  }
  if (raw.ts !== undefined && !Number.isInteger(raw.ts)) {
    errors.push('ts must be an integer unix second');
  }
  if (raw.props !== undefined && (typeof raw.props !== 'object' || raw.props === null)) {
    errors.push('props must be an object');
  }
  if (opts?.rejectUnknownFields) {
    for (const key of Object.keys(raw)) {
      if (!KNOWN.has(key)) errors.push(`unknown field: ${key}`);
    }
  }
  const size = Buffer.byteLength(JSON.stringify(raw));
  if (opts?.maxEventBytes && size > opts.maxEventBytes) {
    errors.push(`event too large: ${size} > ${opts.maxEventBytes}`);
  }
  return { ok: errors.length === 0, errors };
}

export function knownFields() {
  return [...KNOWN];
}
