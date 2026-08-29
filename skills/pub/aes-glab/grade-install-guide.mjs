#!/usr/bin/env node
// aes-glab 安装指引评测评分器（六条基线断言，grep 语义 + 证据行摘录）
// 用法: node grade-install-guide.mjs <eval目录>   （遍历其下各 gate 的 run-*/outputs/install-guide.md）
//       node grade-install-guide.mjs <run目录>    （只判该 run）
// 产物: 各 run 目录 grading.json（results 数组，聚合器口径）；
//       with_skill 臂额外写 with_skill_extras.json（技能私有内容增量检查，不进基线断言、不参与对账）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!target) { console.error('用法: node grade-install-guide.mjs <eval目录|run目录>'); process.exit(2); }
const abs = path.resolve(target);

const checks = [
  { name: '指引含官方安装渠道与可执行命令（winget/scoop/choco/官方 release 任一）',
    test: t => /winget\s+install|scoop\s+install|choco\s+install|glab[^\n]*zip|releases?\s*\/download/i.test(t),
    ev: /winget|scoop|choco|release/i },
  { name: '指引含安装验证（版本或路径查询）与 PATH 生效说明（新开终端等）',
    test: t => /glab\s+--version|glab\s+version/.test(t) && /(新开|重新打开|新终端|PATH)/i.test(t),
    ev: /--version|新开|PATH/i },
  { name: '登录命令带 --hostname git.51vr.local 且带 --api-protocol http --git-protocol http',
    test: t => /--hostname\s+git\.51vr\.local/.test(t) && /--api-protocol\s+http/.test(t) && /--git-protocol\s+http/.test(t),
    ev: /--hostname|--api-protocol|--git-protocol/ },
  { name: '含 PAT 创建步骤（personal_access_tokens 页面路径、权限最小化只勾 api）',
    test: t => /personal_access_tokens/.test(t) && /api/.test(t),
    ev: /personal_access_tokens|api/ },
  { name: '含交互提示避坑（SSH hostname 留空回车）或等效说明',
    test: t => (/SSH/i.test(t) && /留空/.test(t)) || /--stdin/.test(t),
    ev: /SSH|留空|stdin/i },
  { name: '含最终验证步骤与期望输出（glab auth status / issue list）',
    test: t => /auth\s+status/.test(t) && /(issue\s+list|Logged in|keyring)/.test(t),
    ev: /auth\s+status|issue\s+list|keyring/ },
];

// with_skill 私有内容增量（技能新增节才可能命中；基线断言不含，防系统性夸大 with_skill）
const extras = [
  { name: '含 agent bash PATH 兜底（command not found 不误判未安装）',
    test: t => /command not found/.test(t) && /(注册表|Uninstall|winget list|全路径|完整路径)/i.test(t) },
  { name: '含 gitlab.com 噪音块说明（auth status 多余段无害/可清）',
    test: t => /(噪音|模板块)/.test(t) && /gitlab\.com/.test(t) },
];

function gradeRun(runDir, gate) {
  const doc = path.join(runDir, 'outputs', 'install-guide.md');
  const text = fs.readFileSync(doc, 'utf8');
  const lines = text.split(/\r?\n/);
  const ev = c => {
    const hit = lines.filter(l => c.ev.test(l)).slice(0, 2).map(l => l.trim().slice(0, 120));
    return hit.length ? hit.join(' | ') : '(无匹配行)';
  };
  const grading = {
    results: checks.map(c => ({ name: c.name, text: c.name, passed: c.test(text), evidence: ev(c) })),
    eval_feedback: '六条基线断言全部可编程判定（grep 语义）；题面自 2026-08-30 起去除「纯 http」提示，断言 3 恢复区分度。'
  };
  fs.writeFileSync(path.join(runDir, 'grading.json'), JSON.stringify(grading, null, 2));
  if (gate === 'with_skill') {
    fs.writeFileSync(path.join(runDir, 'with_skill_extras.json'),
      JSON.stringify({ extras: extras.map(x => ({ name: x.name, passed: x.test(text) })) }, null, 2));
  }
  const pass = grading.results.filter(a => a.passed).length;
  console.log(`${gate || path.basename(path.dirname(runDir))}: ${pass}/6 基线` +
    (gate === 'with_skill' ? ` + ${extras.filter(x => x.test(text)).length}/${extras.length} 附加` : ''));
}

const st = fs.statSync(abs);
if (st.isDirectory() && /run-\d+$/.test(abs)) { gradeRun(abs, path.basename(path.dirname(abs))); process.exit(0); }
for (const gate of fs.readdirSync(abs)) {
  const gateDir = path.join(abs, gate);
  if (!fs.statSync(gateDir).isDirectory()) continue;
  for (const run of fs.readdirSync(gateDir).filter(n => /^run-\d+$/.test(n))) gradeRun(path.join(gateDir, run), gate);
}
