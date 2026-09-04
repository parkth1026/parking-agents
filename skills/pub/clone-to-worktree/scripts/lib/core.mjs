// core.mjs — clone-to-worktree 共享基础：git 执行、Windows 安全删除、跨目录搬移
// 只用 Node 内置模块；所有 git 调用走 execFileSync（无 shell 注入面）。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** 执行 git 命令，失败抛带 stderr 的 Error；cwd 必须是已存在的目录 */
export function git(cwd, args) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }).toString();
  } catch (e) {
    const err = new Error(
      `git ${args.join(" ")} 失败 (cwd=${cwd})\n${(e.stderr || e.message || "").toString().trim()}`
    );
    err.exitCode = e.status ?? 1;
    throw err;
  }
}

/** git 调用不抛版：返回 {ok, out} */
export function gitOk(cwd, args) {
  try {
    return { ok: true, out: git(cwd, args) };
  } catch (e) {
    return { ok: false, err: e };
  }
}

/** 路径统一为 posix 斜杠（写进 gitfile/config 用绝对 posix 路径最稳） */
export function toPosix(p) {
  return p.replaceAll("\\", "/");
}

/** 比较两个绝对路径是否同一位置（Windows 大小写不敏感 + 8.3 短名如 ADMINI~1；realpathSync.native 才会展开） */
export function samePath(a, b) {
  const r = (x) => {
    const abs = path.resolve(x);
    try { return fs.realpathSync.native(abs); } catch { return abs; }
  };
  return r(a).toLowerCase() === r(b).toLowerCase();
}

/**
 * 递归删除，兼容 Windows 只读文件（git objects 默认只读）：
 * unlink/rmdir 失败时先 chmod 再重试；文件不存在视为成功。
 */
export function rmTree(p) {
  if (!fs.existsSync(p)) return;
  const walk = (fp) => {
    const st = fs.lstatSync(fp);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(fp)) walk(path.join(fp, e));
      try {
        fs.rmdirSync(fp);
      } catch {
        fs.chmodSync(fp, 0o666);
        fs.rmdirSync(fp);
      }
    } else {
      try {
        fs.unlinkSync(fp);
      } catch {
        fs.chmodSync(fp, 0o666);
        fs.unlinkSync(fp);
      }
    }
  };
  walk(p);
}

/** 同卷搬移（rename）；自动创建目标父目录 */
export function moveSync(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(src, dst);
}

/**
 * 覆写文件内容。Windows 上 git 生成的隐藏文件（如 submodule 工作区的 .git gitfile，
 * attrib 为 H）直接 writeFileSync 会 EPERM，先删再写绕开。
 */
export function overwriteFile(p, content) {
  if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  fs.writeFileSync(p, content, "utf8");
}

/** 目录是否为空（不存在视为空） */
export function dirIsEmpty(p) {
  if (!fs.existsSync(p)) return true;
  return fs.readdirSync(p).length === 0;
}

/** 解析简单 --key value / --flag 参数 */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}
