#!/usr/bin/env node
// package-skill.mjs — 技能打包（官方 package_skill.py 移植；STORE 不压缩的标准 zip）
// 用法: node package-skill.mjs <技能目录> [输出目录]
// 退出码: 0 成功 / 1 校验失败或拒绝 / 2 用法错
// 交叉验证: python -m zipfile -l <name>.skill
import { execFileSync } from "node:child_process";
import { existsSync, statSync, readdirSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve, basename, relative, sep } from "node:path";
import { validateSkill } from "./quick-validate.mjs";
import { buildStoreZip } from "./lib/zip.mjs";

// 官方排除规则（逐字保持）
const EXCLUDE_DIRS = new Set(["__pycache__", "node_modules"]);
const EXCLUDE_GLOBS = [/\.pyc$/];
const EXCLUDE_FILES = new Set([".DS_Store"]);
const ROOT_EXCLUDE_DIRS = new Set(["evals", "eval-fixtures"]); // 仅技能根下排除；外部 evidence payload 留在仓库不进包

function shouldExclude(relParts, name) {
  if (relParts.some((p) => EXCLUDE_DIRS.has(p))) return true;
  // relParts[0] = 技能目录名；relParts[1]（若有）= 技能根下第一层子目录
  if (relParts.length > 1 && ROOT_EXCLUDE_DIRS.has(relParts[1])) return true;
  if (EXCLUDE_FILES.has(name)) return true;
  return EXCLUDE_GLOBS.some((re) => re.test(name));
}

/** 递归收集文件（相对技能父目录的 posix 路径） */
function collectFiles(dir) {
  const out = [];
  const walk = (d, relParts) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      const childParts = [...relParts, entry.name];
      const rel = childParts.join("/");
      if (shouldExclude(childParts, entry.name)) {
        console.log(`  跳过: ${rel}${entry.isDirectory() ? "/" : ""}`);
        continue;
      }
      if (entry.isDirectory()) walk(full, childParts);
      else if (entry.isFile()) out.push(full);
    }
  };
  walk(dir, [basename(dir)]);
  return out;
}

function usage() {
  console.log("用法: node package-skill.mjs <技能目录> [输出目录]");
  console.log("示例: node package-skill.mjs ../my-skill ./dist");
  process.exit(2);
}

function runSkillTests(skillPath) {
  const testPath = join(skillPath, "run-tests.mjs");
  if (!existsSync(testPath)) {
    console.log("警告: 无 run-tests.mjs，跳过技能自测（旧技能兼容）");
    return true;
  }

  try {
    const output = execFileSync(process.execPath, [testPath], {
      cwd: skillPath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    console.log("技能自测 PASS");
    if (output.trim()) console.log(output.trim());
    return true;
  } catch (err) {
    const stdout = err.stdout?.toString().trim();
    const stderr = err.stderr?.toString().trim();
    console.log(`技能自测未通过，拒绝打包（退出码 ${err.status ?? 1}）:`);
    if (stdout) console.log(stdout);
    if (stderr) console.log(stderr);
    return false;
  }
}

const [skillPathArg, outputDirArg] = process.argv.slice(2);
if (!skillPathArg || skillPathArg.startsWith("-")) usage();

const skillPath = resolve(skillPathArg);
if (!existsSync(skillPath) || !statSync(skillPath).isDirectory()) {
  console.log(`目录不存在: ${skillPath}`);
  process.exit(1);
}

// 打包前强制校验（违规目录拒绝打包）
console.log("校验技能…");
const { valid, errors, undecidable } = validateSkill(skillPath);
if (undecidable && undecidable.length > 0) {
  console.error(`拒绝打包：${skillPath} 的 frontmatter 含解析器支持子集外的构造，校验无法判定`);
  for (const u of undecidable) console.error(`  - ${u.key}: ${u.construct} → ${u.detail}`);
  process.exit(1);
}
if (!valid) {
  console.log("校验未通过，拒绝打包:");
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("校验 PASS\n");
if (!runSkillTests(skillPath)) process.exit(1);
console.log();

const skillParent = resolve(skillPath, "..");
const files = collectFiles(skillPath).sort();

const entries = [];
for (const file of files) {
  const rel = relative(skillParent, file).split(sep).join("/");
  const parts = rel.split("/");
  const name = parts[parts.length - 1];
  entries.push({ name: rel, data: readFileSync(file) });
  console.log(`  加入: ${rel}`);
}

if (entries.length === 0) {
  console.log("无文件可打包");
  process.exit(1);
}

const outputDir = outputDirArg ? resolve(outputDirArg) : process.cwd();
mkdirSync(outputDir, { recursive: true });
const outPath = join(outputDir, `${basename(skillPath)}.skill`);
writeFileSync(outPath, buildStoreZip(entries));

console.log(`\n打包完成 → ${outPath} (${entries.length} 个条目, STORE)`);
console.log("交叉验证: python -m zipfile -l " + outPath);
process.exit(0);
