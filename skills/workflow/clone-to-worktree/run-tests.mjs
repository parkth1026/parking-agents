#!/usr/bin/env node
// run-tests.mjs — clone-to-worktree 的回归测试（升级/改动后必跑）
// 用临时 fixture 仓起真实 git（含 submodule、ignored 资产、独有 refs、CWD 锁），黑盒执行三个脚本逐条断言。
// 覆盖 references/design.md 的 AC-1..AC-9。退出码 0=全过 / 1=有失败。
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.join(SKILL_DIR, "scripts");

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ` —— ${detail}` : ""}`); }
}
function norm(p) { return p.replaceAll("\\", "/").toLowerCase(); }
function sameReal(a, b) {
  const r = (x) => { try { return realpathSync.native(x); } catch { return x; } };
  return norm(r(a)) === norm(r(b));
}
function worktreePaths(repo) {
  return gitOut(repo, "worktree", "list", "--porcelain")
    .split(/\r?\n/).filter((l) => l.startsWith("worktree ")).map((l) => l.slice(9).trim());
}

function run(cmd, args, opts = {}) {
  try {
    const stdout = execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
    return { status: 0, stdout, stderr: "" };
  } catch (e) {
    return { status: e.status ?? 1, stdout: (e.stdout || "").toString(), stderr: (e.stderr || "").toString() };
  }
}
function node(script, args) { return run(process.execPath, [path.join(SCRIPTS, script), ...args]); }
function git(cwd, ...a) { return run("git", ["-C", cwd, ...a]); }
function gitOut(cwd, ...a) {
  const r = git(cwd, ...a);
  if (r.status !== 0) throw new Error(`git -C ${cwd} ${a.join(" ")} 失败: ${r.stderr}`);
  return r.stdout.trim();
}
function initRepo(dir) {
  mkdirSync(dir, { recursive: true });
  gitOut(dir, "init", "-b", "main");
  gitOut(dir, "config", "user.email", "test@example.com");
  gitOut(dir, "config", "user.name", "c2w-test");
}

// ---------- fixture ----------
const tmp = mkdtempSync(path.join(os.tmpdir(), "c2w-test-"));
const holders = [];
let origin, mainRepo, subSrc;
try {
  subSrc = path.join(tmp, "subsrc");
  initRepo(subSrc);
  writeFileSync(path.join(subSrc, "lib.cpp"), "int f(){return 1;}\n");
  gitOut(subSrc, "add", "-A");
  gitOut(subSrc, "commit", "-m", "sub base");

  origin = path.join(tmp, "origin");
  initRepo(origin);
  writeFileSync(path.join(origin, ".gitignore"), "target/\n.env\nbuild/\napps/server/data/\n");
  writeFileSync(path.join(origin, "README.md"), "fixture\n");
  mkdirSync(path.join(origin, "apps", "server"), { recursive: true });
  writeFileSync(path.join(origin, "apps", "server", "main.txt"), "server\n");
  mkdirSync(path.join(origin, "apps", "web"), { recursive: true });
  writeFileSync(path.join(origin, "apps", "web", "index.html"), "<html></html>\n");
  gitOut(origin, "add", "-A");
  gitOut(origin, "commit", "-m", "base");
  gitOut(origin, "submodule", "add", subSrc.replaceAll("\\", "/"), "third_party/vcpkg");
  gitOut(origin, "add", "-A");
  gitOut(origin, "commit", "-m", "add submodule");
  gitOut(origin, "switch", "-c", "dev-cli");
  writeFileSync(path.join(origin, "dev-cli.txt"), "dev-cli only\n");
  gitOut(origin, "add", "-A");
  gitOut(origin, "commit", "-m", "dev-cli work");
  // 每个 victim 用独立分支：同一分支不能检出在多个 worktree，主仓检出 victim1 的分支后
  // victim2/victim3 会被 preflight 正确拦截（那是 AC-1 的职责，不是 AC-6/9 想测的）
  gitOut(origin, "branch", "dev-cli-2");
  gitOut(origin, "branch", "dev-cli-3");
  gitOut(origin, "switch", "main");

  mainRepo = path.join(tmp, "main-repo");
  if (run("git", ["clone", origin.replaceAll("\\", "/"), mainRepo]).status !== 0) throw new Error("clone main-repo 失败");

  function makeVictim(name, branch) {
    const v = path.join(tmp, name);
    if (run("git", ["clone", origin.replaceAll("\\", "/"), v]).status !== 0) throw new Error(`clone ${name} 失败`);
    gitOut(v, "switch", branch);
    gitOut(v, "submodule", "update", "--init");
    writeFileSync(path.join(v, ".env"), "PORT=18200\n");
    mkdirSync(path.join(v, "target"), { recursive: true });
    writeFileSync(path.join(v, "target", "big.bin"), "payload");
    mkdirSync(path.join(v, "build"), { recursive: true });
    writeFileSync(path.join(v, "build", "x.txt"), "b\n");
    mkdirSync(path.join(v, "apps", "server", "data"), { recursive: true });
    writeFileSync(path.join(v, "apps", "server", "data", "db.sqlite"), "db");
    const t3sha = gitOut(v, "commit-tree", "HEAD^{tree}", "-m", "t3snapshot");
    gitOut(v, "update-ref", "refs/t3/checkpoints/s1/turn/0", t3sha);
    gitOut(v, "tag", "v-victim");
    return { path: v, headSha: gitOut(v, "rev-parse", "HEAD"), t3sha };
  }

  // ---------- AC-1 preflight ----------
  const v1 = makeVictim("victim1", "dev-cli");
  const pf = node("preflight.mjs", ["--target", v1.path, "--main", mainRepo]);
  const pfJson = JSON.parse(pf.stdout || "{}");
  check("AC-1 preflight 通过干净 clone", pf.status === 0 && pfJson.ok === true && pfJson.branch === "dev-cli", pf.stderr);

  appendFileSync(path.join(v1.path, "apps", "server", "main.txt"), "dirty");
  const pfDirty = node("preflight.mjs", ["--target", v1.path, "--main", mainRepo]);
  check("AC-1 preflight 拒绝脏树 (E_DIRTY)", pfDirty.status === 1 && JSON.parse(pfDirty.stdout).checks.some((c) => c.code === "E_DIRTY"));
  gitOut(v1.path, "checkout", "--", "apps/server/main.txt");

  gitOut(v1.path, "remote", "set-url", "origin", subSrc.replaceAll("\\", "/"));
  const pfOrigin = node("preflight.mjs", ["--target", v1.path, "--main", mainRepo]);
  check("AC-1 preflight 拒绝不同 origin (E_ORIGIN_MISMATCH)", pfOrigin.status === 1 && JSON.parse(pfOrigin.stdout).checks.some((c) => c.code === "E_ORIGIN_MISMATCH"));
  gitOut(v1.path, "remote", "set-url", "origin", origin.replaceAll("\\", "/"));

  gitOut(mainRepo, "switch", "dev-cli");
  const pfHold = node("preflight.mjs", ["--target", v1.path, "--main", mainRepo]);
  check("AC-1 preflight 拒绝分支已检出 (E_BRANCH_CHECKED_OUT)", pfHold.status === 1 && JSON.parse(pfHold.stdout).checks.some((c) => c.code === "E_BRANCH_CHECKED_OUT"));
  gitOut(mainRepo, "switch", "main");
  gitOut(mainRepo, "branch", "-D", "dev-cli");

  // ---------- inventory ----------
  const inv = node("inventory.mjs", ["--target", v1.path]);
  const invJson = JSON.parse(inv.stdout || "{}");
  check("inventory 列出 ignored 资产与 submodule",
    inv.status === 0
    && invJson.ignored.includes(".env") && invJson.ignored.includes("target/")
    && invJson.ignored.includes("build/") && invJson.ignored.includes("apps/server/data/")
    && invJson.submodules.includes("third_party/vcpkg"),
    inv.stdout);

  // ---------- AC-8 dry-run ----------
  const dry = node("convert.mjs", ["--target", v1.path, "--main", mainRepo]);
  const dryJson = JSON.parse(dry.stdout || "{}");
  check("AC-8 dry-run 输出计划且零改动",
    dry.status === 0 && dryJson.dryRun === true
    && statSync(path.join(v1.path, ".git")).isDirectory()
    && !existsSync(v1.path + "__staging")
    && worktreePaths(mainRepo).length === 1,
    dry.stdout.slice(0, 300));

  // ---------- AC-2..5,7 apply ----------
  const app = node("convert.mjs", ["--target", v1.path, "--main", mainRepo, "--apply"]);
  const appJson = JSON.parse(app.stdout || "{}");
  check("AC-2 convert --apply 成功", app.status === 0 && appJson.ok === true, JSON.stringify(appJson).slice(0, 400));
  const wl = gitOut(mainRepo, "worktree", "list", "--porcelain");
  check("AC-2 目标注册为 worktree 且分支正确",
    worktreePaths(mainRepo).some((p) => sameReal(p, v1.path)) && wl.includes("refs/heads/dev-cli"),
    wl);
  check("AC-2 .git 变为 gitfile", statSync(path.join(v1.path, ".git")).isFile());
  check("AC-2 工作区干净且 HEAD 不变",
    gitOut(v1.path, "status", "--porcelain") === "" && gitOut(v1.path, "rev-parse", "HEAD") === v1.headSha);
  check("AC-3 ignored 资产回到原路径",
    readFileSync(path.join(v1.path, ".env"), "utf8") === "PORT=18200\n"
    && existsSync(path.join(v1.path, "target", "big.bin"))
    && existsSync(path.join(v1.path, "build", "x.txt"))
    && existsSync(path.join(v1.path, "apps", "server", "data", "db.sqlite")));
  const subGit = readFileSync(path.join(v1.path, "third_party", "vcpkg", ".git"), "utf8").trim();
  const subDir = subGit.replace(/^gitdir: /, "");
  check("AC-4 submodule gitfile 指向 per-worktree modules",
    subGit.includes("/.git/worktrees/") && existsSync(subDir), subGit);
  check("AC-4 submodule status 停在记录 commit",
    git(v1.path, "submodule", "status", "third_party/vcpkg").stdout.trimEnd().startsWith(" "),
    git(v1.path, "submodule", "status", "third_party/vcpkg").stdout.trimEnd());
  check("AC-5 独有 refs 与缺失 tag 并入主仓",
    gitOut(mainRepo, "rev-parse", "refs/t3/checkpoints/s1/turn/0") === v1.t3sha
    && gitOut(mainRepo, "tag", "--list", "v-victim") !== "");
  check("AC-7 备份与暂存区已清理", !existsSync(v1.path + ".bak.git") && !existsSync(v1.path + "__staging"),
    [v1.path + ".bak.git", v1.path + "__staging"].filter(existsSync).join(" 仍存在"));

  // ---------- AC-6 CWD 锁住顶层目录 ----------
  const v2 = makeVictim("victim2", "dev-cli-2");
  const holder = spawn(process.execPath, ["-e", "setTimeout(()=>{},600000)"], { cwd: v2.path, stdio: "ignore" });
  holders.push(holder);
  const app2 = node("convert.mjs", ["--target", v2.path, "--main", mainRepo, "--apply"]);
  const app2Json = JSON.parse(app2.stdout || "{}");
  check("AC-6 顶层被 CWD 锁住仍转换成功",
    app2.status === 0 && app2Json.ok === true
    && existsSync(path.join(v2.path, ".env"))
    && worktreePaths(mainRepo).some((p) => sameReal(p, v2.path))
    && gitOut(v2.path, "status", "--porcelain") === "",
    JSON.stringify(app2Json).slice(0, 400));

  // ---------- AC-9 tracked 子目录被锁 → clear 阶段失败自动回滚 ----------
  const v3 = makeVictim("victim3", "dev-cli-3");
  const holder3 = spawn(process.execPath, ["-e", "setTimeout(()=>{},600000)"], { cwd: path.join(v3.path, "apps"), stdio: "ignore" });
  holders.push(holder3);
  const app3 = node("convert.mjs", ["--target", v3.path, "--main", mainRepo, "--apply"]);
  const app3Json = JSON.parse(app3.stdout || "{}");
  check("AC-9 clear 阶段失败自动回滚且 clone 可用",
    app3.status === 1 && app3Json.rolledBack === true && app3Json.phase === "clear"
    && statSync(path.join(v3.path, ".git")).isDirectory()
    && existsSync(path.join(v3.path, ".env"))
    && gitOut(v3.path, "status", "--porcelain") === "",
    JSON.stringify(app3Json).slice(0, 400));
  check("AC-9 回滚无残留", Array.isArray(app3Json.rollbackLeftovers) && app3Json.rollbackLeftovers.length === 0,
    (app3Json.rollbackLeftovers || []).join(" | "));

  // ---------- 结构 ----------
  const skillMd = readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf8");
  check("SKILL.md 无待办占位且声明 name", skillMd.includes("name: clone-to-worktree") && !skillMd.includes("TODO"));
} finally {
  for (const h of holders) { try { h.kill(); } catch { /* 已退出 */ } }
  if (process.env.C2W_KEEP) {
    console.log(`(C2W_KEEP=1，保留 fixture: ${tmp})`);
  } else {
    try {
      rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (e) {
      console.log(`(清理临时目录失败，可稍后手删: ${tmp} — ${e.message})`);
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
