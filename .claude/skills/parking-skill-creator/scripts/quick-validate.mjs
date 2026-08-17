#!/usr/bin/env node
// quick-validate.mjs — 技能快速校验（官方 quick_validate.py 规则集逐字移植，去 PyYAML）
// 用法: node quick-validate.mjs <技能目录>
// 退出码: 0 合法 / 1 校验失败 / 2 用法错
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseSkillMdFile } from "./lib/frontmatter.mjs";

const ALLOWED_KEYS = ["name", "description", "license", "allowed-tools", "metadata", "compatibility"];

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

  const { name, description, keys, values, error } = parseSkillMdFile(skillDir, readFileSync);
  if (error === "SKILL.md not found" || error === "SKILL.md is a directory") {
    return { valid: false, errors: [error], summary: null };
  }
  if (error) {
    return { valid: false, errors: [`frontmatter 结构错误: ${error}`], summary: null };
  }

  // 未知键（点名允许集）
  const unexpected = keys.filter((k) => !ALLOWED_KEYS.includes(k));
  if (unexpected.length > 0) {
    errors.push(`不允许的键: ${unexpected.join(", ")}（允许: ${ALLOWED_KEYS.join("/")}）`);
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
    errors,
    summary: { name: name.trim(), nameLen: name.trim().length, descLen: description.trim().length, keys },
  };
}

// --- CLI（仅直接运行时执行；被 package-skill 等导入时只提供 validateSkill） ---
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1] || "-").href;
if (isMain) {
  const [dir] = process.argv.slice(2);
  if (!dir || dir.startsWith("-")) usage();

  const { valid, errors, summary } = validateSkill(dir);
  if (valid) {
    console.log(`PASS ${dir}`);
    console.log(`  name: ${summary.name || "(空)"} (${summary.nameLen}/64)`);
    console.log(`  description: ${summary.descLen}/1024, 无尖括号`);
    console.log(`  键: ${summary.keys.join(", ")} ✓`);
    if (!existsSync(join(dir, "run-tests.mjs"))) {
      console.log("  警告: 无 run-tests.mjs——新技能必须固化测试(init 脚手架自带)；旧技能升级时补上");
    }
    if (!existsSync(join(dir, "references", "design.md"))) {
      console.log("  警告: 无 references/design.md——设计依据不可考(新技能必须,老技能升级时补)");
    }
    if (readFileSync(join(dir, "SKILL.md"), "utf8").includes("[TODO")) {
      console.log("  提示: SKILL.md 仍含 TODO 占位（完成占位再分发）");
    }
    process.exit(0);
  } else {
    console.log(`FAIL ${dir}`);
    for (const e of errors) console.log(`  - ${e}`);
    process.exit(1);
  }
}
