#!/usr/bin/env node
// run-tests.mjs — aes-gate 的回归测试（升级/改动后必跑）
// 惯例：check() 计数器 + 黑盒执行（execFileSync 跑脚本/命令再比对输出），退出码 0=全过/1=有失败；
//       fixtures/ 放黄金输入与 expected。测试固化在技能里，随技能分发。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const COLLECT = join(SKILL_DIR, 'scripts', 'collect.mjs');

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
function run(args, opts = {}) {
  return execFileSync('node', [COLLECT, ...args], { encoding: 'utf8', timeout: 120_000, ...opts });
}
function runCode(args, opts = {}) {
  try { run(args, opts); return 0; } catch (e) { return e.status ?? 1; }
}

// ---- T1 资源存在性 ----
check('T1 SKILL.md 存在且声明 name', existsSync(join(SKILL_DIR, 'SKILL.md'))
  && /^name:\s*aes-gate$/m.test(readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8')));
for (const ref of ['weights.md', 'pattern-library.md', 'api.md', 'design.md']) {
  check(`T1 references/${ref} 存在且非占位`, existsSync(join(SKILL_DIR, 'references', ref))
    && !readFileSync(join(SKILL_DIR, 'references', ref), 'utf8').includes('[TODO'));
}
check('T1 看板模板存在且零外链', existsSync(join(SKILL_DIR, 'assets', 'board.template.html'))
  && !/https?:\/\//.test(readFileSync(join(SKILL_DIR, 'assets', 'board.template.html'), 'utf8')));
check('T1 scripts 全 .mjs 零依赖（无 package.json/node_modules）', readdirSync(join(SKILL_DIR, 'scripts'))
  .every((f) => f === 'vendor' || f.endsWith('.mjs')) && !existsSync(join(SKILL_DIR, 'scripts', 'node_modules')));

// ---- T2 self-test 黑盒（正反样例全绿） ----
check('T2 collect --self-test 退出码 0', runCode(['--self-test']) === 0);

// ---- T3 handoff 端到端（临时仓；结构断言对齐 api.md 结局 1） ----
const tmp = mkdtempSync(join(tmpdir(), 'aes-gate-runtests-'));
try {
  mkdirSync(join(tmp, '.git'), { recursive: true });
  writeFileSync(join(tmp, 'run.toml'), [
    '[project]', 'id = "t/fixture"', '',
    '[[actions]]', 'id = "test.ok"', 'name = "Ok"', 'kind = "test"', 'run = ["node", "-e", "process.exit(0)"]', '',
  ].join('\n'));
  const out = run(['--handoff', '--repo', tmp]);
  check('T3 handoff 不落盘（.aes-gate 不存在）', !existsSync(join(tmp, '.aes-gate')));
  check('T3 handoff 四节结构（盘点表/评分/红门置顶/缺口清单）',
    out.includes('## gate 盘点表') && /## 评分：[\d.]+\/110 · (硬门禁|部分|纸面)/.test(out)
    && out.includes('## 红门置顶：') && out.includes('## 缺口清单（=移交单）'));
  check('T3 缺口条目可辩护（带风险级/组装性/归属）', /G1 P0.*可组装·aggregate-check.*归属：aes-gate:assemble/.test(out.replace(/\n/g, ' ')));
  check('T3 首测无基线明示', out.includes('首测无历史基线'));

  // 默认模式：落盘三件 + 退出码 0
  const code = runCode(['--repo', tmp]);
  const gateDir = join(tmp, '.aes-gate');
  const files = existsSync(gateDir) ? readdirSync(gateDir) : [];
  check('T3 默认模式退出码 0 且落盘三件', code === 0 && files.includes('gate-registry.json')
    && files.includes('board.html') && files.some((f) => /^report-.*\.md$/.test(f)), JSON.stringify(files));
  const registry = JSON.parse(readFileSync(join(gateDir, 'gate-registry.json'), 'utf8'));
  check('T3 registry 门 id=action id（runAction 引用）', registry.gates.some((g) => g.id === 'test.ok' && g.runAction === 'test.ok'));
  check('T3 registry 不复制命令定义（gates[].command 仅引用 run argv，缺口含 G0 无 run 标准则否）',
    registry.gates.every((g) => !g.command || Array.isArray(g.command)));
  check('T3 history 追加一行', Array.isArray(registry.history) && registry.history.length === 1);
  const board = readFileSync(join(gateDir, 'board.html'), 'utf8');
  check('T3 board 零 JS 零外链', !/<script/i.test(board) && !/https?:\/\//.test(board));
  check('T3 board 无未替换占位符', !/<!--(PROJECT|TIER|SCORE|DIMS|GATES|GAPS|CONVENTIONS|HISTORY|COLLECTED-AT)-->/.test(board));

  // 二轮：history 追加为 2、handoff 显示差值
  runCode(['--repo', tmp]);
  const registry2 = JSON.parse(readFileSync(join(gateDir, 'gate-registry.json'), 'utf8'));
  check('T3 二轮 history=2（追加不覆盖）', registry2.history.length === 2);
  const out2 = run(['--handoff', '--repo', tmp]);
  check('T3 二轮 handoff 含历史对比', out2.includes('上次') && /差 [-\d.]+/.test(out2));
  check('T3 二轮 handoff 仍不新增 report 文件', readdirSync(gateDir).filter((f) => /^report-/.test(f)).length === 1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ---- T4 BLOCKED：非 git 仓退出码 2、stderr 不产表 ----
const bare = mkdtempSync(join(tmpdir(), 'aes-gate-bare-'));
try {
  let stderr = '';
  let code = 0;
  try {
    run(['--handoff', '--repo', bare]);
  } catch (e) {
    code = e.status ?? 1;
    stderr = e.stderr?.toString() || '';
  }
  check('T4 非 git 仓 → 退出码 2 + BLOCKED 提示', code === 2 && stderr.includes('BLOCKED'));
} finally {
  rmSync(bare, { recursive: true, force: true });
}

// ---- T5 未知参数 → 退出码 64 ----
check('T5 未知参数退出码 64', runCode(['--nonsense']) === 64);

// ---- T6 本技能自身资源一致（design.md AC 表在、契约文件互引） ----
const design = readFileSync(join(SKILL_DIR, 'references', 'design.md'), 'utf8');
check('T6 design.md 验收条件表 AC-1…AC-5 在场', ['AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5'].every((ac) => design.includes(ac)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
