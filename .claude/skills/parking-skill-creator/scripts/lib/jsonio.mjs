// jsonio.mjs — JSON 文件读写小助手（读失败返回 null 而非抛出，调用方决定是否报错）
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** 读 JSON；文件不存在或解析失败返回 null */
export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** 写 JSON（2 空格缩进 + 末尾换行），自动建父目录 */
export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/** 读文本；失败返回 null */
export function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** 写文本（UTF-8），自动建父目录 */
export function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}
