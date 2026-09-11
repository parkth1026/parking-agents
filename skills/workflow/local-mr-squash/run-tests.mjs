#!/usr/bin/env node
// run-tests.mjs — local-mr-squash 的回归测试（升级/改动后必跑）
// 四块断言，对应 references/design.md 验收条件：
//   1) 结构与内容契约（AC-003 五步要素+溯源块三要素+门禁条款；AC-004 量级门槛 ≤45 行/≤8 步）
//   2) fixture 自动演练（AC-005：temp git 仓双侧改动+冲突 → 按七步流程 → 门禁全绿收口）
//   3) 门禁脚本四态（AC-002：用法错 exit 1 / FAIL exit 1 / --keep 跳第 4 项 / 全绿 exit 0 /
//      squash 后源分支前进被「全包含」捕获变红）
// 黑盒执行：真实 spawn git 与 verify-squash-merge.mjs，比对退出码与输出文本。
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const VERIFY = join(SKILL_DIR, "scripts", "verify-squash-merge.mjs");

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? `（实际：${detail}）` : ""}`); }
}

function gate(args, cwd) {
  const r = spawnSync(process.execPath, [VERIFY, ...args], { encoding: "utf8", cwd });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}

// —— temp fixture 仓造法：本地 config 隔离用户全局 git 设置 ——
function makeRepo(tag) {
  const dir = mkdtempSync(join(tmpdir(), `lms-${tag}-`));
  const git = (...a) => {
    const r = spawnSync("git", a, { cwd: dir, encoding: "utf8" });
    return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}`.trim() };
  };
  for (const [k, v] of [
    ["user.name", "fixture"],
    ["user.email", "fixture@test.local"],
    ["core.autocrlf", "false"],
    ["commit.gpgsign", "false"],
  ]) git("config", k, v);
  return { dir, git };
}

const fixtureDirs = [];
try {
  // ============ 1. 结构与内容契约（AC-003 / AC-004） ============
  console.log("结构检查");
  const skill = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
  const fm = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  check("frontmatter 块存在", Boolean(fm));
  const fmText = fm ? fm[1] : "";
  check("name 等于目录名 local-mr-squash", /^name:\s*local-mr-squash$/m.test(fmText));
  const descMatch = fmText.match(/^description:\s*(.+)$/m);
  const desc = descMatch ? descMatch[1].trim() : "";
  check("description 非空且 ≤1024 字符", desc.length > 0 && desc.length <= 1024, `${desc.length} 字符`);
  check("description 不含尖括号", !/[<>]/.test(desc));
  check("description 为显式点名模式（含点名条款且声明不自动选它）",
    desc.includes("local-mr-squash") && desc.includes("点名") && /不要自动/.test(desc));
  check("正文无待办占位", !/\[TODO/.test(skill) && !skill.includes("结构选择指南"));

  const body = skill.replace(/^---\r?\n[\s\S]*?\r?\n---/, "");
  const fiveStep = {
    "五步要素：优先保双方意图": body.includes("保双方意图"),
    "五步要素：不相容按合并目标裁决并记下取舍": /不相容.*裁决/.test(body) && body.includes("记下取舍"),
    "五步要素：不发明行为": body.includes("不发明"),
    "五步要素：永不 --abort": /永不 `--abort`/.test(body),
  };
  for (const [name, ok] of Object.entries(fiveStep)) check(name, ok);
  check("溯源块要求在文", body.includes("溯源块"));
  check("溯源块要素：原分支提交 hash 清单", body.includes("hash 清单"));
  check("溯源块要素：冲突裁决摘要", body.includes("冲突裁决摘要"));
  check("溯源块要素：已跑检查清单", body.includes("已跑检查"));
  check("门禁全绿（退出码 0）才算合并完成", body.includes("全绿（退出码 0）才算合并完成"));
  check("--keep 是逃生门且必须显形于报告", /`--keep`/.test(body) && /报告/.test(body));
  check("永不三则在文（--abort/不改写历史/门禁没绿不宣称完成）",
    /永不：`--abort`、改写已推送历史、门禁没绿就宣称合并完成/.test(body));

  const lines = body.split(/\r?\n/);
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  check("量级门槛：正文 ≤45 行", lines.length <= 45, `${lines.length} 行`);
  const stepCount = (body.match(/^\d+\.\s/gm) || []).length;
  check("量级门槛：步骤 ≤8 条", stepCount <= 8, `${stepCount} 条`);

  check("门禁脚本在位", existsSync(VERIFY));
  const design = readFileSync(join(SKILL_DIR, "references", "design.md"), "utf8");
  for (let i = 1; i <= 6; i++) {
    check(`design.md 验收条件 AC-00${i} 在位`, new RegExp(`AC-00${i}\\b`).test(design));
  }
  check("design.md 迭代记录在位", design.includes("迭代记录"));
  const openai = readFileSync(join(SKILL_DIR, "agents", "openai.yaml"), "utf8");
  check("openai.yaml 引用 $local-mr-squash 且禁止隐式调用",
    openai.includes("$local-mr-squash") && /allow_implicit_invocation:\s*false/.test(openai));

  // ============ 2. fixture 自动演练（AC-005，兼四态之「全绿」） ============
  console.log("fixture 演练（AC-005）");
  const drill = makeRepo("drill");
  fixtureDirs.push(drill.dir);
  const { dir: d1, git: g1 } = drill;
  g1("init");
  // base 提交（main）
  writeFileSync(join(d1, "a.txt"), "line1\nline2\nline3\n");
  g1("add", "-A"); g1("commit", "-m", "base");
  g1("branch", "-M", "main");
  // 源分支：与主干改同一行制造真冲突
  g1("checkout", "-b", "feature");
  writeFileSync(join(d1, "a.txt"), "line1\nfeature 侧改动\nline3\n");
  writeFileSync(join(d1, "feature-only.txt"), "feature 新文件\n");
  g1("add", "-A"); g1("commit", "-m", "feature: 改 a.txt 并新增 feature-only.txt");
  const featureTip = g1("rev-parse", "HEAD").out;
  // 主干侧改动
  g1("checkout", "main");
  writeFileSync(join(d1, "a.txt"), "line1\nmain 侧改动\nline3\n");
  g1("add", "-A"); g1("commit", "-m", "main: 改 a.txt");
  check("预检：源分支领先且主干树净", g1("status", "--porcelain").out === ""
    && g1("rev-list", "--count", "main..feature").out === "1");

  // 第 2 步 squash → 第 3 步语义合并
  const squash = g1("merge", "--squash", "feature");
  check("squash 真实产生冲突（exit 非零）", squash.code !== 0);
  writeFileSync(join(d1, "a.txt"), "line1\n保双方意图：feature 侧 + main 侧融合\nline3\n");
  g1("add", "-A");
  // 第 5 步单笔 commit，message 含溯源块三要素
  g1("commit", "-m",
    `squash 合并 feature 进 main\n\n溯源块：\n- 原分支提交：${featureTip}\n- 冲突裁决摘要：a.txt=保双方意图融合，无不相容取舍\n- 已跑检查：fixture 无自动检查，树净确认`);
  const msg = g1("log", "-1", "--format=%B").out;
  check("commit message 溯源块含原分支 hash", msg.includes(featureTip));
  check("commit message 含冲突裁决摘要与已跑检查", msg.includes("冲突裁决摘要") && msg.includes("已跑检查"));
  const parents = g1("rev-list", "--parents", "-n", "1", "HEAD").out.split(/\s+/);
  check("HEAD 为单笔提交（恰一个父）", parents.length === 2);

  // 第 6 步收口：前滚
  g1("branch", "-f", "feature", "HEAD");
  // 第 7 步硬门禁：全绿
  const green = gate(["feature"], d1);
  check("四态·全绿：门禁 exit 0", green.code === 0, green.out);
  check("四态·全绿：输出含「门禁全绿」且四项 PASS",
    green.out.includes("门禁全绿") && (green.out.match(/^PASS/gm) || []).length === 4, green.out);
  check("演练收口后源 tip == HEAD", g1("rev-parse", "feature").out === g1("rev-parse", "HEAD").out);

  // ============ 3. 门禁脚本四态（AC-002） ============
  console.log("门禁四态（AC-002）");
  // 用法错
  const usage = gate([], d1);
  check("四态·用法错：无参数 exit 1 且输出用法", usage.code === 1 && /用法/.test(usage.out), usage.out);

  // FAIL 态与 --keep 态共用一个 fixture
  const st = makeRepo("state");
  fixtureDirs.push(st.dir);
  const { dir: d2, git: g2 } = st;
  g2("init");
  writeFileSync(join(d2, "a.txt"), "x\ny\nz\n");
  g2("add", "-A"); g2("commit", "-m", "base"); g2("branch", "-M", "main");
  g2("checkout", "-b", "feature");
  writeFileSync(join(d2, "a.txt"), "x\nfeature\nz\n");
  g2("add", "-A"); g2("commit", "-m", "f1");
  g2("checkout", "main");
  writeFileSync(join(d2, "a.txt"), "x\nmain\nz\n");
  g2("add", "-A"); g2("commit", "-m", "m1");
  g2("merge", "--squash", "feature"); // 冲突现场
  const failState = gate(["feature"], d2);
  check("四态·FAIL：冲突未收现场 exit 1", failState.code === 1, failState.out);
  check("四态·FAIL：树净项变红且带修复提示",
    /FAIL\s+树净/.test(failState.out) && failState.out.includes("提交或清理后重跑"));

  // 解冲突 + commit（树净/单笔过；源未收口 → 全包含+已收口 双红：门禁要求前滚，非仅内容到位）
  writeFileSync(join(d2, "a.txt"), "x\nresolved\nz\n");
  g2("add", "-A"); g2("commit", "-m", "squash feature（未收口态）");
  const unclosed = gate(["feature"], d2);
  check("四态·未收口：exit 1 且「全包含」「已收口」双红",
    unclosed.code === 1 && /FAIL\s+已收口/.test(unclosed.out) && /FAIL\s+全包含/.test(unclosed.out),
    unclosed.out);

  // --keep 态：源已前滚到合并点，主干随后又前进一笔 → 源为 HEAD 祖先（全包含绿）但未追平，仅第 4 项红
  g2("branch", "-f", "feature", "HEAD");
  writeFileSync(join(d2, "post.txt"), "主干后续提交\n");
  g2("add", "-A"); g2("commit", "-m", "post-merge advance");
  const noKeep = gate(["feature"], d2);
  check("四态·仅收口未追平：无 --keep exit 1 且只有第 4 项 FAIL",
    noKeep.code === 1 && /FAIL\s+已收口/.test(noKeep.out)
      && !/FAIL\s+(树净|单笔提交|全包含)/.test(noKeep.out), noKeep.out);
  const withKeep = gate(["feature", "--keep"], d2);
  check("四态·--keep：exit 0 且第 4 项 SKIP 并要求写进报告",
    withKeep.code === 0 && /SKIP\s+已收口/.test(withKeep.out) && withKeep.out.includes("必须写进合并报告"),
    withKeep.out);

  // 漂移态（B1）：全绿后源分支又前进，被「全包含」捕获
  g1("checkout", "feature");
  writeFileSync(join(d1, "drift.txt"), "squash 后源分支又前进\n");
  g1("add", "-A"); g1("commit", "-m", "drift");
  g1("checkout", "main");
  const drift = gate(["feature"], d1);
  check("四态·漂移：源前进后 exit 1 且「全包含」变红",
    drift.code === 1 && /FAIL\s+全包含/.test(drift.out) && drift.out.includes("又前进"),
    drift.out);
} finally {
  for (const dir of fixtureDirs) rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
