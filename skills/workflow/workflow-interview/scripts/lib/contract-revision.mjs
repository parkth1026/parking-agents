import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { localPath } from './delivery.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
};

function assertNoLinks(target) {
  for (let current = path.resolve(target);;) {
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error('REVISION_SYMLINK_NOT_ALLOWED: ' + current);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function hostDirectory(issue) {
  const result = spawnSync('git', ['-C', issue, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (result.status === 0) {
    const root = path.resolve(result.stdout.trim());
    assertNoLinks(root);
    const actual = fs.realpathSync.native(root);
    if (!inside(actual, issue)) throw new Error('REVISION_HOST_OUTSIDE_ISSUE');
    return actual;
  }
  const grilling = path.dirname(issue), workflow = path.dirname(grilling);
  if (path.basename(grilling) !== 'grilling' || path.basename(workflow) !== '.aes-workflow') {
    throw new Error('REVISION_HOST_UNAVAILABLE: use a Git repository or .aes-workflow/grilling/<task>');
  }
  return path.dirname(workflow);
}

// Preserve the approved bytes before editing. This helper never changes live
// task state, registers a delivery, or writes to the Git index.
export function archiveContractRevision(issueDir, manifest, reason) {
  if (typeof reason !== 'string' || !reason.trim()) throw new Error('REVISION_REASON_REQUIRED');
  assertNoLinks(issueDir);
  const issue = fs.realpathSync.native(path.resolve(issueDir));
  const manifestPath = localPath(issue, 'manifest.json');
  const manifestBytes = fs.readFileSync(manifestPath);
  if (!isDeepStrictEqual(JSON.parse(manifestBytes.toString('utf8')), manifest)) {
    throw new Error('REVISION_MANIFEST_CHANGED: reload the manifest before revising');
  }

  const contracts = localPath(issue, '3-contract');
  assertNoLinks(contracts);
  const names = new Set(['manifest.json', '3-contract/contract.md']);
  for (const entry of fs.readdirSync(contracts, { withFileTypes: true })) {
    if (/^contract.*\.md$/i.test(entry.name)) names.add('3-contract/' + entry.name);
  }
  for (const name of ['3-contract/verify.txt', '3-contract/verify-evidence.txt']) {
    const source = localPath(issue, name);
    assertNoLinks(source);
    if (fs.existsSync(source)) names.add(name);
  }
  const registered = new Map();
  for (const item of manifest.delivery?.files ?? []) {
    if (item.role !== 'contract') continue;
    const source = localPath(issue, item.path);
    assertNoLinks(source);
    names.add(item.path);
    if (!registered.has(item.path)) registered.set(item.path, []);
    registered.get(item.path).push(item.sha256);
  }
  const originals = new Map();
  for (const name of [...names].sort()) {
    const source = localPath(issue, name);
    assertNoLinks(source);
    if (!fs.statSync(source).isFile()) throw new Error('REVISION_SOURCE_NOT_FILE: ' + name);
    const bytes = name === 'manifest.json' ? manifestBytes : fs.readFileSync(source);
    const hash = sha256(bytes);
    if (registered.get(name)?.some(expected => expected !== hash)) {
      throw new Error('REVISION_CONTRACT_CHANGED: ' + name + '; restore the registered bytes before archiving');
    }
    // native realpath resolves Windows casing aliases to the actual spelling.
    // Keep exact identities on case-sensitive filesystems; do not fold all paths.
    const actual = fs.realpathSync.native(source);
    if (!inside(issue, actual)) throw new Error('REVISION_SOURCE_OUTSIDE_ISSUE: ' + name);
    const original = originals.get(actual);
    if (original) {
      if (original.sha256 !== hash) throw new Error('REVISION_SOURCE_CHANGED: ' + name);
      original.aliases.add(name);
    } else {
      originals.set(actual, { path: path.relative(issue, actual).split(path.sep).join('/'), source: actual,
        bytes, sha256: hash, aliases: new Set([name]) });
    }
  }
  const sources = [...originals.values()].sort((a, b) => a.path.localeCompare(b.path));

  const host = hostDirectory(issue);
  const artifacts = path.join(host, 'artifacts');
  const base = path.join(artifacts, 'workflow-interview', path.basename(issue), 'archive');
  const created = new Date().toISOString();
  const archive = path.join(base, created.replaceAll(':', '-') + '-' + randomUUID());
  if (!inside(artifacts, archive)) throw new Error('REVISION_ARCHIVE_OUTSIDE_ARTIFACTS');
  assertNoLinks(archive);
  fs.mkdirSync(base, { recursive: true });
  assertNoLinks(base);
  fs.mkdirSync(archive);
  const files = sources.map(source => {
    const aliases = [...source.aliases].filter(name => name !== source.path).sort();
    return { path: source.path, archive_path: 'issue/' + source.path, source: source.source,
      bytes: source.bytes.length, sha256: source.sha256, ...(aliases.length ? { aliases } : {}) };
  });
  const snapshot = path.join(archive, 'issue');
  for (const source of sources) {
    const destination = localPath(snapshot, source.path);
    assertNoLinks(destination);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    assertNoLinks(destination);
    fs.writeFileSync(destination, source.bytes, { flag: 'wx' });
  }
  const receipt = path.join(archive, 'revision.json');
  const record = { schema_version: 1, created_at: created, reason: reason.trim(), issue_directory: issue, archive_directory: archive, files };
  assertNoLinks(receipt);
  fs.writeFileSync(receipt, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  return { archive, receipt, files };
}
