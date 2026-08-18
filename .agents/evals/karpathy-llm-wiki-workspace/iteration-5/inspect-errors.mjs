import { readFileSync } from "node:fs";
const j = JSON.parse(readFileSync("D:/GIT_dev/parking-agents/.agents/evals/karpathy-llm-wiki-workspace/iteration-5/grading/objective.json", "utf8"));
for (const r of j.runs) {
  const v = r.validator;
  if (v.total === null || v.total === undefined) {
    console.log(`${r.scenario} ${r.arm} run${r.run} -> code=${v.code} error=${v.error ?? "(no error field)"}`);
    if (v.out) console.log("  out tail:", v.out.slice(-200).replace(/\n/g, " | "));
  }
}
