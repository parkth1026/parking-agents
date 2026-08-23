#!/usr/bin/env node
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { appendLedgerEvent, sha256Json } from './lib/dossier.mjs';

const STAGES = ['1-interview', '2-prototype', '3-contract'];
const TIERS = ['ask', 'default', 'confirm'];
const RESPONSE_TYPES = ['single_select', 'multi_select', 'boolean', 'short_text', 'long_text', 'number', 'date_time', 'ranking', 'evidence'];
const OPTION_RESPONSE_TYPES = new Set(['single_select', 'multi_select', 'boolean', 'ranking']);

function die(message, code = 1) {
  console.error(`publish: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[i + 1];
    const parsed = next === undefined || next.startsWith('--') ? true : next;
    if (key === 'attach') {
      flags.attach ??= [];
      flags.attach.push(parsed);
    } else flags[key] = parsed;
    if (parsed !== true) i += 1;
  }
  return { positional, flags };
}

function atomicJson(pathname, value) {
  mkdirSync(dirname(pathname), { recursive: true });
  const temporary = `${pathname}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, pathname);
  try { chmodSync(pathname, 0o600); } catch { /* Windows ACLs are the effective boundary. */ }
}

function readJson(pathname, label) {
  try { return JSON.parse(readFileSync(pathname, 'utf8')); }
  catch (error) { die(`${label} 不是合法 JSON（${error.message}）。`, 2); }
}

function issueDirFrom(value) {
  if (!value) die('缺少 --issue-dir。', 2);
  const directory = resolve(value);
  if (!existsSync(directory) || !statSync(directory).isDirectory()) die(`issue 目录不存在：${directory}`, 2);
  return directory;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function responseType(item) {
  return item?.response?.type ?? 'single_select';
}

// 协议文档把多选数量边界写成 min/max；实现与存量 state 用 min_selections/max_selections。
// 发布时统一正规化为后者，server 与页面无需理解两套名字。
function normalizeRoundResponses(round) {
  const errors = [];
  if (!Array.isArray(round?.items)) return { round, errors };
  const items = round.items.map((item) => {
    const response = item?.response;
    if (response?.type !== 'multi_select') return item;
    const next = { ...item, response: { ...response } };
    for (const [documented, canonical] of [['min', 'min_selections'], ['max', 'max_selections']]) {
      if (next.response[documented] === undefined) continue;
      if (next.response[canonical] === undefined) next.response[canonical] = next.response[documented];
      else if (next.response[canonical] !== next.response[documented]) {
        errors.push(`${item?.q_id ?? 'item'} 的 response.${documented} 与 ${canonical} 同时存在且不一致。`);
        continue;
      }
      delete next.response[documented];
    }
    return next;
  });
  return { round: { ...round, items }, errors };
}

function validateResponse(at, item, errors) {
  const type = responseType(item);
  if (!RESPONSE_TYPES.includes(type)) {
    errors.push(`${at}.response.type 要是 ${RESPONSE_TYPES.join(' / ')} 之一。`);
    return;
  }
  if (item.response !== undefined && (!item.response || typeof item.response !== 'object' || Array.isArray(item.response))) {
    errors.push(`${at}.response 必须是对象。`);
    return;
  }
  const booleanLabelForm = type === 'boolean' && item.options === undefined;
  if (OPTION_RESPONSE_TYPES.has(type) && !booleanLabelForm) {
    if (!Array.isArray(item.options) || item.options.length < 2) errors.push(`${at}.options 至少两项。`);
    const keys = new Set();
    let total = 0;
    let shapeValid = true;
    for (const [optionIndex, option] of (item.options ?? []).entries()) {
      if (!nonEmpty(option?.key) || !nonEmpty(option?.text)) {
        errors.push(`${at}.options[${optionIndex}] 要有 key 和 text。`);
        shapeValid = false;
        continue;
      }
      if (type === 'single_select' && !Number.isFinite(option?.pct)) {
        errors.push(`${at}.options[${optionIndex}].pct 要是数字。`);
        shapeValid = false;
      }
      if (keys.has(option.key)) errors.push(`${at}.options key 重复：${option.key}。`);
      keys.add(option.key);
      if (Number.isFinite(option.pct)) total += option.pct;
    }
    if (shapeValid && type === 'single_select' && Math.abs(total - 100) > 2) errors.push(`${at}.options 的 pct 加和是 ${total}，必须在 100±2。`);
    if (type === 'boolean' && item.options?.length !== 2) errors.push(`${at}.boolean 必须正好两个 options。`);
    if (type === 'multi_select') {
      const min = item.response?.min_selections ?? (item.required === false ? 0 : 1);
      const available = (item.options?.length ?? 0) + (item.allow_custom === false ? 0 : 1);
      const max = item.response?.max_selections ?? available;
      if (!Number.isInteger(min) || min < 0) errors.push(`${at}.response.min_selections 要是非负整数。`);
      if (!Number.isInteger(max) || max < min || max > available) errors.push(`${at}.response.max_selections 不合法。`);
      for (const key of item.response?.exclusive_keys ?? []) if (!keys.has(key)) errors.push(`${at}.response.exclusive_keys 含未知 key：${key}。`);
    }
  } else if (item.options !== undefined && (!Array.isArray(item.options) || item.options.length > 0)) {
    errors.push(`${at}.${type} 不应声明 options。`);
  }
  if (booleanLabelForm) {
    for (const label of ['true_label', 'false_label']) {
      if (item.response?.[label] !== undefined && !nonEmpty(item.response[label])) {
        errors.push(`${at}.response.${label} 要是非空字符串。`);
      }
    }
  }
  if (type === 'number') {
    if (item.response?.min !== undefined && !Number.isFinite(item.response.min)) errors.push(`${at}.response.min 要是数字。`);
    if (item.response?.max !== undefined && !Number.isFinite(item.response.max)) errors.push(`${at}.response.max 要是数字。`);
    if (Number.isFinite(item.response?.min) && Number.isFinite(item.response?.max) && item.response.min > item.response.max) errors.push(`${at}.response.min 不能大于 max。`);
  }
  if (type === 'date_time' && item.response?.format !== undefined && !['date', 'time', 'datetime-local'].includes(item.response.format)) {
    errors.push(`${at}.response.format 要是 date / time / datetime-local。`);
  }
}

function validateRound(round) {
  const errors = [];
  if (!round || typeof round !== 'object') return ['round 必须是对象。'];
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(round.id ?? '')) errors.push('round.id 要是 1-80 位安全标识。');
  if (!Number.isInteger(round.no) || round.no < 1) errors.push('round.no 要是正整数。');
  if (!STAGES.includes(round.stage)) errors.push(`round.stage 要是 ${STAGES.join(' / ')} 之一。`);
  if (!nonEmpty(round.title)) errors.push('round.title 不能为空。');
  if (round.status !== undefined && round.status !== 'pending') errors.push('新发布 round.status 只能是 pending。');
  if (!Array.isArray(round.items) || round.items.length === 0) errors.push('round.items 要是非空数组。');

  const ids = new Set();
  for (const [index, item] of (round.items ?? []).entries()) {
    const at = `items[${index}]`;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(item?.q_id ?? '')) errors.push(`${at}.q_id 不合法。`);
    else if (ids.has(item.q_id)) errors.push(`${at}.q_id 重复：${item.q_id}。`);
    else ids.add(item.q_id);
    if (!TIERS.includes(item?.tier)) {
      errors.push(`${at}.tier 要是 ${TIERS.join(' / ')} 之一。`);
      continue;
    }
    if (item.tier === 'ask') {
      if (!nonEmpty(item.question)) errors.push(`${at}.question 不能为空。`);
      validateResponse(at, item, errors);
    } else if (!nonEmpty(item.line)) errors.push(`${at}.line 不能为空。`);
  }
  return errors;
}

function validateFinal(final) {
  if (final === undefined || final === null) return [];
  const errors = [];
  if (!nonEmpty(final.title)) errors.push('final.title 不能为空。');
  if (!Array.isArray(final.sections) || final.sections.length === 0) errors.push('final.sections 要是非空数组。');
  for (const [index, section] of (final.sections ?? []).entries()) {
    if (!nonEmpty(section?.title)) errors.push(`final.sections[${index}].title 不能为空。`);
    const hasBody = nonEmpty(section?.body);
    const hasBullets = Array.isArray(section?.bullets) && section.bullets.every(nonEmpty) && section.bullets.length > 0;
    if (!hasBody && !hasBullets) errors.push(`final.sections[${index}] 要有 body 或 bullets。`);
  }
  return errors;
}

function defaultPhases(stage) {
  const activeIndex = STAGES.indexOf(stage);
  const labels = ['访谈·拷问', '原型确认', '交付标准·契约'];
  return STAGES.map((id, index) => ({
    id,
    label: labels[index],
    status: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending',
  }));
}

function validatePhases(phases) {
  if (!Array.isArray(phases) || phases.length !== 3) return false;
  return phases.every((phase, index) => phase?.id === STAGES[index]
    && nonEmpty(phase.label)
    && ['pending', 'active', 'done', 'skipped', 'needs_reinterview'].includes(phase.status));
}

function copyAttachments(rawFlags, assetsDir) {
  const names = [];
  for (const raw of rawFlags ?? []) {
    if (raw === true) die('--attach 后要跟文件路径。', 2);
    const splitAt = raw.lastIndexOf('=');
    const sourceText = splitAt > 1 ? raw.slice(0, splitAt) : raw;
    const requestedName = splitAt > 1 ? raw.slice(splitAt + 1) : basename(sourceText);
    const source = resolve(sourceText);
    const name = basename(requestedName);
    if (!existsSync(source) || !lstatSync(source).isFile() || lstatSync(source).isSymbolicLink()) {
      die(`附件不是普通文件：${source}`, 2);
    }
    if (!name || name.startsWith('.') || name !== requestedName || !extname(name)) die(`附件名不安全：${requestedName}`, 2);
    mkdirSync(assetsDir, { recursive: true });
    copyFileSync(source, join(assetsDir, name));
    names.push(name);
  }
  return names;
}

const { positional, flags } = parseArgs(process.argv.slice(2));
if (positional[0] !== 'round') die('用法：publish.mjs round --issue-dir <dir> --file <round.json> [--attach path[=name]]', 2);
const issueDir = issueDirFrom(flags['issue-dir']);
if (!flags.file) die('缺少 --file。', 2);
const input = readJson(resolve(String(flags.file)), '--file');
const rawRound = input.round && typeof input.round === 'object' ? input.round : input;
const { round, errors: normalizeErrors } = normalizeRoundResponses(rawRound);
const errors = [...normalizeErrors, ...validateRound(round), ...validateFinal(input.final ?? round.final)];
if (input.phases !== undefined && !validatePhases(input.phases)) errors.push('phases 必须按三阶段顺序给出合法状态。');
if (input.open_ambiguities !== undefined && (!Number.isInteger(input.open_ambiguities) || input.open_ambiguities < 0)) {
  errors.push('open_ambiguities 要是非负整数。');
}
if (input.dossier !== undefined && (!input.dossier || typeof input.dossier !== 'object' || !nonEmpty(input.dossier.title))) {
  errors.push('dossier 要是包含非空 title 的对象。');
}
if (errors.length > 0) die(`轮次 schema 不合法：\n- ${errors.join('\n- ')}`, 1);

const webDir = join(issueDir, 'web');
mkdirSync(join(webDir, 'submissions'), { recursive: true });
mkdirSync(join(webDir, 'consumed'), { recursive: true });
const attached = copyAttachments(flags.attach, join(webDir, 'assets'));
const statePath = join(webDir, 'state.json');
const previous = existsSync(statePath) ? readJson(statePath, '现有 state.json') : null;
const existingRound = previous?.rounds?.find((candidate) => candidate.id === round.id);
if (existingRound?.status === 'submitted' || existsSync(join(webDir, 'submissions', `${round.id}.json`))) {
  die(`round ${round.id} 已提交，不能覆盖。`, 1);
}

const nextRound = {
  ...round,
  schema_version: 2,
  revision: (existingRound?.revision ?? 0) + 1,
  status: 'pending',
  ...(attached.length > 0 ? { attachments: attached } : {}),
};
delete nextRound.final;
nextRound.digest = sha256Json({ ...nextRound, digest: undefined });
const rounds = (previous?.rounds ?? []).filter((candidate) => candidate.id !== round.id);
rounds.push(nextRound);
rounds.sort((a, b) => a.no - b.no);
const openAmbiguities = input.open_ambiguities
  ?? round.open_ambiguities
  ?? nextRound.items.filter((item) => item.tier === 'ask' || item.tier === 'confirm').length;
const state = {
  schema_version: 2,
  slug: basename(issueDir),
  dossier: input.dossier ?? previous?.dossier ?? null,
  opening: input.opening ?? previous?.opening ?? null,
  phases: input.phases ?? previous?.phases ?? defaultPhases(round.stage),
  open_ambiguities: openAmbiguities,
  rounds,
  locked: input.locked ?? previous?.locked ?? [],
  final: input.final ?? round.final ?? previous?.final ?? null,
  updated_at: new Date().toISOString(),
};
atomicJson(statePath, state);
appendLedgerEvent(webDir, {
  type: 'round_published',
  actor: { type: 'software-agent', id: 'agent' },
  entity: { kind: 'round', id: nextRound.id, revision: nextRound.revision, digest: nextRound.digest },
  data: {
    opening: state.opening,
    phases: state.phases,
    open_ambiguities: state.open_ambiguities,
    locked: state.locked,
    round: nextRound,
    final: state.final,
  },
});
console.log(JSON.stringify({
  ok: true,
  round: round.id,
  items: round.items.length,
  open_ambiguities: openAmbiguities,
  attached,
}));
