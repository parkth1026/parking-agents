#!/usr/bin/env node
// AC-007 真实宿主人工门：离线门代替不了的证据。
//
// (a) 3 个 fresh contract-complete ready-for-agent Issue 的无人值守 live 运行 —— 需要用户
//     先指定 Issue 或授权创建，本脚本只负责在获得授权后驱动与留证。
// (b) 产品 desktop 全屏星图、右侧 Workers 面板与既有交互不降级。
// 另含：对本机既有 worktree 的真实只读校验（必须零写副作用）。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';
import { launchChrome } from './cdp.mjs';
import { matchesLockedTextSha } from './build-portrait.mjs';
import { classifySlot, probeSlot } from './runner-slots.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
// 代码仓的设计真源：从 SKILL_DIR 上溯到代码仓根（跟 SKILL_DIR 走，与 receipt 分离）。
const CODEBASE_ROOT = resolve(join(SKILL_DIR, '..', '..', '..'));
const DESKTOP_TRUTH = join(CODEBASE_ROOT, 'docs', 'design', 'design_handoff_issue_starmap', '需求星图 7a.dc.html');
const LOCKED_DESKTOP_SHA = '2703B1A632292A1AD4927D2BFD6E57384E234248B5E6EF59C9AA11128435B98A';
const LOCKED_MOCK_SHA = '1A94A5291A37D3969E71E245AFD8399425CA80E13839260A451FC7CD7D736CF4';
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

function git(cwd, args) {
  const result = spawnSync('git', args, { ...HEADLESS_CHILD_OPTIONS, cwd, encoding: 'utf8' });
  return result.status === 0 ? String(result.stdout).trim() : null;
}

function gitHead(cwd) { return git(cwd, ['rev-parse', 'HEAD']); }

// 真实工作区的完整可观测指纹。只读校验的「无写副作用」就是靠它前后比对。
function worktreeFingerprint(path) {
  return {
    head: gitHead(path),
    branch: git(path, ['rev-parse', '--abbrev-ref', 'HEAD']),
    status: git(path, ['status', '--porcelain=v1', '--untracked-files=all']) || '',
    stash: git(path, ['stash', 'list']) || '',
    reflog: (git(path, ['reflog', '--max-count=1']) || ''),
  };
}

// ---------------------------------------------------------------- (b) desktop 非回归

export async function desktopNonRegressionGate({ repoRoot = process.cwd() } = {}) {
  const desktopTruth = matchesLockedTextSha(DESKTOP_TRUTH, LOCKED_DESKTOP_SHA);
  assert.ok(desktopTruth.matched,
    `desktop 视觉真源已被修改，非回归基准失效: ${JSON.stringify(desktopTruth.variants)}`);

  const workDir = mkdtempSync(join(tmpdir(), 'aes-live-desktop-'));
  const page = await launchChrome({ ...DESKTOP_VIEWPORT, deviceScaleFactor: 1 });
  try {
    const boardPath = join(workDir, 'board.html');
    writeFileSync(boardPath, readFileSync(join(SKILL_DIR, 'board.html'), 'utf8')
      .replace('__WORKBOARD_STATUS__', 'data:text/javascript,window.WORKBOARD%3Dnull%3B'));

    // 先看设计真源，取它自己声明的语言与拓扑；再看产品，逐项核对没有降级。
    await page.goto(pathToFileURL(DESKTOP_TRUTH).href);
    const truthShot = await page.session.screenshot();

    page.takeConsoleErrors();
    await page.goto(pathToFileURL(boardPath).href);
    const productShot = await page.session.screenshot();
    const observed = await page.session.evaluate(`(() => {
      const el = (id) => document.getElementById(id);
      const rect = (node) => { if (!node) return null; const r = node.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
      const app = document.querySelector('.app');
      const workers = el('workers');
      return {
        portraitActive: document.body.classList.contains('portrait-active'),
        portraitBooted: Boolean(el('portrait-root') && el('portrait-root').shadowRoot),
        appRect: rect(app),
        starmapRect: rect(el('graph')),
        // 右侧 Workers 面板必须仍在右侧，而不是被竖屏改动挤走。
        workersRect: rect(workers),
        workersOnRight: workers ? (workers.getBoundingClientRect().right > innerWidth * 0.6) : false,
        detailsPresent: Boolean(el('details')),
        legendPresent: Boolean(el('legend')),
        zoomPresent: Boolean(el('zoom')),
        searchPresent: Boolean(el('search')),
        refreshPresent: Boolean(el('refresh')),
        progressPresent: Boolean(document.querySelector('.progress')),
        modeBadge: el('mode-badge') ? el('mode-badge').textContent.trim() : null,
        viewToggle: [...document.querySelectorAll('[data-view]')].map((b) => b.dataset.view),
        dispatchModalPresent: Boolean(el('dirty-modal')),
        documentOverflow: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      };
    })()`);

    // 竖屏层在桌面下必须完全不参与。
    assert.equal(observed.portraitActive, false, 'desktop 不得进入竖屏模式');
    assert.equal(observed.portraitBooted, false, 'desktop 下竖屏工作台不得启动');
    // 全屏星图：铺满视口。
    assert.deepEqual(observed.appRect, [0, 0, DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height],
      'desktop 星图必须仍是全屏');
    assert.deepEqual(observed.starmapRect, [0, 0, DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height],
      'desktop 画布必须仍铺满');
    assert.equal(observed.workersOnRight, true, '右侧 Workers 面板必须仍在右侧');
    for (const key of ['detailsPresent', 'legendPresent', 'zoomPresent', 'searchPresent',
      'refreshPresent', 'progressPresent', 'dispatchModalPresent']) {
      assert.equal(observed[key], true, `desktop 既有交互组件缺失: ${key}`);
    }
    assert.deepEqual(observed.viewToggle, ['graph', 'map'], 'desktop 双视图文案与切换不得降级');
    assert.deepEqual(observed.documentOverflow, [DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height],
      'desktop 不得产生 document 溢出');
    assert.deepEqual(page.takeConsoleErrors(), [], 'desktop 渲染不得产生控制台错误或未捕获异常');

    // receipt 落在目标仓的 .aes-worktree-board/receipts 目录。
    const receiptDir = join(resolve(repoRoot), '.aes-worktree-board', 'receipts');
    mkdirSync(receiptDir, { recursive: true });
    const receipt = {
      schemaVersion: 'aes.worktree-board.live-gate-receipt/v1',
      acceptance: 'AC-007(b)',
      commit: gitHead(repoRoot) || 'UNKNOWN',
      mockSha256: LOCKED_MOCK_SHA,
      desktopTruthSha256: LOCKED_DESKTOP_SHA,
      viewport: DESKTOP_VIEWPORT,
      environment: {
        browser: page.browserVersion,
        userAgent: page.userAgent,
        deviceScaleFactor: page.deviceScaleFactor,
        platform: process.platform,
      },
      observed,
      screenshotSha256: {
        designTruth: createHash('sha256').update(truthShot).digest('hex').toUpperCase(),
        product: createHash('sha256').update(productShot).digest('hex').toUpperCase(),
      },
      recordedAt: new Date().toISOString(),
    };
    writeFileSync(join(receiptDir, 'ac-007b-desktop-non-regression.json'),
      `${JSON.stringify(receipt, null, 2)}\n`);
    writeFileSync(join(receiptDir, 'ac-007b-product-desktop-1440x900.png'), productShot);
    writeFileSync(join(receiptDir, 'ac-007b-design-truth-1440x900.png'), truthShot);
    return receipt;
  } finally {
    await page.close();
    rmSync(workDir, { recursive: true, force: true, maxRetries: 3 });
  }
}

// ---------------------------------------------------------------- 本机 worktree 只读校验

// 对真实 worktree 只做观测，不做任何写入。前后指纹必须完全一致 ——
// 「只读」如果不被机械证明，就只是一句承诺。
export function inspectLocalWorktrees({ repoRoot, integrationBranch, worktrees }) {
  const results = [];
  for (const path of worktrees) {
    const before = worktreeFingerprint(path);
    const facts = probeSlot({ slotId: path, worktreePath: path }, { integrationBranch, expectedRoot: repoRoot });
    const verdict = classifySlot(facts, { expectedRoot: repoRoot });
    const after = worktreeFingerprint(path);
    assert.deepEqual(after, before, `只读校验对 ${path} 产生了写副作用`);
    results.push({
      worktreePath: facts.worktreePath,
      exists: facts.exists,
      branch: facts.branch,
      head: facts.head,
      dirtyCount: facts.dirtyEntries.length,
      syncedToIntegration: facts.syncedToIntegration,
      state: verdict.state,
      reason: verdict.reason,
      recovery: verdict.recovery || null,
      claimable: verdict.claimable,
      readOnlyVerified: true,
    });
  }
  return results;
}

export function localWorktreeGate({ repoRoot, integrationBranch = 'dev', worktrees }) {
  const results = inspectLocalWorktrees({ repoRoot, integrationBranch, worktrees });
  // receipt 落在目标仓的 .aes-worktree-board/receipts 目录。
  const receiptDir = join(resolve(repoRoot), '.aes-worktree-board', 'receipts');
  mkdirSync(receiptDir, { recursive: true });
  const receipt = {
    schemaVersion: 'aes.worktree-board.worktree-inspection-receipt/v1',
    acceptance: 'AC-007(a) 只读校验部分',
    commit: gitHead(repoRoot) || 'UNKNOWN',
    repoRoot,
    integrationBranch,
    inspected: results.length,
    writeSideEffects: 0,
    worktrees: results,
    recordedAt: new Date().toISOString(),
  };
  writeFileSync(join(receiptDir, 'ac-007a-worktree-readonly.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

// ---------------------------------------------------------------- (a) live 运行留证

// 从 v4 registry 与 append-only 审计流里如实导出这次真实宿主运行发生了什么。
// 不重新计算、不美化：registry 说什么就写什么 —— receipt 的价值全在于它不替系统圆场。
export function liveRunReceipt({ repoRoot, hostWorktree, issueRepo, integrationBranch, v4Dir, unexpectedUserMessages = 0 }) {
  const registry = JSON.parse(readFileSync(join(v4Dir, 'registry.json'), 'utf8'));
  const auditLines = (name) => {
    try {
      return readFileSync(join(v4Dir, name), 'utf8').split(/\r?\n/).filter(Boolean).length;
    } catch { return 0; }
  };

  const jobs = Object.values(registry.jobs).map((job) => {
    const delivery = registry.deliveries[job.jobId] || null;
    const attempt = registry.attempts[job.currentAttemptId] || null;
    return {
      jobId: job.jobId,
      issue: job.issue,
      title: job.title,
      url: job.url,
      declaredRisk: job.declaredRisk,
      state: job.state,
      slotId: job.slotId,
      attempts: job.attemptIds.length,
      baseCommit: job.baseCommit,
      candidateCommit: attempt?.candidateCommit || null,
      // 缺证据一律显式写 NOT_RUN，不留空让读者以为跑过。
      reviewOutcome: attempt?.review?.outcome || 'NOT_RUN',
      qaOutcome: attempt?.qa?.outcome || 'NOT_RUN',
      acceptance: job.acceptance || [],
      mergeCommit: delivery?.mergeCommit || null,
      postMergeVerification: delivery?.postMergeVerification
        ? { outcome: delivery.postMergeVerification.outcome, runId: delivery.postMergeVerification.runId }
        : null,
      issueClose: delivery?.issueClose || null,
      runnerRelease: delivery?.runnerRelease || null,
    };
  });

  // 只数本轮产生的 merge：按 job 的 mergeCommit 反查，而不是数整条分支历史。
  // 数 `git log --merges <branch>` 会把验收基线之前的祖先 merge 一并算进来，
  // 把 3 说成 23 —— receipt 的价值全在于不替系统圆场，这种失真必须避免。
  const runMergeCommits = jobs
    .filter((job) => job.mergeCommit)
    .map((job) => ({
      jobId: job.jobId,
      issue: job.issue,
      mergeCommit: job.mergeCommit,
      subject: git(hostWorktree, ['log', '-1', '--format=%s', job.mergeCommit]) || null,
    }));
  const branchMergeTotal = ((git(hostWorktree, ['log', '--merges', '--format=%H', integrationBranch]) || '')
    .split(/\r?\n/).filter(Boolean)).length;

  const receipt = {
    schemaVersion: 'aes.worktree-board.live-run-receipt/v1',
    acceptance: 'AC-007(a)',
    recordedAt: new Date().toISOString(),
    repo: { root: repoRoot, issueRepo, integrationBranch, hostWorktree },
    integrationHead: gitHead(hostWorktree),
    // 验收分支是专用的：live 门不触碰 main / dev，这两个 SHA 就是证据。
    untouchedBranches: { main: git(repoRoot, ['rev-parse', 'main']), dev: git(repoRoot, ['rev-parse', 'dev']) },
    master: registry.master,
    jobs,
    // 本轮产生的 merge；branchMergeTotal 只作对照，说明分支上还有多少历史祖先 merge。
    runMergeCommits,
    branchMergeTotal,
    humanRequests: Object.values(registry.humanRequests).map((request) => ({
      resumeToken: request.resumeToken, kind: request.kind, state: request.state, open: request.open,
    })),
    discoveries: Object.values(registry.discoveries),
    audit: {
      transitions: auditLines('transitions.jsonl'),
      receipts: auditLines('receipts.jsonl'),
      inbox: auditLines('inbox.jsonl'),
    },
    // 契约要求：全程零意外用户消息，人工触点仅限契约人工态终点。
    unexpectedUserMessages,
    humanTouchpoints: Object.values(registry.humanRequests).length,
    // 契约残留风险监测项：本轮 reviewer 与 owner 同 session，未达成独立性。
    reviewerIndependence: 'same-session',
  };

  // receipt 落在目标仓的 .aes-worktree-board/receipts 目录。
  const receiptDir = join(resolve(repoRoot), '.aes-worktree-board', 'receipts');
  mkdirSync(receiptDir, { recursive: true });
  const path = join(receiptDir, 'ac-007a-live-run.json');
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
  return { path, receipt };
}

// ---------------------------------------------------------------- CLI

function parseArguments(argv) {
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) positional.push(value);
    else options[value.slice(2)] = argv[++index];
  }
  return { options, positional };
}

if (resolve(process.argv[1] || '') === resolve(fileURLToPath(import.meta.url))) {
  const { options, positional } = parseArguments(process.argv.slice(2));
  try {
    if (positional[0] === 'desktop') {
      const receipt = await desktopNonRegressionGate({ repoRoot: options.repo || process.cwd() });
      console.log(JSON.stringify({ ok: true, gate: 'AC-007(b)', commit: receipt.commit, browser: receipt.environment.browser }));
    } else if (positional[0] === 'worktrees') {
      const receipt = localWorktreeGate({
        repoRoot: options.repo || process.cwd(),
        integrationBranch: options.branch || 'dev',
        worktrees: (options.paths || '').split(',').map((value) => value.trim()).filter(Boolean),
      });
      console.log(JSON.stringify({ ok: true, gate: 'AC-007(a) readonly', inspected: receipt.inspected, writeSideEffects: 0 }));
    } else if (positional[0] === 'live-receipt') {
      const { path, receipt } = liveRunReceipt({
        repoRoot: options.repo || process.cwd(),
        hostWorktree: options.host || options.repo || process.cwd(),
        issueRepo: options['issue-repo'] || 'unknown',
        integrationBranch: options.branch || 'dev',
        v4Dir: options.dir || join(options.repo || process.cwd(), '.aes-worktree-board', 'runtime-v4'),
        unexpectedUserMessages: Number(options['unexpected-user-messages'] || 0),
      });
      console.log(JSON.stringify({
        ok: true, gate: 'AC-007(a)', path,
        jobs: receipt.jobs.length,
        closed: receipt.jobs.filter((job) => job.state === 'closed').length,
        merges: receipt.runMergeCommits.length,
        unexpectedUserMessages: receipt.unexpectedUserMessages,
      }));
    } else {
      throw new Error('用法: live-gate.mjs desktop [--repo <root>] | worktrees --repo <root> --branch <b> --paths <p1,p2,...> | live-receipt --repo <root> --host <worktree> --branch <b> --issue-repo <owner/name>');
    }
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.stack || error.message }));
    process.exitCode = 1;
  }
}
