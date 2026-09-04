#!/usr/bin/env node
// preflight.mjs — 只读核验：判断一个独立 clone 能否安全转换为当前仓库的 worktree
// 全程零写入、零网络副作用（ls-remote 是只读查询）；结果以 JSON 打印，退出码 0=可转 / 1=不可转。
// 用法: node preflight.mjs --target <clone路径> [--main <主仓路径，缺省=当前目录所在仓]
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { git, gitOk, parseArgs, samePath, toPosix } from "./lib/core.mjs";

/** 归一化 remote URL 便于比较：去尾斜杠、去尾 .git、Windows 盘符路径大小写不敏感 */
function normalizeUrl(u) {
  let s = u.trim().replace(/\/+$/, "");
  if (s.endsWith(".git")) s = s.slice(0, -4);
  return s.toLowerCase();
}

export function runPreflight(targetArg, mainArg) {
  const checks = [];
  const add = (id, status, code, detail) => checks.push({ id, status, code: code ?? null, detail: detail ?? "" });
  const fail = (id, code, detail) => add(id, "fail", code, detail);

  const out = {
    ok: false,
    target: null,
    mainRepo: null,
    branch: null,
    headSha: null,
    originUrl: null,
    remoteTruth: null,
    submodules: [],
    uniqueRefNamespaces: [],
    missingTags: [],
    warnings: [],
    checks,
  };

  // --- 定位两个仓库 ---
  if (!targetArg) { fail("target", "E_NO_TARGET", "缺少 --target"); return out; }
  const target = path.resolve(targetArg);
  out.target = target;
  if (!existsSync(target)) { fail("target", "E_TARGET_NOT_FOUND", target); return out; }

  const gitPath = path.join(target, ".git");
  if (existsSync(gitPath) && statSync(gitPath).isFile()) {
    fail("target", "E_TARGET_IS_WORKTREE", "目标已经是 worktree（.git 是文件），无需转换");
    return out;
  }
  if (!existsSync(gitPath)) { fail("target", "E_TARGET_NOT_REPO", "目标不是 git 仓库（没有 .git）"); return out; }

  const mainRepoRaw = mainArg || process.cwd();
  const mainRes = gitOk(mainRepoRaw, ["rev-parse", "--show-toplevel"]);
  if (!mainRes.ok) { fail("main", "E_MAIN_NOT_REPO", `${mainRepoRaw} 不在 git 仓库内`); return out; }
  const mainRepo = path.resolve(mainRes.out.trim());
  out.mainRepo = mainRepo;
  if (samePath(mainRepo, target)) { fail("main", "E_SAME_REPO", "--target 与主仓是同一路径"); return out; }
  add("main", "pass", null, mainRepo);

  const targetInsideMain = toPosix(target).toLowerCase().startsWith(toPosix(mainRepo).toLowerCase() + "/");
  const mainInsideTarget = toPosix(mainRepo).toLowerCase().startsWith(toPosix(target).toLowerCase() + "/");
  if (targetInsideMain || mainInsideTarget) {
    fail("paths", "E_PATH_NESTED", "两个目录互相嵌套，不能构成主仓/独立 clone 关系");
    return out;
  }

  // --- 同源校验 ---
  const tOrigin = gitOk(target, ["remote", "get-url", "origin"]);
  const mOrigin = gitOk(mainRepo, ["remote", "get-url", "origin"]);
  if (!tOrigin.ok || !mOrigin.ok) {
    fail("origin", "E_NO_ORIGIN", "任一侧缺少 origin remote，无法证明同源");
    return out;
  }
  out.originUrl = tOrigin.out.trim();
  if (normalizeUrl(tOrigin.out) !== normalizeUrl(mOrigin.out)) {
    fail("origin", "E_ORIGIN_MISMATCH", `target origin=${tOrigin.out.trim()} ≠ main origin=${mOrigin.out.trim()}`);
    return out;
  }
  add("origin", "pass", null, out.originUrl);

  // --- 干净 / stash / 分支 ---
  const dirty = git(target, ["status", "--porcelain"]);
  if (dirty.trim() !== "") {
    fail("clean", "E_DIRTY", "工作区有未提交改动或未跟踪文件：\n" + dirty.trim().split("\n").slice(0, 10).join("\n"));
    return out;
  }
  add("clean", "pass");

  if (git(target, ["stash", "list"]).trim() !== "") {
    fail("stash", "E_STASH", "存在 stash，先处理（apply/drop）再转换");
    return out;
  }
  add("stash", "pass");

  const symRef = gitOk(target, ["symbolic-ref", "--quiet", "HEAD"]);
  if (!symRef.ok) { fail("branch", "E_DETACHED", "HEAD 处于 detached 状态，先检出分支"); return out; }
  const branch = symRef.out.trim().replace(/^refs\/heads\//, "");
  out.branch = branch;
  const headSha = git(target, ["rev-parse", "HEAD"]).trim();
  out.headSha = headSha;
  add("branch", "pass", null, `${branch} @ ${headSha.slice(0, 10)}`);

  // --- 与远端同步 ---
  const upstream = gitOk(target, ["rev-parse", "--verify", "--quiet", "@{u}"]);
  if (!upstream.ok) { fail("sync", "E_NO_UPSTREAM", `分支 ${branch} 没有上游，先 push 建立跟踪`); return out; }
  const lsRemote = gitOk(target, ["ls-remote", "origin", `refs/heads/${branch}`]);
  let truth = null;
  if (lsRemote.ok && lsRemote.out.trim() !== "") {
    truth = lsRemote.out.trim().split("\t")[0];
  } else {
    const tracking = gitOk(target, ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${branch}`]);
    if (!tracking.ok) { fail("sync", "E_NO_REMOTE_BRANCH", `远端没有 refs/heads/${branch}，先 push`); return out; }
    truth = tracking.out.trim();
    out.warnings.push("W_LSREMOTE_FALLBACK：ls-remote 不可用，改用本地 remote-tracking ref 判断同步，可能过期");
  }
  out.remoteTruth = truth;
  if (headSha !== truth) {
    const ahead = git(target, ["rev-list", "--count", `refs/remotes/origin/${branch}..HEAD`]).trim();
    fail("sync", "E_NOT_SYNCED",
      ahead !== "0"
        ? `本地领先远端 ${ahead} 个未推送 commit，先 push`
        : "本地落后远端，先 pull 到一致");
    return out;
  }
  add("sync", "pass", null, `HEAD == refs/heads/${branch}（远端）`);

  // --- target 自己没有别的 worktree ---
  const tWt = git(target, ["worktree", "list", "--porcelain"]).trim().split(/\r?\n\r?\n/);
  if (tWt.filter((e) => e.trim()).length > 1) {
    fail("victim-worktrees", "E_HAS_WORKTREAS", "target 仓自带其他 worktree，先在其中 git worktree remove");
    return out;
  }
  add("victim-worktrees", "pass");

  // --- 分支占用冲突（主仓及其 worktree） ---
  const mainWt = git(mainRepo, ["worktree", "list", "--porcelain"]);
  const entries = mainWt.trim().split(/\r?\n\r?\n/).map((e) => {
    const m = e.match(/branch refs\/heads\/(.+)/);
    return { path: ((e.match(/^worktree (.+)$/m) || [])[1] || "").trim(), branch: m ? m[1].trim() : null };
  });
  const heldBy = entries.find((e) => e.branch === branch);
  if (heldBy) {
    fail("branch-hold", "E_BRANCH_CHECKED_OUT", `分支 ${branch} 已在 ${heldBy.path} 检出；同一分支不能同时检出在两个 worktree`);
    return out;
  }
  const localBranch = gitOk(mainRepo, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
  out.reuseLocalBranch = localBranch.ok;
  if (localBranch.ok) {
    const localSha = git(mainRepo, ["rev-parse", `refs/heads/${branch}`]).trim();
    if (localSha !== truth) {
      fail("branch-hold", "E_BRANCH_CONFLICT",
        `主仓本地分支 ${branch}(${localSha.slice(0, 10)}) 与远端(${truth.slice(0, 10)}) 不一致，先对齐`);
      return out;
    }
    add("branch-hold", "pass", null, `复用主仓已有本地分支 ${branch}`);
  } else {
    add("branch-hold", "pass", null, `将从 refs/remotes/origin/${branch} 新建本地分支 ${branch}`);
  }

  // --- 独有 refs（不在 heads/remotes/tags 命名空间的，如 refs/t3/*）与缺失 tag ---
  const tRefs = git(target, ["for-each-ref", "--format=%(refname)"]).trim().split("\n").filter(Boolean);
  const mRefs = new Set(git(mainRepo, ["for-each-ref", "--format=%(refname)"]).trim().split("\n").filter(Boolean));
  const namespaces = new Set();
  for (const r of tRefs) {
    const m = r.match(/^refs\/(heads|remotes|tags)\/(.+)$/);
    if (m) {
      if (m[1] === "tags" && !mRefs.has(r)) out.missingTags.push(r);
      continue;
    }
    // refs/<ns>/... 其他命名空间：按二级命名空间整组搬运
    const ns = r.split("/")[1];
    if (ns) namespaces.add(ns);
  }
  out.uniqueRefNamespaces = [...namespaces].sort();
  if (out.uniqueRefNamespaces.length || out.missingTags.length) {
    add("unique-refs", "warn", null,
      `将搬运独有 refs：${out.uniqueRefNamespaces.map((n) => `refs/${n}/*`).join(" ")}${out.missingTags.length ? ` 及 ${out.missingTags.length} 个缺失 tag` : ""}`);
  } else {
    add("unique-refs", "pass", null, "无独有 refs");
  }

  // --- submodule 清单 ---
  const mods = gitOk(target, ["config", "--file", ".gitmodules", "--get-regexp", "^submodule\\..*\\.path$"]);
  if (mods.ok) {
    for (const line of mods.out.trim().split("\n").filter(Boolean)) {
      const subPath = line.split(" ").pop();
      const initialized = existsSync(path.join(target, subPath, ".git"));
      out.submodules.push({ path: subPath, initialized });
    }
  }
  add("submodules", out.submodules.length ? "warn" : "pass", null,
    out.submodules.length
      ? out.submodules.map((s) => `${s.path}${s.initialized ? "" : "(未初始化)"}`).join(" ")
      : "无 submodule");

  // --- 汇总 ---
  const blocking = checks.filter((c) => c.status === "fail");
  out.ok = blocking.length === 0;
  return out;
}

// ---- CLI（仅在作为主模块执行时运行；被 convert.mjs import 时不触发） ----
import { pathToFileURL } from "node:url";
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const args = parseArgs(process.argv.slice(2));
  const result = runPreflight(args.target, args.main);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
