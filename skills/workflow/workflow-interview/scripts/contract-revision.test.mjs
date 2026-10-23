#!/usr/bin/env node
/** 契约修订 CLI 回归：只用隔离 Git 仓库，不修改真实任务或索引。 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const session = path.join(here, 'session.mjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-contract-revision-'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const run = (...args) => spawnSync(process.execPath, [session, ...args], { cwd: root, encoding: 'utf8' });
const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
const out = result => `${result.stdout || ''}\n${result.stderr || ''}`;
let count = 0, failed = 0, sequence = 0;
function check(name, ok, detail = '') {
  count++;
  if (ok) console.log('ok   ' + name);
  else { failed++; console.error(`FAIL ${name}\n${detail}`); }
}
function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() && !fs.lstatSync(target).isSymbolicLink() ? files(target) : [target];
  }).sort();
}
function liveSnapshot(dir) {
  return JSON.stringify(files(dir).map(file => [path.relative(dir, file).replaceAll('\\', '/'),
    fs.lstatSync(file).isSymbolicLink() ? `SYMLINK:${fs.readlinkSync(file)}` : sha(fs.readFileSync(file))]));
}
function archiveSnapshot() { return liveSnapshot(path.join(root, 'artifacts')); }
const readManifest = dir => JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
function saveManifest(dir, manifest) { fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n'); }
function fixture() {
  const slug = 'revision-' + (++sequence);
  const initialized = run('init', slug);
  if (initialized.status !== 0) throw new Error(out(initialized));
  const dir = path.join(root, '.aes-workflow', 'grilling', slug);
  fs.writeFileSync(path.join(dir, '1-interview/context.md'), '# 已确认事实\n');
  fs.writeFileSync(path.join(dir, '1-interview/rounds.jsonl'), '{"stage":"1-interview","round":1,"tier":"confirm","item":"原边界已确认"}\n');
  fs.writeFileSync(path.join(dir, '2-prototype/behavior.md'), '# 已确认行为\n');
  fs.writeFileSync(path.join(dir, '3-contract/contract.md'), [
    '# Goal Contract: 只修订表达', '## 目标', '保持原边界。', '## 验收条件',
    '- AC-001: 输出可核验',
    '  - Verify: [A] `node -e "require(\'node:fs\').writeFileSync(\'product-verify-ran\',\'BAD\')"` → 文件存在', '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, '3-contract/contract-interface.md'), '# 契约家族报文\n');
  fs.writeFileSync(path.join(dir, '3-contract/verify.txt'), '原有冒烟结果，不得覆盖\r\n');
  fs.writeFileSync(path.join(dir, '3-contract/verify-evidence.txt'), '原有复验结果，不得覆盖\n');
  const m = readManifest(dir);
  m.stage = '3-contract'; m.status = 'ready'; m.next_action = '契约已就绪，把交接指令发给执行 Agent。';
  m.stage_gates['1-interview'] = { status: 'done', closed_at: '2026-10-20T00:00:00Z', self_assessment: { 意图: '已定' } };
  m.stage_gates['2-prototype'] = { status: 'done', closed_at: '2026-10-20T00:01:00Z', artifacts_confirmed: ['behavior'] };
  m.stage_gates['3-contract'] = { status: 'done', closed_at: '2026-10-20T00:02:00Z' };
  m.validation = { status: 'valid', ran_at: '2026-10-20T00:02:00Z', ac_count: 1 };
  m.custom_extension = { preserve: '不丢自定义字段' };
  saveManifest(dir, m);
  return dir;
}

try {
  if (git('init', '-q').status !== 0) throw new Error('隔离 Git 初始化失败');
  fs.writeFileSync(path.join(root, '.gitignore'), '/artifacts/\n');
  {
    const dir = fixture();
    fs.writeFileSync(path.join(dir, 'revision.json'), '{"source":"与归档回执同名的正式输入"}\n');
    const registration = readManifest(dir);
    registration.delivery = { schema_version: 1, files: [{ path: 'revision.json', role: 'contract', sha256: sha(fs.readFileSync(path.join(dir, 'revision.json'))) }], excluded: [] };
    saveManifest(dir, registration);
    const before = readManifest(dir);
    const roundsBefore = fs.readFileSync(path.join(dir, '1-interview/rounds.jsonl'));
    const original = new Map(['manifest.json', '3-contract/contract.md', '3-contract/contract-interface.md', '3-contract/verify.txt', '3-contract/verify-evidence.txt', 'revision.json']
      .map(name => [name, fs.readFileSync(path.join(dir, name))]));
    git('add', '.');
    const index = fs.readFileSync(path.join(root, '.git/index'));
    const result = run('revise', dir, '--reason', '补充完成条件，不改变目标和边界');
    check('revise/显式修订成功', result.status === 0, out(result));
    const after = readManifest(dir);
    check('revise/只重开契约且撤销就绪', after.stage === '3-contract' && after.status !== 'ready'
      && after.stage_gates['3-contract'].status === 'in_progress' && !after.stage_gates['3-contract'].closed_at, JSON.stringify(after));
    check('revise/旧校验不再现行', after.validation?.status !== 'valid' || after.validation?.stale === true, JSON.stringify(after.validation));
    check('revise/保留已确认前两阶段和自定义字段',
      ['1-interview', '2-prototype'].every(stage => JSON.stringify(before.stage_gates[stage]) === JSON.stringify(after.stage_gates[stage]))
      && JSON.stringify(before.custom_extension) === JSON.stringify(after.custom_extension));
    check('revise/不自动改正文或运行产品Verify',
      [...original].filter(([name]) => name !== 'manifest.json').every(([name, bytes]) => bytes.equals(fs.readFileSync(path.join(dir, name))))
      && !fs.existsSync(path.join(root, 'product-verify-ran')));
    check('revise/不替用户确认或追加问答', roundsBefore.equals(fs.readFileSync(path.join(dir, '1-interview/rounds.jsonl'))));
    check('revise/不操作Git索引', index.equals(fs.readFileSync(path.join(root, '.git/index'))));
    const archive = path.join(root, 'artifacts', 'workflow-interview', before.slug, 'archive');
    const archived = files(archive);
    check('revise/底本归宿主仓artifacts而非正式目录', archived.length >= 4 && !files(dir).some(file => /archive|revision-receipt/.test(path.relative(dir, file))));
    check('revise/家族与旧manifest逐字归档', [...original].every(([name, bytes]) => archived.some(file =>
      file.replaceAll('\\', '/').endsWith('/' + name) && bytes.equals(fs.readFileSync(file)))));
    const receipt = archived.filter(file => file.endsWith('.json') && path.basename(file) !== 'manifest.json')
      .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    check('revise/回执包含原因和全部底本指纹', receipt.includes('补充完成条件') && [...original.values()].every(bytes => receipt.includes(sha(bytes))), receipt);
    check('revise/源revision.json与归档回执隔离', archived.some(file => file.replaceAll('\\', '/').endsWith('/issue/revision.json')
      && original.get('revision.json').equals(fs.readFileSync(file)))
      && archived.some(file => path.basename(file) === 'revision.json' && path.basename(path.dirname(file)) !== 'issue'
        && fs.readFileSync(file, 'utf8').includes('archive_directory')));
    check('revise/交接改为修订与重新核验', /修订|修正/.test(after.next_action || '') && /finalize|重新核验/.test(after.next_action || '')
      && !/发给执行 Agent/.test(after.next_action || ''), after.next_action);
    const firstArchive = archiveSnapshot();
    const result2 = run('revise', dir, '--reason', '第二次修订，保留第一次底本');
    check('revise/再次修订使用独立底本', result2.status === 0
      && fs.existsSync(archive) && fs.readdirSync(archive).length >= 2
      && files(archive).filter(file => file.endsWith('/contract.md') || file.endsWith('\\contract.md')).length >= 2, out(result2));
    check('revise/第二次不覆盖第一次归档', JSON.parse(firstArchive).every(([name, hash]) =>
      fs.existsSync(path.join(root, 'artifacts', name)) && sha(fs.readFileSync(path.join(root, 'artifacts', name))) === hash));
  }
  for (const kind of ['缺原因', '空原因', '访谈未闭合', '对照物未闭合', '登记家族漂移', '登记附件缺失']) {
    const dir = fixture();
    if (kind === '访谈未闭合' || kind === '对照物未闭合') {
      const m = readManifest(dir); m.stage_gates[kind === '访谈未闭合' ? '1-interview' : '2-prototype'].status = 'in_progress'; saveManifest(dir, m);
    }
    if (kind === '登记家族漂移') {
      const m = readManifest(dir); m.delivery = { schema_version: 1, files: [
        { path: '3-contract/contract.md', role: 'contract', sha256: sha(fs.readFileSync(path.join(dir, '3-contract/contract.md'))) },
        { path: '3-contract/contract-interface.md', role: 'contract', sha256: sha(Buffer.from('旧报文')) },
      ], excluded: [] }; saveManifest(dir, m);
    }
    if (kind === '登记附件缺失') {
      const attachment = path.join(dir, '3-contract/interface.json');
      fs.writeFileSync(attachment, '{"contract":"已登记的接口附件"}\n');
      const m = readManifest(dir);
      m.delivery = { schema_version: 1, files: [{ path: '3-contract/interface.json', role: 'contract', sha256: sha(fs.readFileSync(attachment)) }], excluded: [] };
      saveManifest(dir, m);
      fs.unlinkSync(attachment);
    }
    const before = liveSnapshot(dir), archiveBefore = archiveSnapshot();
    const result = kind === '缺原因' ? run('revise', dir)
      : run('revise', dir, '--reason', kind === '空原因' ? '   ' : '边界不变的修订');
    check(`revise/${kind}拒绝`, result.status !== 0, out(result));
    check(`revise/${kind}不改live或归档`, before === liveSnapshot(dir) && archiveBefore === archiveSnapshot());
  }
  {
    const probe = path.join(root, 'case-probe');
    fs.writeFileSync(probe, 'case');
    const insensitive = fs.existsSync(path.join(root, 'CASE-PROBE'));
    fs.unlinkSync(probe);
    if (insensitive) {
      for (const kind of ['主文件', '附属登记']) {
        const dir = fixture();
        if (kind === '主文件') fs.renameSync(path.join(dir, '3-contract/contract.md'), path.join(dir, '3-contract/Contract.md'));
        const attachment = kind === '附属登记' ? '3-contract/CONTRACT-interface.md' : '3-contract/contract-interface.md';
        const plan = path.join(root, 'case-plan-' + sequence + '.json');
        fs.writeFileSync(plan, JSON.stringify({ files: [
          ['manifest.json', 'state'], ['1-interview/context.md', 'requirement'], ['1-interview/rounds.jsonl', 'decision'],
          ['2-prototype/behavior.md', 'prototype'], ['3-contract/contract.md', 'contract'], [attachment, 'contract'],
        ].map(([name, role]) => ({ path: name, role })), excluded: [
          { path: '3-contract/verify.txt', reason: '保留过程证据' },
          { path: '3-contract/verify-evidence.txt', reason: '保留过程证据' },
        ] }));
        let result = run('delivery', dir, '--plan', plan);
        check(`revise/Windows${kind}大小写别名可正式登记`, result.status === 0, out(result));
        const original = liveSnapshot(dir);
        result = run('revise', dir, '--reason', '大小写别名属于同一底本');
        check(`revise/Windows${kind}别名只归档一次且有完整回执`, result.status === 0, out(result));
        if (result.status === 0) {
          const record = JSON.parse(result.stdout);
          const receipt = JSON.parse(fs.readFileSync(record.receipt, 'utf8'));
          const contracts = receipt.files.filter(file => /^3-contract\/contract.*\.md$/i.test(file.path));
          check(`revise/Windows${kind}实际路径可逐项恢复`, contracts.length === 2 && receipt.files.every(file => {
            const snapshot = path.join(record.archive, file.archive_path);
            const bytes = fs.readFileSync(snapshot);
            return file.bytes === bytes.length && file.sha256 === sha(bytes);
          }) && contracts.some(file => file.path === (kind === '主文件' ? '3-contract/Contract.md' : '3-contract/contract-interface.md')
            && file.aliases?.includes(kind === '主文件' ? '3-contract/contract.md' : attachment)), JSON.stringify(receipt));
          const firstSnapshot = liveSnapshot(record.archive);
          const again = run('revise', dir, '--reason', '重复修订保留此前完整底本');
          check(`revise/Windows${kind}重复修订独立且原回执不变`, again.status === 0
            && JSON.parse(again.stdout).archive !== record.archive && liveSnapshot(record.archive) === firstSnapshot, out(again));
          check(`revise/Windows${kind}live正文保持`, JSON.parse(original).filter(([name]) => name !== 'manifest.json')
            .every(([name, hash]) => hash === sha(fs.readFileSync(path.join(dir, name)))));
        }
      }
      for (const kind of ['不同别名错SHA', '重复登记先错后对SHA']) {
        const dir = fixture(), m = readManifest(dir), bytes = fs.readFileSync(path.join(dir, '3-contract/contract-interface.md'));
        const wrong = { path: '3-contract/contract-interface.md', role: 'contract', sha256: sha(Buffer.from('过时的登记字节')) };
        const correct = { path: kind === '不同别名错SHA' ? '3-contract/CONTRACT-interface.md' : wrong.path, role: 'contract', sha256: sha(bytes) };
        m.delivery = { schema_version: 1, files: [wrong, correct], excluded: [] };
        saveManifest(dir, m);
        const before = liveSnapshot(dir), archives = archiveSnapshot();
        const result = run('revise', dir, '--reason', '每个登记约束都必须核验');
        check(`revise/Windows${kind}拒绝`, result.status !== 0 && /REVISION_CONTRACT_CHANGED/.test(out(result)), out(result));
        check(`revise/Windows${kind}写归档前失败`, before === liveSnapshot(dir) && archives === archiveSnapshot());
      }
    } else {
      const dir = fixture();
      fs.writeFileSync(path.join(dir, '3-contract/Contract.md'), '# 区分大小写的独立文件\n');
      const result = run('revise', dir, '--reason', '不同大小写可表示独立文件');
      check('revise/区分大小写平台不合并不同文件', result.status === 0 && ['3-contract/contract.md', '3-contract/Contract.md'].every(name => {
        const record = JSON.parse(result.stdout);
        return record.files.some(file => file.path === name)
          && fs.readFileSync(path.join(record.archive, 'issue', name)).equals(fs.readFileSync(path.join(dir, name)));
      }), out(result));
      console.log('NOT_RUN revise/Windows大小写别名：当前文件系统区分大小写；已验证独立文件不合并');
    }
  }
  {
    const dir = fixture();
    const m = readManifest(dir);
    m.stage_gates['2-prototype'] = { status: 'skipped', reason: '无可观察改动，用户已确认' };
    saveManifest(dir, m);
    const caller = path.join(root, 'caller-repo');
    fs.mkdirSync(path.join(caller, '.git'), { recursive: true });
    const result = spawnSync(process.execPath, [session, 'revise', dir, '--reason', '只有契约表达修订'], { cwd: caller, encoding: 'utf8' });
    check('revise/保留已确认跳过的对照物阶段', result.status === 0
      && JSON.stringify(readManifest(dir).stage_gates['2-prototype']) === JSON.stringify(m.stage_gates['2-prototype']), out(result));
    check('revise/由issue宿主确定归档位置，不随cwd改变',
      files(path.join(root, 'artifacts/workflow-interview', m.slug, 'archive')).length >= 4
      && !fs.existsSync(path.join(caller, 'artifacts')));
  }
  {
    // 派生 dossier 必须在最后一次 manifest 变更后生成。阶段闭合不能要求旧派生文件先变新。
    const dir = fixture();
    const write = (name, text) => { const target = path.join(dir, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
    write('1-interview/context.md', ['任务陈述', '用户提出的方案', '意图假设', '已查事实', '验证基建候选池', '四分类']
      .map(name => `## ${name}\n\n已确认。`).join('\n\n'));
    write('2-prototype/impact-surface.md', ['用户可见界面', '可观察行为', '可运行输出', '对外接口报文', '用户配置', '历史兼容性', '架构与依赖']
      .map(name => `- ${name}：无`).join('\n') + '\n');
    const contract = [
      '# Goal Contract: 修订闭合回归', '', '## 目标', '', '已确认的结果输出。', '', '## 验收条件', '',
      '- AC-001: 输入固定数据后输出与期望一致',
      '  - Verify: [A] `node -e "process.exit(1)"` → 退出码 0', '',
      '## 读什么', '', '- [验收期望](verification/expected.json)', '',
    ].join('\n');
    write('3-contract/contract.md', contract);
    write('3-contract/verification/expected.json', '{"answer":42}\n');
    const plan = path.join(root, 'revision-cycle-plan.json');
    fs.writeFileSync(plan, JSON.stringify({ files: [
      ['manifest.json', 'state'], ['1-interview/context.md', 'requirement'], ['1-interview/rounds.jsonl', 'decision'],
      ['2-prototype/impact-surface.md', 'requirement'], ['2-prototype/behavior.md', 'prototype'],
      ['3-contract/contract.md', 'contract'], ['3-contract/contract-interface.md', 'contract'],
      ['3-contract/verification/expected.json', 'verification'], ['dossier.html', 'derived'],
    ].map(([name, role]) => ({ path: name, role })), excluded: [
      { path: '3-contract/verify.txt', reason: '保留冒烟过程证据' },
      { path: '3-contract/verify-evidence.txt', reason: '保留独立复验过程证据' },
    ] }));
    const exportDossier = () => spawnSync(process.execPath, [path.join(here, 'export-dossier.mjs'), '--issue-dir', dir], { cwd: root, encoding: 'utf8' });
    let result = run('delivery', dir, '--plan', plan);
    check('revision-cycle/登记既有正式材料', result.status === 0, out(result));
    result = exportDossier();
    check('revision-cycle/生成旧dossier', result.status === 0, out(result));
    const oldDossier = fs.readFileSync(path.join(dir, 'dossier.html'));
    result = run('revise', dir, '--reason', '只完善表达，原验收边界不变');
    check('revision-cycle/归档后开启修订', result.status === 0, out(result));
    write('3-contract/contract.md', contract.replace('已确认的结果输出。', '原有结果，补充清楚表达。'));
    result = run('round', dir, JSON.stringify({ stage: '3-contract', round: 2, tier: 'default', item: '修正表达，保留原始边界' }));
    check('revision-cycle/记录实际修订决定', result.status === 0, out(result));
    result = run('delivery', dir, '--plan', plan);
    check('revision-cycle/重新登记变化的正式文件', result.status === 0, out(result));
    result = run('finalize', dir);
    check('revision-cycle/旧dossier不阻塞finalize', result.status === 0, out(result));
    result = run('stage', dir, '3-contract', 'done');
    check('revision-cycle/旧dossier不阻塞契约阶段闭合', result.status === 0
      && readManifest(dir).stage_gates['3-contract'].status === 'done' && readManifest(dir).status === 'ready', out(result));
    result = run('submission-check', dir);
    check('revision-cycle/正式提交仍拒绝旧dossier', result.status !== 0 && /DOSSIER_STALE/.test(out(result)), out(result));
    check('revision-cycle/闭合前后不自动覆写旧dossier', oldDossier.equals(fs.readFileSync(path.join(dir, 'dossier.html'))));
    result = exportDossier();
    check('revision-cycle/最终状态生成新dossier', result.status === 0, out(result));
    result = run('submission-check', dir);
    check('revision-cycle/新dossier与验收依赖完整时通过', result.status === 0, out(result));
    fs.unlinkSync(path.join(dir, '3-contract/verification/expected.json'));
    result = run('stage', dir, '3-contract', 'done');
    check('revision-cycle/忽略派生过期不放宽验收依赖', result.status !== 0 && /MISSING_DELIVERY|DEPENDENCY_MISSING/.test(out(result)), out(result));
    result = run('submission-check', dir);
    check('revision-cycle/正式提交仍拒缺失验收输入', result.status !== 0 && /MISSING_DELIVERY|DEPENDENCY_MISSING/.test(out(result)), out(result));
  }
  {
    const dir = fixture(), slug = path.basename(dir);
    const host = path.join(root, 'git-file-host');
    const metadata = path.join(root, 'git-file-metadata');
    const init = git('init', '-q', '--separate-git-dir', metadata, host);
    if (init.status !== 0) throw new Error(out(init));
    const moved = path.join(host, '.aes-workflow/grilling', slug);
    fs.mkdirSync(path.dirname(moved), { recursive: true }); fs.renameSync(dir, moved);
    const result = run('revise', moved, '--reason', '支持git文件宿主');
    check('revise/git文件宿主正确归档', result.status === 0 && fs.statSync(path.join(host, '.git')).isFile()
      && files(path.join(host, 'artifacts/workflow-interview', slug, 'archive')).length >= 6, out(result));
  }
  {
    const dir = fixture(), slug = path.basename(dir);
    const host = path.join(root, 'junction-host'), outside = path.join(root, 'junction-output');
    const init = git('init', '-q', host);
    if (init.status !== 0) throw new Error(out(init));
    const moved = path.join(host, '.aes-workflow/grilling', slug);
    fs.mkdirSync(path.dirname(moved), { recursive: true }); fs.renameSync(dir, moved);
    fs.mkdirSync(outside);
    try {
      fs.symlinkSync(outside, path.join(host, 'artifacts'), process.platform === 'win32' ? 'junction' : 'dir');
      const before = liveSnapshot(moved), outputBefore = liveSnapshot(outside);
      const result = run('revise', moved, '--reason', '拒绝输出目录链接');
      check('revise/归档输出junction或symlink拒绝', result.status !== 0, out(result));
      check('revise/输出链接拒绝不改live或外部目录', before === liveSnapshot(moved) && outputBefore === liveSnapshot(outside));
    } catch (error) {
      if (error.code !== 'EPERM' && error.code !== 'EACCES') throw error;
      console.log('NOT_RUN revise/输出目录链接：当前平台无创建权限');
    }
  }
  {
    const dir = fixture(), cpath = path.join(dir, '3-contract/contract.md');
    const outside = path.join(root, 'outside-contract.md');
    fs.writeFileSync(outside, fs.readFileSync(cpath)); fs.unlinkSync(cpath);
    try {
      fs.symlinkSync(outside, cpath, 'file');
      const before = liveSnapshot(dir), archiveBefore = archiveSnapshot();
      const result = run('revise', dir, '--reason', '不能通过符号链接保存底本');
      check('revise/契约符号链接拒绝', result.status !== 0, out(result));
      check('revise/符号链接拒绝不改live或归档', before === liveSnapshot(dir) && archiveBefore === archiveSnapshot());
    } catch (error) {
      if (error.code !== 'EPERM' && error.code !== 'EACCES') throw error;
      console.log('NOT_RUN revise/文件符号链接：当前平台无创建权限');
    }
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
console.log(`\n${count - failed}/${count} 通过`);
process.exitCode = failed ? 1 : 0;
