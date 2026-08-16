#!/usr/bin/env node
// scan-pairs.mjs — Jenkins 构建预扫描：拉取所有构建，寻找相邻 FAILURE→SUCCESS 对
//
// 用法: node scan-pairs.mjs [--config <config.json>] [--output <pending-pairs.json>] [--window N]
// 缺省输出 = trackFile 同目录下的 pending-pairs.json（所有运行时产物都在配置指定的
// 知识库目录内，技能目录本身保持零写入）；trackFile/output 均支持 ~/ 前缀。
// --window N: 只取每个任务最新 N 个构建（旧行为逃生门）；缺省全量分页拉取完整历史。
// 配置加载与校验见 config.mjs（技能默认 ⊕ 环境层深合并）。
//
// 配对逻辑: FAILURE 与 SUCCESS 必须相邻（仅忽略 ABORTED/NOT_BUILT）。
// 连续 FAILURE 后跟一个 SUCCESS = 一组。不允许跨 FAILURE 配对。
//
// 账本语义: scan 对账本只做一件事——自愈旧版预写的 failure:no-fix-found（其组
// 如今已有 SUCCESS 修复时删键回炉，healed_no_fix{} 记录一次性自愈，防止分析结论
// 为 no-fix 时无限重开）。除此之外 scan 不写任何占位键（success:w=? / skip:ABORTED
// 等历史遗留写法已废除——全量历史下会灌入数千个弱语义键；账本只承载 session 落的
// 真实分析结论）。BUILDING（result null）不落账，下轮重扫重判；尾部失败组不预写
// no-fix-found——"还没等到修复"是瞬态负结果，修复到来后下轮自然配对。
//
// 退出码: 0 成功（含部分任务不可达的 WARN）/ 1 全部启用任务不可达（不写
// pending-pairs.json——Jenkins 挂了不等于没有新失败，编排器会报告并停止）/ 2 参数错

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { readJsonOrDie, expandHome, loadConfig, writeJsonAtomicCRLF, localTimestamp } from "./config.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));

// ---- CLI 参数 ----
function parseArgs(argv) {
  const args = {
    config: join(scriptDir, "..", "config.json"),
    output: null, // 缺省 = trackFile 同目录下的 pending-pairs.json（保持技能目录零写入）
    window: null, // 缺省全量历史；--window N 只取最新 N 个（旧行为逃生门）
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config") args.config = argv[++i];
    else if (argv[i] === "--output") args.output = argv[++i];
    else if (argv[i] === "--window") {
      args.window = Number.parseInt(argv[++i], 10);
      if (!Number.isInteger(args.window) || args.window <= 0) {
        console.error(`--window 需要正整数，收到: ${argv[i]}`);
        process.exit(2);
      }
    } else {
      console.error(`未知参数: ${argv[i]}`);
      process.exit(2);
    }
  }
  return args;
}

const PAGE_SIZE = 500;

// Jenkins allBuilds 按最新在前排列；tree range {from,to} 是 subList 式闭开切片
// （2026-08-16 实测：{500,500} 返回空集而非第 2 页，{500,1000} 才是第 2 页；
// from>to 返回 HTML 错误页）。第 k 页（0 起）= {k*PAGE_SIZE, (k+1)*PAGE_SIZE}，
// 返回条数 < PAGE_SIZE 即到底。
async function fetchBuildPage(baseUrl, jobPath, k) {
  const from = k * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const url = `${baseUrl}/${jobPath}/api/json?tree=allBuilds[number,result,timestamp,duration]{${from},${to}}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data.allBuilds || [];
}

async function fetchBuilds(baseUrl, jobPath, windowLimit) {
  const all = [];
  for (let k = 0; ; k++) {
    const page = await fetchBuildPage(baseUrl, jobPath, k);
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    if (windowLimit && all.length >= windowLimit) break;
  }
  return windowLimit ? all.slice(0, windowLimit) : all; // allBuilds 新→旧，slice(0,N) 保留最新 N 个
}

const { config: configPath, output: outputArg, window: windowLimit } = parseArgs(process.argv.slice(2));

const config = loadConfig(configPath);
const baseUrl = config.jenkins.baseUrl;
const trackFile = expandHome(config.trackFile);
const outputPath = expandHome(outputArg || join(dirname(trackFile), "pending-pairs.json"));
const enabledJobs = config.jobs.filter((j) => j.enabled === true);

// 跟踪文件：不存在则初始化空结构（首次运行）；损坏则优雅报错退出
let track;
if (existsSync(trackFile)) {
  track = readJsonOrDie(trackFile, "analyzed-builds.json（跟踪账本）",
    "从备份恢复或人工修复 JSON 后重试；损坏期间不要继续扫描（会以空账本覆盖历史）。");
} else {
  track = { last_analyzed: {}, analyzed: {}, runHistory: [] };
}

const outDir = dirname(outputPath);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const trackDir = dirname(trackFile);
if (!existsSync(trackDir)) mkdirSync(trackDir, { recursive: true });

const allPairs = [];
let totalBuilds = 0;
let totalFailures = 0;
let totalSuccess = 0;
let totalSkipped = 0;
let jobsUnreachable = 0;

for (const job of enabledJobs) {
  const jobPath = job.path;
  const jobName = job.name;
  console.log(`\n--- Scanning: ${jobName} (${jobPath}) ---`);

  let builds;
  try {
    builds = (await fetchBuilds(baseUrl, jobPath, windowLimit)).sort((a, b) => a.number - b.number);
  } catch (e) {
    jobsUnreachable++;
    console.log(`  WARN: Cannot access ${jobPath}: ${e.message}, skipping`);
    continue;
  }
  if (builds.length === 0) {
    console.log("  (no builds)");
    continue;
  }
  console.log(`  Builds: ${builds.length} (#${builds[0].number} ~ #${builds[builds.length - 1].number})`);

  // Phase 1: 纯统计（不落账——账本只承载 session 写入的真实分析结论）
  for (const build of builds) {
    totalBuilds++;
    if (build.result === "FAILURE") totalFailures++;
    else if (build.result === "SUCCESS") totalSuccess++;
    else if (build.result === "ABORTED" || build.result === "NOT_BUILT") totalSkipped++;
  }

  // Phase 2: 相邻 FAILURE→SUCCESS 配对（忽略 ABORTED 等）
  // 核心逻辑: 连续 FAILURE 组后紧跟 SUCCESS = 一对；入队判定与 session.findPendingPair
  // 严格对称——组内任一构建号未落账即待处理。尾部失败组（后面还没有 SUCCESS）不
  // 预写 no-fix-found，"还没等到修复"是瞬态负结果（确定性结论只由 pair-analyze 写入）。
  const meaningful = builds.filter((b) => b.result === "FAILURE" || b.result === "SUCCESS");
  const groupFullyAnalyzed = (failGroup) =>
    failGroup.every((fb) => `${jobPath}#${fb}` in track.analyzed);

  let i = 0;
  while (i < meaningful.length) {
    const current = meaningful[i];

    if (current.result === "FAILURE") {
      const failGroup = [current.number];
      let j = i + 1;
      while (j < meaningful.length && meaningful[j].result === "FAILURE") {
        failGroup.push(meaningful[j].number);
        j++;
      }

      if (j < meaningful.length && meaningful[j].result === "SUCCESS") {
        const fixBuild = meaningful[j].number;
        const firstKey = `${jobPath}#${failGroup[0]}`;
        const firstVal = track.analyzed[firstKey];
        if (groupFullyAnalyzed(failGroup) && firstVal !== "failure:no-fix-found") {
          // 组内全部落账且有真实终态（score/infra/skip/...）→ 已处理过，不重复入队
        } else if (firstVal === "failure:no-fix-found" && track.healed_no_fix?.[firstKey]) {
          // 已自愈过又回到 no-fix（= pair-analyze 的合法分析结论）→ 尊重结论，不重开
        } else {
          if (firstVal === "failure:no-fix-found") {
            // 旧版 scan 曾把"扫描时还没等到修复"的组预写成 no-fix-found（瞬态终身化）。
            // 该值如今只可能来自旧账本：首次遇到按瞬态自愈回炉（删组内全部 no-fix 键，
            // healed_no_fix 记录一次性自愈防无限重开）。
            track.healed_no_fix = track.healed_no_fix || {};
            let healed = 0;
            for (const fb of failGroup) {
              const k = `${jobPath}#${fb}`;
              if (track.analyzed[k] === "failure:no-fix-found") {
                delete track.analyzed[k];
                track.healed_no_fix[k] = true;
                healed++;
              }
            }
            if (healed > 0) {
              console.log(`  HEAL: ${jobName} 组 [${failGroup.join(",")}] 自愈 ${healed} 个旧版预写的 no-fix-found 键，重新入队`);
            }
          }
          allPairs.push({ jobName, jobPath, failBuilds: failGroup, fixBuild, hasFix: true });
        }
      }
      i = j;
    } else {
      i++;
    }
  }

  const jobPairCount = allPairs.filter((p) => p.jobPath === jobPath).length;
  console.log(`  FAILURE->SUCCESS pairs: ${jobPairCount}`);
}

// 全部启用任务不可达 = Jenkins 故障，不是"没有新失败"：
// 不写 pending-pairs.json，exit 1 让编排器报告并停止（phase0 的停止守卫）
if (enabledJobs.length > 0 && jobsUnreachable === enabledJobs.length) {
  console.error(`\nERROR: 全部 ${enabledJobs.length} 个启用任务都无法访问 Jenkins（${baseUrl}）。`);
  console.error("这不是\"没有新失败\"——是 Jenkins 不可达。不生成 pending-pairs.json，请检查网络/Jenkins 后重试。");
  process.exit(1);
}

// 输出 pending-pairs.json 与跟踪文件（原子写：崩溃时读者只见完整旧文件或新文件）
writeJsonAtomicCRLF(outputPath, {
  generatedAt: localTimestamp(),
  totalBuilds,
  totalFailures,
  totalPairs: allPairs.length,
  pairs: allPairs,
});
console.log("\n=== DONE ===");
console.log(`Pairs file: ${outputPath}`);
console.log(`Total builds: ${totalBuilds} | FAILURE: ${totalFailures} | Adjacent pairs: ${allPairs.length}`);
if (jobsUnreachable > 0) {
  console.log(`WARNING: ${jobsUnreachable}/${enabledJobs.length} 个任务不可达（本次扫描结果不完整）`);
}

writeJsonAtomicCRLF(trackFile, track);
console.log("Tracking updated");
