#!/usr/bin/env node
// scan-pairs.mjs — Jenkins 构建预扫描：拉取所有构建，寻找相邻 FAILURE→SUCCESS 对
//
// 用法: node scan-pairs.mjs [--config <config.json>] [--output <pending-pairs.json>]
// 缺省输出 = trackFile 同目录下的 pending-pairs.json（所有运行时产物都在配置指定的
// 知识库目录内，技能目录本身保持零写入）；trackFile/output 均支持 ~/ 前缀。
// 配置加载与校验见 config.mjs（技能默认 ⊕ 环境层深合并）。
//
// 配对逻辑: FAILURE 与 SUCCESS 必须相邻（仅忽略 ABORTED/NOT_BUILT）。
// 连续 FAILURE 后跟一个 SUCCESS = 一组。不允许跨 FAILURE 配对。
//
// 瞬态语义（定时持续积累的关键约束——只持久化事实，不持久化对未来的判断）:
//   - BUILDING（result 为 null，Jenkins 进行中语义）不落账，下轮重扫重判；
//   - 尾部失败组（后面还没有 SUCCESS）不预写 no-fix-found——"还没等到修复"是瞬态
//     负结果，等修复到来后下轮扫描自然配对（no-fix-found 只由 pair-analyze 的
//     十构建前瞻结论写入）；
//   - 自愈旧版账本: 旧版 scan 预写过的 skip:BUILDING 删除重判；旧版预写的
//     failure:no-fix-found 若其组如今已有 SUCCESS 修复，删键回炉入队（账本
//     healed_no_fix{} 记录一次性自愈，防止分析结论为 no-fix 时无限重开）。
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
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config") args.config = argv[++i];
    else if (argv[i] === "--output") args.output = argv[++i];
    else {
      console.error(`未知参数: ${argv[i]}`);
      process.exit(2);
    }
  }
  return args;
}

async function fetchBuilds(baseUrl, jobPath) {
  const url = `${baseUrl}/${jobPath}/api/json?tree=allBuilds[number,result,timestamp,duration]{0,500}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data.allBuilds || [];
}

const { config: configPath, output: outputArg } = parseArgs(process.argv.slice(2));

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
    builds = (await fetchBuilds(baseUrl, jobPath)).sort((a, b) => a.number - b.number);
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

  // Phase 1: 记录终态事实（SUCCESS/ABORTED/NOT_BUILT；已分析的跳过）
  for (const build of builds) {
    const key = `${jobPath}#${build.number}`;
    totalBuilds++;
    // 自愈旧版冻结的 skip:BUILDING（该值只有旧版 scan 会写）：删后按当前真实结果重判
    if (track.analyzed[key] === "skip:BUILDING") delete track.analyzed[key];
    if (key in track.analyzed) continue;

    let result = build.result;
    if (result === null || result === undefined) result = "BUILDING";

    if (result === "SUCCESS") {
      track.analyzed[key] = "success:w=?";
      totalSuccess++;
    } else if (result === "ABORTED" || result === "NOT_BUILT") {
      track.analyzed[key] = `skip:${result}`;
      totalSkipped++;
    } else if (result === "FAILURE") {
      totalFailures++;
    }
    // BUILDING = Jenkins 进行中语义：瞬态不落账，下轮重扫重判
  }

  // Phase 2: 相邻 FAILURE→SUCCESS 配对（忽略 ABORTED 等）
  // 核心逻辑: 连续 FAILURE 组后紧跟 SUCCESS = 一对；尾部失败组（后面还没有
  // SUCCESS）不预写 no-fix-found——"还没等到修复"是瞬态负结果，修复到来后
  // 下轮扫描自然配对（确定性结论只由 pair-analyze 写入）
  const meaningful = builds.filter((b) => b.result === "FAILURE" || b.result === "SUCCESS");

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
        if (firstVal === undefined) {
          allPairs.push({ jobName, jobPath, failBuilds: failGroup, fixBuild, hasFix: true });
        } else if (firstVal === "failure:no-fix-found") {
          // 旧版 scan 曾把"扫描时还没等到修复"的组预写成 no-fix-found（瞬态终身化）。
          // 该值如今只可能来自旧账本或 pair-analyze 的合法结论：首次遇到按瞬态自愈
          // 回炉；已自愈过又回到 no-fix（= 分析结论）则尊重结论，不再入队防无限重开。
          if (!track.healed_no_fix || !track.healed_no_fix[firstKey]) {
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
              allPairs.push({ jobName, jobPath, failBuilds: failGroup, fixBuild, hasFix: true });
            }
          }
        }
        // 其余：firstKey 已有真实终态（score/infra/skip/...），组已处理过，不重复入队
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
