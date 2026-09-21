#!/usr/bin/env node
// lark-meeting-refine 端到端流水线：取数 → 媒体本地化 → XML→MD 镜像（behavior.md 变化行 1-6）。
// 核对与修正稿（变化行 7-8）是语义工作，由 Agent 按 SKILL.md 在本脚本产物之上执行。
//
// 用法（cwd=仓库根）:
//   node .agents/skills/lark-meeting-refine/scripts/run.mjs --meeting 7686008348404304824 --slug 2026-09-16-WDP6-value-discussion
//   node .agents/skills/lark-meeting-refine/scripts/run.mjs --minutes Uo8idMtivoOFrBxk15Ac6NCgndg --transcript AKeid1Wy1oPRMKxykoecprxenKE --slug ...
// --meeting 也接受含会议 ID 的 URL；--minutes/--transcript 接受 token 或 docx URL。
// 可选: --evidence-root agent/evidence（默认） --refresh（镜像已存在且正文有差异时允许覆盖，evidence 默认不可变）

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ---------- 参数 ----------
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const m = process.argv[i].match(/^--([\w-]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] !== undefined ? m[2] : process.argv[++i];
}
const EVIDENCE = args['evidence-root'] || 'agent/evidence';
const SLUG = args.slug;
if (!SLUG || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Za-z0-9-]+$/.test(SLUG)) {
  console.error('需要 --slug <YYYY-MM-DD-english-slug>（沿系列命名约定，如 2026-09-16-WDP6-value-discussion）');
  process.exit(2);
}
if (!args.meeting && !(args.minutes && args.transcript)) {
  console.error('需要 --meeting <会议ID|URL>，或 --minutes <token|URL> + --transcript <token|URL>');
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..'); // scripts → skill → skills → .agents → 仓库根
const converter = path.join(here, 'xml-to-md.mjs');
const ASSETS_REL = `${SLUG}-assets`; // 镜像内相对引用前缀（与镜像同目录平级）

// ---------- lark-cli 封装 ----------
function lark(cmd) {
  // 输出前可能有日志行，取第一个 '{' 起的 JSON；Windows 下 .cmd shim 需要 shell。
  // --output 只接受 cwd 内相对路径，统一传 repoRoot 相对 + 正斜杠。
  const rel = (p) => path.relative(repoRoot, p).replace(/\\/g, '/');
  const argv = cmd.map((s) => (path.isAbsolute(s) ? rel(s) : s));
  const q = (s) => /^[\w@%+=:,./-]+$/.test(s) ? s : `"${s}"`;
  const raw = execSync(`lark-cli ${argv.map(q).join(' ')}`, {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd: repoRoot,
  });
  const start = raw.indexOf('{');
  if (start < 0) throw new Error(`lark-cli 输出无 JSON: ${argv.join(' ')}\n${raw.slice(0, 300)}`);
  const j = JSON.parse(raw.slice(start));
  if (!j.ok) throw new Error(`lark-cli 失败: ${argv.join(' ')}\n${raw.slice(0, 500)}`);
  return j;
}
function docToken(v, kind) {
  if (!v) return undefined;
  // docx token 20+ 位字母数字；会议 ID 为 10+ 位纯数字
  const m = kind === '--meeting' ? v.match(/\b(\d{10,})\b/) : v.match(/([A-Za-z0-9]{20,})/);
  if (!m) { console.error(`${kind} 无法解析出 token: ${v}`); process.exit(2); }
  return m[1];
}

// ---------- 1. 会议 → 双 doc token ----------
let minutesToken = docToken(args.minutes, '--minutes');
let transcriptToken = docToken(args.transcript, '--transcript');
let meetingMeta = null;
if (!minutesToken || !transcriptToken) {
  const mid = docToken(args.meeting, '--meeting');
  console.log(`[1/5] 解析会议 ${mid} → note → 双文档 token`);
  const vc = lark(['vc', '+detail', '--meeting-ids', mid, '--format', 'json', '--as', 'user']);
  const mtg = vc.data.meetings?.[0];
  if (!mtg?.note_id) { console.error('会议无 note_id（妙记备选路径见 SKILL.md / lark-workflow-meeting-summary）'); process.exit(1); }
  const note = lark(['note', '+detail', '--note-id', mtg.note_id, '--format', 'json', '--as', 'user']);
  minutesToken = minutesToken || note.data.note.note_doc_token;
  transcriptToken = transcriptToken || note.data.note.verbatim_doc_token;
  meetingMeta = { topic: mtg.topic, start: mtg.start_time, end: mtg.end_time, meeting_id: mtg.meeting_id };
  if (!minutesToken || !transcriptToken) { console.error('note 详情缺 doc token'); process.exit(1); }
}

// ---------- 2. 双文档 XML 取数 ----------
console.log(`[2/5] 取数: 纪要 ${minutesToken} / 逐字稿 ${transcriptToken}`);
function fetchDoc(token) {
  const j = lark(['docs', '+fetch', '--doc', token, '--doc-format', 'xml', '--as', 'user']);
  const d = j.data.document;
  return { token, content: d.content, revision: String(d.revision_id) };
}
const minutesDoc = fetchDoc(minutesToken);
const transcriptDoc = fetchDoc(transcriptToken);

// ---------- 3. 媒体本地化 ----------
console.log('[3/5] 媒体本地化');
const assetsDir = path.join(repoRoot, EVIDENCE, ASSETS_REL);
fs.mkdirSync(assetsDir, { recursive: true });
const media = []; // {kind, token, ok, file}
for (const [label, doc] of [['纪要', minutesDoc], ['逐字稿', transcriptDoc]]) {
  const imgs = [...doc.content.matchAll(/<img\s[^>]*\bsrc="([^"]+)"/g)].map((m) => ({ kind: 'img', token: m[1] }));
  const wbs = [...doc.content.matchAll(/<whiteboard\s[^>]*\btoken="([^"]+)"/g)].map((m) => ({ kind: 'whiteboard', token: m[1] }));
  for (const it of [...imgs, ...wbs]) {
    if (media.some((x) => x.token === it.token)) continue; // 幂等
    if (it.kind === 'img') {
      const out = path.join(assetsDir, `${it.token}.png`);
      if (fs.existsSync(out)) { media.push({ ...it, ok: true, file: out, cached: true }); continue; }
      try {
        lark(['docs', '+media-download', '--token', it.token, '--output', out, '--as', 'user']);
        if (!fs.existsSync(out)) throw new Error('下载后文件不存在');
        media.push({ ...it, ok: true, file: out });
      } catch (e) {
        console.warn(`  ⚠️ ${label}图片 ${it.token} 下载失败，将剥离: ${String(e.message).slice(0, 120)}`);
        media.push({ ...it, ok: false });
      }
    } else {
      // 白板缩略图：CLI 按内容补扩展名，先查既有文件再下载
      const existing = fs.readdirSync(assetsDir).find((f) => f.startsWith(`whiteboard-${it.token}.`));
      const out = existing ? path.join(assetsDir, existing) : path.join(assetsDir, `whiteboard-${it.token}`);
      if (existing) { media.push({ kind: it.kind, token: it.token, ok: true, file: out, cached: true }); continue; }
      try {
        lark(['docs', '+media-download', '--type', 'whiteboard', '--token', it.token, '--output', out, '--as', 'user']);
        const got = fs.existsSync(out)
          ? out
          : fs.readdirSync(assetsDir).map((f) => path.join(assetsDir, f)).find((p) => path.basename(p).startsWith(`whiteboard-${it.token}.`));
        if (!got) throw new Error('下载后文件不存在');
        media.push({ kind: it.kind, token: it.token, ok: true, file: got });
      } catch (e) {
        console.warn(`  ⚠️ ${label}白板 ${it.token} 缩略图下载失败，退回 token 标注: ${String(e.message).slice(0, 120)}`);
        media.push({ kind: it.kind, token: it.token, ok: false });
      }
    }
  }
}
const wbExt = {};
for (const m of media) if (m.kind === 'whiteboard' && m.ok) wbExt[m.token] = path.extname(m.file) || '.jpg';

// ---------- 4. XML → MD（被测转换器）+ 降级后处理 ----------
console.log('[4/5] XML → Markdown 镜像');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lmr-'));
function convert(doc, outName) {
  const xmlF = path.join(tmp, `${outName}.xml`);
  const mdF = path.join(tmp, outName);
  fs.writeFileSync(xmlF, doc.content, 'utf8');
  execFileSync(process.execPath, [converter, '--xml', xmlF, '--out', mdF, '--assets-rel', ASSETS_REL], { stdio: 'inherit', cwd: repoRoot });
  let body = fs.readFileSync(mdF, 'utf8');
  // 降级后处理（媒体下载失败：图片剥离仅告警；白板退回 token 标注）
  for (const m of media.filter((x) => !x.ok)) {
    if (m.kind === 'img') {
      body = body.replace(new RegExp(`!\\[[^\\]]*\\]\\(${ASSETS_REL}/${m.token}\\.png\\)`, 'g'),
        `> ⚠️ 图片（token \`${m.token}\`）下载失败已剥离，原始内容见飞书文档`);
    } else {
      body = body.replace(new RegExp(`> 🧩 白板（token \`${m.token}\`）：\\[缩略图快照\\]\\(${ASSETS_REL}/whiteboard-${m.token}\\.(jpg|png)\\)（静态快照，交互版见飞书文档内嵌画板）`, 'g'),
        `> 🧩 白板（token \`${m.token}\`）：缩略图下载失败，交互版见飞书文档内嵌画板`);
    }
  }
  return body;
}
const minutesBody = convert(minutesDoc, 'minutes-body.md');
const transcriptBody = convert(transcriptDoc, 'transcript-body.md');

// ---------- 5. 镜像落盘（frontmatter + 正文） ----------
console.log(`[5/5] 镜像落盘 ${EVIDENCE}/`);
const today = new Date().toISOString().slice(0, 10);
const mediaNote = media.length === 0
  ? 'none（本文档无内嵌媒体）'
  : `localized（${ASSETS_REL}/，白板为缩略图快照${media.some((m) => !m.ok) ? '；部分媒体下载失败已降级，见正文告警' : ''}）`;
function writeMirror(name, doc, body, extraNote) {
  const fm = [
    '---',
    `source: https://ecnuyvxfsk32.feishu.cn/docx/${doc.token}`,
    `document_id: ${doc.token}`,
    `revision_id: ${doc.revision}`,
    `fetched_at: ${today}`,
    extraNote ? `note: ${extraNote}` : null,
    `media: ${mediaNote}`,
    '---',
    '',
  ].filter((l) => l !== null).join('\n');
  const out = path.join(repoRoot, EVIDENCE, name);
  if (fs.existsSync(out)) {
    const prev = fs.readFileSync(out, 'utf8');
    const prevBody = prev.replace(/^---\n[\s\S]*?\n---\n/, '');
    if (prevBody !== body && !args.refresh) {
      console.error(`  ✋ ${name} 已存在且正文有差异（evidence 默认不可变；确认升级用 --refresh）`);
      process.exit(1);
    }
    if (prevBody === body) console.log(`  = ${name} 正文一致，仅更新 frontmatter（behavior 变化行 6 原地升级）`);
  }
  fs.writeFileSync(out, fm + body, 'utf8');
  console.log(`  + ${name}（rev ${doc.revision}，${Buffer.byteLength(body)} B 正文）`);
  return out;
}
const minutesPath = writeMirror(`${SLUG}-smart-minutes.md`, minutesDoc, minutesBody,
  meetingMeta ? `会议「${meetingMeta.topic}」${meetingMeta.start} - ${meetingMeta.end}（meeting_id ${meetingMeta.meeting_id}）的智能纪要` : null);
// behavior.md 边界值：逐字稿前 N 分钟无记录 → frontmatter 注明（首条时间戳 > 45s 即视为有缺口）
const firstTs = transcriptBody.match(/\d{2}:\d{2}:\d{2}/)?.[0];
const gapNote = firstTs && firstTs !== '00:00:00' && (parseInt(firstTs.slice(0, 2)) * 3600 + parseInt(firstTs.slice(3, 5)) * 60 + parseInt(firstTs.slice(6))) > 45
  ? `；会议前段无记录（首条 ${firstTs}）` : '';
const transcriptPath = writeMirror(`${SLUG}-meeting-transcript.md`, transcriptDoc, transcriptBody,
  `文字逐字忠实，cite 转写为 @人名${gapNote}`);
fs.rmSync(tmp, { recursive: true, force: true });

// ---------- 产物报告 + 下一步指引 ----------
const okMedia = media.filter((m) => m.ok);
console.log('\n=== 完成 ===');
console.log(`镜像: ${path.relative(repoRoot, minutesPath)} / ${path.relative(repoRoot, transcriptPath)}`);
if (okMedia.length) for (const m of okMedia) console.log(`媒体: ${path.relative(repoRoot, m.file)}${m.cached ? '（已存在，跳过下载）' : ''}`);
if (media.some((m) => !m.ok)) console.log('降级: 见上方 ⚠️ 告警（behavior.md 边界值：不阻塞）');
console.log('\n下一步（Agent 执行，behavior.md 变化行 7-8）：读两份镜像，以逐字稿为唯一事实基准逐条核对纪要，产出');
console.log(`  ${EVIDENCE}/${SLUG}-corrected-minutes.md（保留纪要骨架 + 全量时间戳 + 文末修正对照表，形态见 SKILL.md 与 9-17 golden 样例）`);
