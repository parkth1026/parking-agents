#!/usr/bin/env node
// quick-validate.mjs — 技能快速校验（官方 quick_validate.py 规则集逐字移植，去 PyYAML）
// 用法: node quick-validate.mjs <技能目录>
// 退出码: 0 合法 / 1 校验失败 / 2 用法错 / 3 无法判定（frontmatter 含解析器支持子集外的构造）
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseSkillMdFile } from "./lib/frontmatter.mjs";

// 宿主实际支持的 skill frontmatter 键。前 6 个来自官方 quick_validate.py；其余逐条
// 求证自 Claude Code 自身的 changelog（issue #63）。这份清单**不是**判定依据，只用于
// 提示与拼写近似比对——枚举宿主功能集必然落后（这 12 个键是数千行 changelog 陆续新增
// 的），而官方校验器正因为拿它当判定依据，拒掉了 31 个官方技能中的 24 个。
const KNOWN_KEYS = [
  "name", "description", "license", "allowed-tools", "metadata", "compatibility",
  "disable-model-invocation", "argument-hint", "user-invocable", "effort", "model",
  "context", "background", "agent", "disallowed-tools", "display-name",
  "default-enabled", "fallback",
];

// 宿主对部分 skill 键接受 kebab-case / snake_case / camelCase 三种写法（changelog L1042），
// 所以比对前先归一，免得把 display_name 当成 display-name 的拼写错误。
const normKey = (k) => k.toLowerCase().replace(/[-_]/g, "");
const KNOWN_NORM = new Map(KNOWN_KEYS.map((k) => [normKey(k), k]));

/** 编辑距离（Levenshtein），用于分辨「拼错的已知键」与「宿主新增的未知键」 */
function editDistance(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * 未知键分诊：拼错的已知键 → 错误；宿主新增的键 → 警告。
 * 阈值同时要求「绝对距离 ≤2」与「距离 ≤ 键长/3」——后者防短键误判
 * （否则 5 个字母的合法新键很容易落在任一已知键的 2 距离内）。
 */
function triageUnknownKey(key) {
  const nk = normKey(key);
  let best = null, bestD = Infinity;
  for (const [kn, orig] of KNOWN_NORM) {
    const d = editDistance(nk, kn);
    if (d < bestD) { bestD = d; best = orig; }
  }
  if (bestD > 0 && bestD <= 2 && bestD <= Math.floor(nk.length / 3)) {
    return { kind: "typo", suggestion: best, distance: bestD };
  }
  return { kind: "unknown" };
}

// 本校验器实际读值的键。解析器越界只有落在这些键上才会让判定失效——
// 例如 `allowed-tools: [Read, Glob]` 是合法 flow 序列，但我们不校验它的内容，
// 对它失败关闭只会无故拒掉正常技能（野外语料 3 处命中全在这类键上）。
const VALIDATED_KEYS = ["name", "description", "compatibility"];

function usage() {
  console.log("用法: node quick-validate.mjs <技能目录>");
  console.log("示例: node quick-validate.mjs ../my-skill");
  process.exit(2);
}

/**
 * 校验技能目录，返回 { valid, errors, summary }。
 * errors 为规则级违规数组（逐条报规则名）；summary 供 PASS 时展示。
 */
export function validateSkill(skillDir) {
  const errors = [];

  if (!existsSync(skillDir)) {
    return { valid: false, errors: [`目录不存在: ${skillDir}`], summary: null };
  }
  if (!statSync(skillDir).isDirectory()) {
    return { valid: false, errors: [`不是目录: ${skillDir}`], summary: null };
  }

  const { name, description, keys, values, unsupported, error } = parseSkillMdFile(skillDir, readFileSync);
  if (error === "SKILL.md not found" || error === "SKILL.md is a directory") {
    return { valid: false, errors: [error], summary: null };
  }
  if (error) {
    return { valid: false, errors: [`frontmatter 结构错误: ${error}`], summary: null };
  }

  // 无法判定：解析器读不了被校验键的值，就不猜——既不判 PASS 也不判 FAIL。
  // 假 PASS 比没有门禁更危险（见 issue #54：1201 字符的 description 曾被读成 600 而放行）。
  const blocking = (unsupported || []).filter((u) => VALIDATED_KEYS.includes(u.key));
  if (blocking.length > 0) {
    return { valid: false, undecidable: blocking, errors: [], summary: null };
  }

  // 未知键分诊（issue #63）：这条规则真正能防的是必填键拼错，不是枚举宿主功能集。
  // 拼错的已知键判错误；宿主新增的未知键只提示，不挡退出码。
  const warnings = [];
  for (const k of keys) {
    if (KNOWN_NORM.has(normKey(k))) continue;
    const t = triageUnknownKey(k);
    if (t.kind === "typo") {
      errors.push(`键 '${k}' 疑似拼错（与已知键 '${t.suggestion}' 相差 ${t.distance} 个字符）`);
    } else {
      warnings.push(`未知键 '${k}'——不在已知 skill 键集内。若是宿主新增的键可忽略；若是笔误请改正`);
    }
  }

  // 必填键
  if (!keys.includes("name")) errors.push("缺少必填键: name");
  if (!keys.includes("description")) errors.push("缺少必填键: description");

  // name 规则（kebab-case ≤64，与官方逐字对齐）
  if (keys.includes("name")) {
    if (typeof values.name !== "string" || values.name === null) {
      errors.push("name 必须是字符串");
    } else {
      const n = name.trim();
      if (!n) {
        errors.push("name 不能为空");
      } else {
        if (!/^[a-z0-9-]+$/.test(n)) {
          errors.push(`name '${n}' 必须是 kebab-case（仅小写字母、数字、连字符）`);
        }
        if (n.startsWith("-") || n.endsWith("-") || n.includes("--")) {
          errors.push(`name '${n}' 不能以连字符开头/结尾或含连续连字符`);
        }
        if (n.length > 64) {
          errors.push(`name 超长（${n.length} 字符，上限 64）`);
        }
      }
    }
  }

  // description 规则（≤1024 且无尖括号）
  if (keys.includes("description")) {
    if (typeof values.description !== "string" || values.description === null) {
      errors.push("description 必须是字符串");
    } else {
      const d = description.trim();
      if (!d) {
        errors.push("description 不能为空");
      } else {
        if (d.includes("<") || d.includes(">")) {
          errors.push("description 不得含尖括号（< 或 >）");
        }
        if (d.length > 1024) {
          errors.push(`description 超长（${d.length} 字符，上限 1024）`);
        }
      }
    }
  }

  // compatibility 可选（≤500）
  if (keys.includes("compatibility") && typeof values.compatibility === "string" && values.compatibility) {
    if (values.compatibility.length > 500) {
      errors.push(`compatibility 超长（${values.compatibility.length} 字符，上限 500）`);
    }
  }

  return {
    valid: errors.length === 0,
    undecidable: null,
    errors,
    warnings,
    summary: { name: name.trim(), nameLen: name.trim().length, descLen: description.trim().length, keys },
  };
}

// --- CLI（仅直接运行时执行；被 package-skill 等导入时只提供 validateSkill） ---
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1] || "-").href;
if (isMain) {
  const [dir] = process.argv.slice(2);
  if (!dir || dir.startsWith("-")) usage();

  const { valid, errors, summary, undecidable, warnings } = validateSkill(dir);
  if (undecidable && undecidable.length > 0) {
    console.log(`UNDECIDABLE ${dir}`);
    console.log("  frontmatter 含解析器支持子集外的构造，无法确认宿主会读到什么值：");
    for (const u of undecidable) console.log(`  - ${u.key}: ${u.construct} → ${u.detail}`);
    console.log("  改写成受支持的写法后重跑；不要把本结果当作通过或失败。");
    process.exit(3);
  }
  if (valid) {
    console.log(`PASS ${dir}`);
    console.log(`  name: ${summary.name || "(空)"} (${summary.nameLen}/64)`);
    console.log(`  description: ${summary.descLen}/1024, 无尖括号`);
    console.log(`  键: ${summary.keys.join(", ")} ✓`);
    for (const w of warnings || []) console.log(`  警告: ${w}`);
    if (!existsSync(join(dir, "run-tests.mjs"))) {
      console.log("  警告: 无 run-tests.mjs——新技能必须固化测试(init 脚手架自带)；旧技能升级时补上");
    }
    if (!existsSync(join(dir, "references", "design.md"))) {
      console.log("  警告: 无 references/design.md——设计依据不可考(新技能必须,老技能升级时补)");
    }
    // 只识别模板占位 [TODO: ...]；正文引用字面量「[TODO」不应触发误报。
    if (/\[\s*TODO\s*[:\]]/i.test(readFileSync(join(dir, "SKILL.md"), "utf8"))) {
      console.log("  提示: SKILL.md 仍含 TODO 占位（完成占位再分发）");
    }
    process.exit(0);
  } else {
    console.log(`FAIL ${dir}`);
    for (const e of errors) console.log(`  - ${e}`);
    for (const w of warnings || []) console.log(`  警告: ${w}`);
    process.exit(1);
  }
}
