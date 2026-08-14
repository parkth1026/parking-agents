// frontmatter.mjs — 手写 SKILL.md frontmatter 解析（零依赖，替代 PyYAML）
// 解析前统一剥离 \r，CRLF 文件与 LF 文件同判定。
import { join } from "node:path";

/** 剥离 CR 后按行切分 */
function toLines(content) {
  return content.replace(/\r\n?/g, "\n").split("\n");
}

/**
 * 解析 SKILL.md 文本，返回 { keys, values, error }。
 * keys: 顶层键（首次出现顺序；重复键取值以后者覆盖，对齐 PyYAML 行为）
 * values: 顶层键 → 标量字符串（name/description 等）；嵌套块（如 metadata:）为 null
 * error: 非 null 表示结构级失败（缺起止 --- / 空映射）
 */
export function parseFrontmatter(content) {
  const lines = toLines(content);

  if (lines[0].trim() !== "---") {
    return { keys: [], values: {}, error: "missing opening --- (no YAML frontmatter)" };
  }

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") { endIdx = i; break; }
  }
  if (endIdx === -1) {
    return { keys: [], values: {}, error: "missing closing --- (invalid frontmatter format)" };
  }

  const fmLines = lines.slice(1, endIdx);
  const keys = [];
  const values = {};
  let i = 0;
  let sawTopLevelKey = false;

  while (i < fmLines.length) {
    const line = fmLines[i];
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:[ \t]*(.*))?$/);
    if (m) {
      const key = m[1];
      const rest = (m[2] || "").trim();
      sawTopLevelKey = true;
      if (!keys.includes(key)) keys.push(key);

      if (rest === ">" || rest === "|" || rest === ">-" || rest === "|-") {
        const continuation = [];
        i++;
        while (i < fmLines.length && (fmLines[i].startsWith("  ") || fmLines[i].startsWith("\t"))) {
          continuation.push(fmLines[i].trim());
          i++;
        }
        values[key] = continuation.join(" ");
        continue;
      }
      if (rest === "") {
        // 空值：嵌套块父键（如 metadata:）或空标量，吞掉缩进行
        i++;
        while (i < fmLines.length && (fmLines[i].startsWith("  ") || fmLines[i].startsWith("\t"))) {
          i++;
        }
        values[key] = null;
        continue;
      }
      values[key] = rest.replace(/^['"]/, "").replace(/['"]$/, "");
    }
    i++;
  }

  if (!sawTopLevelKey) {
    return { keys: [], values: {}, error: "frontmatter must be a YAML dictionary" };
  }
  return { keys, values, error: null };
}

/** 便捷入口：读技能目录下 SKILL.md → { name, description, keys, content, error } */
export function parseSkillMdFile(skillDir, readFileSync) {
  let content;
  try {
    content = readFileSync(join(skillDir, "SKILL.md"), "utf8");
  } catch {
    return { name: "", description: "", keys: [], content: "", error: "SKILL.md not found" };
  }
  const { keys, values, error } = parseFrontmatter(content);
  return {
    name: typeof values.name === "string" ? values.name : "",
    description: typeof values.description === "string" ? values.description : "",
    keys,
    values,
    content,
    error,
  };
}
