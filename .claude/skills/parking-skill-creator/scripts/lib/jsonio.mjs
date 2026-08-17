// jsonio.mjs — JSON 文件读写小助手（读失败返回 null 而非抛出，调用方决定是否报错）
// 写入走「临时文件 + rename」原子路径：进程中途被杀不会留半截文件（读方不会把它误判为损坏）。
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";

/** 读 JSON；文件不存在或解析失败返回 null */
export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** 写 JSON（2 空格缩进 + 末尾换行），临时文件 + 原子 rename，自动建父目录 */
export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
}

/** 读文本；失败返回 null */
export function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** 写文本（UTF-8），临时文件 + 原子 rename，自动建父目录 */
export function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, path);
}
