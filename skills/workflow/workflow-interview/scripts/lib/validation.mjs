import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export function contractDigests(dir) {
  const cdir = join(dir, '3-contract');
  if (!existsSync(cdir)) return {};
  return Object.fromEntries(readdirSync(cdir).filter((f) => /^contract.*\.md$/i.test(f)).sort()
    .map((f) => [f, createHash('sha256').update(readFileSync(join(cdir, f))).digest('hex')]));
}

export function validationIsCurrent(dir, validation) {
  if (validation?.status !== 'valid' || validation.stale) return false;
  if (!existsSync(join(dir, '3-contract', 'contract.md'))) return false;
  if (validation.contract_digests) {
    const current = contractDigests(dir);
    const recorded = validation.contract_digests;
    return Object.keys(current).length === Object.keys(recorded).length
      && Object.entries(current).every(([name, digest]) => recorded[name] === digest);
  }
  // 旧记录未保存摘要，沿用原有时间判据，不重写历史任务。
  const limit = Date.parse(validation.ran_at) + 2000;
  const cdir = join(dir, '3-contract');
  return Number.isFinite(limit) && readdirSync(cdir).filter((f) => /^contract.*\.md$/i.test(f))
    .every((f) => statSync(join(cdir, f)).mtimeMs <= limit);
}
