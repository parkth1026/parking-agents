// frontmatter.mjs — 手写 SKILL.md frontmatter 解析（零依赖，替代 PyYAML）
//
// 支持子集是**显式**的，越界不猜：解析器只承认下面这些构造，其余一律登记进
// `unsupported` 交由调用方处置（quick-validate 以退出码 3「无法判定」报出）。
// 这条纪律来自 issue #54 的实测——11 类构造里旧实现与宿主 9 类分歧，其中
// 多行 plain 标量会把 1201 字符的 description 读成 600 而判 PASS（假 PASS），
// `\u003c` 转义能绕过尖括号检查，行尾注释能把合法 name 判成非 kebab-case（假 FAIL）。
//
// 支持（与宿主 YAML 语义对齐）：
//   - 单行 plain 标量，含行尾注释剥离（` # ...`）
//   - 多行 plain 标量折叠（续行以空格连接）
//   - 双引号标量，含转义序列 \" \ \/ \n \t \r \0 \b \f \v \e \xNN \uNNNN \UNNNNNNNN
//   - 单引号标量（不含 '' 双写转义）
//   - 块标量 `|`（换行连接）与 `>`（空格连接），含 strip(-) 与 clip(默认)
//   - 嵌套块父键（如 metadata:），值记为 null
// 越界（登记进 unsupported，不产出值）：
//   - flow 集合 `[...]` / `{...}`
//   - 跨行引号标量（引号未在本行闭合）
//   - 单引号双写转义 `''`
//   - 块标量 keep chomping `+`
//
// 解析前统一剥离 \r，CRLF 文件与 LF 文件同判定。
import { join } from "node:path";

/** 剥离 CR 后按行切分 */
function toLines(content) {
  return content.replace(/\r\n?/g, "\n").split("\n");
}

const SIMPLE_ESCAPES = {
  "0": "\0", a: "\x07", b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r",
  e: "\x1b", " ": " ", '"': '"', "/": "/", "\\": "\\", N: "\x85", _: "\xa0",
  L: "\u2028", P: "\u2029",
};

/** 解双引号标量的转义序列（YAML 1.1/1.2 共同子集） */
function unescapeDouble(body) {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch !== "\\") { out += ch; continue; }
    const n = body[++i];
    if (n === undefined) { out += "\\"; break; }
    if (n === "x" || n === "u" || n === "U") {
      const width = n === "x" ? 2 : n === "u" ? 4 : 8;
      const hex = body.slice(i + 1, i + 1 + width);
      if (hex.length === width && /^[0-9a-fA-F]+$/.test(hex)) {
        out += String.fromCodePoint(parseInt(hex, 16));
        i += width;
        continue;
      }
      out += n;
      continue;
    }
    out += Object.prototype.hasOwnProperty.call(SIMPLE_ESCAPES, n) ? SIMPLE_ESCAPES[n] : n;
  }
  return out;
}

/** 找双引号标量的闭合引号下标（尊重反斜杠转义）；未闭合返回 -1 */
function findClosingDouble(s) {
  for (let i = 1; i < s.length; i++) {
    if (s[i] === "\\") { i++; continue; }
    if (s[i] === '"') return i;
  }
  return -1;
}

/** 剥离 plain 标量的行尾注释：` #` 之前必须是空白（宿主语义） */
function stripPlainComment(s) {
  const m = s.match(/(^|\s)#/);
  if (!m) return s;
  if (m.index === 0 && m[1] === "") return "";
  return s.slice(0, m.index + m[1].length).replace(/\s+$/, "");
}

/**
 * 解析 SKILL.md 文本，返回 { keys, values, unsupported, error }。
 * keys: 顶层键（首次出现顺序；重复键取值以后者覆盖，对齐宿主行为）
 * values: 顶层键 → 标量字符串；嵌套块（如 metadata:）为 null；越界构造不写入
 * unsupported: [{ key, construct, detail }]，非空表示「无法判定」
 * error: 非 null 表示结构级失败（缺起止 --- / 空映射）
 */
export function parseFrontmatter(content) {
  const lines = toLines(content);

  if (lines[0].trim() !== "---") {
    return { keys: [], values: {}, unsupported: [], error: "missing opening --- (no YAML frontmatter)" };
  }
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") { endIdx = i; break; }
  }
  if (endIdx === -1) {
    return { keys: [], values: {}, unsupported: [], error: "missing closing --- (invalid frontmatter format)" };
  }

  const fmLines = lines.slice(1, endIdx);
  const keys = [];
  const values = {};
  const unsupported = [];
  const KEY_RE = /^([A-Za-z][A-Za-z0-9_-]*):(?:[ \t]*(.*))?$/;
  const isIndented = (l) => l !== undefined && /^[ \t]/.test(l) && l.trim() !== "";
  let i = 0;
  let sawTopLevelKey = false;

  const flag = (key, construct, detail) => {
    unsupported.push({ key, construct, detail });
  };

  while (i < fmLines.length) {
    const m = fmLines[i].match(KEY_RE);
    if (!m) { i++; continue; }

    const key = m[1];
    const rest = (m[2] || "").trim();
    sawTopLevelKey = true;
    if (!keys.includes(key)) keys.push(key);

    // --- 块标量 |、>（含 chomping 指示符）
    const block = rest.match(/^([|>])([-+]?)$/);
    if (block) {
      const [, style, chomp] = block;
      if (chomp === "+") {
        // keep chomping 保留尾部空行，而 frontmatter 在两个 --- 之间抽取，末行本就
        // 没有换行符，无法据此还原宿主语义 —— 不猜，登记为无法判定。
        flag(key, "块标量 keep chomping (+)", rest);
        i++;
        while (i < fmLines.length && (isIndented(fmLines[i]) || fmLines[i].trim() === "")) i++;
        continue;
      }
      const body = [];
      i++;
      while (i < fmLines.length && (isIndented(fmLines[i]) || fmLines[i].trim() === "")) {
        if (fmLines[i].trim() === "" && !isIndented(fmLines[i + 1] || "")) break;
        body.push(fmLines[i].replace(/^[ \t]+/, ""));
        i++;
      }
      while (body.length && body[body.length - 1] === "") body.pop();
      // literal 保留换行；folded 折成空格（与宿主一致）
      // literal 保留换行；folded 折成空格。不追加尾换行：frontmatter 在两个 ---
      // 之间抽取，末行不带换行符，宿主读到的即无尾换行（实测对照 c8/c9 为准）。
      values[key] = style === "|" ? body.join("\n") : body.join(" ");
      continue;
    }

    // --- 空值：嵌套块父键或空标量
    if (rest === "") {
      i++;
      while (i < fmLines.length && isIndented(fmLines[i])) i++;
      values[key] = null;
      continue;
    }

    // --- flow 集合：越界
    if (/^[[{]/.test(rest)) {
      flag(key, "flow 集合", rest.slice(0, 40));
      i++;
      continue;
    }

    // --- 双引号标量
    if (rest.startsWith('"')) {
      const close = findClosingDouble(rest);
      if (close === -1 || close !== rest.length - 1) {
        // 未闭合 → 跨行引号标量；闭合但有尾随内容 → 同样不猜
        flag(key, close === -1 ? "跨行引号标量" : "引号后有尾随内容", rest.slice(0, 40));
        i++;
        if (close === -1) while (i < fmLines.length && isIndented(fmLines[i])) i++;
        continue;
      }
      values[key] = unescapeDouble(rest.slice(1, close));
      i++;
      continue;
    }

    // --- 单引号标量
    if (rest.startsWith("'")) {
      if (!rest.endsWith("'") || rest.length < 2) {
        flag(key, "跨行引号标量", rest.slice(0, 40));
        i++;
        while (i < fmLines.length && isIndented(fmLines[i])) i++;
        continue;
      }
      const body = rest.slice(1, -1);
      if (body.includes("''")) {
        flag(key, "单引号双写转义", rest.slice(0, 40));
        i++;
        continue;
      }
      values[key] = body;
      i++;
      continue;
    }

    // --- plain 标量（含多行折叠与行尾注释剥离）
    const parts = [stripPlainComment(rest)];
    i++;
    while (i < fmLines.length && isIndented(fmLines[i]) && !KEY_RE.test(fmLines[i].trim())) {
      parts.push(stripPlainComment(fmLines[i].trim()));
      i++;
    }
    values[key] = parts.filter((p) => p !== "").join(" ");
  }

  if (!sawTopLevelKey) {
    return { keys: [], values: {}, unsupported: [], error: "frontmatter must be a YAML dictionary" };
  }
  return { keys, values, unsupported, error: null };
}

/** 便捷入口：读技能目录下 SKILL.md → { name, description, keys, values, unsupported, content, error } */
export function parseSkillMdFile(skillDir, readFileSync) {
  let content;
  try {
    content = readFileSync(join(skillDir, "SKILL.md"), "utf8");
  } catch (err) {
    const msg = err?.code === "EISDIR" ? "SKILL.md is a directory" : "SKILL.md not found";
    return { name: "", description: "", keys: [], values: {}, unsupported: [], content: "", error: msg };
  }
  const { keys, values, unsupported, error } = parseFrontmatter(content);
  return {
    name: typeof values.name === "string" ? values.name : "",
    description: typeof values.description === "string" ? values.description : "",
    keys,
    values,
    unsupported,
    content,
    error,
  };
}
