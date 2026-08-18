#!/usr/bin/env node
// test-migration.mjs — UeErrorSolver.mjs 迁移严格验证
// 在 os.tmpdir() 下构造 mock 配置/仓库/知识库，通过子进程调用真实 CLI 并断言结果。
// 用法: node test-migration.mjs [--only <名称过滤>]

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import {
  existsSync, mkdirSync, writeFileSync, readFileSync, rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const workspaceDir = dirname(fileURLToPath(import.meta.url));
// workspace（ue-error-solver-workspace）与 skill 目录（ue-error-solver）为同级兄弟
const SKILL_DIR = resolve(workspaceDir, "..", "ue-error-solver");
const SOLVER = join(SKILL_DIR, "scripts", "UeErrorSolver.mjs");

// ---- 测试基础设施 ----

function cli(args, opts = {}) {
  const r = spawnSync(process.execPath, [SOLVER, ...args], {
    encoding: "utf8",
    input: opts.input,
    timeout: opts.timeout || 60000,
    env: opts.env ? { ...process.env, ...opts.env } : process.env,
  });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* 非 JSON 输出 */ }
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}: 期望 ${JSON.stringify(expected)}, 实际 ${JSON.stringify(actual)}`);
}

const onlyFilter = (() => {
  const i = process.argv.indexOf("--only");
  return i > 0 ? process.argv[i + 1] : null;
})();

const failures = [];
const passes = [];
function test(name, fn) {
  if (onlyFilter && !name.includes(onlyFilter)) return;
  try {
    fn();
    passes.push(name);
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failures.push({ name, error: String(e.message || e) });
    console.log(`  FAIL  ${name}\n        ${e.message}`);
  }
}

// async 测试收集（git/curl 相关）
const asyncTests = [];
function atest(name, fn) {
  if (onlyFilter && !name.includes(onlyFilter)) return;
  asyncTests.push({ name, fn });
}

// ---- mock fixtures（全部在系统 tmp 下，不在 skill 目录内）----

const FIXTURE = join(tmpdir(), "ue-error-solver-test");
const MOCK_GIT_REPOS = join(FIXTURE, "gitRepos");
const MOCK_WIKI = join(FIXTURE, "wiki");
const MOCK_RAW = join(FIXTURE, "raw");
const MOCK_TMP = join(FIXTURE, "tmpdir");
const MOCK_ENV = join(FIXTURE, "skill-env.json");
const BARE_ORIGIN = join(FIXTURE, "origin.git");
const CLONE = join(FIXTURE, "clone");

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 30000, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} 失败:\n${r.stdout}\n${r.stderr}`);
  return r;
}

function setupFixtures() {
  rmSync(FIXTURE, { recursive: true, force: true });
  mkdirSync(MOCK_GIT_REPOS, { recursive: true });
  mkdirSync(MOCK_WIKI, { recursive: true });
  mkdirSync(MOCK_RAW, { recursive: true });
  mkdirSync(MOCK_TMP, { recursive: true });

  // mock skill-env.json（隔离真实配置，保证测试确定性）
  writeFileSync(MOCK_ENV, JSON.stringify({
    jenkins: { baseUrl: "http://127.0.0.1:9" },
    gitRepos: MOCK_GIT_REPOS.replace(/\//g, "\\"),
    knowledgeBase: {
      rawDir: MOCK_RAW.replace(/\//g, "\\"),
      wikiDir: MOCK_WIKI.replace(/\//g, "\\"),
    },
    tmpDir: MOCK_TMP.replace(/\//g, "\\"),
  }, null, 2), "utf8");

  // mock git 仓库（含源文件 + git 历史）
  const repo = join(MOCK_GIT_REPOS, "AesWorld");
  const srcDir = join(repo, "Source", "MyModule");
  mkdirSync(srcDir, { recursive: true });
  const fooCpp = join(srcDir, "Foo.cpp");
  const lines = [];
  for (let i = 1; i <= 40; i++) lines.push(`// line ${i}`);
  writeFileSync(fooCpp, lines.join("\n") + "\n", "utf8");
  sh("git", ["init", "-q", "-b", "master", repo]);
  sh("git", ["-C", repo, "config", "user.email", "test@test.local"]);
  sh("git", ["-C", repo, "config", "user.name", "Test"]);
  sh("git", ["-C", repo, "add", "."]);
  sh("git", ["-C", repo, "commit", "-q", "-m", "init commit"]);

  // 镜像布局：MirrorRepo 带 Plugins\G\ 层级 + AesWorld 仓库同文件的普通布局（验证最长后缀优先）
  const mirrorDir = join(MOCK_GIT_REPOS, "MirrorRepo", "Plugins", "G", "AesWorld", "Source", "MyModule");
  mkdirSync(mirrorDir, { recursive: true });
  writeFileSync(join(mirrorDir, "Bar.cpp"), "// mirror G-layout copy\n", "utf8");
  writeFileSync(join(srcDir, "Bar.cpp"), "// plain-layout copy\n", "utf8");

  // mock wiki（知识库）
  writeFileSync(join(MOCK_WIKI, "kb-c2061.md"), "# C2061 知识\n之前遇到 C2061 syntax error，修复方法是补 include。\n", "utf8");
  writeFileSync(join(MOCK_WIKI, "kb-other.md"), "# 其他\nLNK2019 unresolved external 修复记录。\n", "utf8");

  // 本地 bare 仓库作为 origin（测试 fix-branch / git-submit 的完整 git 流程）
  sh("git", ["init", "-q", "--bare", BARE_ORIGIN]);
  sh("git", ["clone", "-q", BARE_ORIGIN.replace(/\//g, "/"), CLONE]);
  sh("git", ["-C", CLONE, "config", "user.email", "test@test.local"]);
  sh("git", ["-C", CLONE, "config", "user.name", "Test"]);
  sh("git", ["-C", CLONE, "checkout", "-q", "-b", "dev"]);
  writeFileSync(join(CLONE, "a.txt"), "a1\n", "utf8");
  sh("git", ["-C", CLONE, "add", "."]);
  sh("git", ["-C", CLONE, "commit", "-q", "-m", "c1"]);
  sh("git", ["-C", CLONE, "push", "-q", "-u", "origin", "dev"]);
}

// ---- 合成 Jenkins 日志样本 ----

const SAMPLE_LOG = [
  "Started by GitLab push by tester",
  "Obtained Groovy/build.groovy from git http://10.100.10.55/neon/AesBuilderJenkins.git",
  "Running on autoci in D:/Jenkins/workspace/Earth/aes6-ue-runtime-ci",
  "[Pipeline] { (Checkout)",
  " > git config remote.origin.url http://10.100.10.55/neon/AesWorld.git # timeout=10",
  "Checking out Revision 1234567890abcdef1234567890abcdef12345678 (refs/remotes/origin/dev)",
  "[Pipeline] { (Build)",
  "D:\\Jenkins\\workspace\\Earth\\aes6-ue-runtime-ci\\Engine\\Build\\BatchFiles\\Build.bat AesWorldEditor Win64 Development -project=...",
  "  Compiling MyModule",
  "D:\\ws_ci\\AesWorld\\Plugins\\G\\MyPlugin\\Source\\MyModule\\Foo.cpp(42): error C2061: syntax error: identifier 'FooBar'",
  "note: see declaration of 'FooBar'",
  "D:\\ws_ci\\AesWorld\\Source\\MyModule\\Bar.cpp(100): fatal error C1083: Cannot open include file: 'Missing.h'",
  "Foo.obj : error LNK2001: unresolved external symbol \"void __cdecl Missing(void)\"",
  "  referenced by Bar.cpp",
  "Build failed with exit code 5",
].join("\r\n");

const EMPTY_LOG = "Started by user\nAll good, no errors\nFinished: SUCCESS\n";

// ============================================================
// 测试用例
// ============================================================

setupFixtures();
console.log(`\nfixtures: ${FIXTURE}\n`);

console.log("== 1. CLI 基础 ==");

test("help 输出用法且 exit 0", () => {
  const r = cli(["--help"]);
  assertEq(r.code, 0, "exit code");
  assert(r.stderr.includes("用法"), "usage 应在 stderr");
  assert(r.stderr.includes("parse-url"), "应列出子命令");
});

test("无参数 exit 2", () => {
  const r = cli([]);
  assertEq(r.code, 2, "exit code");
});

test("未知子命令 exit 2", () => {
  const r = cli(["no-such-cmd"]);
  assertEq(r.code, 2, "exit code");
  assert(r.stderr.includes("未知子命令"), "错误提示");
});

test("未知 flag exit 2", () => {
  const r = cli(["parse-url", "--ref", "x#1", "--bogus"]);
  assertEq(r.code, 2, "exit code");
});

console.log("== 2. 配置读取（config / SKILL_ENV 深合并）==");

test("config: mock env 深合并 + 路径解析", () => {
  const r = cli(["config"], { env: { SKILL_ENV: MOCK_ENV } });
  assertEq(r.code, 0, "exit code");
  assertEq(r.json.jenkins.baseUrl, "http://127.0.0.1:9", "baseUrl 来自 env 层");
  assertEq(r.json.gitRepos, resolve(MOCK_GIT_REPOS), "gitRepos 解析为绝对路径");
  assertEq(r.json.knowledgeBase.wikiDir, resolve(MOCK_WIKI), "wikiDir 解析");
  assertEq(r.json.knowledgeBase.rawDir, resolve(MOCK_RAW), "rawDir 解析");
  assertEq(r.json.tmpDir, resolve(MOCK_TMP), "tmpDir 解析");
});

test("config: SKILL_ENV 指向不存在文件 → 用默认层 → gitRepos 缺失报错", () => {
  const r = cli(["config"], { env: { SKILL_ENV: join(FIXTURE, "nope.json") } });
  assertEq(r.code, 1, "exit code");
  assert(r.json.error.includes("gitRepos"), `应提示 gitRepos 缺失，实际: ${r.json.error}`);
  assert(r.json.error.includes("skill-env.json"), "应提示设置位置");
});

console.log("== 3. URL 解析 ==");

test("parse-url: 完整 URL", () => {
  const r = cli(["parse-url", "--ref", "https://ci.example.com/job/MyProject/job/Build/42"]);
  assertEq(r.code, 0, "exit code");
  assertEq(r.json.baseUrl, "https://ci.example.com", "baseUrl");
  assertEq(r.json.jobPath, "/job/MyProject/job/Build", "jobPath");
  assertEq(r.json.buildNumber, 42, "buildNumber");
  assertEq(r.json.jobShort, "Build", "jobShort");
});

test("parse-url: 带 console 后缀的 URL", () => {
  const r = cli(["parse-url", "--ref", "http://h/job/A/905/console"]);
  assertEq(r.json.buildNumber, 905, "buildNumber");
  assertEq(r.json.jobShort, "A", "jobShort");
});

test("parse-url: 短名#编号 + base-url", () => {
  const r = cli(["parse-url", "--ref", "linux-ci 905", "--base-url", "http://10.66.12.40/"]);
  assertEq(r.json.baseUrl, "http://10.66.12.40", "baseUrl 去尾斜杠");
  assertEq(r.json.jobShort, "linux-ci", "jobShort");
  assertEq(r.json.buildNumber, 905, "buildNumber");
  assertEq(r.json.jobPath, null, "jobPath 为 null");
});

test("parse-url: 短名缺 base-url → exit 1 报错", () => {
  const r = cli(["parse-url", "--ref", "linux-ci#905"]);
  assertEq(r.code, 1, "exit code");
  assert(r.json.error.includes("BaseUrl"), "错误提及 BaseUrl");
});

test("parse-url: 垃圾输入 → exit 1", () => {
  const r = cli(["parse-url", "--ref", "hello world"]);
  assertEq(r.code, 1, "exit code");
});

console.log("== 4. 日志解析（纯函数）==");

test("repo-checkouts: 提取 remote/branch/commit", () => {
  const r = cli(["repo-checkouts", "--log-file", "-"], { input: SAMPLE_LOG });
  assertEq(r.code, 0, "exit code");
  assertEq(r.json.length, 1, "应提取 1 个仓库");
  assertEq(r.json[0].repoName, "AesWorld", "repoName");
  assertEq(r.json[0].branch, "dev", "branch");
  assertEq(r.json[0].commit, "1234567890abcdef1234567890abcdef12345678", "commit");
  assert(r.json[0].repoUrl.includes("AesWorld.git"), "repoUrl");
});

test("extract-errors: C2061 + C1083 + LNK2001 全部识别", () => {
  const r = cli(["extract-errors", "--log-file", "-"], { input: SAMPLE_LOG });
  assertEq(r.code, 0, "exit code");
  const codes = r.json.map((e) => e.errorCode);
  assert(codes.includes("error C2061"), `应含 C2061: ${codes}`);
  assert(codes.includes("fatal error C1083"), "应含 fatal C1083");
  assert(codes.includes("LNK2001"), "应含 LNK2001");
  const c2061 = r.json.find((e) => e.errorCode === "error C2061");
  assert(c2061.filePath.endsWith("Foo.cpp"), "FilePath 提取");
  assertEq(c2061.lineNumber, 42, "LineNumber 提取");
  assertEq(c2061.type, "Compilation", "类型 Compilation");
  assert(c2061.lines.length >= 2, "note: 续行应并入错误块");
});

test("extract-errors: LNK 错误含 referenced by 续行", () => {
  const r = cli(["extract-errors", "--log-file", "-"], { input: SAMPLE_LOG });
  const lnk = r.json.find((e) => e.errorCode === "LNK2001");
  assertEq(lnk.type, "Linker", "类型 Linker");
  assert(lnk.lines.some((l) => l.includes("referenced by")), "referenced by 续行");
});

test("extract-errors: 干净日志 → 空数组", () => {
  const r = cli(["extract-errors", "--log-file", "-"], { input: EMPTY_LOG });
  assertEq(r.json.length, 0, "无错误");
});

test("extract-build-cmd: 提取 Build.bat 命令", () => {
  const r = cli(["extract-build-cmd", "--log-file", "-"], { input: SAMPLE_LOG });
  assertEq(r.code, 0, "exit code");
  assert(r.json.buildCommand.includes("Build.bat"), `命令应含 Build.bat: ${r.json.buildCommand}`);
});

test("extract-build-cmd: 无命令 → null", () => {
  const r = cli(["extract-build-cmd", "--log-file", "-"], { input: EMPTY_LOG });
  assertEq(r.json.buildCommand, null, "null");
});

test("日志文件不存在 → exit 2", () => {
  const r = cli(["extract-errors", "--log-file", "Z:/no/such/file.log"]);
  assertEq(r.code, 2, "exit code");
});

console.log("== 5. 临时文件位置（不得写入 skill 目录）==");

test("save-log: 写入 config.tmpDir 且不在 skill 目录内", () => {
  const r = cli(["save-log", "--job-short", "aes6-ue-runtime-ci", "--build", "3913", "--log-file", "-"],
    { input: SAMPLE_LOG, env: { SKILL_ENV: MOCK_ENV } });
  assertEq(r.code, 0, "exit code");
  const saved = r.json.savedPath;
  assert(existsSync(saved), `文件应存在: ${saved}`);
  assertEq(resolve(saved), resolve(MOCK_TMP, saved.split(/[\\/]/).pop()), "应位于 mock tmpDir");
  assert(!resolve(saved).startsWith(resolve(SKILL_DIR).toLowerCase()), "绝不在 skill 目录内");
  assert(/aes6-ue-runtime-ci_3913_\d{8}_\d{6}\.log$/.test(saved.replace(/\\/g, "/")), `文件名含 job/build/时间戳: ${saved}`);
});

test("save-log: >500KB 自动生成过滤版", () => {
  const big = SAMPLE_LOG + "\n" + ("filler neutral xyz line\n".repeat(25000));
  const r = cli(["save-log", "--job-short", "big", "--build", "1", "--log-file", "-"],
    { input: big, env: { SKILL_ENV: MOCK_ENV } });
  assertEq(r.code, 0, "exit code");
  assert(r.json.filteredPath, "应有 filteredPath");
  assert(existsSync(r.json.filteredPath), "过滤版文件存在");
  const filtered = readFileSync(r.json.filteredPath, "utf8");
  assert(filtered.includes("error C2061"), "过滤版保留错误行");
  assert(!filtered.includes("filler neutral"), "过滤版剔除普通行");
  assert(!resolve(r.json.filteredPath).startsWith(resolve(SKILL_DIR).toLowerCase()), "过滤版不在 skill 目录");
});

test("save-log: 无 config 时退回 os.tmpdir()（而非 skill 目录）", () => {
  const r = cli(["save-log", "--job-short", "nocfg", "--build", "1", "--log-file", "-"],
    { input: SAMPLE_LOG, env: { SKILL_ENV: join(FIXTURE, "nope.json") } });
  assertEq(r.code, 0, "exit code");
  const savedDir = resolve(r.json.savedPath, "..");
  assert(!savedDir.startsWith(resolve(SKILL_DIR).toLowerCase()), "退回路径也不在 skill 目录");
  assertEq(savedDir.toLowerCase(), join(tmpdir(), "ue-error-solver").toLowerCase(), "退回 os.tmpdir()/ue-error-solver");
});

console.log("== 6. 源码 / 知识库 ==");

test("resolve-error-file: Plugins 路径映射到本地仓库", () => {
  // mock 仓库只有 Source/，验证 Source 分支映射
  const r = cli(["resolve-error-file", "--error-path", "D:\\ws_ci\\AesWorld\\Source\\MyModule\\Foo.cpp", "--git-repos", MOCK_GIT_REPOS]);
  assertEq(r.code, 0, "exit code");
  assertEq(r.json.found, true, "found");
  assert(r.json.localPath.endsWith("Foo.cpp"), "localPath");
  assertEq(r.json.repoRoot && r.json.repoRoot.toLowerCase(), MOCK_GIT_REPOS.replace(/\//g, "\\").toLowerCase() + "\\aesworld", "repoRoot 向上找 .git");
});

test("resolve-error-file: 无匹配 → found=false", () => {
  const r = cli(["resolve-error-file", "--error-path", "D:\\ws_ci\\AesWorld\\Source\\Nope\\Missing.cpp", "--git-repos", MOCK_GIT_REPOS]);
  assertEq(r.json.found, false, "found=false");
});

test("resolve-error-file: CI 带 Plugins\\G\\<Repo>\\ 前缀（本地无此前缀）→ 后缀回退命中", () => {
  // 真实场景回放：CI 工作区 .../Project/Plugins/G/AesWorld/Source/... ↔ 本地 D:/Git/AesWorld/Source/...
  const r = cli(["resolve-error-file", "--error-path", "D:\\ws_twe_ue5.5_ci\\Project\\Plugins\\G\\AesWorld\\Source\\MyModule\\Foo.cpp", "--git-repos", MOCK_GIT_REPOS]);
  assertEq(r.code, 0, "exit code");
  assertEq(r.json.found, true, `found 应为 true（后缀回退），实际: ${JSON.stringify(r.json)}`);
  assertEq(r.json.matchedSuffix, "AesWorld\\Source\\MyModule\\Foo.cpp", "matchedSuffix 应剥掉 G\\ 前缀");
  assert(r.json.localPath.endsWith("Foo.cpp"), "localPath");
});

test("resolve-error-file: 完整相对段可命中时最长后缀优先", () => {
  // Bar.cpp 两种布局都有：MirrorRepo 镜像了 CI 的 Plugins\G\ 布局 → 完整后缀命中它，而非 AesWorld 的短后缀副本
  const r = cli(["resolve-error-file", "--error-path", "D:\\ws_ci\\x\\Plugins\\G\\AesWorld\\Source\\MyModule\\Bar.cpp", "--git-repos", MOCK_GIT_REPOS]);
  assertEq(r.json.found, true, "found");
  assertEq(r.json.matchedSuffix, "G\\AesWorld\\Source\\MyModule\\Bar.cpp", "最长后缀优先");
  assert(r.json.localPath.includes("MirrorRepo"), "应命中镜像布局副本");
});

test("source-context: >>> 标记目标行 + 行号", () => {
  const r = cli(["source-context", "--file", join(MOCK_GIT_REPOS, "AesWorld", "Source", "MyModule", "Foo.cpp"), "--line", "20"]);
  assertEq(r.code, 0, "exit code");
  assert(r.json.snippet.includes(">>> 20:"), ">>> 标记第 20 行");
  assert(r.json.snippet.includes("    5:"), "上下文含第 5 行");
});

test("search-kb: 关键词命中 wiki", () => {
  const r = cli(["search-kb", "--terms", "C2061,NothingMatches"], { env: { SKILL_ENV: MOCK_ENV } });
  assertEq(r.code, 0, "exit code");
  const hits = r.json.filter((h) => h.searchTerm === "C2061");
  assert(hits.length > 0, "C2061 应命中");
  assert(hits.some((h) => h.filePath.includes("kb-c2061.md")), "命中 kb-c2061.md");
  const none = r.json.filter((h) => h.searchTerm === "NothingMatches");
  assertEq(none.length, 0, "未命中词无结果");
});

test("search-kb: 搜索词含正则特殊字符不崩溃", () => {
  const r = cli(["search-kb", "--terms", "C2061 (foo)"], { env: { SKILL_ENV: MOCK_ENV } });
  assertEq(r.code, 0, "exit code");
});

test("save-knowledge: 新建条目 + 重复追加 Update", () => {
  const common = { env: { SKILL_ENV: MOCK_ENV } };
  const r1 = cli(["save-knowledge", "--job-short", "aes6", "--build", "100", "--error-code", "C2061", "--short-desc", "missing include fix", "--content", "root cause + fix details"], common);
  assertEq(r1.code, 0, "首次保存 exit 0");
  assert(existsSync(r1.json.savedPath), "文件已创建");
  assert(r1.json.savedPath.includes("details"), "位于 details/ 下");
  const r2 = cli(["save-knowledge", "--job-short", "aes6", "--build", "200", "--error-code", "C2061", "--short-desc", "missing include fix", "--content", "second occurrence"], common);
  assertEq(r2.json.savedPath, r1.json.savedPath, "重复条目返回同一路径（追加）");
  const merged = readFileSync(r2.json.savedPath, "utf8");
  assert(merged.includes("## Update: aes6#200"), "追加 Update 段落");
  assert(merged.includes("# C2061: missing include fix"), "标题保留");
});

test("save-knowledge: --content-file 变体", () => {
  const cf = join(FIXTURE, "entry.md");
  writeFileSync(cf, "content from file", "utf8");
  const r = cli(["save-knowledge", "--job-short", "aes6", "--build", "1", "--error-code", "LNK2019", "--short-desc", "from file", "--content-file", cf], { env: { SKILL_ENV: MOCK_ENV } });
  assertEq(r.code, 0, "exit code");
  assert(readFileSync(r.json.savedPath, "utf8").includes("content from file"), "内容来自文件");
});

console.log("== 7. 门禁断言 ==");

test("assert-build-passed: exit 0 / 非 0 / 豁免 / 缺参数", () => {
  assertEq(cli(["assert-build-passed", "--exit-code", "0"]).json.passed, true, "0 → passed");
  const fail = cli(["assert-build-passed", "--exit-code", "5"]);
  assertEq(fail.code, 1, "5 → exit 1");
  assertEq(fail.json.passed, false, "5 → not passed");
  assert(fail.json.error.includes("ExitCode=5"), "错误含退出码");
  const waived = cli(["assert-build-passed", "--exit-code", "5", "--user-waived"]);
  assertEq(waived.json.passed, true, "豁免 → passed");
  assert(waived.json.warning.includes("waived"), "豁免含 warning");
  const none = cli(["assert-build-passed"]);
  assertEq(none.code, 1, "缺参数 → exit 1");
});

test("assert-files-in-repos: 目录内通过 / 目录外拒绝", () => {
  const inside = join(MOCK_GIT_REPOS, "AesWorld", "Source", "MyModule", "Foo.cpp");
  const ok = cli(["assert-files-in-repos", "--files", inside, "--git-repos-root", MOCK_GIT_REPOS]);
  assertEq(ok.code, 0, "目录内 exit 0");
  const outside = join(FIXTURE, "clone", "a.txt");
  const bad = cli(["assert-files-in-repos", "--files", outside, "--git-repos-root", MOCK_GIT_REPOS]);
  assertEq(bad.code, 1, "目录外 exit 1");
  assert(bad.json.error.includes("outside gitRepos"), "拒绝原因");
  const missing = cli(["assert-files-in-repos", "--files", "Z:/no/where.cpp", "--git-repos-root", MOCK_GIT_REPOS]);
  assertEq(missing.code, 1, "文件不存在 exit 1");
});

console.log("== 8. check-env（Phase 0.5）==");

test("check-env: 仓库存在 → ready", () => {
  const r = cli(["check-env", "--repos", "AesWorld"], { env: { SKILL_ENV: MOCK_ENV } });
  assertEq(r.code, 0, "exit code");
  assertEq(r.json.ready, true, "ready");
});

test("check-env: 仓库缺失 → not ready + clone 指引", () => {
  const r = cli(["check-env", "--repos", "MissingRepo"], { env: { SKILL_ENV: MOCK_ENV } });
  assertEq(r.code, 1, "exit code");
  assertEq(r.json.ready, false, "not ready");
  assertEq(r.json.missingRepos[0], "MissingRepo", "missingRepos");
  assert(r.json.warnings.some((w) => w.includes("git clone")), "给出 clone 指引");
});

console.log("== 9. 网络（错误路径 + 本地集成）==");

test("console-log: 不可达 Jenkins → exit 1 错误 JSON", () => {
  const r = cli(["console-log", "--job-path", "/job/x", "--build", "1", "--base-url", "http://127.0.0.1:9"], { timeout: 30000 });
  assertEq(r.code, 1, "exit code");
  assert(r.json.error.includes("Failed to download"), `错误信息: ${r.json && r.json.error}`);
});

test("build-result: 不可达 Jenkins → exit 1", () => {
  const r = cli(["build-result", "--job-path", "/job/x", "--build", "1", "--base-url", "http://127.0.0.1:9"], { timeout: 30000 });
  assertEq(r.code, 1, "exit code");
});

test("console-log: 缺 baseUrl 且 config 无 → exit 1 提示", () => {
  const r = cli(["console-log", "--job-path", "/job/x", "--build", "1"], { env: { SKILL_ENV: join(FIXTURE, "nope.json") } });
  assertEq(r.code, 1, "exit code");
  assert(r.stderr.includes("baseUrl"), "提示设置 baseUrl");
});

atest("local-build: cmd echo 成功 / exit 2 失败", async () => {
  const ok = cli(["local-build", "--repo-root", FIXTURE, "--build-command", "echo hello-build"]);
  assertEq(ok.code, 0, "exit code");
  assertEq(ok.json.success, true, "echo → success");
  assert(ok.json.output.includes("hello-build"), "输出捕获");
  const bad = cli(["local-build", "--repo-root", FIXTURE, "--build-command", "exit 2"]);
  assertEq(bad.json.success, false, "exit 2 → fail");
  assertEq(bad.json.exitCode, 2, "exitCode=2");
});

console.log("== 10. git 集成（本地 bare 仓库作为 origin）==");

atest("fix-branch: CI commit == HEAD → base 为 CI commit", async () => {
  const head = spawnSync("git", ["-C", CLONE, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  const r = cli(["fix-branch", "--repo-root", CLONE, "--source-branch", "dev", "--source-commit", head, "--fix-branch", "fix/test-a"]);
  assertEq(r.code, 0, "exit code");
  assertEq(r.json.success, true, "success");
  assertEq(r.json.isNew, true, "isNew");
  assert(r.json.baseDescription.includes("CI commit"), `base 描述: ${r.json.baseDescription}`);
  // 分支已切到 fix/test-a
  const cur = spawnSync("git", ["-C", CLONE, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).stdout.trim();
  assertEq(cur, "fix/test-a", "当前分支");
});

atest("fix-branch: CI commit 落后 → 强制用 origin/HEAD", async () => {
  // 回到 dev 再推一个新 commit，使旧 commit 落后
  sh("git", ["-C", CLONE, "checkout", "-q", "dev"]);
  writeFileSync(join(CLONE, "a.txt"), "a2\n", "utf8");
  sh("git", ["-C", CLONE, "add", "."]);
  sh("git", ["-C", CLONE, "commit", "-q", "-m", "c2"]);
  sh("git", ["-C", CLONE, "push", "-q", "origin", "dev"]);
  const oldHead = spawnSync("git", ["-C", CLONE, "rev-parse", "HEAD~1"], { encoding: "utf8" }).stdout.trim();

  const r = cli(["fix-branch", "--repo-root", CLONE, "--source-branch", "dev", "--source-commit", oldHead, "--fix-branch", "fix/test-b"]);
  assertEq(r.code, 0, "exit code");
  assertEq(r.json.success, true, "success");
  assert(r.json.baseDescription.includes("origin/dev"), `base 应为 origin/dev: ${r.json.baseDescription}`);
  assert(r.json.notes.some((n) => n.includes("落后")), `notes 应说明落后: ${JSON.stringify(r.json.notes)}`);
  // 新分支 HEAD 应等于 origin/dev 最新
  const originHead = spawnSync("git", ["-C", CLONE, "rev-parse", "origin/dev"], { encoding: "utf8" }).stdout.trim();
  assertEq(r.json.baseCommit, originHead, "baseCommit = origin/dev HEAD");
});

atest("fix-branch: 已存在分支 → 检出且 isNew=false", async () => {
  sh("git", ["-C", CLONE, "checkout", "-q", "dev"]);
  const r = cli(["fix-branch", "--repo-root", CLONE, "--source-branch", "dev", "--fix-branch", "fix/test-a"]);
  assertEq(r.code, 0, "exit code");
  assertEq(r.json.success, true, "success");
  assertEq(r.json.isNew, false, "isNew=false");
  const cur = spawnSync("git", ["-C", CLONE, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).stdout.trim();
  assertEq(cur, "fix/test-a", "切回已有分支");
});

atest("fix-branch: 无 origin remote → fetch 失败返回错误", async () => {
  const lone = join(FIXTURE, "lone-repo");
  sh("git", ["init", "-q", "-b", "main", lone]);
  const r = cli(["fix-branch", "--repo-root", lone, "--source-branch", "dev", "--fix-branch", "fix/x"]);
  assertEq(r.code, 0, "exit code（JSON 结果）");
  assertEq(r.json.success, false, "success=false");
  assert(r.json.error.includes("fetch"), `错误应关于 fetch: ${r.json.error}`);
});

atest("git-history: 返回文件提交历史", async () => {
  const r = cli(["git-history", "--repo-root", CLONE, "--file", join(CLONE, "a.txt")]);
  assertEq(r.code, 0, "exit code");
  assert(r.json.history.includes("c1"), `历史含 c1: ${r.json.history}`);
});

atest("git-history: --oneline flag 被接受（no-op，评测回放）", async () => {
  const r = cli(["git-history", "--repo-root", CLONE, "--file", join(CLONE, "a.txt"), "--oneline"]);
  assertEq(r.code, 0, `--oneline 不应导致 exit 2，实际 stderr: ${r.stderr.slice(0, 120)}`);
  assert(r.json.history.includes("c1"), "历史仍正确");
});

atest("git-submit: 提交并推送到本地 origin", async () => {
  sh("git", ["-C", CLONE, "checkout", "-q", "dev"]);
  sh("git", ["-C", CLONE, "checkout", "-q", "-b", "fix/submit-test"]);
  writeFileSync(join(CLONE, "b.txt"), "b\n", "utf8");
  const r = cli(["git-submit", "--repo-root", CLONE, "--files", "b.txt", "--message", "fix(test): add b"]);
  assertEq(r.code, 0, "exit code");
  assertEq(r.json.success, true, "success");
  assert(/^[0-9a-f]{40}$/.test(r.json.commitHash), "commitHash 为 40 位 hash");
  assertEq(r.json.branch, "fix/submit-test", "branch");
});

atest("git-submit: --force 消息被拒绝", async () => {
  const r = cli(["git-submit", "--repo-root", CLONE, "--files", "b.txt", "--message", "push --force origin dev"]);
  assertEq(r.code, 1, "exit code");
  assertEq(r.json.success, false, "success=false");
  assert(r.json.error.includes("Force push is forbidden"), "拒绝 force");
});

atest("gitlab-mr: 无法解析的 remote（本地路径）→ 明确报错", async () => {
  const r = cli(["gitlab-mr", "--repo-root", CLONE, "--source-branch", "fix/submit-test", "--target-branch", "dev", "--title", "t"]);
  assertEq(r.code, 1, "exit code");
  assertEq(r.json.success, false, "success=false");
  assert(r.json.error.includes("Cannot parse GitLab URL"), `错误: ${r.json.error}`);
});

console.log("== 11. 静态检查 ==");

test("源码无硬编码绝对路径", () => {
  const src = readFileSync(SOLVER, "utf8");
  const driveLetters = src.match(/[^\w'"\\](?:[A-Za-z]:\\(?:Users|Git|Jenkins|ws|repo|windows|Windows|Program)[^\s"']*)/g) || [];
  assertEq(driveLetters.length, 0, `发现硬编码路径: ${driveLetters.join(", ")}`);
  const unixAbs = src.match(/["'](\/(?:home|Users|tmp|var|opt)\/[^"']*)["']/g) || [];
  assertEq(unixAbs.length, 0, `发现 unix 硬编码路径: ${unixAbs.join(", ")}`);
});

test("源码无 PowerShell 残留", () => {
  const src = readFileSync(SOLVER, "utf8");
  assert(!/\$PSScriptRoot|Import-Module|PSCustomObject/.test(src), "无 PS 语法残留");
});

test("临时写入仅派生自 tmpdir()/config（源码检查）", () => {
  const src = readFileSync(SOLVER, "utf8");
  assert(!src.includes(join(scriptDirSafe(), "tmp")), "不存在 skill 内 tmp 目录引用");
});

function scriptDirSafe() { return dirname(SOLVER); }

// ============================================================
// 执行（同步用例已在定义时执行，此处跑异步用例并汇总）
// ============================================================

(async () => {
  for (const t of asyncTests) {
    try {
      await t.fn();
      passes.push(t.name);
      console.log(`  PASS  ${t.name}`);
    } catch (e) {
      failures.push({ name: t.name, error: String(e.message || e) });
      console.log(`  FAIL  ${t.name}\n        ${e.message}`);
    }
  }

  console.log(`\n===== 结果: ${passes.length} 通过, ${failures.length} 失败 =====`);
  if (failures.length > 0) {
    console.log("\n失败清单:");
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
    process.exit(1);
  }
})();
