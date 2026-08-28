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

// ---------- AC-1b frames 帧号回绕(UE5 原生 mod 1000) ----------
{
  const w = run(["frames", FX("fixture-wrap-freeze.log"), "--json"]);
  check("AC-1b wrap: 检测到帧号回绕",
    w.frameWrap.detected === true && w.frameWrap.backwardJumps === 2);
  check("AC-1b wrap: 解绕后真实最大帧 2312(原始列最大 999)",
    w.frameWrap.realMaxFrame === 2312 && w.maxFrame === 999);
  check("AC-1b wrap: 尾部冻结判死而非误判存活",
    w.alive === false && w.tailFrozenMs !== null && w.tailFrozenMs >= 200000
      && w.verdict.includes("冻结"));
  check("AC-1b wrap: 冻结段合并为单段(帧 312 恒定, 心跳不切段)",
    w.stalls.some((s) => s.frame === 312 && s.durMs >= 200000));
  check("AC-1b wrap: 判活谱首小时有帧变化",
    w.hourlyChanges.length >= 1 && w.hourlyChanges[0].changes > 0);

  const plain = run(["frames", FX("fixture-run-freeze.log"), "--json"]);
  check("AC-1b 无回绕日志不受影响",
    plain.frameWrap.detected === false && plain.frameWrap.realMaxFrame === 831);
}

// ---------- AC-9 env ----------
{
  const early = run(["env", FX("fixture-env-early-death.log"), "--json"]);
  check("AC-9 env: RHI 早死日志从 CSV 元数据回退提取命令行(无 LogInit 行)",
    early.source === 'csv-metadata' && early.commandLine.includes('-GraphicsAdapter=6'));
  check("AC-9 env: 参数与开关解析(-Key=V / 裸 Key=V / Flag)",
    early.params.GraphicsAdapter === '6' && early.params.TaskId === 'fc721239-c9c1-54db-44a9-340c1667994c'
      && early.params.ResX === '200' && early.flags.includes('RenderOffScreen'));
  check("AC-9 env: CSV 元数据字段提取",
    early.metadata.engineversion.includes('5.5') && early.metadata.cpu.includes('XEON'));

  const normal = run(["env", FX("fixture-env-normal.log"), "--json"]);
  check("AC-9 env: 正常日志从 LogInit 行提取",
    normal.source === 'loginit' && normal.params.GraphicsAdapter === '2'
      && normal.params.ABSLOG.includes('a.log'));
}

// ---------- AC-10 inventory ----------
{
  const inv = run(["inventory", FX("crash-loop"), "--json"]);
  check("AC-10 inventory: 聚出 1 个崩溃循环簇(5 文件, 6s 间隔, 选卡失败)",
    inv.totalFiles === 7 && inv.clusters.length === 1 && inv.clusterFileCount === 5
      && Math.abs(inv.clusters[0].medianIntervalMs - 6000) < 50
      && inv.clusters[0].endState === 'rhi-adapter-fail'
      && inv.clusters[0].deathReason.includes('HandleUnsupportedRHI')
      && inv.clusters[0].graphicsAdapter === '6');
  check("AC-10 inventory: 非循环文件单列且终态/参数正确",
    inv.others.length === 2
      && inv.others.some((o) => o.name.endsWith('14-13-00.log') && o.endState === 'abrupt-heartbeat' && o.graphicsAdapter === '2')
      && inv.others.some((o) => o.name.endsWith('14-13-00_2.log') && o.endState === 'clean-exit' && o.graphicsAdapter === '3'));
}

// ---------- AC-11 struggle 挣扎段 ----------
{
  const s = run(["frames", FX("fixture-struggle-freeze.log"), "--json"]);
  check("AC-11 struggle: 检出冻结前挣扎段(低fps, >=5s, 紧邻冻结)",
    s.struggleSegments.length === 1 && s.struggleSegments[0].durMs >= 5000
      && s.verdict.includes("挣扎"));
  const w = run(["frames", FX("fixture-wrap-freeze.log"), "--json"]);
  check("AC-11 struggle: 无挣扎段日志不误报",
    w.struggleSegments.length === 0);
  const idle = run(["frames", FX("fixture-run-freeze.log"), "--json"]);
  check("AC-11 struggle: 存活日志不误报",
    idle.struggleSegments.length === 0);
}

// ---------- AC-13 validate-patterns ----------
{
  const code = (args) => {
    try {
      execFileSync("node", [join(SKILL_DIR, "scripts", "validate-patterns.mjs"), ...args], { stdio: "pipe" });
      return 0;
    } catch (e) { return e.status; }
  };
  check("AC-13 patterns 真实库校验全绿 exit 0",
    code([FX(".")]).toString() === "0" || code([]) === 0 || code([join(SKILL_DIR, "patterns")]) === 0);
  check("AC-13 坏 fixture 检出违规 exit 1",
    code([FX("patterns-bad")]) === 1);
}

// ---------- AC-14 errors --kb ----------
{
  const kb = run(["errors", FX("fixture-stall.log"), "--json", "--kb", join(SKILL_DIR, "patterns")]);
  check("AC-14 kb: ensure 连锁两形态都命中 ensure-chain-missing-package(签名+别名)",
    kb.kb.hits >= 2
      && kb.rows.some((r) => r.pattern === 'ensure-chain-missing-package' && r.sample.includes("IsInGameThread"))
      && kb.rows.some((r) => r.pattern === 'ensure-chain-missing-package' && r.sample.includes("Couldn't find file")));
  const noKb = run(["errors", FX("fixture-stall.log"), "--json"]);
  check("AC-14 kb: 不传 --kb 时输出不带 kb 字段且行无 pattern",
    noKb.kb === null && noKb.rows.every((r) => r.pattern === undefined || r.pattern === null));
  const md = execFileSync("node",
    [SCRIPT, "errors", FX("fixture-stall.log"), "--kb", join(SKILL_DIR, "patterns")], { encoding: "utf8" });
  check("AC-14 kb: markdown 表含模式列与入库提示",
    md.includes("| 次数 | 模式 |") && md.includes("候选入库"));
}

// ---------- AC-12 diff ----------
{
  const d = run(["diff", FX("fixture-stall.log"), FX("fixture-run-freeze.log"), "--json"]);
  check("AC-12 diff: 判活分岔识别冻结侧(A=帧0卡死, B=存活)",
    d.deathSide === 'A' && d.a.alive === false && d.b.alive === true);
  check("AC-12 diff: 冻结侧独有错误挂 deathCandidate",
    d.aOnly.length > 0 && d.aOnly.every((r) => r.deathCandidate === true));
  const same = run(["diff", FX("fixture-stall.log"), FX("fixture-stall.log"), "--json"]);
  check("AC-12 diff: 相同日志两侧独有为空、共享非空",
    same.aOnly.length === 0 && same.bOnly.length === 0 && same.shared.length > 0
      && same.deathSide === null);
}

// ---------- AC-15 log.Timestamp 非日期形态 ----------
{
  const since = run(["frames", FX("fixture-timestamp-sincestart.log"), "--json"]);
  check("AC-15 SinceStart 形态: 帧判活与冻结段正常(冻结 69s)",
    since.parsedLines === 8 && since.alive === false
      && since.stalls.some((x) => x.frame === 30 && x.durMs >= 60000));
  const tc = run(["frames", FX("fixture-timestamp-timecode.log"), "--json"]);
  check("AC-15 Timecode 形态: 帧判活正常",
    tc.parsedLines === 4 && tc.alive === true && tc.maxFrame === 36);
  const none = run(["frames", FX("fixture-timestamp-none.log"), "--json"]);
  check("AC-15 None 形态: 零前缀给出明确提示而非误判'从未出帧'",
    none.parsedLines === 0 && none.verdict.includes("log.Timestamp"));
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
