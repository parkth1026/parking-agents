import {inflateRawSync} from 'node:zlib';

const MAX_ZIP = 96 * 1024 * 1024;
export function crc32(raw) {
  let crc = 0xffffffff;
  for (const byte of raw) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Read the central directory first. Never trust local headers for allocation sizes.
export function readZip(raw) {
  let end = -1;
  for (let i = raw.length - 22; i >= Math.max(0, raw.length - 65557); i--) {
    if (raw.readUInt32LE(i) === 0x06054b50 && i + 22 + raw.readUInt16LE(i + 20) === raw.length) { end = i; break; }
  }
  if (end < 0) throw new Error('无效 ZIP：缺少结束记录。');
  const count = raw.readUInt16LE(end + 10), size = raw.readUInt32LE(end + 12), start = raw.readUInt32LE(end + 16);
  if (raw.readUInt16LE(end + 4) || raw.readUInt16LE(end + 6) || raw.readUInt16LE(end + 8) !== count || count === 0xffff || start === 0xffffffff || size === 0xffffffff) throw new Error('不支持多卷 ZIP 或 ZIP64。');
  if (start + size > end) throw new Error('无效 ZIP 目录边界。');
  const entries = new Map(); let offset = start, total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > start + size || raw.readUInt32LE(offset) !== 0x02014b50) throw new Error('无效 ZIP 目录。');
    const flags = raw.readUInt16LE(offset + 8), method = raw.readUInt16LE(offset + 10), crc = raw.readUInt32LE(offset + 16), compressed = raw.readUInt32LE(offset + 20), length = raw.readUInt32LE(offset + 24);
    const nameLength = raw.readUInt16LE(offset + 28), extraLength = raw.readUInt16LE(offset + 30), commentLength = raw.readUInt16LE(offset + 32), local = raw.readUInt32LE(offset + 42);
    if (flags & 1 || flags & 0x40) throw new Error('不支持加密 ZIP。');
    if (![0, 8].includes(method)) throw new Error(`不支持 ZIP 压缩方式 ${method}。`);
    if ([compressed, length, local].includes(0xffffffff)) throw new Error('不支持 ZIP64。');
    total += length;
    if (total > MAX_ZIP) throw new Error('解压后超过 96 MB；请缩小输入。');
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > start + size || raw.readUInt16LE(offset + 34)) throw new Error('无效 ZIP 条目边界。');
    const name = new TextDecoder('utf-8', {fatal: true}).decode(raw.subarray(offset + 46, offset + 46 + nameLength));
    if (entries.has(name)) throw new Error('ZIP 成员名称重复。');
    if (local + 30 > start || raw.readUInt32LE(local) !== 0x04034b50) throw new Error('无效 ZIP 本地头。');
    if (raw.readUInt16LE(local + 6) !== flags || raw.readUInt16LE(local + 8) !== method) throw new Error('ZIP 本地头与目录不一致。');
    const localNameLength = raw.readUInt16LE(local + 26), localExtraLength = raw.readUInt16LE(local + 28);
    const dataOffset = local + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressed > start || !raw.subarray(local + 30, local + 30 + localNameLength).equals(raw.subarray(offset + 46, offset + 46 + nameLength))) throw new Error('无效 ZIP 数据边界或成员名。');
    entries.set(name, {method, crc, compressed, length, dataOffset}); offset = next;
  }
  if (offset !== start + size) throw new Error('ZIP 目录长度不一致。');
  return {has: name => entries.has(name), read(name) {
    const e = entries.get(name); if (!e) throw new Error(`ZIP 成员缺失：${name}`);
    const compressed = raw.subarray(e.dataOffset, e.dataOffset + e.compressed);
    const data = e.method === 0 ? compressed : inflateRawSync(compressed, {maxOutputLength: Math.max(1, e.length)});
    if (data.length !== e.length || crc32(data) !== e.crc) throw new Error(`ZIP 成员长度或 CRC 不匹配：${name}`);
    return data;
  }};
}

function entities(text) {
  if (/&(?!(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-f]+);)/i.test(text)) throw new Error('无效或未声明 XML 实体。');
  return text.replace(/&([^;\s]+);/g, (_, name) => {
    const standard = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"};
    if (Object.hasOwn(standard, name)) return standard[name];
    if (!/^#(?:[0-9]+|x[0-9a-f]+)$/i.test(name)) throw new Error(`不支持 XML 实体：${name}`);
    const n = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    if (!(n === 9 || n === 10 || n === 13 || (n >= 32 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)))) throw new Error('无效 XML 字符引用。');
    return String.fromCodePoint(n);
  });
}

// Small namespace-aware XML reader; DTD and all declaration forms are rejected.
export function parseXml(raw) {
  const text = new TextDecoder('utf-8', {fatal: true}).decode(raw).replace(/^\uFEFF/, '');
  const root = {children: [], content: [], namespaces: {}}, stack = [root];
  let offset = 0, nodes = 0;
  const namePattern = '[A-Za-z_][\\w.:-]*';
  while (offset < text.length) {
    const parent = stack.at(-1);
    if (text[offset] !== '<') {
      const stop = text.indexOf('<', offset), end = stop < 0 ? text.length : stop;
      const value = entities(text.slice(offset, end));
      if (stack.length === 1 && value.trim()) throw new Error('XML 根节点外存在正文。');
      parent.content.push(value); offset = end; continue;
    }
    if (text.startsWith('<!--', offset)) { const end = text.indexOf('-->', offset + 4); if (end < 0) throw new Error('XML 注释未闭合。'); offset = end + 3; continue; }
    if (text.startsWith('<![CDATA[', offset)) { const end = text.indexOf(']]>', offset + 9); if (end < 0 || stack.length === 1) throw new Error('无效 XML CDATA。'); parent.content.push(text.slice(offset + 9, end)); offset = end + 3; continue; }
    if (text.startsWith('<?', offset)) { const end = text.indexOf('?>', offset + 2); if (end < 0) throw new Error('XML 指令未闭合。'); offset = end + 2; continue; }
    if (text.startsWith('<!', offset)) throw new Error('拒绝 XML DTD、实体或外部引用声明。');
    const close = text.slice(offset).match(new RegExp(`^</(${namePattern})\\s*>`));
    if (close) { if (stack.length === 1 || parent.qualified !== close[1]) throw new Error('XML 标签闭合不匹配。'); stack.pop(); offset += close[0].length; continue; }
    const open = text.slice(offset).match(new RegExp(`^<(${namePattern})`));
    if (!open) throw new Error('无效 XML 标签。');
    offset += open[0].length;
    const attrs = Object.create(null), namespaces = {...parent.namespaces}; let selfClosing = false;
    while (true) {
      const whitespace = text.slice(offset).match(/^\s*/)[0]; offset += whitespace.length;
      if (text.startsWith('/>', offset)) { offset += 2; selfClosing = true; break; }
      if (text[offset] === '>') { offset++; break; }
      const attribute = text.slice(offset).match(new RegExp(`^(${namePattern})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`));
      if (!whitespace || !attribute || Object.hasOwn(attrs, attribute[1])) throw new Error('无效或重复 XML 属性。');
      const value = attribute[2] ?? attribute[3];
      if (value.includes('<')) throw new Error('XML 属性包含无效字符。');
      attrs[attribute[1]] = entities(value); offset += attribute[0].length;
    }
    for (const [key, value] of Object.entries(attrs)) if (key === 'xmlns') namespaces[''] = value; else if (key.startsWith('xmlns:')) namespaces[key.slice(6)] = value;
    const qualified = open[1], parts = qualified.split(':');
    if (parts.length > 2 || (parts.length === 2 && !namespaces[parts[0]])) throw new Error('无效 XML 命名空间。');
    const node = {qualified, name: parts.at(-1), namespace: namespaces[parts.length === 2 ? parts[0] : ''] || '', attrs, namespaces, children: [], content: []};
    if (++nodes > 1000000 || stack.length > 256) throw new Error('XML 节点数或嵌套深度超过限制。');
    parent.children.push(node); parent.content.push(node);
    if (!selfClosing) stack.push(node);
  }
  if (stack.length !== 1 || root.children.length !== 1) throw new Error('XML 文档未闭合或根节点数量无效。');
  return root.children[0];
}
export function children(node, name, namespace) { return node.children.filter(n => n.name === name && n.namespace === namespace); }
export function descendants(node, name, namespace) {
  const result = [];
  function visit(n) { if (n.name === name && n.namespace === namespace) result.push(n); for (const child of n.children) visit(child); }
  visit(node); return result;
}
export function xmlText(node) { return node.content.map(n => typeof n === 'string' ? n : xmlText(n)).join(''); }
