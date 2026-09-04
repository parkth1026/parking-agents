#!/usr/bin/env node
// convert.mjs — 把同 remote 的独立 clone 原地转换成当前仓库的 worktree
// 缺省 dry-run（只打印计划不改任何东西）；--apply 才执行。
// 策略（单一 in-place 路径，不做 rename-aside）：
//   1 搬运独有 refs → 2 暂存 ignored 资产与 submodule → 3 .git 挪到备份 →
//   4 清空目录（保留被 CWD 锁住的顶层目录壳）→ 5 worktree add 检出到空目录 →
//   6 资产搬回 → 7 submodule gitdir 手术 → 8 验证 → 9 清理备份
//   phase 1-4 失败自动回滚；phase 5 起失败保留全部现场并输出状态报告。
// 用法: node convert.mjs --target <clone路径> [--main <主仓路径>] [--apply] [--keep-backup] [--staging <目录>]
import { existsSync, readdirSync, renameSync, rmdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { git, gitOk, moveSync, overwriteFile, parseArgs, rmTree, dirIsEmpty, samePath, toPosix } from "./lib/core.mjs";
import { runPreflight } from "./preflight.mjs";
import { runInventory } from "./inventory.mjs";

function convert(args) {
  const pre = runPreflight(args.target, args.main);
  if (!pre.ok) {
    return { ok: false, stage: "preflight", preflight: pre, error: "preflight 未通过，拒绝转换" };
  }
  const target = pre.target;
  const mainRepo = pre.mainRepo;
  const branch = pre.branch;
  const inv = runInventory(target);
  const staging = args.staging ? path.resolve(String(args.staging)) : target + "__staging";
  const backup = target + ".bak.git";
  const startPoint = pre.reuseLocalBranch ? branch : `refs/remotes/origin/${branch}`;

  const plan = {
    ok: true,
    dryRun: args.apply !== true,
    target,
    mainRepo,
    branch,
    startPoint,
    staging,
    backup,
    artifacts: inv.all,
    submodules: inv.submodules,
    refsPreserved: { namespaces: pre.uniqueRefNamespaces.map((n) => `refs/${n}/*`), tags: pre.missingTags },
    notes: [
      "dry-run：加 --apply 执行。执行时 ignored 资产与 submodule 先进暂存区，旧 .git 备份为 " + backup + "，验证通过后自动删除（--keep-backup 保留）。",
    ],
  };

  if (args.apply !== true) return plan;

  // ---------- 执行 ----------
  let phase = "refs";
  const done = { refsFetched: [], submodulesFixed: [], submodulesSkipped: [] };
  try {
    // phase 1: 搬运独有 refs；确保主仓远端跟踪 ref 与远端真值一致（离线，从 target 取）
    // 独有 refs 用 + 强制：命名空间内部（如 t3 的 session id）本身隔离，
    // 同名 ref 出现说明同一 session 在该 clone 里又推进过，后写覆盖是对的
    for (const ns of pre.uniqueRefNamespaces) {
      git(mainRepo, ["fetch", target, `+refs/${ns}/*:refs/${ns}/*`]);
      done.refsFetched.push(`refs/${ns}/*`);
    }
    for (const tagRef of pre.missingTags) {
      git(mainRepo, ["fetch", target, `${tagRef}:${tagRef}`]);
      done.refsFetched.push(tagRef);
    }
    const tracking = `refs/remotes/origin/${branch}`;
    const haveTracking = gitOk(mainRepo, ["rev-parse", "--verify", "--quiet", tracking]);
    if (!haveTracking.ok || haveTracking.out.trim() !== pre.remoteTruth) {
      git(mainRepo, ["fetch", target, `+refs/heads/${branch}:${tracking}`]);
    }

    // phase 2: 暂存资产
    phase = "stage";
    if (existsSync(staging) && !dirIsEmpty(staging)) {
      throw new Error(`暂存目录已存在且非空：${staging}`);
    }
    for (const rel of inv.all) moveSync(path.join(target, rel), path.join(staging, rel));

    // phase 3: 旧 .git 挪到备份（这是安全网；验证通过才删）
    phase = "backup-git";
    if (existsSync(backup)) throw new Error(`备份已存在：${backup}（先处理上次残留）`);
    renameSync(path.join(target, ".git"), backup);

    // phase 4: 清空剩余（全是已跟踪文件，与远端冗余）；顶层目录壳保留——被进程当 CWD 锁住也能删内容
    phase = "clear";
    for (const entry of readdirSync(target)) rmTree(path.join(target, entry));

    // phase 5: 检出到既有空目录（git 接受空目录；路径不变 → 绝对路径指纹的构建缓存继续有效）
    phase = "worktree-add";
    if (pre.reuseLocalBranch) git(mainRepo, ["worktree", "add", target, branch]);
    else git(mainRepo, ["worktree", "add", "-b", branch, target, startPoint]);

    // phase 6: 资产搬回
    phase = "restore";
    for (const rel of inv.all) {
      const dst = path.join(target, rel);
      if (existsSync(dst)) {
        if (statSync(dst).isDirectory() && dirIsEmpty(dst)) {
          rmdirSync(dst); // 检出会给未初始化 submodule 留一个空目录
        } else {
          throw new Error(`检出在 ${dst} 生成了意外内容，拒绝覆盖；请人工检查`);
        }
      }
      moveSync(path.join(staging, rel), dst);
    }

    // phase 7: submodule gitdir 手术（gitfile 型）
    phase = "submodule";
    for (const subPath of inv.submodules) {
      const gitFile = path.join(target, subPath, ".git");
      if (!existsSync(gitFile) || !statSync(gitFile).isFile()) {
        done.submodulesSkipped.push(`${subPath}：无 gitfile（未初始化或内嵌 .git，自包含无需手术）`);
        continue;
      }
      const expected = git(target, ["rev-parse", "--git-path", `modules/${subPath}`]).trim();
      const expectedAbs = path.isAbsolute(expected) ? expected : path.resolve(target, expected);
      const src = path.join(backup, "modules", subPath);
      if (existsSync(src)) {
        if (existsSync(expectedAbs)) {
          throw new Error(`submodule gitdir 已存在 ${expectedAbs}，疑似与主仓共用 modules，中止手术`);
        }
        moveSync(src, expectedAbs);
      } else if (!existsSync(expectedAbs)) {
        done.submodulesSkipped.push(`${subPath}：备份与新位置都没有 modules 数据，保持未初始化`);
        continue;
      }
      overwriteFile(gitFile, `gitdir: ${toPosix(expectedAbs)}\n`);
      // core.worktree 直接改文件：经 git config 会因旧的相对路径 chdir 失败
      const cfgPath = path.join(expectedAbs, "config");
      let cfg = readFileSync(cfgPath, "utf8");
      const wtLine = `\tworktree = ${toPosix(path.resolve(target, subPath))}`;
      if (/^\tworktree = .*$/m.test(cfg)) cfg = cfg.replace(/^\tworktree = .*$/m, wtLine);
      else cfg = cfg.replace(/^\[core\]$/m, `[core]\n${wtLine}`);
      overwriteFile(cfgPath, cfg);
      const backPtr = path.join(expectedAbs, "gitdir");
      if (existsSync(backPtr)) overwriteFile(backPtr, toPosix(gitFile) + "\n");
      // worktree 共用主仓 config，而 clone 不会把本地 submodule 配置带过来：
      // 不 init 的话 submodule status 判为未初始化（前缀 '-'）
      const r = gitOk(target, ["submodule", "init", subPath]);
      if (!r.ok) throw new Error(`submodule init 失败：${r.err.message.split("\n")[0]}`);
      done.submodulesFixed.push(subPath);
    }

    // phase 8: 验证
    phase = "verify";
    const wl = git(mainRepo, ["worktree", "list", "--porcelain"]);
    const me = wl.trim().split(/\r?\n\r?\n/).find((e) => {
      const p = (e.match(/^worktree (.+)$/m) || [])[1];
      return p && samePath(p, target);
    });
    if (!me || !me.includes(`branch refs/heads/${branch}`)) {
      throw new Error(`worktree 注册异常：\n${wl.trim()}`);
    }
    const st = git(target, ["status", "--porcelain"]);
    if (st.trim() !== "") throw new Error(`转换后工作区不干净：\n${st.trim().split("\n").slice(0, 5).join("\n")}`);
    const head = git(target, ["rev-parse", "HEAD"]).trim();
    if (head !== pre.headSha) throw new Error(`HEAD 漂移：${head} != ${pre.headSha}`);
    for (const rel of inv.all) {
      if (!existsSync(path.join(target, rel))) throw new Error(`资产未回到位：${rel}`);
    }
    for (const subPath of inv.submodules) {
      if (!existsSync(path.join(target, subPath, ".git"))) continue;
      // 前缀空格 = 停在记录的 commit；不能用 trim()，会把判定字符剪掉
      const ss = git(target, ["submodule", "status", subPath]).trimEnd();
      if (!ss.startsWith(" ")) throw new Error(`submodule 状态异常：${ss}`);
    }

    // phase 9: 清理
    phase = "cleanup";
    const backupDeleted = args["keep-backup"] !== true;
    if (backupDeleted) rmTree(backup);
    rmTree(staging);

    return {
      ok: true,
      dryRun: false,
      worktree: target,
      branch,
      head: head.slice(0, 10),
      movedArtifacts: inv.all.length,
      ...done,
      backup: backupDeleted ? "已删除" : backup,
    };
  } catch (e) {
    const report = { ok: false, error: e.message, phase };
    if (phase === "refs" || phase === "stage" || phase === "backup-git" || phase === "clear" || phase === "worktree-add") {
      // 回滚：恢复 .git 与资产，回到转换前状态（best-effort，残留会列在报告里）
      const leftovers = [];
      try {
        if (phase === "worktree-add") {
          gitOk(mainRepo, ["worktree", "remove", "--force", target]);
          gitOk(mainRepo, ["worktree", "prune"]);
        }
        if (existsSync(backup) && !existsSync(path.join(target, ".git"))) {
          renameSync(backup, path.join(target, ".git"));
        }
        // clear/worktree-add 阶段失败时 tracked 文件可能已被删了一半；
        // preflight 保证转换前工作区干净，reset --hard 恰好恢复到该状态
        if (existsSync(path.join(target, ".git")) && (phase === "clear" || phase === "worktree-add")) {
          const r = gitOk(target, ["reset", "--hard", "HEAD"]);
          if (!r.ok) leftovers.push(`reset --hard 失败: ${r.err.message.split("\n")[0]}`);
        }
        if (existsSync(staging)) {
          for (const rel of inv.all) {
            if (existsSync(path.join(staging, rel))) {
              try {
                const dst = path.join(target, rel);
                if (existsSync(dst) && statSync(dst).isDirectory() && dirIsEmpty(dst)) rmdirSync(dst);
                moveSync(path.join(staging, rel), dst);
              }
              catch (e2) { leftovers.push(`暂存残留 ${rel}: ${e2.message}`); }
            }
          }
          rmTree(staging);
        }
      } catch (e2) {
        leftovers.push(e2.message);
      }
      report.rolledBack = true;
      report.rollbackLeftovers = leftovers;
    } else {
      // phase restore/submodule/verify/cleanup 失败：现场完整保留，禁止即兴补救
      report.rolledBack = false;
      report.state = {
        worktree: target,
        staging,
        backup,
        movedArtifacts: inv.all,
        submodulesFixed: done.submodulesFixed,
        phaseReached: phase,
        recovery: "见 references/recovery.md 按状态对号入座；不要盲目重跑 --apply",
      };
    }
    return report;
  }
}

const args = parseArgs(process.argv.slice(2));
const result = convert(args);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
