/** Read local source data without executing macros, formulas, or embedded code. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readZip, parseXml, children, descendants, xmlText} from './archive-xml.mjs';

const MAX_FILE = 32 * 1024 * 1024;
const SS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const linesOf = text => text.split(/\r\n|[\n\r]/).filter((_, i, all) => i < all.length - 1 || all[i] !== '');

export function mdCells(line) {
  let text = line.trim(), cell = '', code = 0; const result = [];
  if (text.startsWith('|')) text = text.slice(1);
  // Delimiters are identified while scanning, so an escaped final pipe remains content.
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length && /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(text[i + 1])) { cell += text[++i]; continue; }
    if (ch === '`') { let end = i; while (text[end] === '`') end++; const count = end - i; if (code === count) code = 0; else if (!code && text.indexOf('`'.repeat(count), end) >= 0) code = count; cell += text.slice(i, end); i = end - 1; continue; }
    if (ch === '|' && !code) { result.push(cell.trim()); cell = ''; if (i === text.length - 1) return result; }
    else cell += ch;
  }
  result.push(cell.trim()); return result;
}
export function markdownTables(text) {
  const lines = linesOf(text), tables = []; let section = '', fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], marker = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) { if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null; continue; }
    if (marker) { fence = {char: marker[1][0], length: marker[1].length}; continue; }
    if (/^\s*#/.test(line)) section = line.replace(/^\s*#+\s*/, '').trim();
    if (i + 1 >= lines.length || !line.includes('|')) continue;
    const separator = mdCells(lines[i + 1]);
    if (separator.length < 2 || !separator.every(c => /^:?-{3,}:?$/.test(c.replaceAll(' ', '')))) continue;
    const rows = [{locator: `line:${i + 1}`, values: mdCells(line)}]; i += 2;
    while (i < lines.length && lines[i].includes('|') && lines[i].trim() && !/^\s{0,3}(`{3,}|~{3,})/.test(lines[i])) { rows.push({locator: `line:${i + 1}`, values: mdCells(lines[i])}); i++; }
    tables.push({name: section || `table-${tables.length + 1}`, rows}); i--;
  }
  return tables;
}
export function decodeText(raw) {
  const encodings = raw[0] === 0xff && raw[1] === 0xfe ? ['utf-16le'] : raw[0] === 0xfe && raw[1] === 0xff ? ['utf-16be'] : ['utf-8', 'gb18030'];
  for (const encoding of encodings) { try { return new TextDecoder(encoding, {fatal: true}).decode(raw); } catch {} }
  throw new Error('无法识别文本编码；请转换为 UTF-8。');
}
function csvRows(text, delimiter) {
  const rows = []; let row = [], value = '', quoted = false, afterQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { value += '"'; i++; } else if (ch === '"') { quoted = false; afterQuote = true; } else value += ch; continue; }
    if (ch === '"' && !value && !afterQuote) { quoted = true; continue; }
    if (ch === delimiter) { row.push(value); value = ''; afterQuote = false; continue; }
    if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(value); rows.push(row); row = []; value = ''; afterQuote = false; continue; }
    if (afterQuote) throw new Error('CSV 引号后存在无效字符。');
    value += ch;
  }
  if (quoted) throw new Error('CSV 引号未闭合。');
  if (row.length || value || afterQuote) { row.push(value); rows.push(row); }
  return rows;
}
function csvDelimiter(text) {
  const candidates = [',', ';', '\t'].map(delimiter => {
    try { const widths = csvRows(text, delimiter).slice(0, 20).filter(r => r.some(v => v !== '')).map(r => r.length); return {delimiter, score: widths.length && widths.every(n => n === widths[0]) ? widths[0] : 0}; } catch { return {delimiter, score: 0}; }
  });
  return candidates.sort((a, b) => b.score - a.score)[0].delimiter;
}
function textNodes(node, namespace) { return descendants(node, 't', namespace).map(xmlText).join(''); }
function readXlsx(raw) {
  const zip = readZip(raw), tables = [], warnings = [];
  const shared = zip.has('xl/sharedStrings.xml') ? children(parseXml(zip.read('xl/sharedStrings.xml')), 'si', SS).map(n => textNodes(n, SS)) : [];
  const relationships = new Map(parseXml(zip.read('xl/_rels/workbook.xml.rels')).children.filter(n => n.name === 'Relationship' && n.attrs.TargetMode !== 'External').map(n => [n.attrs.Id, n.attrs.Target]));
  const sheets = children(parseXml(zip.read('xl/workbook.xml')), 'sheets', SS)[0];
  if (!sheets) throw new Error('工作表列表缺失。');
  for (const sheet of children(sheets, 'sheet', SS)) {
    const relationAttribute = Object.keys(sheet.attrs).find(key => key.includes(':') && key.split(':')[1] === 'id' && sheet.namespaces[key.split(':')[0]] === REL);
    const target = relationships.get(sheet.attrs[relationAttribute]); if (!target) throw new Error('工作表引用缺失。');
    const member = target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join('xl', target));
    const root = parseXml(zip.read(member)), rows = [], formulas = [];
    for (const row of descendants(root, 'row', SS)) {
      const values = [], cells = [];
      for (const cell of children(row, 'c', SS)) {
        const ref = cell.attrs.r || '', match = ref.match(/^([A-Z]+)[1-9][0-9]*$/); if (!match) throw new Error('无效的单元格坐标。');
        let ix = 0; for (const ch of match[1]) ix = ix * 26 + ch.charCodeAt(0) - 64; ix--;
        if (ix > 2047) throw new Error('工作表列数超过 2048；请导出能力范围。');
        while (values.length <= ix) { values.push(''); cells.push(''); }
        const v = children(cell, 'v', SS)[0], formula = children(cell, 'f', SS)[0]; let value = v ? xmlText(v) : '';
        if (cell.attrs.t === 's' && value !== '') { if (!/^\d+$/.test(value) || !Object.hasOwn(shared, Number(value))) throw new Error('共享字符串引用无效。'); value = shared[Number(value)]; }
        else if (cell.attrs.t === 'inlineStr') value = textNodes(cell, SS);
        else if (cell.attrs.t === 'b') value = value === '1' ? 'TRUE' : 'FALSE';
        if (formula) { formulas.push({cell: ref, formula: xmlText(formula), cachedValue: value}); warnings.push(`${sheet.attrs.name}!${ref}: 公式仅保留缓存值，未重算；涉及状态时需核实。`); }
        values[ix] = value; cells[ix] = ref;
      }
      if (values.some(v => v !== '')) rows.push({locator: `${sheet.attrs.name}!row:${row.attrs.r || '?'}`, values, cells});
    }
    const mergedRanges = descendants(root, 'mergeCell', SS).map(n => n.attrs.ref);
    if (mergedRanges.length) warnings.push(`${sheet.attrs.name}: 存在合并单元格；不自动填充合并范围。`);
    tables.push({name: sheet.attrs.name, state: sheet.attrs.state || 'visible', rows, mergedRanges, formulas});
  }
  return {tables, warnings};
}
function readDocx(raw) {
  const root = parseXml(readZip(raw).read('word/document.xml'));
  const text = descendants(root, 'p', WORD).map(p => textNodes(p, WORD)).join('\n');
  const tables = descendants(root, 'tbl', WORD).map((table, i) => ({name: `table-${i + 1}`, rows: children(table, 'tr', WORD).map((row, j) => ({locator: `table:${i + 1}/row:${j + 1}`, values: children(row, 'tc', WORD).map(c => textNodes(c, WORD))}))}));
  return {text, tables};
}
export function extract(file) {
  const absolute = path.resolve(file), ext = path.extname(absolute).toLowerCase();
  if (fs.statSync(absolute).size > MAX_FILE) throw new Error(`${path.basename(absolute)}: 文件超过 32 MB。`);
  const raw = fs.readFileSync(absolute);
  if (raw.length > MAX_FILE) throw new Error('文件超过 32 MB。');
  const source = {id: 'SRC-' + sha256(absolute).slice(0, 10), name: path.basename(absolute), path: absolute, sha256: sha256(raw), kind: ext.slice(1), tables: [], warnings: []};
  if (['.md', '.markdown', '.txt'].includes(ext)) { source.text = decodeText(raw); source.lines = linesOf(source.text).map((text, i) => ({locator: `line:${i + 1}`, text})); source.tables = markdownTables(source.text); }
  else if (['.csv', '.tsv'].includes(ext)) { source.text = decodeText(raw); const delimiter = ext === '.tsv' ? '\t' : csvDelimiter(source.text); source.tables = [{name: path.basename(absolute, ext), rows: csvRows(source.text, delimiter).map((values, i) => ({locator: `record:${i + 1}`, values}))}]; }
  else if (['.xlsx', '.xlsm'].includes(ext)) { Object.assign(source, readXlsx(raw)); if (ext === '.xlsm') source.warnings.push('仅提取单元格；宏未执行。'); }
  else if (ext === '.docx') Object.assign(source, readDocx(raw));
  else if (ext === '.json') source.data = JSON.parse(decodeText(raw));
  else throw new Error(`${ext} 暂不支持直接提取。旧版 XLS、PDF、扫描件先通过相应文件工具转换为可读文字或 XLSX，再运行；保留原始来源。`);
  return source;
}
export function main(args = process.argv.slice(2)) {
  const outIndex = args.indexOf('--out');
  if (outIndex < 1 || outIndex !== args.length - 2) throw new Error('用法：node extract_sources.mjs <input...> --out <output.json>');
  const output = path.resolve(args[outIndex + 1]); if (fs.existsSync(output)) throw new Error(`输出已存在，拒绝覆盖：${output}`);
  const sources = [], failures = [];
  for (const input of args.slice(0, outIndex)) { try { sources.push(extract(input)); } catch (error) { failures.push({path: path.resolve(input), reason: error.message}); } }
  if (!sources.length) throw new Error('全部输入读取失败：' + JSON.stringify(failures));
  fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify({version: 1, sources, failures}, null, 2), {encoding: 'utf8', flag: 'wx'});
  console.log(JSON.stringify({status: failures.length ? 'PARTIAL' : 'EXTRACTED', sources: sources.length, failures, output}));
  return failures.length ? 2 : 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { try { process.exitCode = main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
