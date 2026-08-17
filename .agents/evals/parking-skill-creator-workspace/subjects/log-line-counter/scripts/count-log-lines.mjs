#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  console.error("Usage: node scripts/count-log-lines.mjs <input-file> [output.md]");
  process.exit(2);
}

export function countLines(text) {
  if (text.length === 0) {
    return { total: 0, empty: 0, nonEmpty: 0 };
  }

  const lines = text.split(/\r\n|\n|\r/);
  if (/\r\n$|[\n\r]$/.test(text)) lines.pop();

  const empty = lines.filter((line) => line.length === 0).length;
  return { total: lines.length, empty, nonEmpty: lines.length - empty };
}

export function renderMarkdown({ total, empty, nonEmpty }) {
  return [
    "# Log line count",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Total lines | ${total} |`,
    `| Empty lines | ${empty} |`,
    `| Non-empty lines | ${nonEmpty} |`,
    "",
  ].join("\n");
}

function readUtf8(path) {
  const bytes = readFileSync(path);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function main(argv) {
  if (argv.length < 1 || argv.length > 2 || argv[0].startsWith("-")) usage();

  const inputPath = resolve(argv[0]);
  const outputPath = argv[1] ? resolve(argv[1]) : null;

  try {
    const markdown = renderMarkdown(countLines(readUtf8(inputPath)));
    if (outputPath) writeFileSync(outputPath, markdown, "utf8");
    else process.stdout.write(markdown);
  } catch (error) {
    console.error(`log-line-counter: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
