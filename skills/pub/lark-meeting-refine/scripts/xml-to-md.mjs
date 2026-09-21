#!/usr/bin/env node
// lark docs +fetch --doc-format xml 的 content → Markdown 镜像。
// 语义对齐 feishu-weekly-extract：grid/column 解包保内容、cite→@人名、文字逐字忠实、
// img/whiteboard 经 file_token 本地化后以相对路径引用、readonly-block 丢弃。
// 用法: node xml-to-md.mjs --xml <content.xml> --out <body.md> --assets-rel <相对assets目录>

import fs from 'node:fs';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const m = process.argv[i].match(/^--([\w-]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] !== undefined ? m[2] : process.argv[++i];
}
if (!args.xml || !args.out || !args['assets-rel']) {
  console.error('用法: node xml-to-md.mjs --xml <content.xml> --out <body.md> --assets-rel <dir>');
  process.exit(2);
}
const ASSETS = args['assets-rel'].replace(/\/+$/, '');
const xml = fs.readFileSync(args.xml, 'utf8');

// ---------- 实体解码 ----------
function decode(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// ---------- 极简 XML 解析（该 API 输出为良构标签子集） ----------
function parse(src) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<\/?([\w-]+)((?:\s+[\w-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[4] !== undefined) {
      const t = decode(m[4]);
      if (t) stack[stack.length - 1].children.push({ tag: '#text', text: t });
    } else if (m[1]) {
      const attrs = {};
      for (const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = decode(a[2]);
      if (m[0][1] === '/') { // 闭合标签
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].tag === m[1]) { stack.length = i; break; }
        }
      } else {
        const node = { tag: m[1], attrs, children: [] };
        stack[stack.length - 1].children.push(node);
        if (!m[3]) stack.push(node); // 非自闭合则入栈
      }
    }
  }
  return root;
}

// ---------- 渲染 ----------
function inline(nodes) {
  let s = '';
  let prev = null;
  for (const n of nodes) {
    // 相邻 cite（源文档无分隔文本，如参会人列表）用顿号隔开
    if (n.tag === 'cite' && prev === 'cite') s += '、';
    prev = n.tag === '#text' && !n.text.trim() ? prev : n.tag;
    switch (n.tag) {
      case '#text': s += n.text; break;
      case 'b': case 'strong': { const t = inline(n.children); if (t.trim()) s += `**${t}**`; break; }
      case 'i': case 'em': { const t = inline(n.children); if (t.trim()) s += `*${t}*`; break; }
      case 'cite': s += `@${n.attrs['user-name'] || n.attrs['uid-ref'] || n.attrs['user-id'] || ''}`; break;
      case 'a': s += `[${inline(n.children)}](${n.attrs.href || ''})`; break;
      case 'br': s += '\n'; break;
      case 'img': {
        const alt = (n.attrs.caption || n.attrs.name || 'image').replace(/\s+$/g, '');
        const src = n.attrs.src || n.attrs.token;
        s += `![${alt}](${ASSETS}/${src}.png)`;
        break;
      }
      case 'whiteboard': {
        const tk = n.attrs.token;
        s += `> 🧩 白板（token \`${tk}\`）：[缩略图快照](${ASSETS}/whiteboard-${tk}.jpg)（静态快照，交互版见飞书文档内嵌画板）`;
        break;
      }
      default: s += inline(n.children); // grid/column 等容器在 inline 层直接透传
    }
  }
  return s;
}

function renderBlocks(nodes, out, depth = 0) {
  for (const n of nodes) {
    switch (n.tag) {
      case '#text': {
        const t = n.text.trim();
        if (t) out.push(t);
        break;
      }
      case 'title': out.push(`# ${inline(n.children)}`); break;
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        const lv = Number(n.tag[1]);
        out.push(`${'#'.repeat(lv)} ${inline(n.children)}`);
        break;
      }
      case 'blockquote': {
        const inner = [];
        renderBlocks(n.children, inner, depth);
        out.push(inner.filter(Boolean).flatMap((l) => l.split('\n').map((x) => `> ${x}`)).join('\n'));
        break;
      }
      case 'p': {
        const t = inline(n.children).replace(/[ \t]+$/gm, '');
        if (t.trim()) out.push(t);
        break;
      }
      case 'ul': case 'ol': {
        renderList(n, out, depth, n.tag === 'ol');
        break;
      }
      case 'checkbox': {
        const mark = n.attrs.done === 'true' ? 'x' : ' ';
        out.push(`- [${mark}] ${inline(n.children).trim()}`);
        break;
      }
      case 'grid': case 'column': renderBlocks(n.children, out, depth); break; // 解包
      case 'img': { // 顶层图片（不在容器内）
        const alt = (n.attrs.caption || n.attrs.name || 'image').replace(/\s+$/g, '');
        out.push(`![${alt}](${ASSETS}/${n.attrs.src || n.attrs.token}.png)`);
        break;
      }
      case 'whiteboard': {
        const tk = n.attrs.token;
        out.push(`> 🧩 白板（token \`${tk}\`）：[缩略图快照](${ASSETS}/whiteboard-${tk}.jpg)（静态快照，交互版见飞书文档内嵌画板）`);
        break;
      }
      case 'table': renderTable(n, out); break;
      case 'readonly-block': break; // 丢弃
      default: renderBlocks(n.children, out, depth);
    }
  }
}

function renderList(list, out, depth, ordered) {
  const lines = [];
  emitList(list, lines, depth, ordered);
  out.push(lines.join('\n'));
}

// 列表整体作为一个块输出（项间无空行）；li 内子节点按文档顺序：
// 文本先行成项，嵌套 ul/ol 与 grid/img/whiteboard 等块级子节点依次缩进跟随。
function emitList(list, lines, depth, ordered) {
  let idx = 1;
  for (const li of list.children.filter((c) => c.tag === 'li')) {
    const inlineNodes = [];
    for (const c of li.children) {
      if (c.tag === 'ul' || c.tag === 'ol') continue;
      if (['grid', 'column', 'img', 'whiteboard', 'p', 'table'].includes(c.tag)) continue;
      inlineNodes.push(c);
    }
    const text = inline(inlineNodes).replace(/[ \t]+$/gm, '').trim();
    const indent = '  '.repeat(depth);
    lines.push(`${indent}${ordered ? `${idx++}. ` : '- '}${text}`);
    for (const c of li.children) {
      if (c.tag === 'ul' || c.tag === 'ol') emitList(c, lines, depth + 1, c.tag === 'ol');
      else if (['grid', 'column'].includes(c.tag)) emitMediaBlocks(c.children, lines, depth + 1);
      else if (['img', 'whiteboard'].includes(c.tag)) emitMediaBlocks([c], lines, depth + 1);
    }
  }
}

function emitMediaBlocks(nodes, lines, depth) {
  const indent = '  '.repeat(depth);
  for (const n of nodes) {
    if (n.tag === 'img') {
      const alt = (n.attrs.caption || n.attrs.name || 'image').replace(/\s+$/g, '');
      lines.push(`${indent}![${alt}](${ASSETS}/${n.attrs.src || n.attrs.token}.png)`);
    } else if (n.tag === 'whiteboard') {
      const tk = n.attrs.token;
      lines.push(`${indent}> 🧩 白板（token \`${tk}\`）：[缩略图快照](${ASSETS}/whiteboard-${tk}.jpg)（静态快照，交互版见飞书文档内嵌画板）`);
    } else if (n.tag === 'grid' || n.tag === 'column') {
      emitMediaBlocks(n.children, lines, depth);
    }
  }
}

function renderTable(tbl, out) {
  const rows = [];
  for (const tr of tbl.children.filter((c) => c.tag === 'tr')) {
    rows.push(tr.children.filter((c) => c.tag === 'td' || c.tag === 'th').map((c) => inline(c.children).trim()));
  }
  if (!rows.length) return;
  const width = Math.max(...rows.map((r) => r.length));
  const norm = rows.map((r) => { const c = [...r]; while (c.length < width) c.push(''); return c; });
  out.push(`| ${norm[0].join(' | ')} |`);
  out.push(`| ${Array(width).fill('---').join(' | ')} |`);
  for (const r of norm.slice(1)) out.push(`| ${r.join(' | ')} |`);
}

const root = parse(xml);
const out = [];
renderBlocks(root.children, out);
const body = out.filter((l) => l !== '').join('\n\n') + '\n';
fs.writeFileSync(args.out, body, 'utf8');
console.log(`written: ${args.out} (${body.length} chars, ${out.filter(Boolean).length} blocks)`);
