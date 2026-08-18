#!/usr/bin/env node

import { basename, resolve } from "node:path";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const expected = [];
const forbidden = [];
let target;
let kind = "auto";
let maxEnglishTerms;

function usage(message) {
  if (message) console.error(`ERROR: ${message}`);
  console.error("Usage: node validate-rewrite.mjs <file> [--kind auto|prompt|skill] [--expect <text>] [--forbid <text>] [--max-english-terms <n>]");
  process.exit(2);
}

while (args.length) {
  const arg = args.shift();
  if (!target && !arg.startsWith("--")) {
    target = arg;
    continue;
  }
  if (arg === "--kind") {
    kind = args.shift() ?? usage("--kind requires a value");
    continue;
  }
  if (arg === "--expect") {
    expected.push(args.shift() ?? usage("--expect requires a value"));
    continue;
  }
  if (arg === "--forbid") {
    forbidden.push(args.shift() ?? usage("--forbid requires a value"));
    continue;
  }
  if (arg === "--max-english-terms") {
    const value = args.shift() ?? usage("--max-english-terms requires a value");
    maxEnglishTerms = Number(value);
    if (!Number.isInteger(maxEnglishTerms) || maxEnglishTerms < 0) usage("--max-english-terms must be a non-negative integer");
    continue;
  }
  usage(`unknown argument: ${arg}`);
}

if (!target) usage("missing target file");
if (!["auto", "prompt", "skill"].includes(kind)) usage(`unsupported kind: ${kind}`);

const path = resolve(target);
let text;
try {
  text = readFileSync(path, "utf8");
} catch (error) {
  usage(`cannot read ${path}: ${error.message}`);
}

if (kind === "auto") kind = basename(path).toLowerCase() === "skill.md" ? "skill" : "prompt";

const errors = [];
for (const term of expected) {
  if (!text.includes(term)) errors.push(`missing expected text: ${term}`);
}
for (const term of forbidden) {
  if (text.includes(term)) errors.push(`found forbidden text: ${term}`);
}
if (maxEnglishTerms !== undefined) {
  const englishTerms = text.match(/[（(][A-Za-z][A-Za-z0-9 -]*[）)]/g) ?? [];
  if (englishTerms.length > maxEnglishTerms) {
    errors.push(`English term count exceeds ${maxEnglishTerms}: ${englishTerms.length}`);
  }
}

if (kind === "skill") {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) {
    errors.push("missing YAML frontmatter");
  } else {
    const lines = frontmatter[1].split(/\r?\n/);
    const nameLine = lines.find((line) => /^name:\s*/.test(line));
    const descriptionLine = lines.find((line) => /^description:\s*/.test(line));
    const name = nameLine?.replace(/^name:\s*/, "").trim();
    const description = descriptionLine?.replace(/^description:\s*/, "").trim();
    if (!name) errors.push("frontmatter name is missing");
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) errors.push("frontmatter name is not kebab-case");
    if (!description) errors.push("frontmatter description is missing");
    else {
      if (description.length > 1024) errors.push(`description exceeds 1024 characters: ${description.length}`);
      if (/[<>]/.test(description)) errors.push("description contains angle brackets");
    }
  }
  if (/\[TODO:/i.test(text)) errors.push("skill still contains TODO placeholders");
}

if (errors.length) {
  console.error(`FAIL ${path}`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`PASS ${path} (${kind})`);
