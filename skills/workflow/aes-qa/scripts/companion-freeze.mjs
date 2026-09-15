// 伴随目录冻结（v4 截图义务轮的 tracker 无关保留）：VERIFIED 后把 claim-complete
// 的终态截图冻结为 receipts/<attempt>/ 伴随产物——shots/ 副本 + shots-manifest.json
// + qa-report.html（一等伴随产物、出票必产）。secrets 红线：截图进任何保留产物前
// 必须机械扫描；BLOCKED 则不入库、receipt 必须 FAIL。GitLab 发布链路原样并行（零收窄）。
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FILES, atomicWriteJson, canonicalBatchId, deriveClaimSet, digestObject, loadManifest, readJson,
} from './screenshot-evidence-core.mjs';
import { scanShotsForSecrets } from './secrets-scan.mjs';
import { renderQaReportHtml } from './qa-report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const COMPANION_MANIFEST_SCHEMA = 'aes.qa.companion-shots-manifest/v1';

// 容量上限沿用上游 GitLab 批次 Balanced limits（同一批字节的第二份保留面不放宽口径）。
export const COMPANION_LIMITS = Object.freeze({
  maxShots: 16,
  maxTotalBytes: 100 * 1024 * 1024,
});

function freezeError(code, message, extra = {}) {
  const error = new Error(message);
  error.name = 'CompanionFreezeError';
  error.code = code;
  error.exitCode = extra.exitCode ?? 65;
  Object.assign(error, extra);
  return error;
}

function verifyMarker({ spool, manifest, candidateSha }) {
  const markerPath = join(spool, FILES.marker);
  if (!existsSync(markerPath)) {
    throw freezeError('MARKER_MISSING', '伴随冻结要求 aggregate marker 已落盘（publish VERIFIED 后才可冻结）');
  }
  const marker = readJson(markerPath);
  if (marker.schema !== 'aes.screenshot-evidence-marker/v1' || marker.status !== 'VERIFIED') {
    throw freezeError('MARKER_NOT_VERIFIED', `marker status=${marker.status ?? 'NOT_SET'}，仅 VERIFIED 批次可冻结伴随副本`);
  }
  if (marker.batchId !== canonicalBatchId(manifest)) throw freezeError('MARKER_IDENTITY_MISMATCH', 'marker batchId 与冻结 manifest 不符');
  if (marker.frozenManifestSha256 !== manifest.frozenManifestSha256) throw freezeError('MARKER_IDENTITY_MISMATCH', 'marker frozenManifestSha256 与 manifest 不符');
  if (marker.candidateSha !== manifest.codeState?.candidateSha) throw freezeError('MARKER_CANDIDATE_MISMATCH', 'marker candidateSha 与 manifest codeState 不符');
  if (candidateSha && marker.candidateSha !== candidateSha) {
    throw freezeError('COMPANION_STALE_CANDIDATE', `receipt candidate=${candidateSha} 与证据 candidate=${marker.candidateSha} 不符：candidate 变更后旧伴随目录随旧 receipt 同批作废，新 candidate 必须新 attempt 重跑`);
  }
  return marker;
}

// 冻结伴随目录。spool=已 VERIFIED 的 run-spool；dest=attempt 伴随目录
// （<目标仓>/.aes-worktree-board/receipts/<jobId>/<attemptId>/）；receipt=v4 QaReceipt 对象。
// 返回 { companionShots, manifestPath, reportPath, manifest }；companionShots 直接进 receipt。
export function freezeCompanionShots({ spool, dest, receipt }) {
  if (!spool || !dest || !receipt) throw freezeError('FREEZE_ARGS_REQUIRED', '需要 --spool/--dest/--receipt', { exitCode: 64 });
  if (receipt.schemaVersion !== 'aes.qa.receipt/v4') {
    throw freezeError('V4_REQUIRED', `伴随目录冻结是 v4 义务，实际 schemaVersion=${receipt.schemaVersion ?? 'NOT_SET'}`, { exitCode: 64 });
  }
  const manifest = loadManifest(spool);
  const claimSet = deriveClaimSet(manifest);
  const uniqueBlobs = claimSet.uniqueBlobs;
  if (!uniqueBlobs.length) throw freezeError('NO_CLAIM_BEARING_SHOTS', 'claim-complete 集为空（N=U=0）的批次没有伴随保留义务');
  const marker = verifyMarker({ spool, manifest, candidateSha: receipt.commitSha });

  // 同一伴随目录不容两个 candidate：candidate 前进必须新 attempt 新目录（同批作废语义）。
  const existingManifestPath = join(dest, 'shots-manifest.json');
  if (existsSync(existingManifestPath)) {
    const existing = readJson(existingManifestPath, 'COMPANION_MANIFEST_REQUIRED');
    if (existing.candidateSha !== receipt.commitSha) {
      throw freezeError('COMPANION_STALE_CANDIDATE', `伴随目录已属 candidate=${existing.candidateSha}，candidate=${receipt.commitSha} 必须新 attempt 重跑并冻结到新目录`);
    }
    // 同 candidate 幂等重冻：返回既有清单（内容寻址保证可对账）。
    const companion = receipt.screenshotEvidence?.companionShots;
    return {
      companionShots: companion ?? {
        dir: 'shots/', manifest: 'shots-manifest.json',
        manifestSha256: `sha256:${existing.manifestSha256Hex}`,
        count: existing.count, secretsScan: existing.secretsScan,
      },
      manifestPath: existingManifestPath,
      reportPath: join(dest, 'qa-report.html'),
      manifest: existing, idempotent: true,
    };
  }

  if (uniqueBlobs.length > COMPANION_LIMITS.maxShots) {
    throw freezeError('COMPANION_LIMIT_EXCEEDED', `伴随截图 U=${uniqueBlobs.length} 超上限 ${COMPANION_LIMITS.maxShots}`);
  }
  const capturesById = new Map(manifest.captures.map((capture) => [capture.captureId, capture]));
  const shots = [];
  let totalBytes = 0;
  for (const capture of uniqueBlobs) {
    const sourcePath = join(spool, ...capture.spoolRelativePath.split('/'));
    if (!existsSync(sourcePath)) throw freezeError('STABLE_BLOB_MISSING', `spool 缺少稳定副本 ${capture.captureId}`);
    const bytes = readFileSync(sourcePath);
    if (bytes.length !== capture.bytes) throw freezeError('STABLE_BLOB_MISMATCH', `${capture.captureId} 字节数与 manifest 记录不符`);
    shots.push({
      captureId: capture.captureId,
      claimIds: claimSet.claimRefs.filter((ref) => ref.captureId === capture.captureId).map((ref) => ref.claimId),
      displayFileName: capturesById.get(capture.captureId)?.displayFileName ?? `${capture.sha256}.png`,
      file: `shots/${capture.sha256}.png`,
      sha256: capture.sha256,
      bytes: bytes.length,
      ...(capture.viewport ? { viewport: `${capture.viewport.width}x${capture.viewport.height}` } : {}),
      ...(capture.theme ? { theme: capture.theme } : {}),
      _bytes: bytes,
    });
    totalBytes += bytes.length;
  }
  if (totalBytes > COMPANION_LIMITS.maxTotalBytes) {
    throw freezeError('COMPANION_LIMIT_EXCEEDED', `伴随截图合计 ${totalBytes} bytes 超上限 ${COMPANION_LIMITS.maxTotalBytes}`);
  }

  // secrets 红线：进保留产物前机械扫描；BLOCKED 则不入库（receipt 由调用方写 FAIL）。
  const secretsScan = scanShotsForSecrets(shots.map((shot) => ({ displayFileName: shot.displayFileName, bytes: shot._bytes })));
  if (secretsScan.result === 'BLOCKED') {
    return {
      blocked: true,
      secretsScan,
      detail: `secrets 扫描命中（${secretsScan.findings.map((f) => `${f.patternId}@${f.scope}`).join(', ')}）：截图不得入库，receipt 必须 outcome=FAIL`,
    };
  }

  // 冻结落盘：shots/ 副本 → shots-manifest.json → qa-report.html（出票必产）。
  mkdirSync(join(dest, 'shots'), { recursive: true });
  for (const shot of shots) {
    const target = join(dest, ...shot.file.split('/'));
    if (existsSync(target)) {
      const existing = readFileSync(target);
      if (!existing.equals(shot._bytes)) throw freezeError('CONTENT_ADDRESS_CONFLICT', `${shot.file} 与既有字节冲突`);
    } else {
      writeFileSync(target, shot._bytes);
    }
  }
  const manifestContent = {
    schema: COMPANION_MANIFEST_SCHEMA,
    jobId: receipt.jobId,
    attemptId: receipt.attemptId,
    candidateSha: receipt.commitSha,
    sourceMarker: {
      batchId: marker.batchId,
      frozenManifestSha256: marker.frozenManifestSha256,
      assertionOutcome: marker.assertionOutcome,
      noteId: marker.noteId ?? null,
    },
    shots: shots.map(({ _bytes, ...rest }) => rest),
    count: shots.length,
    totalBytes,
    secretsScan,
    generatedAt: new Date().toISOString(),
  };
  const manifestSha256Hex = digestObject(manifestContent);
  manifestContent.manifestSha256Hex = manifestSha256Hex;
  atomicWriteJson(existingManifestPath, manifestContent);

  const companionShots = {
    dir: 'shots/',
    manifest: 'shots-manifest.json',
    manifestSha256: `sha256:${manifestSha256Hex}`,
    count: shots.length,
    secretsScan,
  };
  const receiptForReport = structuredClone(receipt);
  receiptForReport.screenshotEvidence = { ...(receipt.screenshotEvidence ?? { required: true }), required: true, companionShots };
  const reportPath = join(dest, 'qa-report.html');
  writeFileSync(reportPath, renderQaReportHtml(receiptForReport, manifestContent), 'utf8');
  return { companionShots, manifestPath: existingManifestPath, reportPath, manifest: manifestContent, idempotent: false };
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token !== '--spool' && token !== '--dest' && token !== '--receipt' && token !== '--json') {
      throw freezeError('USAGE', `未知参数 ${token}（支持 --spool/--dest/--receipt/--json）`, { exitCode: 64 });
    }
    if (token === '--json') {
      values.json = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) throw freezeError('USAGE', `参数 ${token} 缺少值`, { exitCode: 64 });
    values[token.slice(2)] = value;
    index += 1;
  }
  if (!values.spool || !values.dest || !values.receipt) throw freezeError('USAGE', '需要 --spool <run-spool> --dest <attempt-dir> --receipt <qa-receipt.json>', { exitCode: 64 });
  return values;
}

const isMain = (() => {
  try {
    return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const receipt = JSON.parse(readFileSync(args.receipt, 'utf8'));
    const result = freezeCompanionShots({ spool: args.spool, dest: args.dest, receipt });
    const payload = result.blocked
      ? { schema: 'aes.qa.companion-freeze-result/v1', resultKind: 'business_failure', ...result }
      : {
        schema: 'aes.qa.companion-freeze-result/v1', resultKind: 'success',
        companionShots: result.companionShots, manifestPath: result.manifestPath,
        reportPath: result.reportPath, idempotent: result.idempotent ?? false,
      };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    process.exit(result.blocked ? 1 : 0);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      schema: 'aes.qa.companion-freeze-result/v1',
      resultKind: error.code === 'USAGE' ? 'usage_error' : 'business_failure',
      error: { code: error.code ?? 'UNEXPECTED_ERROR', message: error.message },
    })}\n`);
    process.exit(error.exitCode ?? 65);
  }
}
