// tmp 落点路由层（run standard §9.7「TEST_TMP_ROOT 临时落点路由」，2026-09-15 随
// v4.1 入标准）：测试临时落点的唯一决策变量 TEST_TMP_ROOT（跨项目标准名）。
//   解析链总规则：变量 > 回退 os.tmpdir()；仓库脚本永不硬编码盘符、永不感知
//   RAM disk 软件（变量指 RAM 盘、普通目录皆合法；RAM 盘是用户个人优化）。
//
// 防护语义（与参照实现 AntHub 实证形态一致）：
//   - 变量未设 → source='fallback'（零配置机器 = 机器默认 tmp 行为；调用方唯一
//     允许新增一行回退提示日志）。
//   - 目录缺失自动重建：RAM 盘重启自洁后子目录丢失属常态（非漂移）——探针
//     失败先 mkdir(recursive) 再验，建成即用（盘在即建）；盘符不在/权限拒绝
//     （mkdir 或复验失败）才是配置漂移 → warnings 携带告警 + 回退，测试不因
//     漂移失败。
//   - 水位告警：解析根剩余空间占比 < WATERMARK_WARN_RATIO（15% 起步）→
//     warnings 携带告警（不失败）；statfsSync 做能力探测，目标仓 Node 过老或
//     网络盘/权限不可得时自动跳过（非阻断）。
//
// 自包含约束（run-standard §11 模板物清单）：零目录外依赖、零仓内特有依赖——
// 仅 import node: 内置模块，可整文件平移进任何采纳仓的 scripts/run/lib/。
//
// 消费方：scripts/run.mjs（runner 动作执行前解析并注入子进程 TMP/TEMP）；
// 直呼形态 node scripts/run/lib/tmp-root.mjs --print（首行=解析根，供任何
// PowerShell/编排入口消费）。建议条款（各仓可选，标准不带代码）：入口脚本
// 自解析（selfResolveTmp）+ 机械守卫（禁裸读 TMP/TEMP/GetTempPath、禁盘符
// 字面量）——双保险形态见 run-standard §9.7。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const TEST_TMP_ROOT_VAR = 'TEST_TMP_ROOT';
export const WATERMARK_WARN_RATIO = 0.15;

export const TMP_ROUTE_PREFIX = '[tmp-route]';

// 可写探针：根目录存在且能写删一个探针文件才算有效（漂移=不存在/不可写）。
// 探针文件 IO 每动作启动一次，量级可忽略。
function defaultProbe(dir) {
  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
    const probeFile = path.join(dir, `.run-tmp-route-probe-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probeFile, 'probe', 'utf8');
    fs.unlinkSync(probeFile);
    return true;
  } catch {
    return false;
  }
}

// 缺失重建：探针失败先尝试创建变量根（RAM 盘重启自洁后目录丢失属常态，盘在
// 即建）。recursive 幂等——已存在不报错（但已存在仍探针失败时再 mkdir 也无济
// 于事，落漂移回退）；盘符不在/权限拒绝抛错 → false → 漂移回退。
function defaultMkdir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

// 水位探测：返回根所在卷的可用/总字节；不可得（网络盘/权限/Node 过老无
// statfsSync）返回 null（跳过告警）。
function defaultStatfs(dir) {
  try {
    if (typeof fs.statfsSync !== 'function') return null;
    const stats = fs.statfsSync(dir);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    if (!Number.isFinite(totalBytes) || !Number.isFinite(freeBytes) || totalBytes <= 0) return null;
    return { freeBytes, totalBytes };
  } catch {
    return null;
  }
}

function formatGib(bytes) {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}G`;
}

/**
 * 解析路由根。依赖全部可注入（env/osTmpdir/probe/mkdir/statfs），供目标仓
 * 自建 node:test 断言 设/不设/缺失重建/漂移 形态。
 *
 * 返回：
 *   {
 *     root,          // 最终根：变量值（已验证可写，必要时已重建）或 osTmpdir()
 *     source,        // 'variable' | 'fallback'
 *     variableValue, // 变量原始值（未设为 null）
 *     warnings,      // string[]，[tmp-route] 前缀行（漂移/水位告警、缺失重建提示），
 *                    // 调用方原样打印（stderr）
 *   }
 */
export function resolveRoutedRoot({
  variable,
  env = process.env,
  osTmpdir = os.tmpdir,
  probe = defaultProbe,
  mkdir = defaultMkdir,
  statfs = defaultStatfs,
} = {}) {
  if (!variable) throw new Error('resolveRoutedRoot requires a variable name');
  const raw = String(env[variable] ?? '').trim();
  if (!raw) {
    return { root: path.resolve(osTmpdir()), source: 'fallback', variableValue: null, warnings: [] };
  }
  const candidate = path.resolve(raw);
  const warnings = [];
  if (!probe(candidate)) {
    // RAM 盘重启自洁后目录丢失属常态：盘在即建（recursive），建成复验后照常使用。
    if (mkdir(candidate) && probe(candidate)) {
      warnings.push(
        `${TMP_ROUTE_PREFIX} ${variable}=${candidate} 缺失 → 自动重建（盘在即建；RAM 盘重启自洁/目录被删皆属此常态）`,
      );
    } else {
      return {
        root: path.resolve(osTmpdir()),
        source: 'fallback',
        variableValue: raw,
        warnings: [
          `${TMP_ROUTE_PREFIX} ${variable}=${candidate} 不可创建或不可写 → WARN + fallback os.tmpdir()（配置漂移防护：测试不失败）`,
        ],
      };
    }
  }
  const usage = statfs(candidate);
  if (usage && usage.freeBytes / usage.totalBytes < WATERMARK_WARN_RATIO) {
    const ratioPct = Math.round((usage.freeBytes / usage.totalBytes) * 100);
    warnings.push(
      `${TMP_ROUTE_PREFIX} WARN ${variable}=${candidate} 余量 ${formatGib(usage.freeBytes)}/${formatGib(usage.totalBytes)} = ${ratioPct}% 低于 ${(WATERMARK_WARN_RATIO * 100).toFixed(0)}% 水位——大载荷任务建议临时指其他盘`,
    );
  }
  return { root: candidate, source: 'variable', variableValue: raw, warnings };
}

/**
 * 入口脚本自解析（建议条款的配套实现，各仓可选）：可裸直呼的入口脚本（不经
 * ./run 跑的 .mjs）在自身进程内解析 TEST_TMP_ROOT 并把 TMP/TEMP 设到解析根——
 * 裸跑时子进程同样落对盘。
 *
 * 静默约定：经 ./run 启动时 run 层已注入（TMP/TEMP 已等于解析根）则不再改写、
 * 不再打路由行（run 层的 [tmp-route] 提示不重复）；只在裸直呼、实际改写 env 时
 * 打一行。零配置机器（变量未设）不注入、静默回退（回退提示由 run 层负责）。
 *
 * 返回 resolveRoutedRoot 的完整结果；notes = warnings + 路由行，调用方原样打印。
 */
export function selfResolveTmp({
  variable = TEST_TMP_ROOT_VAR,
  env = process.env,
  osTmpdir = os.tmpdir,
  probe = defaultProbe,
  mkdir = defaultMkdir,
  statfs = defaultStatfs,
} = {}) {
  const resolved = resolveRoutedRoot({ variable, env, osTmpdir, probe, mkdir, statfs });
  const notes = [...resolved.warnings];
  const alreadyRouted = env.TMP === resolved.root && env.TEMP === resolved.root;
  if (resolved.source === 'variable' && !alreadyRouted) {
    env.TMP = resolved.root;
    env.TEMP = resolved.root;
    notes.push(`${TMP_ROUTE_PREFIX} ${variable}=${resolved.root} → 自解析注入本进程与子进程 TMP/TEMP`);
  }
  return { ...resolved, notes };
}

// 直呼形态：node scripts/run/lib/tmp-root.mjs --print。首行 = 解析根绝对路径
// （供 PowerShell 等入口消费），随后逐行 [tmp-route] 告警；退出码恒 0（漂移回退
// 不失败）。main-guard 内联自包含（零目录外依赖）：仅当自身被 node 直呼为主模块
// 时为 true；argv[1] 缺席（eval/动态 import 形态）恒 false，库导入零副作用。
const invokedAsScript = (() => {
  if (!process.argv[1]) return false;
  const selfPath = fileURLToPath(import.meta.url);
  return process.platform === 'win32'
    ? selfPath.toLowerCase() === path.resolve(process.argv[1]).toLowerCase()
    : selfPath === path.resolve(process.argv[1]);
})();
if (invokedAsScript) {
  const resolved = resolveRoutedRoot({ variable: TEST_TMP_ROOT_VAR });
  process.stdout.write(`${resolved.root}\n`);
  for (const warning of resolved.warnings) process.stdout.write(`${warning}\n`);
}
