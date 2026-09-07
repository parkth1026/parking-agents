// Node 版本下限判定（run-standard 9.5 / G12 落地，模板 v1.3.0 起）。
//
// 本文件是模板默认值：22.13/24 是 2026-09 前端生态水位（vite 8 "^20.19.0 || >=22.12.0"、
// eslint 10 / jsdom 29 "^20.19.0 || ^22.13.0 || >=24" 的交集）。标准化评审时必须按
// 目标仓依赖树 engines 交集改写这里的常量，并与 package.json 的 engines.node 同笔
// 同步——两处分叉即假契约。纯 node 编排仓可放宽，但不得低于 runner 语法要求
// （顶层 await，≥14.8）。
// 不引 semver 依赖：门必须能在过老的 Node 上跑起来并自举报错，只解析 major.minor。

const MIN_MAJOR = 22;
const MIN_MINOR = 13;
const NEXT_MAJOR = 24;

export const REQUIRED_NODE_RANGE = "^22.13.0 || >=24.0.0";

export function nodeSatisfies(versionString) {
  const match = /^v?(\d+)\.(\d+)/u.exec(versionString);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return (major === MIN_MAJOR && minor >= MIN_MINOR) || major >= NEXT_MAJOR;
}
