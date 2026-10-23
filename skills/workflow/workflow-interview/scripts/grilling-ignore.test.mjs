#!/usr/bin/env node
// Ignore setup and effective Git policy regressions. Every mutation stays in a
// fresh temporary fixture; no commit or index change touches a real repository.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ensureGrillingIgnore, inspectIgnorePolicy, copyIgnorePrerequisites } from './lib/grilling-ignore.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SESSION = path.join(HERE, 'session.mjs');
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'grilling-ignore-regression-'));
const globalConfig = path.join(ROOT, 'empty-gitconfig');
fs.writeFileSync(globalConfig, '');
const priorGlobal = process.env.GIT_CONFIG_GLOBAL;
const priorSystem = process.env.GIT_CONFIG_NOSYSTEM;
process.env.GIT_CONFIG_GLOBAL = globalConfig;
process.env.GIT_CONFIG_NOSYSTEM = '1';
let total = 0, failed = 0, sequence = 0;
const BEGIN = '# BEGIN workflow-interview managed';
const END = '# END workflow-interview managed';
const sha = s => createHash('sha256').update(s).digest('hex');

function check(name, condition, detail = '') {
  total += 1;
  if (condition) console.log('ok   ' + name);
  else { failed += 1; console.error('FAIL ' + name + (detail ? '\n     ' + detail : '')); }
}
function write(p, text) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); }
function git(repo, ...args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('git ' + args.join(' ') + ': ' + result.stderr);
  return result;
}
function fixture({ artifacts = true, separate = false } = {}) {
  const repo = path.join(ROOT, 'repo-' + (++sequence)); fs.mkdirSync(repo);
  if (separate) git(repo, 'init', '--quiet', '--separate-git-dir', path.join(ROOT, 'gitdir-' + sequence));
  else git(repo, 'init', '--quiet');
  if (artifacts) write(path.join(repo, '.gitignore'), '/artifacts/\n');
  const grilling = path.join(repo, '.aes-workflow', 'grilling');
  const issue = path.join(grilling, 'task'); fs.mkdirSync(issue, { recursive: true });
  return { repo, grilling, issue, ignore: path.join(grilling, '.gitignore') };
}
function cli(cwd, ...args) { return spawnSync(process.execPath, [SESSION, ...args], { cwd, encoding: 'utf8' }); }
function rejects(name, fn, expected) {
  let error;
  try { fn(); } catch (e) { error = e; }
  check(name, !!error && (!expected || expected.test(error.message)), error?.message || 'did not reject');
}
function block(body) { return BEGIN + '\n# template-sha256: ' + sha(body) + '\n' + body + END + '\n'; }
function messages(report) { return [...report.errors, ...report.warnings].join('\n'); }
function submissionFixture({ excluded = [] } = {}) {
  const f = fixture(); ensureGrillingIgnore(f.grilling);
  const files = [
    ['manifest.json', 'state', JSON.stringify({ slug: 'task', goal_oneline: '正式目标', stage_gates: {}, validation: { status: 'valid' } })],
    ['README.md', 'requirement', '[档案](dossier.html)'],
    ['1-interview/context.md', 'requirement', '正式上下文'],
    ['1-interview/rounds.jsonl', 'requirement', ''],
    ['2-prototype/impact-surface.md', 'requirement', '已扫描'],
    ['2-prototype/mock.html', 'prototype', '<html><body>正式对照物</body></html>'],
    ['3-contract/contract.md', 'contract', '## 目标\n正式目标\n## 读什么\n[对照物](../2-prototype/mock.html)'],
    ['dossier.html', 'derived'],
  ];
  for (const [p, , text] of files) if (text !== undefined) write(path.join(f.issue, p), text);
  for (const p of excluded) write(path.join(f.issue, p), '{}');
  const plan = path.join(f.repo, 'delivery-plan.json');
  write(plan, JSON.stringify({ files: files.map(([p, role]) => ({ path: p, role })), excluded: excluded.map(p => ({ path: p, reason: '过程材料保留本地，不提交' })) }));
  const registered = cli(f.repo, 'delivery', f.issue, '--plan', plan);
  if (registered.status !== 0) throw new Error('CLI fixture delivery failed: ' + registered.stdout + registered.stderr);
  const exported = spawnSync(process.execPath, [path.join(HERE, 'export-dossier.mjs'), '--issue-dir', f.issue], { cwd: f.repo, encoding: 'utf8' });
  if (exported.status !== 0) throw new Error('CLI fixture dossier failed: ' + exported.stdout + exported.stderr);
  return f;
}
function checkSubmission(f, name) {
  const output = path.join(ROOT, name + '-' + sequence);
  const run = cli(f.repo, 'submission-check', f.issue, '--output', output);
  let report;
  try { report = JSON.parse(run.stdout); } catch { throw new Error('CLI fixture returned invalid JSON: ' + run.stdout + run.stderr); }
  return { run, report, output, detail: run.stdout + run.stderr };
}

try {
  // Real CLI init creates the shared file before the task and keeps manifests
  // byte-for-byte stable when an existing task is opened again.
  {
    const f = fixture();
    const first = cli(f.repo, 'init', 'first-task', '--request', 'first request');
    const manifest = path.join(f.grilling, 'first-task', 'manifest.json');
    check('CLI init creates a managed public ignore', first.status === 0 && fs.readFileSync(f.ignore, 'utf8').includes(BEGIN), first.stderr);
    const beforeIgnore = fs.readFileSync(f.ignore), beforeManifest = fs.readFileSync(manifest);
    const repeated = cli(f.repo, 'init', 'first-task');
    check('repeat CLI init is successful', repeated.status === 0, repeated.stderr);
    check('repeat init leaves ignore and manifest bytes unchanged', beforeIgnore.equals(fs.readFileSync(f.ignore)) && beforeManifest.equals(fs.readFileSync(manifest)));
    check('repeated API setup reports unchanged', ensureGrillingIgnore(f.grilling).status === 'unchanged');
    const nested = path.join(f.repo, 'nested', 'cwd'); fs.mkdirSync(nested, { recursive: true });
    const elsewhere = cli(nested, 'init', 'nested-task');
    check('init from nested cwd uses the repository grilling directory', elsewhere.status === 0 && fs.existsSync(path.join(f.grilling, 'nested-task', 'manifest.json')) && !fs.existsSync(path.join(nested, '.aes-workflow')), elsewhere.stderr);
  }
  {
    const f = fixture();
    const prefix = '\uFEFF# 用户自定义\r\n/custom-output/\r\n';
    write(f.ignore, prefix);
    const created = ensureGrillingIgnore(f.grilling);
    const text = fs.readFileSync(f.ignore, 'utf8');
    check('setup appends a block while preserving BOM and custom CRLF prefix', created.status === 'appended' && text.startsWith(prefix));
    const suffix = '\r\n# 用户尾部规则\r\n!/keep.txt\r\n';
    fs.appendFileSync(f.ignore, suffix);
    const before = fs.readFileSync(f.ignore);
    check('custom suffix and managed CRLF block stay byte-identical', ensureGrillingIgnore(f.grilling).status === 'unchanged' && before.equals(fs.readFileSync(f.ignore)));
    check('managed block adopts existing CRLF without stray LF', !text.replaceAll('\r\n', '').includes('\n'));
  }
  {
    const f=fixture();ensureGrillingIgnore(f.grilling);
    const text='\uFEFF'+fs.readFileSync(f.ignore,'utf8');write(f.ignore,text);
    check('BOM directly before a managed block stays unchanged',ensureGrillingIgnore(f.grilling).status==='unchanged'&&fs.readFileSync(f.ignore,'utf8')===text);
  }
  {
    const f = fixture(); ensureGrillingIgnore(f.grilling);
    const initial = cli(f.repo, 'init', 'task');
    if (initial.status !== 0) throw new Error(initial.stderr);
    const manifest = path.join(f.issue, 'manifest.json'), beforeManifest = fs.readFileSync(manifest);
    const modified = fs.readFileSync(f.ignore, 'utf8').replace('drafts/', 'user-edited/');
    write(f.ignore, modified);
    rejects('modified managed body is rejected', () => ensureGrillingIgnore(f.grilling), /MODIFIED/);
    const result = cli(f.repo, 'init', 'task');
    check('CLI rejects modified block without changing ignore or manifest', result.status !== 0 && fs.readFileSync(f.ignore, 'utf8') === modified && beforeManifest.equals(fs.readFileSync(manifest)), result.stderr);
    write(f.ignore, BEGIN + '\n# unfinished\n');
    const damaged = fs.readFileSync(f.ignore);
    rejects('unfinished block is rejected', () => ensureGrillingIgnore(f.grilling), /INVALID/);
    check('unfinished block is preserved', damaged.equals(fs.readFileSync(f.ignore)));
    const good = block('# template-version: 1\n\n/old-cache/\n');
    write(f.ignore, good + good);
    rejects('duplicate managed blocks are rejected', () => ensureGrillingIgnore(f.grilling), /INVALID/);
  }
  {
    const f = fixture();
    const prefix = '# keep-before\n', suffix = '# keep-after\n';
    write(f.ignore, prefix + block('# template-version: 1\n\n/old-cache/\n') + suffix);
    const result = ensureGrillingIgnore(f.grilling), text = fs.readFileSync(f.ignore, 'utf8');
    check('unchanged old v1 body with valid checksum can be updated', result.status === 'updated' && text.includes('\ndrafts/\n') && !text.includes('/old-cache/'));
    check('updating an old block preserves outside custom rules', text.startsWith(prefix) && text.endsWith(suffix));
    const future = block('# template-version: 999\n\n/future-output/\n'); write(f.ignore, future);
    rejects('future template version is rejected', () => ensureGrillingIgnore(f.grilling), /VERSION_UNSUPPORTED/);
    check('future block is preserved', fs.readFileSync(f.ignore, 'utf8') === future);
  }
  {
    const f = fixture();
    const v2 = '# template-version: 2\n\n# 所有任务中的依赖与未确认草稿\nnode_modules/\ndrafts/\n\n# 验收工具在固定位置生成的本地报告\n/*/3-contract/verification/test-results/\n/*/3-contract/verification/playwright-report/\n';
    const prefix = '\uFEFF# 自定义前置规则\r\n/custom/\r\n', suffix = '# 自定义尾部规则\r\n!/kept.txt\r\n';
    write(f.ignore, prefix + block(v2).replaceAll('\n', '\r\n') + suffix);
    const upgraded = ensureGrillingIgnore(f.grilling), text = fs.readFileSync(f.ignore, 'utf8');
    check('the real v2 body upgrades to v3 with four unprefixed reserved directories', upgraded.status === 'updated' && upgraded.version === 3 && ['node_modules/', 'drafts/', 'test-results/', 'playwright-report/'].every(p => text.includes('\r\n' + p + '\r\n')) && !text.includes('/*/3-contract/verification/'));
    check('v2 upgrade preserves custom prefix, suffix, BOM and CRLF', text.startsWith(prefix) && text.endsWith(suffix) && !text.replaceAll('\r\n', '').includes('\n'));
    const before = fs.readFileSync(f.ignore);
    check('repeat v3 upgrade is byte-idempotent', ensureGrillingIgnore(f.grilling).status === 'unchanged' && before.equals(fs.readFileSync(f.ignore)));
  }
  {
    const f = fixture(); ensureGrillingIgnore(f.grilling); write(path.join(f.issue, 'README.md'), '# formal\n');
    const beforeIndex = git(f.repo, 'ls-files', '-z').stdout;
    const report = inspectIgnorePolicy(f.issue, ['README.md']);
    check('real Git confirms all four output probes plus artifacts', report.ok && report.outputMatches.length === 5 && report.outputMatches.every(m => m.match?.ignored), messages(report));
    check('shared ignore and root ignore are reported as repository prerequisites', report.requiredRepositoryFiles.includes('.aes-workflow/grilling/.gitignore') && report.requiredRepositoryFiles.includes('.gitignore'));
    check('formal files and public ignore remain visible to Git', report.formalMatches.length === 2 && report.formalMatches.every(m => !m.match?.ignored));
    check('inspection leaves the index unchanged', git(f.repo, 'ls-files', '-z').stdout === beforeIndex);
  }
  {
    const f = fixture(); ensureGrillingIgnore(f.grilling);
    const formal = ['3-contract/verification/fixtures/expected/result.json', '3-contract/verification/fixtures/input/report.html'];
    for (const p of formal) write(path.join(f.issue, p), '{}');
    const report = inspectIgnorePolicy(f.issue, formal);
    check('formal expected and input fixtures remain visible with the reserved-directory template', report.ok && report.formalMatches.filter(m => formal.some(p => m.path.endsWith('/' + p))).every(m => !m.match?.ignored), messages(report));
    const nested = ['3-contract/verification/tools/node_modules/nested/dependency.js', '2-prototype/experiments/drafts/nested/old.json', '3-contract/verification/fixtures/test-results/expected.json', '3-contract/verification/fixtures/playwright-report/expected.html'];
    for (const p of nested) write(path.join(f.issue, p), '{}');
    const nestedReport = inspectIgnorePolicy(f.issue, formal);
    check('all four reserved directory names are ignored and inspected at arbitrary depth', nestedReport.ok && nested.every(p => nestedReport.outputMatches.some(m => m.path.endsWith('/' + p) && m.match?.ignored)), messages(nestedReport));
    const invalidFormal = inspectIgnorePolicy(f.issue, nested);
    check('a reserved output directory cannot become a visible formal fixture by registration', !invalidFormal.ok && nested.every(p => invalidFormal.errors.some(e => e.includes('FORMAL_FILE_IGNORED') && e.endsWith('/' + p))), messages(invalidFormal));
    git(f.repo, 'add', '-f', '--', ...nested.map(p => '.aes-workflow/grilling/task/' + p));
    const tracked = inspectIgnorePolicy(f.issue, formal);
    check('tracked outputs under all four nested reserved names block the current task', !tracked.ok && nested.every(p => tracked.trackedCurrent.includes('.aes-workflow/grilling/task/' + p)) && tracked.errors.some(e => e.startsWith('TRACKED_CURRENT_OUTPUTS')), messages(tracked));
  }
  for (const [label, subtree] of [
    ['dependency', '3-contract/verification/node_modules/pkg'],
    ['draft', '2-prototype/drafts/local'],
  ]) {
    const f = fixture(); ensureGrillingIgnore(f.grilling);
    const config = '.aes-workflow/grilling/task/' + subtree + '/.gitignore';
    const output = '.aes-workflow/grilling/task/' + subtree + '/index.js';
    // Git never reads a config below an already ignored directory. Even this
    // negation therefore cannot expose index.js or become a shared prerequisite.
    write(path.join(f.repo, config), '!index.js\n'); write(path.join(f.repo, output), 'local output');
    const report = inspectIgnorePolicy(f.issue);
    check('ignored ' + label + ' subtree configs do not become shared prerequisites', report.ok && !report.requiredRepositoryFiles.includes(config) && [config, output].every(p => report.outputMatches.some(m => m.path === p && m.match?.ignored)), messages(report));
  }
  {
    const f = fixture({ artifacts: false }); ensureGrillingIgnore(f.grilling);
    let report = inspectIgnorePolicy(f.issue);
    check('missing root artifacts protection is an explicit error', !report.ok && report.errors.some(e => e.includes('OUTPUT_NOT_IGNORED') && e.includes('artifacts/')), messages(report));
    write(path.join(f.repo, '.git', 'info', 'exclude'), '/artifacts/\n');
    report = inspectIgnorePolicy(f.issue);
    check('local-only info/exclude protection cannot pass portability', !report.ok && report.errors.some(e => e.includes('IGNORE_RULE_NOT_PORTABLE') && e.includes('artifacts/')), messages(report));
  }
  {
    const f=fixture({artifacts:false});ensureGrillingIgnore(f.grilling);
    const local=path.join(f.repo,'local-only','.gitignore');write(local,'/artifacts/\n');git(f.repo,'config','core.excludesFile',local);
    const report=inspectIgnorePolicy(f.issue);
    check('a global exclude file inside the repo is not a portable ancestor rule',!report.ok&&report.errors.some(e=>e.includes('IGNORE_RULE_NOT_PORTABLE')),messages(report));
  }
  {
    const f=fixture();ensureGrillingIgnore(f.grilling);write(path.join(f.issue,'README.md'),'# formal');
    write(path.join(f.repo,'.gitignore'),'/artifacts/\n/.aes-workflow/*\n!/.aes-workflow/.gitignore\n');
    write(path.join(f.repo,'.aes-workflow','.gitignore'),'!grilling/\n');
    const report=inspectIgnorePolicy(f.issue,['README.md']);
    check('ancestor negation rules are retained as prerequisites',report.ok&&report.requiredRepositoryFiles.includes('.aes-workflow/.gitignore'),messages(report));
    const output=path.join(ROOT,'prerequisite-replay');copyIgnorePrerequisites(output,report);
    const fresh=fixture({artifacts:false});
    for(const p of report.requiredRepositoryFiles)write(path.join(fresh.repo,p),fs.readFileSync(path.join(output,'repository-files',p)));
    write(path.join(fresh.issue,'README.md'),'# formal');
    const replay=inspectIgnorePolicy(fresh.issue,['README.md']);
    check('copied prerequisites replay visibility and output protection in fresh Git',replay.ok,messages(replay));
    write(path.join(f.repo,'.gitignore'),'/artifacts/\n/.aes-workflow/*\n');
    const hidden=inspectIgnorePolicy(f.issue,['README.md']);
    check('an untracked ignored ancestor configuration cannot claim recoverability',!hidden.ok&&hidden.errors.some(e=>e.includes('IGNORE_PREREQUISITE_IGNORED')),messages(hidden));
  }
  {
    const f = fixture(); ensureGrillingIgnore(f.grilling);
    const config = '.aes-workflow/grilling/task/2-prototype/experiments/.gitignore';
    const outputPath = '2-prototype/experiments/drafts/receipt.json';
    write(path.join(f.repo, config), 'drafts/\n'); write(path.join(f.issue, outputPath), '{}');
    const report = inspectIgnorePolicy(f.issue);
    check('an existing nested process output contributes its ancestor ignore prerequisite', report.ok && report.requiredRepositoryFiles.includes(config), messages(report));
    if (report.ok) {
      const output = path.join(ROOT, 'existing-output-prerequisite-copy'); copyIgnorePrerequisites(output, report);
      const fresh = fixture({ artifacts: false });
      for (const p of report.requiredRepositoryFiles) write(path.join(fresh.repo, p), fs.readFileSync(path.join(output, 'repository-files', p)));
      write(path.join(fresh.issue, outputPath), '{}');
      const replay = inspectIgnorePolicy(fresh.issue);
      check('copied existing-output prerequisites replay in fresh Git', replay.ok && replay.requiredRepositoryFiles.includes(config) && replay.outputMatches.some(m => m.path.endsWith('/' + outputPath) && m.match?.ignored), messages(replay));
    } else check('copied existing-output prerequisites replay in fresh Git', false, messages(report));
  }
  {
    const f = fixture(); ensureGrillingIgnore(f.grilling);
    const config = 'artifacts/.gitignore', artifact = 'artifacts/workflow-interview/task/runs/receipt.json';
    write(path.join(f.repo, '.gitignore'), '# artifacts use their own repository rules\n');
    write(path.join(f.repo, config), 'workflow-interview/\n'); write(path.join(f.repo, artifact), '{}');
    // This local configuration is redundant. The same file also protects the
    // output correctly within its native artifacts/ directory scope.
    git(f.repo, 'config', 'core.excludesFile', path.join(f.repo, config));
    const beforeConfig = fs.readFileSync(path.join(f.repo, '.git', 'config'));
    const policy = inspectIgnorePolicy(f.issue);
    check('a correctly scoped ancestor remains portable when also named as a redundant global exclude', policy.ok && policy.requiredRepositoryFiles.includes(config), messages(policy));
    if (policy.ok) {
      const copied = path.join(ROOT, 'native-ancestor-global-copy'); copyIgnorePrerequisites(copied, policy);
      const fresh = fixture({ artifacts: false });
      for (const p of policy.requiredRepositoryFiles) write(path.join(fresh.repo, p), fs.readFileSync(path.join(copied, 'repository-files', p)));
      write(path.join(fresh.repo, artifact), '{}');
      const replay = inspectIgnorePolicy(fresh.issue);
      check('native ancestor protection replays without the redundant global setting', replay.ok && replay.requiredRepositoryFiles.includes(config) && replay.outputMatches.some(m => m.path === artifact && m.match?.ignored), messages(replay));
    } else check('native ancestor protection replays without the redundant global setting', false, messages(policy));
    check('portable native ancestor check leaves the redundant local configuration untouched', beforeConfig.equals(fs.readFileSync(path.join(f.repo, '.git', 'config'))));
  }
  {
    const noGit=path.join(ROOT,'non-git');fs.mkdirSync(noGit);
    const result=cli(noGit,'init','legacy-task');
    check('non-Git init configures local rules with an explicit verification warning',result.status===0&&result.stderr.includes('GIT_CONTEXT_UNAVAILABLE'),result.stderr);
    const report=inspectIgnorePolicy(path.join(noGit,'.aes-workflow/grilling/legacy-task'));
    check('non-Git ignore verification is not reported as PASS',!report.ok&&report.errors.some(e=>e.includes('NOT_VERIFIED')),messages(report));
  }
  {
    const f = fixture(); ensureGrillingIgnore(f.grilling);
    fs.appendFileSync(path.join(f.repo, '.gitignore'), '/.aes-workflow/\n');
    const report = inspectIgnorePolicy(f.issue);
    check('parent rule hiding the public ignore is rejected', !report.ok && report.errors.some(e => e.includes('FORMAL_FILE_IGNORED') && e.includes('grilling/.gitignore')), messages(report));
  }
  {
    const f = fixture(); ensureGrillingIgnore(f.grilling);
    fs.appendFileSync(f.ignore, '\n!/task/2-prototype/drafts/\n!/task/2-prototype/drafts/**\n');
    const report = inspectIgnorePolicy(f.issue);
    check('custom negation disabling a required output rule is detected', !report.ok && report.errors.some(e => e.includes('OUTPUT_NOT_IGNORED') && e.includes('drafts/')), messages(report));
  }
  // These are complete CLI regressions for the two review findings. Declaring
  // a local draft excluded keeps delivery validation green; the Git gate must
  // still reject that exact existing file even when every future probe passes.
  {
    const leaked = '2-prototype/drafts/leaked.json';
    const f = submissionFixture({ excluded: [leaked] });
    const custom = '\n!/task/2-prototype/drafts/\n/task/2-prototype/drafts/**\n!/task/2-prototype/drafts/leaked.json\n';
    fs.appendFileSync(f.ignore, custom);
    const beforeIgnore = fs.readFileSync(f.ignore), beforeIndex = git(f.repo, 'ls-files', '-z').stdout;
    const policy = inspectIgnorePolicy(f.issue);
    const fixed = policy.outputMatches.filter(m => m.path.includes('__workflow_ignore_probe__') || m.path.endsWith('/probe.js') || m.path.endsWith('/probe.json') || m.path.endsWith('/playwright-report/index.html'));
    check('targeted draft exception leaves all five fixed probes ignored', fixed.length === 5 && fixed.every(m => m.match?.ignored), messages(policy));
    const { run, report, output, detail } = checkSubmission(f, 'leaked-draft-preview');
    check('CLI blocks an excluded existing draft released by a targeted custom negation', run.status !== 0 && report.errors?.some(e => e.includes('OUTPUT_NOT_IGNORED') && e.includes(leaked)), detail);
    check('blocked draft CLI does not generate a successful preview', !fs.existsSync(path.join(output, 'submission.json')) && !fs.existsSync(path.join(output, 'issue')), detail);
    check('draft CLI preserves custom rules, local evidence and the fixture index', beforeIgnore.equals(fs.readFileSync(f.ignore)) && fs.existsSync(path.join(f.issue, leaked)) && git(f.repo, 'ls-files', '-z').stdout === beforeIndex);
  }
  {
    const f = submissionFixture();
    const leaked = 'artifacts/workflow-interview/task/runs/receipt.json';
    const custom = '\n!/artifacts/\n/artifacts/*\n!/artifacts/workflow-interview/\n/artifacts/workflow-interview/*\n!/artifacts/workflow-interview/task/\n/artifacts/workflow-interview/task/*\n!/artifacts/workflow-interview/task/runs/\n/artifacts/workflow-interview/task/runs/*\n!/artifacts/workflow-interview/task/runs/receipt.json\n';
    fs.appendFileSync(path.join(f.repo, '.gitignore'), custom);
    write(path.join(f.repo, leaked), '{}');
    const before = fs.readFileSync(path.join(f.repo, '.gitignore'));
    const { run, report, output, detail } = checkSubmission(f, 'leaked-artifact-preview');
    check('CLI blocks existing current-task artifacts even when the global probe stays ignored', run.status !== 0 && report.errors?.some(e => e.includes('OUTPUT_NOT_IGNORED') && e.includes(leaked)) && report.ignorePolicy.outputMatches.some(m => m.path === 'artifacts/workflow-interview/__workflow_ignore_probe__.json' && m.match?.ignored), detail);
    check('blocked artifact CLI preserves custom rules and does not emit a successful preview', before.equals(fs.readFileSync(path.join(f.repo, '.gitignore'))) && fs.existsSync(path.join(f.repo, leaked)) && !fs.existsSync(path.join(output, 'submission.json')), detail);
  }
  {
    const f = submissionFixture();
    const current = 'artifacts/workflow-interview/task/runs/receipt.json';
    const historical = 'artifacts/workflow-interview/older-task/runs/receipt.json';
    write(path.join(f.repo, current), '{}'); write(path.join(f.repo, historical), '{}');
    git(f.repo, 'add', '-f', '--', current, historical);
    const before = git(f.repo, 'ls-files', '-z').stdout;
    const { run, report, output, detail } = checkSubmission(f, 'tracked-artifact-preview');
    check('CLI blocks tracked current-task artifacts with the exact path', run.status !== 0 && report.errors?.some(e => e.startsWith('TRACKED_CURRENT_OUTPUTS')) && report.ignorePolicy.trackedCurrent.includes(current), detail);
    check('CLI separately warns about tracked artifacts from another task', report.ignorePolicy.trackedHistorical.includes(historical) && report.warnings?.some(e => e.startsWith('TRACKED_HISTORICAL_OUTPUTS')), detail);
    check('tracked artifact CLI preserves evidence and index without a successful preview', fs.existsSync(path.join(f.repo, current)) && fs.existsSync(path.join(f.repo, historical)) && git(f.repo, 'ls-files', '-z').stdout === before && !fs.existsSync(path.join(output, 'submission.json')), detail);
  }
  {
    const f = submissionFixture();
    const historical = 'artifacts/workflow-interview/older-task/runs/receipt.json';
    write(path.join(f.repo, historical), '{}'); git(f.repo, 'add', '-f', '--', historical);
    const { run, report, output, detail } = checkSubmission(f, 'historical-artifact-preview');
    const receipt = fs.existsSync(path.join(output, 'submission.json')) ? JSON.parse(fs.readFileSync(path.join(output, 'submission.json'))) : undefined;
    check('tracked historical artifacts warn without blocking a clean task CLI preview', run.status === 0 && receipt?.ignorePolicy.trackedHistorical.includes(historical) && !receipt.ignorePolicy.trackedCurrent.length, detail);
    check('successful preview excludes historical artifacts and leaves the fixture index intact', !!receipt && !receipt.files.some(p => p.path === historical) && git(f.repo, 'ls-files', '-z').stdout === historical + '\0', detail);
  }
  // Windows must classify the same disk directory identically even when the
  // caller changes its spelling. Distinct case-sensitive directories remain
  // separate tasks; never normalize every platform by lowercasing.
  if (process.platform === 'win32') {
    {
      const f = submissionFixture(), current = 'artifacts/workflow-interview/task/runs/receipt.json';
      write(path.join(f.repo, current), '{}'); git(f.repo, 'add', '-f', '--', current);
      const beforeIndex = git(f.repo, 'ls-files', '--stage', '-z').stdout;
      const beforeConfig = fs.readFileSync(path.join(f.repo, '.git', 'config'));
      const beforeIgnore = fs.readFileSync(f.ignore);
      const exact = checkSubmission(f, 'tracked-exact-case');
      const alternate = checkSubmission({ ...f, issue: path.join(f.grilling, 'TASK') }, 'tracked-alternate-case');
      check('Windows task and TASK CLI both reject the same tracked current artifact', exact.run.status !== 0 && alternate.run.status !== 0 && [exact, alternate].every(r => r.report.ignorePolicy.trackedCurrent.includes(current) && !r.report.ignorePolicy.trackedHistorical.includes(current)), alternate.detail);
      check('Windows alternate-case tracked rejection leaves no successful preview or state mutation', [exact, alternate].every(r => !fs.existsSync(path.join(r.output, 'submission.json'))) && git(f.repo, 'ls-files', '--stage', '-z').stdout === beforeIndex && beforeConfig.equals(fs.readFileSync(path.join(f.repo, '.git', 'config'))) && beforeIgnore.equals(fs.readFileSync(f.ignore)) && fs.existsSync(path.join(f.repo, current)), alternate.detail);
    }
    {
      const f = submissionFixture(), current = 'artifacts/workflow-interview/task/runs/receipt.json';
      const custom = '\n!/artifacts/\n/artifacts/*\n!/artifacts/workflow-interview/\n/artifacts/workflow-interview/*\n!/artifacts/workflow-interview/task/\n/artifacts/workflow-interview/task/*\n!/artifacts/workflow-interview/task/runs/\n/artifacts/workflow-interview/task/runs/*\n!/artifacts/workflow-interview/task/runs/receipt.json\n';
      fs.appendFileSync(path.join(f.repo, '.gitignore'), custom); write(path.join(f.repo, current), '{}');
      const beforeRoot = fs.readFileSync(path.join(f.repo, '.gitignore')), beforeIndex = git(f.repo, 'ls-files', '--stage', '-z').stdout;
      const exact = checkSubmission(f, 'visible-exact-case');
      const alternate = checkSubmission({ ...f, issue: path.join(f.grilling, 'TASK') }, 'visible-alternate-case');
      check('Windows task and TASK CLI both reject the same visible current artifact', [exact, alternate].every(r => r.run.status !== 0 && r.report.errors?.some(e => e.includes('OUTPUT_NOT_IGNORED') && e.includes(current)) && r.report.ignorePolicy.outputMatches.some(m => m.path === current)), alternate.detail);
      check('Windows alternate-case visible rejection preserves custom rules, evidence and index', [exact, alternate].every(r => !fs.existsSync(path.join(r.output, 'submission.json'))) && beforeRoot.equals(fs.readFileSync(path.join(f.repo, '.gitignore'))) && fs.existsSync(path.join(f.repo, current)) && git(f.repo, 'ls-files', '--stage', '-z').stdout === beforeIndex, alternate.detail);
    }
    for (const [label, actual] of [
      ['task-directory-case', 'artifacts/workflow-interview/TASK/runs/receipt.json'],
      ['artifact-root-case', 'ARTIFACTS/workflow-interview/task/runs/receipt.json'],
    ]) {
      {
        const f = submissionFixture();
        write(path.join(f.repo, actual), '{}'); git(f.repo, 'add', '-f', '--', actual);
        const beforeIndex = git(f.repo, 'ls-files', '--stage', '-z').stdout;
        const beforeIgnore = fs.readFileSync(path.join(f.repo, '.gitignore'));
        const standard = path.join(f.repo, 'artifacts/workflow-interview/task/runs/receipt.json');
        check('Windows ' + label + ' fixture has the same physical current-artifact identity', fs.realpathSync.native(standard) === fs.realpathSync.native(path.join(f.repo, actual)));
        const { run, report, output, detail } = checkSubmission(f, 'tracked-' + label);
        check('Windows CLI blocks tracked current artifacts with ' + label, run.status !== 0 && report.ignorePolicy.trackedCurrent.includes(actual) && !report.ignorePolicy.trackedHistorical.includes(actual), detail);
        check('Windows ' + label + ' tracked check preserves evidence, custom rules and index without preview', !fs.existsSync(path.join(output, 'submission.json')) && fs.existsSync(path.join(f.repo, actual)) && beforeIgnore.equals(fs.readFileSync(path.join(f.repo, '.gitignore'))) && git(f.repo, 'ls-files', '--stage', '-z').stdout === beforeIndex, detail);
      }
      {
        const f = submissionFixture();
        const current = 'artifacts/workflow-interview/task/runs/receipt.json';
        write(path.join(f.repo, '.gitignore'), '/artifacts/workflow-interview/__workflow_ignore_probe__.json\n# 自定义规则保持\n/other-output/\n');
        write(path.join(f.repo, actual), '{}');
        const beforeRoot = fs.readFileSync(path.join(f.repo, '.gitignore')), beforeIndex = git(f.repo, 'ls-files', '--stage', '-z').stdout;
        const { run, report, output, detail } = checkSubmission(f, 'visible-' + label);
        check('Windows CLI blocks an existing visible current artifact with ' + label, run.status !== 0 && report.ignorePolicy.outputMatches.some(m => m.path === actual || m.path === current) && report.errors?.some(e => e.includes('OUTPUT_NOT_IGNORED') && /receipt\.json/.test(e)), detail);
        check('Windows ' + label + ' visible check preserves custom rules and index without preview', !fs.existsSync(path.join(output, 'submission.json')) && fs.existsSync(path.join(f.repo, actual)) && beforeRoot.equals(fs.readFileSync(path.join(f.repo, '.gitignore'))) && git(f.repo, 'ls-files', '--stage', '-z').stdout === beforeIndex, detail);
      }
    }
    {
      const f = submissionFixture(), actual = 'artifacts/workflow-interview/TASK/runs/receipt.json';
      write(path.join(f.repo, actual), '{}'); git(f.repo, 'add', '-f', '--', actual);
      const beforeIndex = git(f.repo, 'ls-files', '--stage', '-z').stdout;
      // Remove only fixture worktree files. The tracked record deliberately
      // remains, so identity must not depend on every output still existing.
      fs.unlinkSync(path.join(f.repo, actual));
      fs.rmdirSync(path.join(f.repo, 'artifacts/workflow-interview/TASK/runs'));
      fs.rmdirSync(path.join(f.repo, 'artifacts/workflow-interview/TASK'));
      const { run, report, output, detail } = checkSubmission(f, 'deleted-uppercase-artifact-directory');
      check('Windows CLI blocks a current uppercase artifact index entry after its worktree directory is deleted', run.status !== 0 && report.ignorePolicy.trackedCurrent.includes(actual) && !report.ignorePolicy.trackedHistorical.includes(actual), detail);
      check('deleted artifact identity check preserves the index and leaves no successful preview', !fs.existsSync(path.join(output, 'submission.json')) && !fs.existsSync(path.join(f.repo, actual)) && git(f.repo, 'ls-files', '--stage', '-z').stdout === beforeIndex, detail);
    }
    for (const spelling of ['TASK', 'task']) {
      const f = submissionFixture(), actual = 'artifacts/workflow-interview/' + spelling + '/runs/receipt.json';
      write(path.join(f.repo, actual), '{}'); git(f.repo, 'config', 'core.ignorecase', 'false');
      check('Windows ignorecase=false ' + spelling + ' fixture has the standard physical identity before deletion', fs.realpathSync.native(path.join(f.repo, 'artifacts/workflow-interview/task')) === fs.realpathSync.native(path.join(f.repo, 'artifacts/workflow-interview', spelling)));
      git(f.repo, 'add', '-f', '--', actual);
      const beforeIndex = git(f.repo, 'ls-files', '--stage', '-z').stdout, beforeConfig = fs.readFileSync(path.join(f.repo, '.git', 'config'));
      fs.unlinkSync(path.join(f.repo, actual));
      fs.rmdirSync(path.join(f.repo, 'artifacts/workflow-interview', spelling, 'runs'));
      fs.rmdirSync(path.join(f.repo, 'artifacts/workflow-interview', spelling));
      const { run, report, output, detail } = checkSubmission(f, 'deleted-ignorecase-false-' + spelling);
      if (spelling === 'TASK') {
        check('Windows ignorecase=false blocks ambiguous missing uppercase artifact identity instead of accepting historical status', run.status !== 0 && report.errors?.some(e => e.includes('AMBIGUOUS_TASK_IDENTITY')), detail);
      } else {
        check('Windows ignorecase=false keeps an exactly spelled deleted artifact classified as current', run.status !== 0 && report.ignorePolicy.trackedCurrent.includes(actual) && !report.ignorePolicy.trackedHistorical.includes(actual) && report.errors?.some(e => e.startsWith('TRACKED_CURRENT_OUTPUTS')), detail);
      }
      check('Windows ignorecase=false deleted ' + spelling + ' check preserves config and index without a successful preview', !fs.existsSync(path.join(output, 'submission.json')) && !fs.existsSync(path.join(f.repo, actual)) && beforeConfig.equals(fs.readFileSync(path.join(f.repo, '.git', 'config'))) && git(f.repo, 'ls-files', '--stage', '-z').stdout === beforeIndex, detail);
    }
    {
      const f = submissionFixture();
      const actual = 'artifacts/workflow-interview/task/' + Array.from({ length: 9 }, (_, i) => 'deep-' + i + '-' + 'x'.repeat(28)).join('/') + '/receipt.json';
      write(path.join(f.repo, '.gitignore'), '/artifacts/workflow-interview/__workflow_ignore_probe__.json\n# Keep long-path evidence local\n');
      let created = false;
      try { write(path.join(f.repo, actual), '{}'); created = fs.statSync(path.join(f.repo, actual)).isFile(); }
      catch (error) { if (!['ENAMETOOLONG', 'ENOENT'].includes(error.code)) throw error; console.log('NOT_RUN Windows long-path output: filesystem creation rejected ' + error.code); }
      if (created) {
        git(f.repo, 'config', 'core.longpaths', 'false');
        const beforeConfig = fs.readFileSync(path.join(f.repo, '.git', 'config')), beforeRoot = fs.readFileSync(path.join(f.repo, '.gitignore'));
        const beforeIndex = git(f.repo, 'ls-files', '--stage', '-z').stdout;
        const { run, report, output, detail } = checkSubmission(f, 'visible-long-path-artifact');
        check('Windows CLI enumerates and blocks a visible current artifact longer than MAX_PATH despite local core.longpaths=false', run.status !== 0 && report.ignorePolicy.outputMatches.some(m => m.path === actual) && report.errors?.some(e => e.includes('OUTPUT_NOT_IGNORED') && e.includes(actual)), detail);
        check('Windows long-path check preserves evidence, local config, custom rules and index without preview', !fs.existsSync(path.join(output, 'submission.json')) && fs.existsSync(path.join(f.repo, actual)) && beforeConfig.equals(fs.readFileSync(path.join(f.repo, '.git', 'config'))) && beforeRoot.equals(fs.readFileSync(path.join(f.repo, '.gitignore'))) && git(f.repo, 'ls-files', '--stage', '-z').stdout === beforeIndex, detail);
      }
    }
  } else {
    const f = fixture(); ensureGrillingIgnore(f.grilling);
    const other = path.join(f.grilling, 'TASK'); fs.mkdirSync(other, { recursive: true });
    const actualStat = fs.statSync(f.issue), otherStat = fs.statSync(other);
    if (actualStat.dev === otherStat.dev && actualStat.ino === otherStat.ino) console.log('NOT_RUN case-sensitive independent task and artifacts roots: filesystem resolves task and TASK to the same directory');
    else {
      const current = 'artifacts/workflow-interview/task/runs/current.json', historical = 'artifacts/workflow-interview/TASK/runs/other.json', separateRoot = 'ARTIFACTS/workflow-interview/task/runs/separate.json';
      write(path.join(f.repo, current), '{}'); write(path.join(f.repo, historical), '{}'); write(path.join(f.repo, separateRoot), '{}');
      git(f.repo, 'add', '-f', '--', current, historical, separateRoot);
      const policy = inspectIgnorePolicy(f.issue);
      check('case-sensitive task and TASK directories retain distinct current and historical identities', !policy.ok && policy.trackedCurrent.includes(current) && !policy.trackedCurrent.includes(historical) && policy.trackedHistorical.includes(historical), messages(policy));
      check('case-sensitive artifacts and ARTIFACTS roots remain separate directories', !policy.trackedCurrent.includes(separateRoot) && !policy.trackedHistorical.includes(separateRoot), messages(policy));
    }
  }
  {
    const f = submissionFixture(), artifact = 'artifacts/workflow-interview/task/runs/receipt.json', disguised = 'artifacts/.gitignore';
    write(path.join(f.repo, '.gitignore'), '/artifacts/workflow-interview/__workflow_ignore_probe__.json\n');
    write(path.join(f.repo, disguised), '/' + artifact + '\n'); write(path.join(f.repo, artifact), '{}');
    git(f.repo, 'config', 'core.excludesFile', path.join(f.repo, disguised));
    const beforeConfig = fs.readFileSync(path.join(f.repo, '.git', 'config')), beforeIndex = git(f.repo, 'ls-files', '--stage', '-z').stdout;
    const beforeRoot = fs.readFileSync(path.join(f.repo, '.gitignore')), beforeDisguised = fs.readFileSync(path.join(f.repo, disguised));
    const { run, report, output, detail } = checkSubmission(f, 'global-disguised-ancestor');
    check('CLI rejects a global exclude masquerading as a repository ancestor rule', run.status !== 0 && report.errors?.some(e => e.includes(artifact)), detail);
    check('disguised global exclude cannot produce a successful portable preview', !fs.existsSync(path.join(output, 'submission.json')) && !fs.existsSync(path.join(output, 'issue')), detail);
    check('exclude-independent inspection preserves local Git config, custom rules, evidence and index', beforeConfig.equals(fs.readFileSync(path.join(f.repo, '.git', 'config'))) && beforeRoot.equals(fs.readFileSync(path.join(f.repo, '.gitignore'))) && beforeDisguised.equals(fs.readFileSync(path.join(f.repo, disguised))) && git(f.repo, 'ls-files', '--stage', '-z').stdout === beforeIndex && fs.existsSync(path.join(f.repo, artifact)));
  }
  {
    const f = submissionFixture(), artifact = 'artifacts/workflow-interview/task/runs/receipt.json';
    write(path.join(f.repo, '.gitignore'), '/artifacts/\n/.aes-workflow/*\n!/.aes-workflow/.gitignore\n');
    write(path.join(f.repo, '.aes-workflow', '.gitignore'), '!grilling/\n');
    write(path.join(f.repo, artifact), '{}');
    const unrelatedGlobal = path.join(ROOT, 'unrelated-global-' + sequence);
    write(unrelatedGlobal, '/unrelated-global/\n'); git(f.repo, 'config', 'core.excludesFile', unrelatedGlobal);
    write(path.join(f.repo, '.git', 'info', 'exclude'), '/unrelated-info/\n');
    const beforeConfig = fs.readFileSync(path.join(f.repo, '.git', 'config')), beforeInfo = fs.readFileSync(path.join(f.repo, '.git', 'info', 'exclude'));
    const beforeIndex = git(f.repo, 'ls-files', '--stage', '-z').stdout;
    const { run, report, output, detail } = checkSubmission(f, 'portable-with-local-excludes');
    check('normal repository rules pass the full CLI despite unrelated global and info excludes', run.status === 0 && report.report?.ok && fs.existsSync(path.join(output, 'submission.json')), detail);
    check('exclude-independent check retains the effective ancestor negation prerequisite', report.ignorePolicy.requiredRepositoryFiles.includes('.aes-workflow/.gitignore'), detail);
    if (run.status === 0) {
      const receipt = JSON.parse(fs.readFileSync(path.join(output, 'submission.json'), 'utf8'));
      const fresh = fixture({ artifacts: false });
      for (const p of receipt.repositoryPrerequisites) write(path.join(fresh.repo, p), fs.readFileSync(path.join(output, 'repository-files', p)));
      fs.cpSync(path.join(output, 'issue'), fresh.issue, { recursive: true }); write(path.join(fresh.repo, artifact), '{}');
      const replay = checkSubmission(fresh, 'portable-fresh-no-local-excludes');
      check('all copied prerequisites replay through the full CLI without local excludes', replay.run.status === 0 && replay.report.report?.ok && replay.report.ignorePolicy.requiredRepositoryFiles.includes('.aes-workflow/.gitignore') && replay.report.ignorePolicy.outputMatches.some(m => m.path === artifact && m.match?.ignored), replay.detail);
    } else check('all copied prerequisites replay through the full CLI without local excludes', false, detail);
    check('successful portable verification leaves unrelated local excludes and index unchanged', beforeConfig.equals(fs.readFileSync(path.join(f.repo, '.git', 'config'))) && beforeInfo.equals(fs.readFileSync(path.join(f.repo, '.git', 'info', 'exclude'))) && git(f.repo, 'ls-files', '--stage', '-z').stdout === beforeIndex);
  }
  {
    const f = fixture(); ensureGrillingIgnore(f.grilling); write(path.join(f.issue, 'README.md'), '# formal\n');
    fs.appendFileSync(f.ignore, '\n/task/README.md\n');
    const report = inspectIgnorePolicy(f.issue, ['README.md']);
    check('custom rule hiding a formal delivery is rejected', !report.ok && report.errors.some(e => e.includes('FORMAL_FILE_IGNORED') && e.includes('README.md')), messages(report));
  }
  {
    const f = fixture(); ensureGrillingIgnore(f.grilling);
    const current = '.aes-workflow/grilling/task/2-prototype/drafts/current.html';
    const historical = '.aes-workflow/grilling/older-task/2-prototype/drafts/old.html';
    write(path.join(f.repo, current), 'current'); write(path.join(f.repo, historical), 'historical');
    git(f.repo, 'add', '-f', '--', current, historical);
    const before = git(f.repo, 'ls-files', '-z').stdout;
    const report = inspectIgnorePolicy(f.issue);
    check('tracked current process output blocks submission', !report.ok && report.trackedCurrent.includes(current) && report.errors.some(e => e.startsWith('TRACKED_CURRENT_OUTPUTS')), messages(report));
    check('tracked historical process output is separately warned', report.trackedHistorical.includes(historical) && report.warnings.some(e => e.startsWith('TRACKED_HISTORICAL_OUTPUTS')), messages(report));
    check('tracked outputs and index are preserved', fs.existsSync(path.join(f.repo, current)) && fs.existsSync(path.join(f.repo, historical)) && git(f.repo, 'ls-files', '-z').stdout === before);
    const other = path.join(f.grilling, 'fresh-task'); fs.mkdirSync(other);
    const onlyHistorical = inspectIgnorePolicy(other);
    check('unrelated historical outputs do not block a clean task', onlyHistorical.ok && onlyHistorical.trackedHistorical.length === 2, messages(onlyHistorical));
  }
  {
    const f = fixture({ separate: true });
    const result = cli(f.repo, 'init', 'separate-task');
    const issue = path.join(f.grilling, 'separate-task');
    const report = inspectIgnorePolicy(issue, ['manifest.json']);
    check('separate git-dir repository with .git file supports init and inspection', fs.statSync(path.join(f.repo, '.git')).isFile() && result.status === 0 && report.ok, result.stderr + messages(report));
  }
  {
    const f = fixture();
    fs.rmdirSync(f.issue); fs.rmdirSync(f.grilling);
    const destination = path.join(ROOT, 'junction-destination'); fs.mkdirSync(destination);
    fs.symlinkSync(destination, f.grilling, process.platform === 'win32' ? 'junction' : 'dir');
    rejects('setup refuses a symlink or junction ancestor', () => ensureGrillingIgnore(f.grilling), /SYMLINK_NOT_ALLOWED/);
    check('rejected linked setup leaves destination untouched', fs.readdirSync(destination).length === 0);
  }
} catch (error) {
  check('test harness completes without unexpected error', false, error.stack || String(error));
} finally {
  if (priorGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = priorGlobal;
  if (priorSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM; else process.env.GIT_CONFIG_NOSYSTEM = priorSystem;
  const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(ROOT));
  if (!relative.startsWith('grilling-ignore-regression-') || relative.includes(path.sep)) throw new Error('Refusing cleanup outside the temporary fixture');
  fs.rmSync(ROOT, { recursive: true, force: true });
}
console.log('\n' + total + ' checks; ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
