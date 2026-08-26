#!/usr/bin/env node
// run-tests.mjs — ue-log-analysis 的回归测试（升级/改动后必跑）
// 惯例：check() 计数器 + 黑盒执行（execFileSync 跑脚本/命令再比对输出），退出码 0=全过/1=有失败；
//       fixtures/ 放黄金输入与 expected，逐字段比对。测试固化在技能里，随技能分发。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SKILL_DIR, "scripts", "ue-log-analysis.mjs");
const FX = (f) => join(SKILL_DIR, "fixtures", f);

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

function run(args) {
  const out = execFileSync("node", [SCRIPT, ...args], { encoding: "utf8" });
  return JSON.parse(out);
}

// ---------- AC-1 frames ----------
{
  const stall = run(["frames", FX("fixture-stall.log"), "--json"]);
  check("AC-1 stall: 最大帧为 0 且判定从未出帧",
    stall.maxFrame === 0 && stall.verdict.includes("从未出帧"));
  check("AC-1 stall: 帧 0 占比 100%",
    stall.frame0Lines === stall.parsedLines && stall.frame0Pct === "100.0%");

  const freeze = run(["frames", FX("fixture-run-freeze.log"), "--json"]);
  check("AC-1 freeze: 最大帧 831 且判定存活",
    freeze.maxFrame === 831 && freeze.alive === true);
  check("AC-1 freeze: 检出 FPS 骤降(基准 40 附近, 跌至 ~10)",
    freeze.fpsDrops.length === 1 && freeze.fpsDrops[0].fps < 15 && freeze.fpsDrops[0].baseline > 30);

  const crash = run(["frames", FX("fixture-crash.log"), "--json"]);
  check("AC-1 crash: 帧 0 与游戏帧混合解析正常",
    crash.maxFrame === 220 && crash.frame0Lines === 1);
}

// ---------- AC-2 gaps ----------
{
  const freeze = run(["gaps", FX("fixture-run-freeze.log"), "--json"]);
  check("AC-2 freeze: 检出 1 处空窗",
    freeze.count === 1);
  check("AC-2 freeze: 空窗时长 ~26.5s 且带前后上下文",
    Math.abs(freeze.gaps[0].durMs - 26479) < 50
      && freeze.gaps[0].before.length > 0 && freeze.gaps[0].after.length > 0);

  const none = run(["gaps", FX("fixture-crash.log"), "--json"]);
  check("AC-2 无空窗时 count=0 正常退出",
    none.count === 0);

  const custom = run(["gaps", FX("fixture-stall.log"), "--json", "--min-ms", "60000"]);
  check("AC-2 --min-ms 阈值可调(60s 下 stall 无空窗)",
    custom.count === 0);
}

// ---------- AC-3 errors ----------
{
  const stall = run(["errors", FX("fixture-stall.log"), "--json"]);
  check("AC-3 stall: 错误行 4 行归并为 4 类",
    stall.totalErrorLines === 4 && stall.distinctPatterns === 4);
  check("AC-3 stall: 含 Couldn't find file 与 Ensure 样例",
    stall.rows.some((r) => r.sample.includes("Couldn't find file"))
      && stall.rows.some((r) => r.sample.includes("Ensure condition failed")));
  check("AC-3 stall: 首末时间与帧号字段齐全",
    stall.rows.every((r) => r.first.at && r.last.at && r.first.frame === 0));

  const crash = run(["errors", FX("fixture-crash.log"), "--json"]);
  check("AC-3 crash: 无前缀行也参与(Ensure/Callstack 类多行块)",
    crash.totalErrorLines === 2 && crash.distinctPatterns === 2);
}

// ---------- AC-4 noise ----------
{
  const stall = run(["noise", FX("fixture-stall.log"), "--json"]);
  check("AC-4 stall: PROJ I/O 刷屏聚类为 open/close 两签名各 24 次",
    stall.patterns.filter((p) => p.signature.includes("FEarthUFSProj")).length === 2
      && stall.patterns.filter((p) => p.signature.includes("FEarthUFSProj"))
        .every((p) => p.count === 24));

  const freeze = run(["noise", FX("fixture-run-freeze.log"), "--json"]);
  check("AC-4 freeze: EarthReady Timer 刷屏(13 次同签名)被聚类",
    freeze.patterns.some((p) => p.signature.includes("EarthReady") && p.count === 13));

  const quiet = run(["noise", FX("fixture-crash.log"), "--json", "--min-count", "100"]);
  check("AC-4 无重复模式时输出空且正常退出",
    quiet.patterns.length === 0);
}

// ---------- AC-5 timeline ----------
{
  const freeze = run(["timeline", FX("fixture-run-freeze.log"), "--json"]);
  check("AC-5 freeze: 首帧里程碑存在",
    freeze.milestones.some((m) => m.label === "首帧"));
  check("AC-5 freeze: 心跳被识别",
    freeze.heartbeat !== null && freeze.heartbeat.count >= 1);
  check("AC-5 freeze: 空窗已标注",
    freeze.gaps.length === 1);
  check("AC-5 freeze: 终止形态=戛然而止",
    freeze.ending.includes("戛然而止"));

  const crash = run(["timeline", FX("fixture-crash.log"), "--json"]);
  check("AC-5 crash: 终止形态=崩溃终止",
    crash.ending.includes("崩溃终止"));
  check("AC-5 crash: PSO 等待计数",
    crash.psoWaits !== null && crash.psoWaits.count === 1);

  const stall = run(["timeline", FX("fixture-stall.log"), "--json"]);
  check("AC-5 stall: 无首帧里程碑(从未出帧)",
    !stall.milestones.some((m) => m.label === "首帧"));
  check("AC-5 stall: 关卡流送 2 次",
    stall.levelStreamCount === 2);
}

// ---------- AC-6 summary / --json ----------
{
  const out = execFileSync("node",
    [SCRIPT, "summary", FX("fixture-run-freeze.log")], { encoding: "utf8" });
  check("AC-6 summary: markdown 报告含全部五个章节",
    ["# 帧号体检", "# 时间线", "# 错误频次", "# 噪声聚类", "# 时间空窗"]
      .every((h) => out.includes(h)));
  check("AC-6 summary: 报告含判活结论与骤降",
    out.includes("存活") && out.includes("骤降"));
}

// ---------- AC-7 退出码 ----------
{
  let code = 0;
  try {
    execFileSync("node", [SCRIPT, "frames", FX("不存在.log")], { stdio: "pipe" });
  } catch (e) { code = e.status; }
  check("AC-7 文件不存在 exit 2", code === 2);

  try {
    execFileSync("node", [SCRIPT, "bogus", FX("fixture-crash.log")], { stdio: "pipe" });
    check("AC-7 非法命令 exit 2", false);
  } catch (e) {
    check("AC-7 非法命令 exit 2", e.status === 2);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
