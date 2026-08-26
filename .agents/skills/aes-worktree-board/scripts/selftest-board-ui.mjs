#!/usr/bin/env node
// AC-006：700×1000 竖屏工作台。
//
// 截图 diff 的两侧是「同一次运行中渲染的 mock.html 与产品 board.html」，不是 mock 当初
// 录下的 PNG 字节。后者会因 Chromium 版本不同永远失败，而失败原因与产品无关；前者只要求
// 版本在单次运行内固定，实际版本写进 D-02 receipt。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';
import { diffPng, launchChrome } from './cdp.mjs';
import { DEFAULT_MOCK_PATH, generatePortraitBlock, normalizeEol, sha256Of } from './build-portrait.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const REPO_ROOT = resolve(join(SKILL_DIR, '..', '..', '..'));
export const RECEIPT_DIR = join(SKILL_DIR, 'receipts');
// 契约锁定的 mock SHA；产品必须一直跟着这个真源走。
export const LOCKED_MOCK_SHA = '1A94A5291A37D3969E71E245AFD8399425CA80E13839260A451FC7CD7D736CF4';
export const DESKTOP_TRUTH = join(REPO_ROOT, 'docs', 'design', 'design_handoff_issue_starmap', '需求星图 7a.dc.html');
export const LOCKED_DESKTOP_SHA = '2703B1A632292A1AD4927D2BFD6E57384E234248B5E6EF59C9AA11128435B98A';

const BASELINE = { width: 700, height: 1000 };
// 相邻竖屏只做布局 smoke，不做像素 diff（契约明确「仅布局 smoke」）。
// 768 档工作台仍是居中的 700 宽，图谱尺寸与基线相同 —— 该档本就没有 resize 发生，
// 因此不期望 reset 旧 pan/zoom；把这个差异写进用例表，而不是让断言含糊过去。
const ADJACENT = [
  { width: 640, height: 960, viewBox: '0 0 640 644', graphResizes: true },
  { width: 768, height: 1024, viewBox: '0 0 700 684', graphResizes: false },
];
const REQUIRED_FONTS = ['Segoe UI', 'Microsoft YaHei', 'Cascadia Mono', 'Georgia'];

// shadow root 内取值的统一入口：所有断言都必须穿过 shadow 边界，
// 顺带证明产品确实把工作台放在隔离作用域里（桌面层 id 不会被误命中）。
const SHADOW = "document.getElementById('portrait-root').shadowRoot";

function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { ...HEADLESS_CHILD_OPTIONS, cwd: REPO_ROOT, encoding: 'utf8' });
  return result.status === 0 ? String(result.stdout).trim() : 'UNKNOWN';
}

function stageBoard(workDir) {
  const board = readFileSync(join(SKILL_DIR, 'board.html'), 'utf8')
    .replace('__WORKBOARD_STATUS__', 'data:text/javascript,window.WORKBOARD%3Dnull%3B');
  const path = join(workDir, 'board.html');
  writeFileSync(path, board);
  return path;
}

// ------------------------------------------------------------------ 静态断言

function assertGeneratedBlockFresh() {
  const board = readFileSync(join(SKILL_DIR, 'board.html'), 'utf8');
  const mockSha = sha256Of(readFileSync(DEFAULT_MOCK_PATH));
  assert.equal(mockSha, LOCKED_MOCK_SHA, 'mock.html 已偏离契约锁定的 SHA，视觉真源失效');
  assert.equal(sha256Of(readFileSync(DESKTOP_TRUTH)), LOCKED_DESKTOP_SHA, 'desktop 视觉真源不得被修改');
  // 生成物必须与当前 mock 完全一致：否则产品在悄悄偏离真源。换行风格不参与比较。
  const expected = normalizeEol(generatePortraitBlock(DEFAULT_MOCK_PATH));
  assert.ok(normalizeEol(board).includes(expected),
    'board.html 中的竖屏工作台区段与 mock.html 不同步；重跑 build-portrait.mjs');
  assert.ok(board.includes(`mockSha256=${LOCKED_MOCK_SHA}`), '生成区段必须记录 mock SHA 溯源');
  // 桌面层不得被竖屏改动侵入。
  assert.ok(board.includes('id="graph"') && board.includes('class="map-view" id="map-view"'), '桌面全屏星图结构必须保留');
}

// ------------------------------------------------------------------ 交互断言

async function readState(page) {
  return page.session.evaluate(`(() => {
    const root = ${SHADOW};
    const graph = root.getElementById('graph');
    const details = root.getElementById('details');
    const drawer = root.getElementById('runner-drawer');
    const nodes = [...root.querySelectorAll('.node')].map((node) => ({
      id: Number(node.dataset.id),
      opacity: Number(node.style.opacity),
      tabIndex: node.tabIndex,
      ariaHidden: node.getAttribute('aria-hidden'),
      ariaSelected: node.getAttribute('aria-selected'),
      ariaExpanded: node.getAttribute('aria-expanded'),
      transform: node.style.transform,
    }));
    return {
      viewBox: graph.getAttribute('viewBox'),
      graphRect: (() => { const r = graph.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })(),
      graphDisplay: getComputedStyle(graph).display,
      listDisplay: getComputedStyle(root.getElementById('list-view')).display,
      nodes,
      beacons: [...root.querySelectorAll('.beacon')].map((b) => ({ id: Number(b.dataset.beacon), opacity: b.style.opacity })),
      detailsOpen: details.classList.contains('open'),
      detailsExpanded: details.classList.contains('expanded'),
      detailsAriaHidden: details.getAttribute('aria-hidden'),
      drawerOpen: drawer.classList.contains('open'),
      drawerAriaHidden: drawer.getAttribute('aria-hidden'),
      detailId: root.getElementById('detail-id').textContent,
      detailTitle: root.getElementById('detail-title').textContent,
      detailBody: root.getElementById('detail-body').textContent,
      peekMeta: root.getElementById('peek-meta').textContent,
      collapsedNote: root.getElementById('collapsed-note').textContent,
      zoom: root.getElementById('zoom-value').textContent,
      transform: root.getElementById('viewport').getAttribute('transform'),
      searchValue: root.getElementById('search').value,
      activeFilter: [...root.querySelectorAll('[data-filter]')].filter((b) => b.classList.contains('active')).map((b) => b.dataset.filter),
      listCards: [...root.querySelectorAll('[data-list-id]')].map((b) => Number(b.dataset.listId)),
      statusPill: root.querySelector('.status-pill.demo, .status-pill.goal').textContent,
      activeElementId: root.activeElement ? (root.activeElement.dataset.id || root.activeElement.id || root.activeElement.tagName) : null,
    };
  })()`);
}

// 图谱节点是 SVG <g>，没有 HTMLElement.click()；对它们派发真实 MouseEvent。
function click(page, selectorExpression) {
  return page.session.evaluate(`(() => {
    const root = ${SHADOW};
    const el = ${selectorExpression};
    if (!el) throw new Error('找不到元素: ' + ${JSON.stringify(selectorExpression)});
    if (typeof el.click === 'function') el.click();
    else el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    return true;
  })()`);
}

async function boardUiAssertions(page, boardUrl) {
  await page.goto(boardUrl);

  // --- 容器原生动态 viewBox ---
  let state = await readState(page);
  assert.equal(state.viewBox, '0 0 700 684', '700 基线必须使用容器原生 viewBox');
  assert.deepEqual(state.graphRect, [0, 258, 700, 684], '图谱几何必须与锁定基线一致');

  // --- DEMO SNAPSHOT truthful（无真实数据时不得显示 LIVE）---
  assert.equal(state.statusPill, 'DEMO SNAPSHOT', '静态 fixture 必须显示 DEMO SNAPSHOT');
  const liveText = await page.session.evaluate(`${SHADOW}.textContent.includes('LIVE')`);
  assert.equal(liveText, false, '未经 live 校验不得出现 LIVE 字样');

  // --- 10 条 Issue 同源绑定 ---
  assert.equal(state.nodes.length, 10, '必须渲染 10 条 Issue');
  const ids = state.nodes.map((node) => node.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [7, 12, 34, 45, 47, 49, 53, 58, 60, 61]);

  // --- beacon 常显（独立于节点淡出层）---
  assert.ok(state.beacons.length >= 4, 'worker beacon 必须存在');

  // --- 真实一跳展开：#58 展开后必须揭示概览中折叠的 #60 ---
  const before = new Map(state.nodes.map((node) => [node.id, node]));
  assert.equal(before.get(60).opacity, 0, '#60 在概览中应折叠');
  await click(page, `root.querySelector('[data-id="58"]')`);
  state = await readState(page);
  const expanded = new Map(state.nodes.map((node) => [node.id, node]));
  assert.ok(expanded.get(60).opacity > 0.5, '一跳展开必须真实揭示折叠的 #60，而不是只淡出别人');
  assert.equal(expanded.get(58).ariaExpanded, 'true');
  assert.equal(expanded.get(58).ariaSelected, 'true');
  for (const id of [47, 53, 60, 61]) {
    assert.ok(expanded.get(id).opacity > 0.5, `一跳邻居 #${id} 必须可见`);
  }
  // 非邻居退出辅助技术树。
  assert.equal(expanded.get(12).ariaHidden, 'true', '非邻居必须退出辅助技术树');
  assert.notEqual(before.get(58).transform, expanded.get(58).transform, '展开必须真实移动布局，而不是原地淡出');
  assert.match(state.collapsedNote, /#58 已展开一跳/);
  assert.equal(state.detailsOpen, true, '展开必须同时打开不遮挡图谱的 peek sheet');
  assert.equal(state.detailId, '#58');

  // --- 复位 ---
  await click(page, `root.getElementById('detail-reset')`);
  state = await readState(page);
  assert.equal(state.detailsOpen, false, '复位必须关闭详情');
  assert.match(state.collapsedNote, /选择节点/);
  assert.equal(state.nodes.find((node) => node.id === 60).opacity, 0, '复位必须回到概览折叠态');

  // --- 10 条 Issue 逐条同源绑定 + 缺失字段显示 未产生 / NOT_RUN ---
  await click(page, `root.querySelector('[data-view="list"]')`);
  state = await readState(page);
  assert.equal(state.listCards.length, 10, 'List 必须显示全部十条');
  assert.equal(state.graphDisplay, 'none', 'List 视图必须隐藏 Map 浮层');
  const seen = new Set();
  for (const id of [45, 61, 7, 60, 12]) {
    await click(page, `root.querySelector('[data-list-id="${id}"]')`);
    const detail = await readState(page);
    assert.equal(detail.detailId, `#${id}`, `List → Map 必须绑定 #${id}`);
    assert.ok(!seen.has(detail.detailBody), `#${id} 的详情不得复用其他 Issue 的证据`);
    seen.add(detail.detailBody);
    // #45 / #61 尚未领取 job，缺失字段必须显式标注而不是留空或编造。
    if ([45, 61].includes(id)) {
      assert.match(detail.detailBody, /未产生 \/ NOT_RUN/, `#${id} 缺失字段必须显示「未产生 / NOT_RUN」`);
    }
    await click(page, `root.getElementById('detail-reset')`);
    await click(page, `root.querySelector('[data-view="list"]')`);
  }

  // --- delivery / awaiting-human / legacy 状态可达 ---
  await click(page, `root.querySelector('[data-list-id="7"]')`);
  state = await readState(page);
  assert.match(state.detailBody, /WAITING_HUMAN_VERDICT/, 'awaiting-human 的人工验收证据必须可达');
  assert.match(state.detailBody, /writer lease released/);
  await click(page, `root.getElementById('detail-reset')`);
  await click(page, `root.querySelector('[data-view="list"]')`);
  await click(page, `root.querySelector('[data-list-id="34"]')`);
  state = await readState(page);
  assert.match(state.detailBody, /merged · issue closed/, 'delivery 终态必须可达');
  assert.match(state.detailBody, /legacy archive immutable/, 'legacy 归档证据必须可达');
  await click(page, `root.getElementById('detail-reset')`);

  // --- runner drawer 与 detail sheet 互斥 ---
  await click(page, `root.querySelector('[data-view="map"]')`);
  await click(page, `root.querySelector('[data-id="58"]')`);
  state = await readState(page);
  assert.equal(state.detailsOpen, true);
  await click(page, `root.getElementById('runner-toggle')`);
  state = await readState(page);
  assert.equal(state.drawerOpen, true, 'runner drawer 必须打开');
  assert.equal(state.detailsOpen, false, 'drawer 与 detail sheet 必须互斥');
  assert.equal(state.detailsAriaHidden, 'true');
  assert.equal(state.drawerAriaHidden, 'false');
  const legacyText = await page.session.evaluate(`${SHADOW}.getElementById('runner-drawer').textContent`);
  assert.match(legacyText, /LEGACY V3 ARCHIVE · READ ONLY/, 'legacy 只读封存必须在 drawer 中可见');
  assert.match(legacyText, /不迁移、不推导/);

  // --- runner 定位：清除不兼容 filter 后再定位 ---
  await click(page, `root.getElementById('runner-close')`);
  await click(page, `root.querySelector('[data-filter="frontier"]')`);
  state = await readState(page);
  assert.deepEqual(state.activeFilter, ['frontier'], 'filter 必须生效');
  await click(page, `root.getElementById('runner-toggle')`);
  await click(page, `root.querySelector('[data-locate="58"]')`);
  state = await readState(page);
  assert.deepEqual(state.activeFilter, [], '定位必须先清除不兼容 filter');
  assert.equal(state.drawerOpen, false, '定位后 drawer 必须关闭');
  assert.equal(state.detailId, '#58');
  const located = state.nodes.find((node) => node.id === 58);
  assert.equal(located.ariaHidden, 'false');
  assert.equal(located.tabIndex, 0);
  assert.equal(located.ariaSelected, 'true');

  // --- Map/List/search/filter 单一状态源 ---
  await click(page, `root.getElementById('detail-reset')`);
  await page.session.evaluate(`(() => {
    const root = ${SHADOW}; const search = root.getElementById('search');
    search.value = 'runner'; search.dispatchEvent(new Event('input', { bubbles: true })); return true;
  })()`);
  state = await readState(page);
  assert.equal(state.searchValue, 'runner');
  assert.equal(state.detailsOpen, false, '搜索必须清除既有 selection');
  // 单一状态源的含义：同一个 query 同时决定 Map 的可见集与 List 的条目集。
  const mapMatched = state.nodes.filter((node) => node.opacity === 1).map((node) => node.id).sort((a, b) => a - b);
  assert.ok(mapMatched.length > 0 && mapMatched.length < 10, `搜索应过滤出子集，实际 ${mapMatched.length}`);
  await click(page, `root.querySelector('[data-view="list"]')`);
  state = await readState(page);
  assert.deepEqual(state.listCards.sort((a, b) => a - b), mapMatched,
    'List 必须与 Map 用同一份过滤结果，不得各自维护状态');
  assert.equal(state.detailsOpen, false, '切换视图必须清除 selection/expansion/detail');
  assert.equal(state.drawerOpen, false);
  // 清空搜索后两边同时回到全集。
  await page.session.evaluate(`(() => {
    const root = ${SHADOW}; const search = root.getElementById('search');
    search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true })); return true;
  })()`);
  state = await readState(page);
  assert.equal(state.listCards.length, 10, '清空搜索后 List 必须回到全集');

  // --- 键盘 / 焦点 / ARIA ---
  await click(page, `root.querySelector('[data-view="map"]')`);
  const keyboard = await page.session.evaluate(`(() => {
    const root = ${SHADOW}; const node = root.querySelector('[data-id="58"]');
    node.focus();
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    return { expanded: node.getAttribute('aria-expanded'), focused: root.activeElement === node };
  })()`);
  assert.equal(keyboard.expanded, 'true', 'Enter 必须触发真实一跳');
  const escaped = await page.session.evaluate(`(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const root = ${SHADOW};
    return root.getElementById('details').classList.contains('open');
  })()`);
  assert.equal(escaped, false, 'Escape 必须收起详情');
  const roles = await page.session.evaluate(`(() => {
    const root = ${SHADOW};
    return {
      nodeRole: root.querySelector('.node').getAttribute('role'),
      nodeLabel: root.querySelector('.node').getAttribute('aria-label'),
      drawerRole: root.getElementById('runner-drawer').getAttribute('role'),
      drawerModal: root.getElementById('runner-drawer').getAttribute('aria-modal'),
      searchResultsRole: root.getElementById('search-results').getAttribute('role'),
      graphLabel: root.getElementById('graph').getAttribute('aria-label'),
    };
  })()`);
  assert.equal(roles.nodeRole, 'button');
  assert.match(roles.nodeLabel, /Issue #/);
  assert.equal(roles.drawerRole, 'dialog');
  assert.equal(roles.drawerModal, 'true');
  assert.equal(roles.searchResultsRole, 'listbox');
  assert.ok(roles.graphLabel);

  // --- id 唯一性（含 shadow 边界两侧）---
  const duplicateIds = await page.session.evaluate(`(() => {
    const check = (root) => {
      const seen = new Set(); const dupes = [];
      root.querySelectorAll('[id]').forEach((el) => { if (seen.has(el.id)) dupes.push(el.id); seen.add(el.id); });
      return dupes;
    };
    return { light: check(document), shadow: check(${SHADOW}) };
  })()`);
  assert.deepEqual(duplicateIds.light, [], '桌面层不得出现重复 id');
  assert.deepEqual(duplicateIds.shadow, [], '工作台不得出现重复 id');

  // --- 无 document overflow ---
  const overflow = await page.session.evaluate(`({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  })`);
  assert.deepEqual(overflow, { scrollWidth: 700, scrollHeight: 1000 }, '700×1000 下不得产生 document 溢出');

  // 整轮交互跑完后控制台必须干净（design-qa 的「0 errors」口径）。
  assert.deepEqual(page.takeConsoleErrors(), [], '竖屏工作台交互不得产生控制台错误或未捕获异常');

  return { ok: true };
}

// zoom / pan / pinch 锚点。用真实 CDP 输入事件，不伪造 pointer 生命周期。
async function gestureAssertions(page, boardUrl) {
  await page.goto(boardUrl);
  // 未交互时 transform 属性不存在，语义上等于恒等变换。
  const transformOf = () => page.session.evaluate(`(() => {
    const t = ${SHADOW}.getElementById('viewport').getAttribute('transform');
    if (!t) return { x: 0, y: 0, k: 1 };
    const m = t.match(/translate\\(([-\\d.]+) ([-\\d.]+)\\) scale\\(([-\\d.]+)\\)/);
    return { x: Number(m[1]), y: Number(m[2]), k: Number(m[3]) };
  })()`);

  assert.deepEqual(await transformOf(), { x: 0, y: 0, k: 1 }, '初始 transform 必须是恒等');

  // 按钮 zoom
  await click(page, `root.querySelector('[data-zoom="in"]')`);
  const zoomed = await transformOf();
  assert.ok(zoomed.k > 1.1 && zoomed.k < 1.3, `zoom in 应到约 1.2，实际 ${zoomed.k}`);
  await click(page, `root.getElementById('fit')`);
  assert.deepEqual(await transformOf(), { x: 0, y: 0, k: 1 }, '复位必须回到恒等 transform');

  // 离中心双指缩放：锚点必须固定。
  const anchor = { x: 130, y: 450 };
  // Chrome 会把连续 touchMove 合并后延迟派发。实测只等 rAF 不够 —— 会读到上一次手势的
  // 结果；必须给输入管线真实的挂钟时间去 flush，再等一帧确认已应用。
  const settle = async () => {
    await new Promise((resolve) => { setTimeout(resolve, 80); });
    await page.session.evaluate('new Promise((r) => requestAnimationFrame(() => r(true)))');
  };
  const touch = async (type, points) => {
    await page.session.send('Input.dispatchTouchEvent', {
      type, touchPoints: points.map((point, index) => ({ x: point.x, y: point.y, id: index + 1 })),
    });
    await settle();
  };
  await touch('touchStart', [{ x: anchor.x - 40, y: anchor.y }, { x: anchor.x + 40, y: anchor.y }]);
  await touch('touchMove', [{ x: anchor.x - 90, y: anchor.y }, { x: anchor.x + 90, y: anchor.y }]);
  const pinched = await transformOf();
  assert.ok(pinched.k > 1.5, `双指缩放必须放大，实际 k=${pinched.k}`);
  // 锚点不变即：屏幕点 anchor 在缩放前后映射到同一图谱坐标。
  const anchorAfter = await page.session.evaluate(`(() => {
    const root = ${SHADOW}; const graph = root.getElementById('graph');
    const rect = graph.getBoundingClientRect();
    const t = root.getElementById('viewport').getAttribute('transform');
    const m = t.match(/translate\\(([-\\d.]+) ([-\\d.]+)\\) scale\\(([-\\d.]+)\\)/);
    const gx = (${anchor.x} - rect.left) * 700 / rect.width, gy = (${anchor.y} - rect.top) * 684 / rect.height;
    return { gx: (gx - Number(m[1])) / Number(m[3]), gy: (gy - Number(m[2])) / Number(m[3]) };
  })()`);
  const anchorBefore = { gx: anchor.x, gy: anchor.y - 258 };
  assert.ok(Math.abs(anchorAfter.gx - anchorBefore.gx) < 2, `pinch 水平锚点漂移过大: ${anchorAfter.gx} vs ${anchorBefore.gx}`);
  assert.ok(Math.abs(anchorAfter.gy - anchorBefore.gy) < 2, `pinch 垂直锚点漂移过大: ${anchorAfter.gy} vs ${anchorBefore.gy}`);

  // 等距双指平移只改变 x/y，不改变 k。
  const beforePan = await transformOf();
  await touch('touchMove', [{ x: anchor.x - 90 + 40, y: anchor.y + 30 }, { x: anchor.x + 90 + 40, y: anchor.y + 30 }]);
  const panned = await transformOf();
  assert.equal(panned.k.toFixed(3), beforePan.k.toFixed(3), '等距双指移动不得改变缩放');
  assert.ok(Math.abs((panned.x - beforePan.x) - 40) < 3, `双指平移 x 位移应约 +40，实际 ${panned.x - beforePan.x}`);
  assert.ok(Math.abs((panned.y - beforePan.y) - 30) < 3, `双指平移 y 位移应约 +30，实际 ${panned.y - beforePan.y}`);

  // pinch → 单指 pan 交接：抬起一根手指后缩放必须保持。
  await touch('touchEnd', [{ x: anchor.x + 130, y: anchor.y + 30 }]);
  const handed = await transformOf();
  assert.equal(handed.k.toFixed(3), panned.k.toFixed(3), 'pinch → pan 交接必须保持缩放');
  await touch('touchEnd', []);

  return { ok: true };
}

// 相邻竖屏只做布局 smoke：原生 viewBox + 无溢出 + resize 明确 reset 旧 transform。
async function adjacentSmoke(page, boardUrl) {
  const results = [];
  for (const size of ADJACENT) {
    // 每档都从 700 基线「真实 resize」过去，而不是重新加载：只有这样才测得到
    // ResizeObserver 是否按容器实时尺寸重建坐标系，以及是否明确 reset 旧 pan/zoom。
    await page.setViewport(BASELINE);
    await page.goto(boardUrl);
    await click(page, `root.querySelector('[data-zoom="in"]')`);
    const dirty = await page.session.evaluate(`${SHADOW}.getElementById('viewport').getAttribute('transform')`);
    assert.notEqual(dirty, 'translate(0 0) scale(1)', 'resize 前应存在非恒等 transform');

    await page.setViewport(size);
    await new Promise((resolve) => { setTimeout(resolve, 120); });
    const observed = await page.session.evaluate(`(() => {
      const root = ${SHADOW}; const graph = root.getElementById('graph');
      const rect = graph.getBoundingClientRect();
      return {
        viewBox: graph.getAttribute('viewBox'),
        transform: root.getElementById('viewport').getAttribute('transform'),
        graphRect: [rect.width, rect.height],
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        nodes: root.querySelectorAll('.node').length,
        listCards: root.querySelectorAll('[data-list-id]').length,
      };
    })()`);
    assert.equal(observed.viewBox, size.viewBox, `${size.width}×${size.height} 必须使用容器原生 viewBox`);
    if (size.graphResizes) {
      assert.deepEqual(observed.graphRect, [size.width, Number(size.viewBox.split(' ')[3])],
        '图谱必须按容器实时尺寸建立原生坐标，而不是等比放大基线稿');
      assert.equal(observed.transform, 'translate(0 0) scale(1)', 'resize 必须明确 reset 旧 pan/zoom');
    } else {
      assert.deepEqual(observed.graphRect, [700, 684], '较宽竖屏必须居中呈现 700 宽工作台');
      assert.equal(observed.transform, dirty, '图谱尺寸未变时不得无故丢弃用户的 pan/zoom');
    }
    assert.equal(observed.scrollWidth, size.width, `${size.width} 宽不得横向溢出`);
    assert.equal(observed.scrollHeight, size.height, `${size.height} 高不得纵向溢出`);
    assert.equal(observed.nodes, 10, '相邻竖屏仍须渲染全部十条 Issue');
    results.push({ ...size, ...observed });
  }
  await page.setViewport(BASELINE);
  return results;
}

// 桌面非回归：1440×900 下不得进入竖屏模式，全屏星图与 Workers 面板照常。
async function desktopNonRegression(page, boardUrl) {
  await page.setViewport({ width: 1440, height: 900 });
  page.takeConsoleErrors();
  await page.goto(boardUrl);
  const desktop = await page.session.evaluate(`(() => {
    const host = document.getElementById('portrait-root');
    return {
      portraitActive: document.body.classList.contains('portrait-active'),
      portraitHidden: host.hidden,
      portraitBooted: Boolean(host.shadowRoot),
      starmap: Boolean(document.getElementById('graph')),
      workers: Boolean(document.getElementById('workers')),
      details: Boolean(document.getElementById('details')),
      viewToggle: [...document.querySelectorAll('[data-view]')].map((b) => b.dataset.view),
      zoom: Boolean(document.getElementById('zoom')),
      appVisible: getComputedStyle(document.querySelector('.app')).display !== 'none',
    };
  })()`);
  assert.equal(desktop.portraitActive, false, 'desktop 不得进入竖屏模式');
  assert.equal(desktop.portraitHidden, true, 'desktop 下竖屏挂载点必须隐藏');
  assert.equal(desktop.portraitBooted, false, 'desktop 下不得启动竖屏工作台');
  assert.equal(desktop.appVisible, true, 'desktop 全屏星图必须可见');
  for (const key of ['starmap', 'workers', 'details', 'zoom']) {
    assert.equal(desktop[key], true, `desktop 既有结构 ${key} 不得缺失`);
  }
  assert.deepEqual(desktop.viewToggle, ['graph', 'map'], 'desktop 既有 Map/List 切换不得降级');
  assert.deepEqual(page.takeConsoleErrors(), [], 'desktop 渲染不得产生控制台错误或未捕获异常');
  await page.setViewport(BASELINE);
  return desktop;
}

// ------------------------------------------------------------------ domain 入口

export async function boardUiDomain() {
  const baselineIndex = process.argv.indexOf('--baseline');
  const requested = baselineIndex >= 0 ? process.argv[baselineIndex + 1] : `${BASELINE.width}x${BASELINE.height}`;
  assert.equal(requested, '700x1000', `AC-006 锁定基线为 700x1000，收到 ${requested}`);

  assertGeneratedBlockFresh();

  const workDir = mkdtempSync(join(tmpdir(), 'aes-board-ui-'));
  const page = await launchChrome({ ...BASELINE, deviceScaleFactor: 1 });
  try {
    const boardPath = stageBoard(workDir);
    const boardUrl = pathToFileURL(boardPath).href;
    const mockUrl = pathToFileURL(DEFAULT_MOCK_PATH).href;

    // 字体可用性：字体缺失会让像素 diff 以「看似产品的错」失败。
    await page.goto(mockUrl);
    const fonts = await page.session.evaluate(`(${JSON.stringify(REQUIRED_FONTS)}).map((family) => ({
      family, available: document.fonts.check('12px "' + family + '"'),
    }))`);
    for (const font of fonts) assert.equal(font.available, true, `缺少基线字体 ${font.family}`);

    const mockShot = await page.session.screenshot();
    const mockGeometry = await page.session.evaluate(`(() => {
      const r = document.getElementById('app').getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    })()`);
    assert.deepEqual(mockGeometry, [0, 0, 700, 1000], 'mock 在 700×1000 下必须恰好铺满');

    await page.goto(boardUrl);
    const boardShot = await page.session.screenshot();
    const diff = diffPng(mockShot, boardShot, { tolerance: 2 });
    assert.equal(diff.comparable, true, `截图不可比较: ${diff.reason}`);
    assert.equal(diff.differentPixels, 0,
      `产品与 mock 真源存在 ${diff.differentPixels} 个像素差异（maxDelta=${diff.maxDelta}）`);

    await boardUiAssertions(page, boardUrl);
    await gestureAssertions(page, boardUrl);
    const adjacent = await adjacentSmoke(page, boardUrl);
    const desktop = await desktopNonRegression(page, boardUrl);

    // D-02 receipt：绑定 commit / mock SHA / 环境。
    mkdirSync(RECEIPT_DIR, { recursive: true });
    const receipt = {
      schemaVersion: 'aes.worktree-board.board-ui-receipt/v1',
      acceptance: 'AC-006',
      baseline: `${BASELINE.width}x${BASELINE.height}`,
      commit: gitHead(),
      mockSha256: LOCKED_MOCK_SHA,
      desktopTruthSha256: LOCKED_DESKTOP_SHA,
      environment: {
        browser: page.browserVersion,
        userAgent: page.userAgent,
        deviceScaleFactor: page.deviceScaleFactor,
        prefersReducedMotion: 'reduce',
        fonts,
        platform: process.platform,
      },
      screenshotDiff: diff,
      screenshotSha256: {
        mock: createHash('sha256').update(mockShot).digest('hex').toUpperCase(),
        product: createHash('sha256').update(boardShot).digest('hex').toUpperCase(),
      },
      adjacentSmoke: adjacent,
      desktopNonRegression: desktop,
      recordedAt: new Date().toISOString(),
    };
    const receiptPath = join(RECEIPT_DIR, 'ac-006-board-ui.json');
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    // 截图与 receipt 一同落盘，便于人工复核 diff 结论。
    writeFileSync(join(RECEIPT_DIR, 'ac-006-mock-700x1000.png'), mockShot);
    writeFileSync(join(RECEIPT_DIR, 'ac-006-product-700x1000.png'), boardShot);

    return {
      baseline: requested,
      differentPixels: diff.differentPixels,
      browser: page.browserVersion,
      adjacent: adjacent.length,
      receipt: receiptPath,
    };
  } finally {
    await page.close();
    rmSync(workDir, { recursive: true, force: true, maxRetries: 3 });
  }
}

if (resolve(process.argv[1] || '') === resolve(fileURLToPath(import.meta.url))) {
  try {
    const detail = await boardUiDomain();
    console.log(JSON.stringify({ ok: true, domain: 'board-ui', ...detail }));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, domain: 'board-ui', error: error.stack || error.message }));
    process.exitCode = 1;
  }
}
