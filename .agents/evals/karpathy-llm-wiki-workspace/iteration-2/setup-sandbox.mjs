#!/usr/bin/env node
// iteration-2 测试脚手架：mock env + 隔离 sandbox + 种子/问题 wiki
// 全部产物只存在于 workspace（已 gitignore），绝不进入 skill 目录或真实 memory 目录
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const WS = "D:/GIT_dev/Claude_skills/.claude/skills/karpathy-llm-wiki-workspace/iteration-2";
const EVALS = ["eval-ingest-fresh", "eval-ingest-incremental", "eval-lint"];

for (const e of EVALS) {
  rmSync(join(WS, e), { recursive: true, force: true });
  mkdirSync(join(WS, e, "with_skill", "outputs"), { recursive: true });
  mkdirSync(join(WS, e, "without_skill", "outputs"), { recursive: true });
}
mkdirSync(join(WS, "mock-env"), { recursive: true });

// ---- mock env 文件：SKILL_ENV 指向这里，knowledgeBase 指向 sandbox ----
const mockEnv = (evalDir) => join(WS, "mock-env", `${evalDir}.json`);
writeFileSync(mockEnv("eval-ingest-fresh"), JSON.stringify({
  knowledgeBase: {
    wikiDir: join(WS, "eval-ingest-fresh", "with_skill", "outputs", "wiki"),
    rawDir: join(WS, "eval-ingest-fresh", "with_skill", "outputs", "wiki-raw"),
  },
}, null, 2));
writeFileSync(mockEnv("eval-ingest-incremental"), JSON.stringify({
  knowledgeBase: {
    wikiDir: join(WS, "eval-ingest-incremental", "with_skill", "outputs", "wiki"),
    rawDir: join(WS, "eval-ingest-incremental", "with_skill", "outputs", "wiki-raw"),
  },
}, null, 2));
writeFileSync(mockEnv("eval-lint"), JSON.stringify({
  knowledgeBase: {
    wikiDir: join(WS, "eval-lint", "with_skill", "outputs", "wiki"),
    rawDir: join(WS, "eval-lint", "with_skill", "outputs", "wiki-raw"),
  },
}, null, 2));

// ---- 种子 wiki（eval-2 incremental：3 页闭环，初始校验可通过）----
const seedWiki = (base) => {
  mkdirSync(join(base, "concepts"), { recursive: true });
  writeFileSync(join(base, "SCHEMA.md"),
    "# Wiki Schema\n\n## Tag Taxonomy\n- architecture\n- attention\n- model\n- core-concept\n- paper\n");
  writeFileSync(join(base, "index.md"),
    "# Wiki Index\n\n## Concepts\n- [[Attention Mechanism]] — how models weigh input tokens\n- [[Transformer]] — the dominant LLM architecture\n- [[Neural Network]] — layered function approximators\n");
  writeFileSync(join(base, "log.md"),
    "# Wiki Log\n\n| Date | Operation | Details |\n|------|-----------|--------|\n| 2026-08-10 | init | seeded 3 concept pages |\n");
  writeFileSync(join(base, "concepts", "Attention Mechanism.md"),
    "---\ntitle: Attention Mechanism\ntype: concept\ntags: [attention, architecture]\nsources: []\n---\n# Attention Mechanism\nWeights token relevance dynamically.\n## How It Works\nQueries, keys and values produce a weighted sum.\n## Related\n- [[Transformer]]\n- [[Neural Network]]\n");
  writeFileSync(join(base, "concepts", "Transformer.md"),
    "---\ntitle: Transformer\ntype: concept\ntags: [architecture, core-concept]\nsources: []\n---\n# Transformer\nStacked attention + feed-forward blocks.\n## Related\n- [[Attention Mechanism]]\n- [[Neural Network]]\n");
  writeFileSync(join(base, "concepts", "Neural Network.md"),
    "---\ntitle: Neural Network\ntype: concept\ntags: [core-concept]\nsources: []\n---\n# Neural Network\nLayered differentiable function approximator.\n## Related\n- [[Attention Mechanism]]\n- [[Transformer]]\n");
};
seedWiki(join(WS, "eval-ingest-incremental", "with_skill", "outputs", "wiki"));
seedWiki(join(WS, "eval-ingest-incremental", "without_skill", "outputs", "wiki"));

// ---- 问题 wiki（eval-3 lint：断链/自引/孤儿/缺index/缺frontmatter/非法tag/超尺寸/出链不足）----
const dirtyWiki = (base) => {
  mkdirSync(join(base, "concepts"), { recursive: true });
  mkdirSync(join(base, "sources"), { recursive: true });
  writeFileSync(join(base, "SCHEMA.md"),
    "# Wiki Schema\n\n## Tag Taxonomy\n- architecture\n- model\n");
  // index 只列 1 页 → Missing from Index ×N
  writeFileSync(join(base, "index.md"),
    "# Wiki Index\n\n## Concepts\n- [[Transformer]] — the dominant architecture\n");
  writeFileSync(join(base, "log.md"), "# Wiki Log\n");
  // 断链 [[Ghost Network]] + 自引 [[Transformer]] + 非法 tag transformer-arch
  writeFileSync(join(base, "concepts", "Transformer.md"),
    "---\ntitle: Transformer\ntype: concept\ntags: [transformer-arch]\n---\n# Transformer\nStacked attention blocks. See [[Ghost Network]] (broken) and [[Transformer]] (self) and [[Neural Network]].\n");
  // 缺 frontmatter + 出链不足（0）
  writeFileSync(join(base, "concepts", "Neural Network.md"),
    "# Neural Network\nLayered function approximator, no frontmatter, no links.\n");
  // 孤儿页（无人链入）
  writeFileSync(join(base, "concepts", "Orphan Concept.md"),
    "---\ntitle: Orphan Concept\ntype: concept\ntags: [architecture]\n---\n# Orphan Concept\nNobody links here.\n- [[Transformer]]\n- [[Neural Network]]\n");
  // 超尺寸页（>200 行）
  const filler = Array.from({ length: 210 }, (_, i) => `filler line ${i}`).join("\n");
  writeFileSync(join(base, "sources", "Big Source.md"),
    `---\ntitle: Big Source\ntype: source\ntags: [architecture]\n---\n# Big Source\nWay too long.\n- [[Transformer]]\n- [[Neural Network]]\n${filler}\n`);
};
dirtyWiki(join(WS, "eval-lint", "with_skill", "outputs", "wiki"));
dirtyWiki(join(WS, "eval-lint", "without_skill", "outputs", "wiki"));

console.log("sandbox ready under", WS);
for (const e of EVALS) console.log(" -", e, "→ mock env:", mockEnv(e));
