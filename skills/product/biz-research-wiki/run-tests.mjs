import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, symlinkSync, readdirSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const temp = mkdtempSync(path.join(tmpdir(), 'biz-wiki-paths-'));
const script = fileURLToPath(new URL('./scripts/resolve-paths.mjs', import.meta.url));
let passed = 0;
function run(value) {
  const envFile = path.join(temp, 'env.json');
  writeFileSync(envFile, JSON.stringify(value));
  return spawnSync(process.execPath, [script], {
    cwd: temp, env: { ...process.env, SKILL_ENV: envFile }, encoding: 'utf8',
  });
}
try {
  for (const rootDir of ['./shared', '~/biz-research', path.join(temp, 'absolute')]) {
    const result = run({ bizResearchWiki: { rootDir }, knowledgeBase: { wikiDir: 'wrong-ue-wiki' } });
    assert.equal(result.status, 0, result.stderr);
    const resolved = JSON.parse(result.stdout);
    const expected = path.resolve(temp, rootDir.replace(/^~(?=[\\/]|$)/, homedir()));
    assert.equal(resolved.rootDir, expected);
    assert.equal(resolved.wikiDir, path.join(expected, 'wiki'));
    assert.equal(resolved.rawDir, path.join(expected, 'raw'));
    assert.equal(resolved.runsDir, path.join(expected, 'runs'));
    passed++;
  }
  assert.equal(run({ knowledgeBase: { wikiDir: 'wrong-ue-wiki' } }).status, 1);
  passed++;
  writeFileSync(path.join(temp, 'env.json'), '{bad json');
  assert.equal(spawnSync(process.execPath, [script], {
    env: { ...process.env, SKILL_ENV: path.join(temp, 'env.json') },
  }).status, 1);
  passed++;
  assert.equal(spawnSync(process.execPath, [script], {
    env: { ...process.env, SKILL_ENV: path.join(temp, 'missing.json') },
  }).status, 1);
  passed++;
  console.log(`PASS: ${passed} path/config checks`);
  const validator = fileURLToPath(new URL('./scripts/validate-raw-run.mjs', import.meta.url));
  const root = path.join(temp, 'archive');
  const runId = '2026-10-08-example-ab12';
  const runDir = path.join(root, 'runs', runId);
  mkdirSync(path.join(root, 'raw', 'articles'), { recursive: true });
  mkdirSync(path.join(root, 'raw', 'reports', runId), { recursive: true });
  mkdirSync(runDir, { recursive: true });
  mkdirSync(path.join(root, 'wiki'), { recursive: true });
  writeFileSync(path.join(root, 'wiki', 'index.md'), 'Wiki must remain unchanged.');
  writeFileSync(path.join(runDir, 'run.md'), 'Synthetic fixture; not a real research run.');
  const sourcePath = 'raw/articles/pricing.md';
  const objectPath = `raw/reports/${runId}/example.md`;
  const overviewPath = `raw/reports/${runId}/overview.md`;
  writeFileSync(path.join(root, sourcePath), 'Vendor says price is USD 10 per month.');
  writeFileSync(path.join(root, objectPath), '[Vendor pricing](../../articles/pricing.md). Payment evidence unknown.');
  writeFileSync(path.join(root, overviewPath), 'Comparison limited to one synthetic object.');
  const digest = filename => createHash('sha256').update(readFileSync(filename)).digest('hex');
  const snapshot = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? snapshot(filename) : [[filename, digest(filename)]];
  });
  const originalFiles = snapshot(root);
  const manifestPath = path.join(runDir, 'manifest.json');
  const golden = {
    schema_version: 1, run_id: runId, status: 'complete', topic_prompt: 'Synthetic pricing research',
    as_of: '2026-10-08', questions: ['Who pays?'],
    objects: [{ id: 'example', name: 'Example', kind: 'company' }],
    artifacts: [
      { id: 's1', kind: 'source', path: sourcePath, sha256: digest(path.join(root, sourcePath)),
        url: 'https://example.com/pricing', published_at: null, fetched_at: '2026-10-08T10:00:00+08:00',
        capture: 'webfetch_excerpt', source_tier: 'vendor_claim', origin: 'https://example.com/pricing' },
      { id: 'r1', kind: 'report', path: objectPath, sha256: digest(path.join(root, objectPath)),
        object_ids: ['example'], source_ids: ['s1'], verification: 'verified',
        review: { author_id: 'researcher-1', verifier_id: 'verifier-1', notes: 'Synthetic review statement only.',
          changes: { removed: 0, requalified: 0, added_sources: 0 } } },
      { id: 'overview', kind: 'report', role: 'overview', path: overviewPath, sha256: digest(path.join(root, overviewPath)),
        object_ids: ['example'], source_ids: ['s1'], verification: 'verified',
        review: { author_id: 'root', verifier_id: 'verifier-2', notes: 'Synthetic overview review statement only.',
          changes: { removed: 0, requalified: 0, added_sources: 0 } } },
    ], unresolved: ['No payment proof'], failed_urls: [],
    usage: [{ object_id: 'example', search_calls: 2, fetch_calls: 1, elapsed_seconds: 1.5, tokens: null }],
  };
  let deliveryChecks = 0;
  function check(label, mutate = () => {}, expected = 1, errorPattern) {
    const value = structuredClone(golden);
    mutate(value);
    writeFileSync(manifestPath, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validator, '--root', root, '--manifest', manifestPath], { encoding: 'utf8' });
    assert.equal(result.status, expected, `${label}: ${result.stderr}`);
    if (errorPattern) assert.match(result.stderr, errorPattern, label);
    if (expected === 0) {
      const receipt = JSON.parse(result.stdout);
      assert.equal(receipt.scope, 'manifest_structure_and_file_integrity');
      assert.equal(receipt.semantic_verification, 'NOT_RUN');
      assert.equal(receipt.wiki_compilation, 'NOT_RUN');
    }
    deliveryChecks++;
  }
  check('complete delivery with unresolved facts', undefined, 0);
  check('partial delivery', value => { value.status = 'partial'; value.artifacts[1].verification = 'not_run';
    value.artifacts[1].verification_gap = 'Verifier unavailable'; }, 0);
  check('schema version', value => { value.schema_version = 2; }, 1, /schema_version/);
  check('hash tampering', value => { value.artifacts[0].sha256 = '0'.repeat(64); }, 1, /不匹配/);
  check('path traversal', value => { value.artifacts[0].path = 'raw/../wiki/index.md'; }, 1, /相对路径/);
  check('wiki as raw', value => { value.artifacts[0].path = 'wiki/index.md'; }, 1, /相对路径/);
  check('missing file', value => { value.artifacts[0].path = 'raw/articles/missing.md'; }, 1, /ENOENT/);
  check('broken source reference', value => { value.artifacts[1].source_ids = ['missing']; }, 1, /引用/);
  check('duplicate IDs', value => { value.artifacts[1].id = 's1'; }, 1, /唯一/);
  check('duplicate paths', value => { value.artifacts[1].path = sourcePath; }, 1, /唯一/);
  check('missing object report', value => { value.artifacts.splice(1, 1); }, 1, /对象缺少报告/);
  check('missing overview', value => { value.artifacts.pop(); }, 1, /主题报告/);
  check('invalid source tier', value => { value.artifacts[0].source_tier = 'trusted'; }, 1, /来源等级/);
  check('invalid source URL', value => { value.artifacts[0].url = 'file:///private'; }, 1, /URL/);
  check('impossible date', value => { value.as_of = '2026-02-30'; }, 1, /as_of/);
  check('source origin required', value => { delete value.artifacts[0].origin; }, 1, /origin/);
  check('complete with unverified report', value => { value.artifacts[1].verification = 'not_run'; }, 1, /未核实/);
  check('unknown tokens supported', value => { value.usage[0].tokens = null; }, 0);
  check('missing usage field', value => { delete value.usage[0].tokens; }, 1, /tokens/);
  check('negative usage', value => { value.usage[0].fetch_calls = -1; }, 1, /fetch_calls/);
  check('unknown usage object', value => { value.usage[0].object_id = 'other'; }, 1, /未知对象/);
  check('source-less unknown report', value => { value.artifacts = value.artifacts.filter(item => item.kind === 'report');
    for (const item of value.artifacts) { item.source_ids = []; item.evidence_gap = 'No accessible source for this report'; } }, 0);
  check('source-less report with unrelated global gap', value => { value.artifacts[1].source_ids = []; }, 1, /报告级缺口/);
  const outside = path.join(temp, 'outside');
  mkdirSync(outside);
  writeFileSync(path.join(outside, 'secret.md'), 'Outside archive.');
  // Windows junction creation does not require the symlink privilege.
  symlinkSync(outside, path.join(root, 'raw', 'articles', 'external'), process.platform === 'win32' ? 'junction' : 'dir');
  check('junction escape', value => { value.artifacts[0].path = 'raw/articles/external/secret.md'; }, 1, /超出 raw/);
  check('source in report directory', value => { value.artifacts[0].path = objectPath; value.artifacts.splice(1, 1); }, 1, /目录/);
  check('report in source directory', value => { value.artifacts[1].path = 'raw/articles/wrong.md'; }, 1, /目录/);
  check('report from another run', value => { value.artifacts[1].path = 'raw/reports/other/example.md'; }, 1, /批次/);
  check('bad run ID', value => { value.run_id = 'example'; }, 1, /run_id/);
  check('missing verification record', value => { delete value.artifacts[1].review; }, 1, /核实记录/);
  check('self verification', value => { value.artifacts[1].review.verifier_id = 'researcher-1'; }, 1, /作者相同/);
  check('unverified without reason', value => { value.status = 'partial'; value.artifacts[1].verification = 'not_run'; }, 1, /原因/);
  renameSync(path.join(root, 'wiki'), path.join(root, 'wiki-backup'));
  try { check('delivery without Wiki', undefined, 0); }
  finally { renameSync(path.join(root, 'wiki-backup'), path.join(root, 'wiki')); }
  for (const [filename, expected] of originalFiles) assert.equal(digest(filename), expected, `Unexpected write: ${filename}`);
  deliveryChecks++;
  console.log(`PASS: ${deliveryChecks} delivery/integrity checks (synthetic fixtures, no live research)`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
