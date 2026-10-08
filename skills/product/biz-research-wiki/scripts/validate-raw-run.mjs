import { readFileSync, realpathSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const tiers = ['customer_or_regulator', 'independent_media', 'attributed_restatement', 'vendor_claim', 'estimate'];
const captures = ['webfetch_full', 'webfetch_excerpt', 'search_excerpt'];
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
  && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const url = value => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};
function within(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
function unique(items, field, label) {
  const values = items.map(item => item?.[field]);
  requireValue(values.every(nonempty) && new Set(values).size === values.length, `${label}: ${field} 必须非空且唯一`);
  return new Set(values);
}
function refs(value, allowed, label, allowEmpty = false) {
  requireValue(Array.isArray(value) && (allowEmpty || value.length > 0)
    && new Set(value).size === value.length && value.every(id => allowed.has(id)), `${label}: 引用缺失、重复或无效`);
}

try {
  const args = process.argv.slice(2);
  requireValue(args.length === 4, '用法: node validate-raw-run.mjs --root <rootDir> --manifest <manifest.json>');
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    requireValue(['--root', '--manifest'].includes(args[i]) && !options[args[i]], '未知或重复参数');
    options[args[i]] = args[i + 1];
  }
  requireValue(nonempty(options['--root']) && nonempty(options['--manifest']), '缺少 root 或 manifest');
  const root = realpathSync(path.resolve(options['--root']));
  const raw = realpathSync(path.join(root, 'raw'));
  const runs = realpathSync(path.join(root, 'runs'));
  requireValue(within(root, raw) && within(root, runs), 'raw/runs 实际路径超出归档根');
  const manifestPath = realpathSync(path.resolve(options['--manifest']));
  requireValue(within(runs, manifestPath), 'manifest 必须在 runs 内');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
  requireValue(manifest?.schema_version === 1, '不支持的 schema_version');
  requireValue(nonempty(manifest.run_id) && /^\d{4}-\d{2}-\d{2}-[\p{L}\p{N}_-]+-[\p{L}\p{N}]{4,}$/u.test(manifest.run_id)
    && date(manifest.run_id.slice(0, 10)), '无效 run_id');
  requireValue(path.basename(path.dirname(manifestPath)) === manifest.run_id, 'run_id 与目录不一致');
  requireValue(statSync(path.join(path.dirname(manifestPath), 'run.md')).isFile(), '缺少 run.md');
  requireValue(['complete', 'partial'].includes(manifest.status), '无效 status');
  requireValue(nonempty(manifest.topic_prompt) && date(manifest.as_of), '缺少主题或无效 as_of');
  requireValue(Array.isArray(manifest.questions) && manifest.questions.length > 0
    && manifest.questions.every(nonempty), 'questions 必须为非空问题清单');
  requireValue(Array.isArray(manifest.objects) && manifest.objects.length > 0, '缺少对象');
  const objectIds = unique(manifest.objects, 'id', 'objects');
  requireValue(manifest.objects.every(item => nonempty(item.name) && ['company', 'product'].includes(item.kind)), '对象名称或类型无效');
  requireValue(Array.isArray(manifest.unresolved) && manifest.unresolved.every(nonempty), 'unresolved 无效');
  requireValue(Array.isArray(manifest.failed_urls) && manifest.failed_urls.every(item => url(item?.url) && nonempty(item.reason)), 'failed_urls 无效');
  requireValue(Array.isArray(manifest.artifacts) && manifest.artifacts.length > 0, '缺少 artifacts');
  unique(manifest.artifacts, 'id', 'artifacts');
  unique(manifest.artifacts, 'path', 'artifacts');
  const resolvedFiles = new Set();
  for (const item of manifest.artifacts) {
    requireValue(['source', 'report'].includes(item.kind), `${item.id}: 无效 kind`);
    requireValue(nonempty(item.path) && item.path.startsWith('raw/') && !item.path.includes('\\')
      && !item.path.split('/').some(part => ['', '.', '..'].includes(part)), `${item.id}: 无效 raw 相对路径`);
    requireValue(item.kind === 'source' ? item.path.startsWith('raw/articles/')
      : item.path.startsWith(`raw/reports/${manifest.run_id}/`), `${item.id}: kind 与目录或报告批次不一致`);
    const file = realpathSync(path.resolve(root, item.path));
    const identity = process.platform === 'win32' ? file.toLowerCase() : file;
    requireValue(within(raw, file) && statSync(file).isFile(), `${item.id}: 文件超出 raw 或不是文件`);
    requireValue(!resolvedFiles.has(identity), `${item.id}: 重复物理文件`);
    resolvedFiles.add(identity);
    requireValue(/^[a-f0-9]{64}$/.test(item.sha256), `${item.id}: SHA-256 格式无效`);
    requireValue(createHash('sha256').update(readFileSync(file)).digest('hex') === item.sha256, `${item.id}: SHA-256 不匹配`);
    if (item.kind === 'source') {
      requireValue(url(item.url) && (item.published_at === null || date(item.published_at))
        && timestamp(item.fetched_at), `${item.id}: 来源 URL 或日期无效`);
      requireValue(tiers.includes(item.source_tier) && captures.includes(item.capture), `${item.id}: 来源等级或 capture 无效`);
      requireValue(item.origin === null || url(item.origin), `${item.id}: origin 无效`);
    }
  }
  const sources = manifest.artifacts.filter(item => item.kind === 'source');
  const reports = manifest.artifacts.filter(item => item.kind === 'report');
  const sourceIds = new Set(sources.map(item => item.id));
  const coveredObjects = new Set();
  requireValue(reports.filter(item => item.role === 'overview').length === 1, '必须有且仅有一份主题报告');
  for (const report of reports) {
    refs(report.object_ids, objectIds, `${report.id}.object_ids`);
    refs(report.source_ids, sourceIds, `${report.id}.source_ids`, true);
    requireValue(report.role === undefined || report.role === 'overview', `${report.id}: 无效报告 role`);
    requireValue(['verified', 'not_run'].includes(report.verification), `${report.id}: 无效 verification`);
    requireValue(manifest.status !== 'complete' || report.verification === 'verified', 'complete 批次存在未核实报告');
    requireValue(report.source_ids.length > 0 || nonempty(report.evidence_gap), `${report.id}: 无来源报告未说明报告级缺口`);
    if (report.verification === 'verified') {
      const review = report.review;
      requireValue(nonempty(review?.author_id) && nonempty(review?.verifier_id)
        && review.author_id !== review.verifier_id && nonempty(review.notes), `${report.id}: 缺少核实记录或核实者与作者相同`);
      for (const key of ['removed', 'requalified', 'added_sources']) {
        requireValue(Number.isInteger(review.changes?.[key]) && review.changes[key] >= 0, `${report.id}: 无效核实改动计数 ${key}`);
      }
    } else {
      requireValue(nonempty(report.verification_gap), `${report.id}: 未核实但未说明原因`);
    }
    if (report.role !== 'overview') for (const id of report.object_ids) coveredObjects.add(id);
    else requireValue(report.object_ids.length === objectIds.size, '主题报告未覆盖全部对象');
  }
  requireValue(coveredObjects.size === objectIds.size, '对象缺少报告，主题报告不能替代对象报告');
  requireValue(Array.isArray(manifest.usage) && manifest.usage.length === objectIds.size, '用量记录不完整');
  const usageIds = unique(manifest.usage, 'object_id', 'usage');
  requireValue([...usageIds].every(id => objectIds.has(id)), '用量记录含未知对象');
  for (const usage of manifest.usage) {
    for (const key of ['search_calls', 'fetch_calls', 'elapsed_seconds', 'tokens']) {
      const value = usage[key];
      requireValue(value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0
        && (key === 'elapsed_seconds' || Number.isInteger(value))), `${usage.object_id}.${key}: 必须为非负数或 null`);
    }
  }
  console.log(JSON.stringify({ result: 'PASS', scope: 'manifest_structure_and_file_integrity',
    run_id: manifest.run_id, research_status: manifest.status, sources: sources.length, reports: reports.length,
    semantic_verification: 'NOT_RUN', verifier_independence: 'DECLARED_ONLY', wiki_compilation: 'NOT_RUN' }, null, 2));
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
