#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const RELEASE_CATEGORIES = ["engineering", "productivity", "pub"];
export const EVAL_GATE_FILES = [
  "trigger-evals.json",
  "output-evals.json",
  "run-tests.mjs",
  "trigger-benchmark.json",
  "history.json",
];

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_NAME = ".generated-by-build-release.json";
const SKILL_MARKER_NAME = ".generated-by-build-release.json";
const INDEX_BEGIN = "<!-- BEGIN GENERATED SELF-DEVELOPED SKILLS -->";
const INDEX_END = "<!-- END GENERATED SELF-DEVELOPED SKILLS -->";
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toPosix(path) {
  return path.split(sep).join("/");
}

function scalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseSkillFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return null;
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) return null;

  const fields = new Map();
  for (const line of normalized.slice(4, end).split("\n")) {
    if (!line || /^\s/.test(line) || line.trimStart().startsWith("#")) continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match || fields.has(match[1])) return null;
    fields.set(match[1], scalar(match[2]));
  }
  if (!fields.get("name") || !fields.has("description")) return null;
  return Object.fromEntries(fields);
}

function readManifest(releaseRoot) {
  const path = join(releaseRoot, MANIFEST_NAME);
  if (!existsSync(path)) return { version: 1, skills: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (parsed?.version !== 1 || !Array.isArray(parsed.skills)) throw new Error("schema");
    for (const item of parsed.skills) {
      if (
        !item ||
        typeof item.name !== "string" ||
        typeof item.category !== "string" ||
        !SKILL_NAME_PATTERN.test(item.name) ||
        !RELEASE_CATEGORIES.includes(item.category)
      ) {
        throw new Error("schema");
      }
    }
    return parsed;
  } catch {
    throw new Error(`[build-release] ${toPosix(relative(resolve(releaseRoot, ".."), path))} 不可解析`);
  }
}

function markerText(skill) {
  return `${JSON.stringify(
    {
      generatedBy: "scripts/build-release.mjs",
      source: `.agents/skills/${skill.name}`,
      category: skill.category,
    },
    null,
    2
  )}\n`;
}

function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}

function treeSnapshot(root) {
  const rows = [];
  const walk = (dir, prefix = "") => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const stat = lstatSync(abs);
      if (stat.isDirectory()) {
        rows.push(`d ${rel}`);
        walk(abs, rel);
      } else if (stat.isSymbolicLink()) {
        rows.push(`l ${rel} ${readlinkSync(abs)}`);
      } else if (stat.isFile()) {
        rows.push(`f ${rel} ${hash(readFileSync(abs))}`);
      } else {
        rows.push(`? ${rel}`);
      }
    }
  };
  walk(root);
  return rows;
}

function expectedSkillSnapshot(skill) {
  const rows = treeSnapshot(skill.sourceDir);
  rows.push(`f ${SKILL_MARKER_NAME} ${hash(Buffer.from(markerText(skill)))}`);
  return rows.sort();
}

function actualSkillSnapshot(target) {
  return treeSnapshot(target).sort();
}

function replaceGeneratedSection(content, body, { keepEmpty = false } = {}) {
  const normalized = content.replace(/\r\n/g, "\n");
  const begin = normalized.indexOf(INDEX_BEGIN);
  const end = normalized.indexOf(INDEX_END);
  if ((begin === -1) !== (end === -1) || (begin !== -1 && end < begin)) {
    throw new Error("生成索引标记不完整");
  }
  if (
    (begin !== -1 && normalized.indexOf(INDEX_BEGIN, begin + INDEX_BEGIN.length) !== -1) ||
    (end !== -1 && normalized.indexOf(INDEX_END, end + INDEX_END.length) !== -1)
  ) {
    throw new Error("生成索引标记重复");
  }
  const hasSection = begin !== -1 && end !== -1 && end > begin;

  if (!body && !hasSection) return normalized;
  if (!body && hasSection && !keepEmpty) {
    const after = end + INDEX_END.length;
    return `${normalized.slice(0, begin).trimEnd()}\n${normalized.slice(after).trimStart()}`.trimEnd() + "\n";
  }

  const section = `${INDEX_BEGIN}\n${body || "_当前没有自研晋级技能。_"}\n${INDEX_END}`;
  if (!hasSection) return `${normalized.trimEnd()}\n\n${section}\n`;
  return `${normalized.slice(0, begin)}${section}${normalized.slice(end + INDEX_END.length)}`;
}

function topIndexBody(skills) {
  if (skills.length === 0) return "";
  return [
    "### 自研晋级技能（生成）",
    "",
    "| 分类 | Skill | 开发真源 |",
    "| --- | --- | --- |",
    ...skills.map(
      (skill) =>
        `| ${skill.category} | [${skill.name}](./skills/${skill.category}/${skill.name}/SKILL.md) | [.agents/skills/${skill.name}](./.agents/skills/${skill.name}/SKILL.md) |`
    ),
  ].join("\n");
}

function bucketIndexBody(category, skills) {
  const inCategory = skills.filter((skill) => skill.category === category);
  if (inCategory.length === 0) return "";
  return [
    "## 自研晋级技能（生成）",
    "",
    ...inCategory.map((skill) => `- **[${skill.name}](./${skill.name}/SKILL.md)** — 由开发真源生成，请勿手改。`),
  ].join("\n");
}

function discoverPromotions(devRoot, warnings, errors) {
  if (!existsSync(devRoot)) return [];
  const promotions = [];
  for (const entry of readdirSync(devRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const sourceDir = join(devRoot, entry.name);
    const skillPath = join(sourceDir, "SKILL.md");
    if (!existsSync(skillPath)) {
      warnings.push(`${entry.name}: 缺 SKILL.md，已跳过`);
      continue;
    }
    const frontmatter = parseSkillFrontmatter(readFileSync(skillPath, "utf8"));
    if (!frontmatter) {
      warnings.push(`${entry.name}: SKILL.md frontmatter 不可解析，已跳过`);
      continue;
    }
    if (!frontmatter.category) continue;
    if (!RELEASE_CATEGORIES.includes(frontmatter.category)) {
      errors.push(`${entry.name}: 非法 category '${frontmatter.category}'`);
      continue;
    }
    const missing = EVAL_GATE_FILES.filter((name) => !existsSync(join(sourceDir, name)));
    if (missing.length > 0) {
      errors.push(`${entry.name}: 评测五件套不齐，缺 ${missing.join(", ")}`);
      continue;
    }
    if (existsSync(join(sourceDir, SKILL_MARKER_NAME))) {
      errors.push(`${entry.name}: 开发真源包含生成器保留文件 ${SKILL_MARKER_NAME}`);
      continue;
    }
    promotions.push({ name: entry.name, category: frontmatter.category, sourceDir });
  }
  return promotions;
}

function generatedMarkerIsValid(releaseRoot, item) {
  const marker = join(releaseRoot, item.category, item.name, SKILL_MARKER_NAME);
  if (!existsSync(marker)) return false;
  try {
    const parsed = JSON.parse(readFileSync(marker, "utf8"));
    return (
      parsed?.generatedBy === "scripts/build-release.mjs" &&
      parsed?.source === `.agents/skills/${item.name}` &&
      parsed?.category === item.category
    );
  } catch {
    return false;
  }
}

function findGeneratedMarkers(releaseRoot) {
  const found = [];
  if (!existsSync(releaseRoot)) return found;
  for (const category of readdirSync(releaseRoot, { withFileTypes: true })) {
    if (!category.isDirectory() || category.name.startsWith(".")) continue;
    const categoryRoot = join(releaseRoot, category.name);
    for (const entry of readdirSync(categoryRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(categoryRoot, entry.name, SKILL_MARKER_NAME))) {
        found.push(`${category.name}/${entry.name}`);
      }
    }
  }
  return found;
}

function existingReleaseSkills(releaseRoot, verifiedGeneratedPaths) {
  const generatedPaths = new Set(verifiedGeneratedPaths);
  const byName = new Map();
  if (!existsSync(releaseRoot)) return byName;
  for (const category of readdirSync(releaseRoot, { withFileTypes: true })) {
    if (!category.isDirectory() || category.name.startsWith(".")) continue;
    const categoryRoot = join(releaseRoot, category.name);
    for (const entry of readdirSync(categoryRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (!existsSync(join(categoryRoot, entry.name, "SKILL.md"))) continue;
      const key = `${category.name}/${entry.name}`;
      if (generatedPaths.has(key)) continue;
      const rows = byName.get(entry.name) ?? [];
      rows.push(key);
      byName.set(entry.name, rows);
    }
  }
  return byName;
}

function runPromotionTests(promotions, errors) {
  for (const skill of promotions) {
    const result = spawnSync(process.execPath, [join(skill.sourceDir, "run-tests.mjs")], {
      cwd: skill.sourceDir,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      const detail = `${result.stdout || ""}${result.stderr || ""}`.trim();
      errors.push(`${skill.name}: run-tests 未通过${detail ? `\n${detail}` : ""}`);
    }
  }
}

function desiredManifest(skills) {
  return {
    version: 1,
    skills: skills.map(({ name, category }) => ({ name, category })),
  };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function buildRelease({ root = SCRIPT_ROOT, check = false } = {}) {
  const repoRoot = resolve(root);
  const devRoot = join(repoRoot, ".agents", "skills");
  const releaseRoot = join(repoRoot, "skills");
  const warnings = [];
  const errors = [];
  const promotions = discoverPromotions(devRoot, warnings, errors).sort((a, b) => a.name.localeCompare(b.name));
  const prior = readManifest(releaseRoot).skills;
  const verifiedPrior = [];
  for (const item of prior) {
    const target = join(releaseRoot, item.category, item.name);
    if (!existsSync(target)) continue;
    if (generatedMarkerIsValid(releaseRoot, item)) verifiedPrior.push(`${item.category}/${item.name}`);
    else errors.push(`${item.category}/${item.name}: 生成清单存在但技能标记缺失或无效，拒绝覆盖`);
  }
  const priorPaths = new Set(prior.map((item) => `${item.category}/${item.name}`));
  for (const markedPath of findGeneratedMarkers(releaseRoot)) {
    if (!priorPaths.has(markedPath)) errors.push(`${markedPath}: 生成技能标记存在但未登记在清单`);
  }
  const existing = existingReleaseSkills(releaseRoot, verifiedPrior);

  for (const skill of promotions) {
    if (existing.has(skill.name)) {
      errors.push(`${skill.name}: 与 skills/ 既有技能重名 (${existing.get(skill.name).join(", ")})`);
    }
  }
  if (new Set(promotions.map((skill) => skill.name)).size !== promotions.length) {
    errors.push("自研晋级技能名称重复");
  }
  if (errors.length === 0) runPromotionTests(promotions, errors);

  for (const warning of warnings) console.warn(`[build-release] warning: ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`[build-release] ERROR: ${error}`);
    return { ok: false, promotions, warnings, errors };
  }

  const manifest = desiredManifest(promotions);
  const manifestPath = join(releaseRoot, MANIFEST_NAME);
  const readmePath = join(repoRoot, "README.md");
  const desiredReadme = existsSync(readmePath)
    ? replaceGeneratedSection(readFileSync(readmePath, "utf8"), topIndexBody(promotions), { keepEmpty: true })
    : null;
  const bucketReadmes = new Map();
  for (const category of RELEASE_CATEGORIES) {
    const path = join(releaseRoot, category, "README.md");
    if (!existsSync(path) && promotions.every((skill) => skill.category !== category)) continue;
    const current = existsSync(path) ? readFileSync(path, "utf8") : `# ${category}\n`;
    bucketReadmes.set(path, replaceGeneratedSection(current, bucketIndexBody(category, promotions)));
  }

  if (check) {
    const expectedManifest = stableJson(manifest);
    const actualManifest = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8").replace(/\r\n/g, "\n") : null;
    if (
      (promotions.length === 0 && actualManifest !== null) ||
      (promotions.length > 0 && actualManifest !== expectedManifest)
    ) {
      errors.push(`${MANIFEST_NAME} 与分类真源不一致`);
    }
    for (const skill of promotions) {
      const target = join(releaseRoot, skill.category, skill.name);
      if (!existsSync(target)) {
        errors.push(`${toPosix(relative(repoRoot, target))} 缺失`);
      } else if (actualSkillSnapshot(target).join("\n") !== expectedSkillSnapshot(skill).join("\n")) {
        errors.push(`${toPosix(relative(repoRoot, target))} 与开发真源漂移`);
      }
    }
    if (desiredReadme !== null && readFileSync(readmePath, "utf8").replace(/\r\n/g, "\n") !== desiredReadme) {
      errors.push("README.md 生成索引与分类真源不一致");
    }
    for (const [path, desired] of bucketReadmes) {
      if (!existsSync(path) || readFileSync(path, "utf8").replace(/\r\n/g, "\n") !== desired) {
        errors.push(`${toPosix(relative(repoRoot, path))} 生成索引与分类真源不一致`);
      }
    }
    if (errors.length > 0) {
      for (const error of errors) console.error(`[build-release] 不一致: ${error}`);
      console.error("[build-release] ERROR: 生成树过期，运行 node scripts/build-release.mjs 后重试");
      return { ok: false, promotions, warnings, errors };
    }
    console.log(`[build-release] --check: 生成树与真源一致 ✓ (${promotions.length} 个自研晋级技能)`);
    return { ok: true, promotions, warnings, errors };
  }

  mkdirSync(releaseRoot, { recursive: true });
  const desiredPaths = new Set(promotions.map((skill) => `${skill.category}/${skill.name}`));
  for (const old of prior) {
    const oldKey = `${old.category}/${old.name}`;
    if (!desiredPaths.has(oldKey)) rmSync(join(releaseRoot, old.category, old.name), { recursive: true, force: true });
  }
  for (const skill of promotions) {
    const target = join(releaseRoot, skill.category, skill.name);
    rmSync(target, { recursive: true, force: true });
    mkdirSync(dirname(target), { recursive: true });
    cpSync(skill.sourceDir, target, { recursive: true, verbatimSymlinks: true });
    writeFileSync(join(target, SKILL_MARKER_NAME), markerText(skill));
    console.log(`[build-release] 生成 ${toPosix(relative(repoRoot, target))}/`);
  }
  if (promotions.length > 0 || existsSync(manifestPath)) {
    if (promotions.length > 0) writeFileSync(manifestPath, stableJson(manifest));
    else rmSync(manifestPath, { force: true });
  }
  if (desiredReadme !== null) writeFileSync(readmePath, desiredReadme);
  for (const [path, desired] of bucketReadmes) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, desired);
  }
  console.log(`[build-release] 完成: ${promotions.length} 个自研技能晋级`);
  return { ok: true, promotions, warnings, errors };
}

function parseArgs(argv) {
  let root = SCRIPT_ROOT;
  let check = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--check") check = true;
    else if (arg === "--root" && argv[index + 1]) root = argv[++index];
    else throw new Error(`未知参数或缺参数值: ${arg}`);
  }
  return { root, check };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = buildRelease(parseArgs(process.argv.slice(2)));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(`[build-release] ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
