// secrets 扫描（v4 伴随截图保留的机械红线）：截图进任何保留产物前必须扫描
// token/凭据模式；BLOCKED 则 receipt FAIL、不入库。
// 零依赖约束：只扫「文件名 + PNG 文本元数据 + 可提取字符串」三个已声明 scope；
// 像素内渲染内容是已声明盲区（不做 OCR）。findings 永不回显命中内容本身，
// 只记 patternId / scope 层 / 命中位置——报文里出现凭据本身就是违规。
import { inflateSync } from 'node:zlib';

export const SECRETS_SCAN_SCOPE = Object.freeze(['filename', 'metadata', 'extractable-text']);

// token/凭据正则族（保守阻断：命中即 BLOCKED）。非穷尽——漏检兜底说明随
// references/screenshot-evidence.md 落盘：未命中不证明无凭据，入库前仍建议人工抽查。
export const SECRET_PATTERNS = Object.freeze([
  { id: 'github-classic-pat', pattern: /ghp_[A-Za-z0-9]{36}/ },
  { id: 'github-fine-grained-pat', pattern: /github_pat_[A-Za-z0-9_]{22,}/ },
  { id: 'gitlab-pat', pattern: /glpat-[A-Za-z0-9_-]{20,}/ },
  { id: 'slack-token', pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { id: 'aws-access-key', pattern: /AKIA[0-9A-Z]{16}/ },
  { id: 'google-api-key', pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { id: 'openai-style-key', pattern: /sk-[A-Za-z0-9_-]{20,}/ },
  { id: 'private-key-header', pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { id: 'jwt', pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}/ },
  { id: 'bearer-token', pattern: /Bearer\s+[A-Za-z0-9._=-]{20,}/i },
  { id: 'generic-assignment', pattern: /(api[_-]?key|secret|token|password|passwd|pwd|credential)\s*[:=]\s*['"]?[A-Za-z0-9_+/=-]{16,}/i },
]);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunkType(buffer, offset) {
  return buffer.toString('latin1', offset + 4, offset + 8);
}
function chunkLength(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

// 解析 PNG 文本块（tEXt / zTXt / iTXt），返回可直接进扫描管线的字符串数组。
// 解析是宽容的：单块损坏跳过该块，不让整批扫描崩溃（扫描红线不依赖格式完美）。
export function extractPngTextChunks(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return [];
  const texts = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const type = chunkType(buffer, offset);
    const length = chunkLength(buffer, offset);
    if (length < 0 || offset + 12 + length > buffer.length) break;
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'tEXt') {
      const zero = data.indexOf(0);
      if (zero >= 0) texts.push(data.toString('latin1', 0, zero), data.toString('latin1', zero + 1));
    } else if (type === 'zTXt') {
      const zero = data.indexOf(0);
      if (zero >= 0 && data[zero + 1] === 0) {
        try { texts.push(inflateSync(data.subarray(zero + 2)).toString('latin1')); } catch { /* 容错跳过 */ }
      }
    } else if (type === 'iTXt') {
      const zero = data.indexOf(0);
      if (zero >= 0 && data[zero + 1] === 0) {
        const rest = data.subarray(zero + 2);
        const langEnd = rest.indexOf(0);
        if (langEnd >= 0) {
          const translatedEnd = rest.indexOf(0, langEnd + 1);
          if (translatedEnd >= 0) texts.push(rest.toString('utf8', translatedEnd + 1));
        }
      }
    }
    offset += 12 + length;
  }
  return texts.filter((text) => text.length > 0);
}

// strings 式提取：整段字节里的可打印 ASCII 连续串。PNG 压缩流里偶发命中属正常，
// 只作为 findings 的 scope 层标注来源，命中判定仍由正则族完成。
export function extractPrintableStrings(buffer, minRun = 8) {
  if (!Buffer.isBuffer(buffer)) return [];
  const runs = [];
  let start = -1;
  for (let index = 0; index <= buffer.length; index += 1) {
    const byte = index < buffer.length ? buffer[index] : 0x0a;
    const printable = byte >= 0x20 && byte <= 0x7e;
    if (printable && start < 0) start = index;
    if (!printable && start >= 0) {
      if (index - start >= minRun) runs.push(buffer.toString('latin1', start, index));
      start = -1;
    }
  }
  return runs;
}

export function scanTextForSecrets(text, scopeLayer) {
  const findings = [];
  const value = String(text ?? '');
  for (const { id, pattern } of SECRET_PATTERNS) {
    const match = pattern.exec(value);
    if (match) findings.push({ patternId: id, scope: scopeLayer, at: match.index });
  }
  return findings;
}

// 对一组截图做三 scope 扫描，产出对象化 secretsScan（v4 报文形态）。
// shots: [{ displayFileName, bytes }]。返回 {result, scope, ocr} + findings（内容脱敏）。
export function scanShotsForSecrets(shots) {
  const findings = [];
  for (const shot of shots || []) {
    const filename = String(shot.displayFileName ?? '');
    findings.push(...scanTextForSecrets(filename, 'filename').map((f) => ({ ...f, shot: filename })));
    const buffer = Buffer.isBuffer(shot.bytes) ? shot.bytes : Buffer.from(shot.bytes ?? '');
    for (const text of extractPngTextChunks(buffer)) {
      findings.push(...scanTextForSecrets(text, 'metadata').map((f) => ({ ...f, shot: filename })));
    }
    const printable = `${extractPrintableStrings(buffer).join('\n')}\n${extractPngTextChunks(buffer).join('\n')}`;
    findings.push(...scanTextForSecrets(printable, 'extractable-text').map((f) => ({ ...f, shot: filename })));
  }
  return {
    result: findings.length ? 'BLOCKED' : 'CLEAR',
    scope: [...SECRETS_SCAN_SCOPE],
    ocr: false,
    ...(findings.length ? { findings } : {}),
  };
}
