import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync,
  statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRecordedAdapter } from './request-byte-recorder.mjs';

export const FILES = Object.freeze({
  manifest: 'capture-manifest.json',
  receipt: 'publish-receipt.json',
  marker: 'aggregate-marker.json',
  gateReceipt: 'qa-gate-receipt.json',
  abandon: 'abandon-record.json',
  cleanup: 'cleanup-receipt.json',
});

export const BALANCED_LIMITS = Object.freeze({
  maxClaimRefs: 32,
  maxUniqueImages: 16,
  maxImageBytes: 10 * 1024 * 1024,
  maxTotalUniqueBytes: 100 * 1024 * 1024,
  maxNoteBytes: 64 * 1024,
  maxFileNameUtf8Bytes: 180,
  maxClaimIdUtf8Bytes: 128,
  maxFindingTextUtf8Bytes: 256,
  reservedUploadUrlUtf8Bytes: 512,
});

export const DEFAULT_RETRY_POLICY = Object.freeze({
  maxAttemptsPerStage: 3,
  maxPublisherInvocationsPerBatch: 2,
  retryBackoffMs: [250, 1000],
});

export class EvidenceError extends Error {
  constructor(code, message, { exitCode = 65, field = null, detail = null } = {}) {
    super(message);
    this.name = 'EvidenceError';
    this.code = code;
    this.exitCode = exitCode;
    this.field = field;
    this.detail = detail;
  }
}

export function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function digestObject(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), 'utf8'));
}

export function atomicWriteJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const fd = openSync(temporary, 'wx');
  try {
    writeFileSync(fd, payload, 'utf8');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporary, path);
  return payload;
}

export function readJson(path, code = 'DURABLE_STATE_MISSING') {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new EvidenceError(code, `cannot read durable state ${path}: ${error.message}`, { exitCode: 65 });
  }
}

export function manifestPath(spool) {
  return join(spool, FILES.manifest);
}

export function loadManifest(spool) {
  const manifest = readJson(manifestPath(spool), 'CAPTURE_MANIFEST_REQUIRED');
  if (manifest.schema !== 'aes.screenshot-capture-manifest/v1') {
    throw new EvidenceError('CAPTURE_MANIFEST_SCHEMA_INVALID', `unsupported manifest schema: ${manifest.schema ?? 'missing'}`);
  }
  if (existsSync(join(spool, FILES.abandon))) {
    throw new EvidenceError('ATTEMPT_ABANDONED', 'this qaRoundId/attemptId was explicitly abandoned and cannot be reused');
  }
  manifest.captures ??= [];
  manifest.requiredEvidence ??= [];
  manifest.manifestRevision ??= 0;
  return manifest;
}

export function ensureEvidenceTarget(manifest, { usage = false } = {}) {
  const target = manifest.evidenceTarget;
  if (!target || target.provider !== 'gitlab' || !target.host || target.projectId === undefined || target.issueIid === undefined) {
    throw new EvidenceError('EVIDENCE_TARGET_REQUIRED', 'formal screenshot run requires evidenceTarget before capture', {
      exitCode: usage ? 64 : 65,
      field: 'evidenceTarget',
    });
  }
}

function writeDurableBlob(sourcePath, destinationPath) {
  const bytes = readFileSync(sourcePath);
  mkdirSync(dirname(destinationPath), { recursive: true });
  if (existsSync(destinationPath)) {
    const existing = readFileSync(destinationPath);
    if (!existing.equals(bytes)) throw new EvidenceError('CONTENT_ADDRESS_CONFLICT', 'content-addressed blob differs from existing bytes');
    return bytes;
  }
  const temporary = `${destinationPath}.tmp-${process.pid}-${Date.now()}`;
  const fd = openSync(temporary, 'wx');
  try {
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporary, destinationPath);
  return bytes;
}

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/i.exec(String(value ?? ''));
  if (!match) throw new EvidenceError('VIEWPORT_INVALID', 'viewport must be WIDTHxHEIGHT', { exitCode: 64, field: 'viewport' });
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function captureEvidence({ spool, file, captureId, claim = null, finding = null, role, viewport, theme, sensitivity, diagnosticOnly = false }) {
  const manifest = loadManifest(spool);
  ensureEvidenceTarget(manifest, { usage: true });
  if (manifest.terminal || manifest.frozenManifestSha256) {
    throw new EvidenceError('BATCH_ALREADY_FROZEN', 'a frozen attempt cannot accept additional capture evidence');
  }
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    throw new EvidenceError('CAPTURE_FILE_REQUIRED', 'capture file does not exist', { exitCode: 64, field: 'file' });
  }
  if (!captureId || !role || !theme) {
    throw new EvidenceError('CAPTURE_METADATA_REQUIRED', 'capture-id, role, viewport and theme are required', { exitCode: 64 });
  }
  const sensitiveContentCheck = String(sensitivity ?? 'UNKNOWN').toUpperCase();
  const sourceBytes = readFileSync(file);
  const sha256 = sha256Bytes(sourceBytes);
  const existing = manifest.captures.find((entry) => entry.captureId === captureId);
  if (existing) {
    if (existing.sha256 !== sha256) {
      throw new EvidenceError('CAPTURE_ID_CONFLICT', `captureId ${captureId} already identifies different bytes`);
    }
    return {
      schema: 'aes.screenshot-spool-ack/v1',
      qaRoundId: manifest.qaRoundId,
      attemptId: manifest.attemptId,
      captureId,
      manifestRevision: existing.manifestRevision ?? manifest.manifestRevision,
      manifestDigest: `sha256:${digestObject(manifest)}`,
      captureSha256: sha256,
      bytes: existing.bytes,
      durability: 'FILE_CLOSED_AND_MANIFEST_ATOMICALLY_REPLACED',
      remoteWrites: 0,
      idempotent: true,
    };
  }
  const relative = `images/${sha256}.png`;
  const stablePath = join(spool, ...relative.split('/'));
  const bytes = writeDurableBlob(file, stablePath);
  const isDiagnostic = diagnosticOnly || role === 'navigation';
  const participatesIn = [];
  if (claim) participatesIn.push(`claim:${claim}`);
  if (finding) participatesIn.push(`finding:${finding}`);
  manifest.manifestRevision += 1;
  manifest.captures.push({
    captureId,
    claimId: claim,
    role,
    displayFileName: basename(file),
    spoolRelativePath: relative,
    mimeType: 'image/png',
    bytes: bytes.length,
    sha256,
    viewport: parseViewport(viewport),
    theme,
    capturedAt: new Date().toISOString(),
    participatesIn,
    sensitiveContentCheck,
    publishDisposition: isDiagnostic ? 'DIAGNOSTIC_ONLY' : 'REQUIRED',
    ...(finding ? { findingId: finding } : {}),
    ...(isDiagnostic ? { exclusionReason: 'navigation/diagnostic capture does not support a claim, verdict or Finding' } : {}),
    manifestRevision: manifest.manifestRevision,
  });
  atomicWriteJson(manifestPath(spool), manifest);
  return {
    schema: 'aes.screenshot-spool-ack/v1',
    qaRoundId: manifest.qaRoundId,
    attemptId: manifest.attemptId,
    captureId,
    manifestRevision: manifest.manifestRevision,
    manifestDigest: `sha256:${digestObject(manifest)}`,
    captureSha256: sha256,
    bytes: bytes.length,
    disposition: isDiagnostic ? 'DIAGNOSTIC_ONLY' : 'REQUIRED',
    durability: 'FILE_CLOSED_AND_MANIFEST_ATOMICALLY_REPLACED',
    remoteWrites: 0,
  };
}

function captureVariant(capture) {
  return `${capture.theme}@${capture.viewport?.width}x${capture.viewport?.height}`;
}

export function deriveClaimSet(manifest) {
  const requiredCaptures = manifest.captures.filter((capture) => capture.publishDisposition === 'REQUIRED');
  const refs = new Map();
  const missing = [];
  for (const requirement of manifest.requiredEvidence || []) {
    for (const variant of requirement.requiredVariants || []) {
      const matching = requiredCaptures.filter((capture) => capture.claimId === requirement.claimId && captureVariant(capture) === variant);
      if (!matching.length) missing.push(`${requirement.claimId}:${variant}`);
      for (const capture of matching) refs.set(`${requirement.claimId}\u0000${capture.captureId}`, {
        claimId: requirement.claimId, captureId: capture.captureId, source: 'spec',
      });
    }
  }
  for (const capture of requiredCaptures) {
    const claimIds = (capture.participatesIn || [])
      .filter((entry) => entry.startsWith('claim:'))
      .map((entry) => entry.slice('claim:'.length));
    if (!claimIds.length && capture.claimId) claimIds.push(capture.claimId);
    if (!claimIds.length) {
      missing.push(`${capture.captureId}:claim`);
      continue;
    }
    for (const claimId of claimIds) refs.set(`${claimId}\u0000${capture.captureId}`, {
      claimId, captureId: capture.captureId, source: capture.findingId ? 'finding' : 'verdict',
      ...(capture.findingId ? { findingId: capture.findingId } : {}),
    });
  }
  const claimRefs = [...refs.values()];
  const referencedIds = new Set(claimRefs.map((entry) => entry.captureId));
  const captures = requiredCaptures.filter((capture) => referencedIds.has(capture.captureId));
  const uniqueBlobs = [...new Map(captures.map((capture) => [capture.sha256, capture])).values()];
  return { claimRefs, captures, uniqueBlobs, missing };
}

function validateCandidate(manifest, candidate) {
  const codeState = manifest.codeState || {};
  if (codeState.finality === 'final') {
    const expected = codeState.candidateSha;
    if (!/^[0-9a-f]{40}$/i.test(String(candidate ?? expected ?? ''))) {
      throw new EvidenceError('FINAL_CANDIDATE_REQUIRED', 'final terminal requires a full 40-character candidate SHA');
    }
    if (expected && candidate && expected !== candidate) {
      throw new EvidenceError('CANDIDATE_MISMATCH', `terminal candidate ${candidate} differs from manifest ${expected}`);
    }
    if (codeState.worktreeDirty || codeState.headSha !== expected) {
      throw new EvidenceError('FINAL_CANDIDATE_PROVENANCE_INVALID', 'final evidence requires clean headSha == candidateSha');
    }
  }
}

export function freezeTerminal({ spool, outcome, candidate = null }) {
  const manifest = loadManifest(spool);
  ensureEvidenceTarget(manifest);
  if (!['PASS', 'FAIL', 'BLOCKED'].includes(outcome)) {
    throw new EvidenceError('TERMINAL_OUTCOME_INVALID', 'outcome must be PASS, FAIL or BLOCKED', { exitCode: 64, field: 'outcome' });
  }
  validateCandidate(manifest, candidate);
  if (manifest.terminal && manifest.frozenManifestSha256) {
    if (manifest.terminal.outcome !== outcome) {
      throw new EvidenceError('TERMINAL_OUTCOME_CONFLICT', 'an attempt can freeze only one terminal outcome');
    }
    return terminalSummary(manifest, true);
  }
  const set = deriveClaimSet(manifest);
  if (set.missing.length) {
    throw new EvidenceError('CLAIM_SET_INCOMPLETE', `claim-complete set is missing ${set.missing.join(', ')}`, { detail: { missing: set.missing } });
  }
  manifest.terminal = {
    outcome,
    formedAt: new Date().toISOString(),
    evidenceState: set.claimRefs.length ? 'BATCH_FROZEN' : 'LOCAL_SPOOLED',
    claimIds: [...new Set(set.claimRefs.map((entry) => entry.claimId))],
    screenshotEvidenceRequired: set.claimRefs.length > 0,
    reconciliation: {
      claimRefs: set.claimRefs,
      uniqueSha256: set.uniqueBlobs.map((capture) => capture.sha256),
      missingCaptureIds: [],
    },
  };
  delete manifest.frozenManifestSha256;
  manifest.frozenManifestSha256 = digestObject(manifest);
  atomicWriteJson(manifestPath(spool), manifest);
  return terminalSummary(manifest, false);
}

function terminalSummary(manifest, idempotent) {
  const set = deriveClaimSet(manifest);
  return {
    schema: 'aes.screenshot-terminal-result/v1',
    qaRoundId: manifest.qaRoundId,
    attemptId: manifest.attemptId,
    assertionOutcome: manifest.terminal.outcome,
    evidenceState: manifest.terminal.evidenceState,
    screenshotEvidenceRequired: set.claimRefs.length > 0,
    N: set.claimRefs.length,
    U: set.uniqueBlobs.length,
    excludedDiagnostic: manifest.captures.filter((capture) => capture.publishDisposition === 'DIAGNOSTIC_ONLY').length,
    frozenManifestSha256: manifest.frozenManifestSha256,
    remoteWrites: 0,
    idempotent,
  };
}

export function cleanupEvidence({ spool, abandon = false, reason = null, actor = null }) {
  const manifestFile = manifestPath(spool);
  const manifest = readJson(manifestFile, 'CAPTURE_MANIFEST_REQUIRED');
  const abandonPath = join(spool, FILES.abandon);
  if (abandon) {
    if (!reason || !actor) throw new EvidenceError('ABANDON_AUDIT_REQUIRED', 'abandon requires non-empty reason and actor', { exitCode: 64 });
    if (existsSync(join(spool, FILES.marker))) throw new EvidenceError('VERIFIED_BATCH_CANNOT_BE_ABANDONED', 'a VERIFIED batch cannot be abandoned');
    const record = {
      schema: 'aes.screenshot-evidence-abandon/v1', qaRoundId: manifest.qaRoundId, attemptId: manifest.attemptId,
      status: 'ABANDONED', reason, actor, abandonedAt: new Date().toISOString(), remoteWrites: 0,
    };
    if (existsSync(abandonPath)) {
      const existing = readJson(abandonPath);
      if (existing.reason !== reason || existing.actor !== actor) throw new EvidenceError('ABANDON_RECORD_CONFLICT', 'abandon record is immutable');
    } else atomicWriteJson(abandonPath, record);
  } else {
    const markerPath = join(spool, FILES.marker);
    const gateReceiptPath = join(spool, FILES.gateReceipt);
    if (!existsSync(markerPath) || !existsSync(gateReceiptPath)) {
      throw new EvidenceError('CLEANUP_NOT_ELIGIBLE', 'cleanup requires VERIFIED marker plus a persisted gate/QaReceipt consumer');
    }
    const marker = readJson(markerPath);
    const gateReceipt = readJson(gateReceiptPath);
    if (marker.status !== 'VERIFIED' || gateReceipt.batchId !== marker.batchId) {
      throw new EvidenceError('CLEANUP_NOT_ELIGIBLE', 'marker and gate receipt do not prove a consumed VERIFIED batch');
    }
  }
  let deletedImages = 0;
  for (const capture of manifest.captures || []) {
    const path = join(spool, ...String(capture.spoolRelativePath || '').split('/'));
    if (existsSync(path)) {
      unlinkSync(path);
      deletedImages += 1;
    }
  }
  const result = {
    schema: 'aes.screenshot-evidence-cleanup/v1', qaRoundId: manifest.qaRoundId, attemptId: manifest.attemptId,
    outcome: abandon ? 'ABANDONED_AND_CLEANED' : 'VERIFIED_BYTES_CLEANED', deletedImages,
    retained: [FILES.manifest, abandon ? FILES.abandon : FILES.marker], remoteWrites: 0, cleanedAt: new Date().toISOString(),
  };
  atomicWriteJson(join(spool, FILES.cleanup), result);
  return result;
}

function computeFrozenManifestDigest(manifest) {
  const copy = structuredClone(manifest);
  delete copy.frozenManifestSha256;
  return digestObject(copy);
}

function codeStateIdentity(manifest) {
  if (manifest.codeState?.finality === 'final') return manifest.codeState.candidateSha;
  return `sha256:${digestObject(manifest.codeState || {})}`;
}

export function canonicalBatchId(manifest) {
  const target = manifest.evidenceTarget;
  const identity = [
    target.provider, target.host, target.projectId, target.issueIid,
    manifest.qaRoundId, manifest.attemptId, codeStateIdentity(manifest), manifest.frozenManifestSha256,
  ];
  return `sha256:${sha256Bytes(Buffer.from(identity.map(String).join('\n'), 'utf8'))}`;
}

function parseJsonOption(value, fallback, code) {
  if (!value) return structuredClone(fallback);
  try { return typeof value === 'string' ? JSON.parse(value) : structuredClone(value); }
  catch (error) { throw new EvidenceError(code, `invalid JSON option: ${error.message}`, { exitCode: 64 }); }
}

function assertExactKeys(value, allowed, code) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new EvidenceError(code, `unsupported policy fields: ${unknown.join(', ')}`, { exitCode: 64 });
}

function utf8Bytes(value) {
  return Buffer.byteLength(String(value ?? ''), 'utf8');
}

function renderEvidenceNote({ manifest, batchId, claimSet, uploadsBySha, placeholderUrls = false }) {
  const candidate = manifest.codeState?.candidateSha ?? 'nonFinal';
  const environmentDigest = manifest.environment?.environmentDigest ?? 'missing';
  const lines = [
    '## Screenshot evidence batch', '',
    `- QA round: \`${manifest.qaRoundId}\``,
    `- Attempt: \`${manifest.attemptId}\``,
    `- Target: \`gitlab://${manifest.evidenceTarget.host}/projects/${manifest.evidenceTarget.projectId}/issues/${manifest.evidenceTarget.issueIid}\``,
    `- Terminal assertion: **${manifest.terminal.outcome}**`,
    `- Candidate SHA: \`${candidate}\``,
    `- Frozen manifest SHA-256: \`${manifest.frozenManifestSha256}\``,
    `- Environment SHA-256: \`${environmentDigest}\``,
    `- Kind: \`${manifest.kind || 'acceptance'}\``, '',
    '| Claim | Capture | Viewport / theme | SHA-256 | Evidence |',
    '| --- | --- | --- | --- | --- |',
  ];
  const captures = new Map(manifest.captures.map((capture) => [capture.captureId, capture]));
  for (const ref of claimSet.claimRefs) {
    const capture = captures.get(ref.captureId);
    const upload = uploadsBySha.get(capture.sha256);
    const url = placeholderUrls ? '' : upload?.gitlabUrl;
    lines.push(`| ${ref.claimId} | ${capture.captureId} | ${capture.viewport.width}×${capture.viewport.height} / ${capture.theme} | \`${capture.sha256}\` | [${capture.displayFileName}](${url || ''}) |`);
  }
  for (const finding of manifest.findings || []) {
    lines.push('', `- Finding ${finding.findingId} / ${finding.claimId}: ${finding.summary}`);
  }
  lines.push('', `- Reconciliation: claim refs N=${claimSet.claimRefs.length}; unique blobs U=${claimSet.uniqueBlobs.length}; required ${claimSet.claimRefs.length} = captured ${claimSet.claimRefs.length} = indexed ${claimSet.claimRefs.length} = verified ${claimSet.uniqueBlobs.length}`);
  lines.push(`- Batch ID: \`${batchId}\``);
  return `${lines.join('\n')}\n`;
}

export function preflightManifest(manifest, { limits: limitsInput = null, retryPolicy: retryInput = null } = {}) {
  ensureEvidenceTarget(manifest);
  if (!manifest.terminal || !manifest.frozenManifestSha256) throw new EvidenceError('TERMINAL_OUTCOME_REQUIRED', 'publish requires a frozen terminal attempt');
  if (computeFrozenManifestDigest(manifest) !== manifest.frozenManifestSha256) throw new EvidenceError('FROZEN_MANIFEST_DIGEST_MISMATCH', 'manifest changed after terminal freeze');
  const claimSet = deriveClaimSet(manifest);
  if (claimSet.missing.length) throw new EvidenceError('CLAIM_SET_INCOMPLETE', 'claim-complete reconciliation failed', { detail: { missing: claimSet.missing } });
  if (!claimSet.claimRefs.length) throw new EvidenceError('NO_SCREENSHOT_EVIDENCE_REQUIRED', 'N=U=0 run must not invoke publisher');
  const limits = parseJsonOption(limitsInput, BALANCED_LIMITS, 'LIMITS_JSON_INVALID');
  const retryPolicy = parseJsonOption(retryInput, DEFAULT_RETRY_POLICY, 'RETRY_POLICY_JSON_INVALID');
  assertExactKeys(limits, Object.keys(BALANCED_LIMITS), 'LIMIT_POLICY_UNKNOWN_FIELD');
  assertExactKeys(retryPolicy, Object.keys(DEFAULT_RETRY_POLICY), 'RETRY_POLICY_UNKNOWN_FIELD');
  for (const [key, value] of Object.entries(BALANCED_LIMITS)) if (!(Number.isInteger(limits[key]) && limits[key] > 0)) throw new EvidenceError('LIMIT_POLICY_INVALID', `${key} must be a positive finite integer`);
  if (retryPolicy.maxAttemptsPerStage !== 3 || retryPolicy.maxPublisherInvocationsPerBatch !== 2 || JSON.stringify(retryPolicy.retryBackoffMs) !== '[250,1000]') {
    throw new EvidenceError('RETRY_POLICY_INVALID', 'v1 requires A=3, R=2 and backoff [250,1000]', { exitCode: 64 });
  }
  const exceeded = [];
  if (claimSet.claimRefs.length > limits.maxClaimRefs) exceeded.push('maxClaimRefs');
  if (claimSet.uniqueBlobs.length > limits.maxUniqueImages) exceeded.push('maxUniqueImages');
  let totalUniqueBytes = 0;
  for (const capture of claimSet.uniqueBlobs) {
    const path = join(dirname(manifest.__path), ...capture.spoolRelativePath.split('/'));
    if (!existsSync(path)) throw new EvidenceError('STABLE_BLOB_MISSING', `stable blob missing for ${capture.captureId}`);
    const bytes = readFileSync(path);
    if (bytes.length !== capture.bytes || sha256Bytes(bytes) !== capture.sha256) throw new EvidenceError('STABLE_BLOB_MISMATCH', `stable blob bytes/hash mismatch for ${capture.captureId}`);
    totalUniqueBytes += bytes.length;
    if (bytes.length > limits.maxImageBytes) exceeded.push('maxImageBytes');
  }
  if (totalUniqueBytes > limits.maxTotalUniqueBytes) exceeded.push('maxTotalUniqueBytes');
  for (const capture of claimSet.captures) {
    if (utf8Bytes(capture.displayFileName) > limits.maxFileNameUtf8Bytes) exceeded.push('maxFileNameUtf8Bytes');
    if (!['CLEAR'].includes(String(capture.sensitiveContentCheck).toUpperCase())) exceeded.push('sensitiveContentCheck');
  }
  for (const ref of claimSet.claimRefs) if (utf8Bytes(ref.claimId) > limits.maxClaimIdUtf8Bytes) exceeded.push('maxClaimIdUtf8Bytes');
  for (const finding of manifest.findings || []) if (utf8Bytes(finding.summary) > limits.maxFindingTextUtf8Bytes) exceeded.push('maxFindingTextUtf8Bytes');
  const batchId = canonicalBatchId(manifest);
  const renderedKnownUtf8Bytes = utf8Bytes(renderEvidenceNote({ manifest, batchId, claimSet, uploadsBySha: new Map(), placeholderUrls: true }));
  const noteBytesUpperBound = renderedKnownUtf8Bytes + claimSet.uniqueBlobs.length * limits.reservedUploadUrlUtf8Bytes;
  if (noteBytesUpperBound > limits.maxNoteBytes) exceeded.push('maxNoteBytes');
  if (exceeded.length) {
    throw new EvidenceError(exceeded.includes('sensitiveContentCheck') ? 'SENSITIVE_CONTENT_NOT_CLEAR' : 'BATCH_LIMIT_EXCEEDED', 'frozen batch failed local preflight', {
      detail: { exceeded: [...new Set(exceeded)], observed: { claimRefs: claimSet.claimRefs.length, uniqueImages: claimSet.uniqueBlobs.length, totalUniqueBytes, renderedKnownUtf8Bytes, noteBytesUpperBound } },
    });
  }
  return { manifest, claimSet, limits, retryPolicy, batchId, totalUniqueBytes, renderedKnownUtf8Bytes, noteBytesUpperBound };
}

function zeroCost() {
  return { gitlabUploadRequests: 0, gitlabNoteCreateRequests: 0, gitlabNoteReadRequests: 0, gitlabAttachmentDownloadRequests: 0, gitlabHttpRequests: 0, uploadedBytes: 0, downloadedBytes: 0 };
}

function addCost(a, b) {
  const result = zeroCost();
  for (const key of Object.keys(result)) result[key] = (a?.[key] || 0) + (b?.[key] || 0);
  return result;
}

function receiptCost(receipt) {
  return (receipt.attempts || []).reduce((sum, attempt) => addCost(sum, attempt.costDelta), zeroCost());
}

async function loadAdapter(modulePath, options) {
  const path = modulePath || join(dirname(fileURLToPath(import.meta.url)), 'gitlab-live-adapter.mjs');
  const imported = await import(pathToFileURL(path).href);
  if (typeof imported.createGitLabAdapter !== 'function') throw new EvidenceError('ADAPTER_INVALID', 'adapter module must export createGitLabAdapter', { exitCode: 64 });
  return imported.createGitLabAdapter({ options });
}

function publicPublishResult(receipt, { idempotent = false, newUploads = null, newNotes = null } = {}) {
  const payload = {
    schema: 'aes.screenshot-evidence-publish-result/v1',
    resultKind: receipt.resultKind,
    batchId: receipt.batchId,
    assertionOutcome: receipt.assertionOutcome,
    evidenceState: receipt.evidenceState,
    releaseEligibility: receipt.releaseEligibility,
    N: receipt.reconciliation.claimRefs,
    U: receipt.reconciliation.uniqueBlobs,
    verifiedU: receipt.reconciliation.verified,
    noteId: receipt.note?.noteId ?? null,
    noteUrl: receipt.note?.noteUrl ?? null,
    markerPath: receipt.modelSummary?.marker,
    cost: receipt.cost,
    idempotent,
    newUploads: newUploads ?? (idempotent ? 0 : receipt.cost.gitlabUploadRequests),
    newNotes: newNotes ?? (idempotent ? 0 : receipt.cost.gitlabNoteCreateRequests),
  };
  return payload;
}

function persistPreflightFailure({ manifest, manifestFile, receiptPath, error }) {
  if (!(error instanceof EvidenceError) || error.exitCode !== 65 || !manifest.terminal || !manifest.frozenManifestSha256 || !manifest.evidenceTarget) return;
  let batchId;
  try { batchId = canonicalBatchId(manifest); } catch { return; }
  const claimSet = deriveClaimSet(manifest);
  const delta = zeroCost();
  const modelSummary = {
    batchIdPrefix: batchId.slice(7, 19), assertion: manifest.terminal.outcome,
    evidence: manifest.terminal.evidenceState, release: 'BLOCKED', error: error.code,
    remoteWrites: 0, receipt: receiptPath,
  };
  const controlSummaryUtf8Bytes = utf8Bytes(JSON.stringify(modelSummary));
  if (controlSummaryUtf8Bytes > 1024) {
    modelSummary.receipt = FILES.receipt;
  }
  const receipt = {
    schema: 'aes.screenshot-evidence-receipt/v1', resultKind: 'business_failure', batchId,
    qaRoundId: manifest.qaRoundId, attemptId: manifest.attemptId,
    assertionOutcome: manifest.terminal.outcome, evidenceState: manifest.terminal.evidenceState,
    releaseEligibility: 'BLOCKED', evidenceTarget: manifest.evidenceTarget,
    codeState: manifest.codeState, frozenManifestSha256: manifest.frozenManifestSha256,
    reconciliation: {
      claimRefs: claimSet.claimRefs.length, uniqueBlobs: claimSet.uniqueBlobs.length,
      required: claimSet.claimRefs.length + claimSet.missing.length,
      captured: claimSet.claimRefs.length, uploadedOrReused: 0, indexedInNote: 0, verified: 0,
      missingCaptureIds: claimSet.missing, unexpectedCaptureIds: [],
    },
    lastPublishAttempt: {
      phase: 'PREFLIGHT', outcome: 'REJECTED', code: error.code,
      message: error.message, retryable: false, ...(error.detail ? error.detail : {}),
    },
    cost: {
      scope: 'batch_cumulative', claimRefs: claimSet.claimRefs.length, uniqueBlobs: claimSet.uniqueBlobs.length,
      publisherInvocations: 1, ...delta, logicalVerificationBatches: 0,
      modelImageReadsDuringPublish: 0, controlSummaryUtf8Bytes: utf8Bytes(JSON.stringify(modelSummary)),
    },
    attempts: [{ attempt: 1, command: 'publish', outcome: 'REJECTED', costDelta: delta }],
    modelSummary,
  };
  atomicWriteJson(receiptPath, receipt);
}

export async function publishEvidence({ manifest: manifestFile, limits = null, retryPolicy = null, adapterModule = null, adapterOptions = null, recorder = null }) {
  if (!manifestFile) throw new EvidenceError('MANIFEST_PATH_REQUIRED', 'publish requires --manifest', { exitCode: 64 });
  const manifest = readJson(manifestFile, 'CAPTURE_MANIFEST_REQUIRED');
  Object.defineProperty(manifest, '__path', { value: manifestFile, enumerable: false, configurable: true });
  const receiptPath = join(dirname(manifestFile), FILES.receipt);
  if (existsSync(receiptPath)) {
    const existing = readJson(receiptPath);
    if (existing.evidenceState === 'VERIFIED') return publicPublishResult(existing, { idempotent: true });
    throw new EvidenceError('RESUME_REQUIRED', 'existing incomplete receipt must be resumed, not republished');
  }
  let context;
  try {
    context = preflightManifest(manifest, { limits, retryPolicy });
  } catch (error) {
    persistPreflightFailure({ manifest, manifestFile, receiptPath, error });
    throw error;
  } finally { delete manifest.__path; }
  const { claimSet, batchId, totalUniqueBytes } = context;
  const options = parseJsonOption(adapterOptions, {}, 'ADAPTER_OPTIONS_JSON_INVALID');
  const rawAdapter = await loadAdapter(adapterModule, options);
  const adapter = createRecordedAdapter(rawAdapter, { recorderPath: recorder, batchId });
  const attempt = { attempt: 1, command: 'publish', outcome: 'RUNNING', costDelta: zeroCost() };
  const releaseEligibility = 'BLOCKED';
  const receipt = {
    schema: 'aes.screenshot-evidence-receipt/v1', resultKind: 'unexpected_error', batchId,
    qaRoundId: manifest.qaRoundId, attemptId: manifest.attemptId, assertionOutcome: manifest.terminal.outcome,
    evidenceState: 'BATCH_FROZEN', releaseEligibility,
    evidenceTarget: manifest.evidenceTarget, codeState: manifest.codeState,
    frozenManifestSha256: manifest.frozenManifestSha256,
    reconciliation: {
      claimRefs: claimSet.claimRefs.length, uniqueBlobs: claimSet.uniqueBlobs.length,
      required: claimSet.claimRefs.length, captured: claimSet.claimRefs.length, uploadedOrReused: 0,
      indexedInNote: 0, verified: 0, missingCaptureIds: [], unexpectedCaptureIds: [],
    },
    uploads: [], note: { noteId: null, noteUrl: null, noteState: 'NONE' },
    verification: { logicalBatches: 0, noteRead: null, attachments: { checked: 0, http200: 0, bytesMatched: 0, sha256Matched: 0 } },
    cost: { scope: 'batch_cumulative', claimRefs: claimSet.claimRefs.length, uniqueBlobs: claimSet.uniqueBlobs.length, publisherInvocations: 1, ...zeroCost(), logicalVerificationBatches: 0, modelImageReadsDuringPublish: 0 },
    attempts: [attempt],
  };
  const persist = () => atomicWriteJson(receiptPath, receipt);
  persist();
  const invoke = async (operation, input, bytes = 0) => {
    attempt.costDelta.gitlabHttpRequests += 1;
    if (operation === 'uploadAttachment') { attempt.costDelta.gitlabUploadRequests += 1; attempt.costDelta.uploadedBytes += bytes; }
    if (operation === 'createNote') attempt.costDelta.gitlabNoteCreateRequests += 1;
    if (operation === 'getNote' || operation === 'findNotesByMarker') attempt.costDelta.gitlabNoteReadRequests += 1;
    if (operation === 'downloadAttachment') attempt.costDelta.gitlabAttachmentDownloadRequests += 1;
    try {
      const result = await adapter[operation](input);
      if (operation === 'downloadAttachment') attempt.costDelta.downloadedBytes += Buffer.byteLength(result);
      return result;
    } finally {
      receipt.cost = { ...receipt.cost, ...receiptCost(receipt) };
      persist();
    }
  };
  const stageCode = (operation) => ({
    uploadAttachment: 'GITLAB_UPLOAD_FAILED', createNote: 'GITLAB_NOTE_CREATE_FAILED',
    getNote: 'GITLAB_NOTE_READ_FAILED', findNotesByMarker: 'AMBIGUOUS_NOTE',
    downloadAttachment: 'GITLAB_ATTACHMENT_VERIFY_FAILED',
  })[operation] || 'GITLAB_OPERATION_FAILED';
  const invokeStage = async (operation, input, bytes = 0) => {
    for (let stageAttempt = 1; stageAttempt <= context.retryPolicy.maxAttemptsPerStage; stageAttempt += 1) {
      try {
        return await invoke(operation, input, bytes);
      } catch (error) {
        if (error?.kind === 'ambiguous' || String(error?.code || '').startsWith('AMBIGUOUS_')) {
          throw new EvidenceError(error.code || stageCode(operation), error.message, { exitCode: 75 });
        }
        const transient = error?.kind === 'transient' || /^HTTP_5\d\d$/.test(String(error?.code || ''));
        if (!transient || stageAttempt === context.retryPolicy.maxAttemptsPerStage) {
          throw new EvidenceError(stageCode(operation), error.message, { exitCode: transient ? 75 : 70 });
        }
        if (!process.env.AES_SCREENSHOT_EVIDENCE_TEST_NO_BACKOFF) {
          const delay = context.retryPolicy.retryBackoffMs[stageAttempt - 1] || 0;
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw new EvidenceError(stageCode(operation), `${operation} retry budget exhausted`, { exitCode: 75 });
  };
  try {
    for (const capture of claimSet.uniqueBlobs) {
      const filePath = join(dirname(manifestFile), ...capture.spoolRelativePath.split('/'));
      const uploaded = await invokeStage('uploadAttachment', { target: manifest.evidenceTarget, filePath, fileName: capture.displayFileName, bytes: capture.bytes }, capture.bytes);
      receipt.uploads.push({ captureId: capture.captureId, sha256: capture.sha256, bytes: capture.bytes, gitlabUrl: uploaded.url, gitlabMarkdown: uploaded.markdown, uploadState: 'UPLOADED' });
      receipt.reconciliation.uploadedOrReused = receipt.uploads.length;
      receipt.evidenceState = receipt.uploads.length === claimSet.uniqueBlobs.length ? 'UPLOADED' : 'BATCH_FROZEN';
      persist();
      const crashAfter = Number.parseInt(process.env.AES_SCREENSHOT_EVIDENCE_CRASH_AFTER_PERSISTED_UPLOADS || '', 10);
      if (Number.isInteger(crashAfter) && crashAfter > 0 && receipt.uploads.length === crashAfter) process.exit(86);
    }
    const uploadsBySha = new Map(receipt.uploads.map((entry) => [entry.sha256, entry]));
    const noteBody = renderEvidenceNote({ manifest, batchId, claimSet, uploadsBySha });
    if (utf8Bytes(noteBody) > context.limits.maxNoteBytes) throw new EvidenceError('NOTE_ACTUAL_BYTES_EXCEEDED', 'rendered note exceeded preflight limit');
    let note;
    try {
      note = await invokeStage('createNote', { target: manifest.evidenceTarget, body: noteBody, marker: batchId });
    } catch (error) {
      if (error instanceof EvidenceError && error.code === 'AMBIGUOUS_NOTE') {
        const found = await invokeStage('findNotesByMarker', { target: manifest.evidenceTarget, marker: batchId });
        if (found.conclusive && found.notes.length === 1) note = found.notes[0];
        else throw new EvidenceError('AMBIGUOUS_NOTE', 'note create outcome could not be reconciled uniquely', { exitCode: 75 });
      } else throw error;
    }
    receipt.note = { noteId: note.id, noteUrl: note.url, noteState: 'POSTED' };
    receipt.evidenceState = 'NOTE_POSTED';
    receipt.reconciliation.indexedInNote = claimSet.claimRefs.length;
    persist();
    const readback = await invokeStage('getNote', { target: manifest.evidenceTarget, noteId: note.id });
    const allUrlsAndHashesPresent = receipt.uploads.every((entry) => readback.body.includes(entry.gitlabUrl) && readback.body.includes(entry.sha256)) && readback.body.includes(batchId);
    if (!allUrlsAndHashesPresent) throw new EvidenceError('NOTE_READBACK_MISMATCH', 'note readback omitted an evidence URL/hash or batch marker');
    receipt.verification.noteRead = { httpStatus: 200, allUrlsAndHashesPresent: true };
    for (const upload of receipt.uploads) {
      const bytes = await invokeStage('downloadAttachment', { target: manifest.evidenceTarget, url: upload.gitlabUrl });
      receipt.verification.attachments.checked += 1;
      receipt.verification.attachments.http200 += 1;
      if (bytes.length === upload.bytes) receipt.verification.attachments.bytesMatched += 1;
      if (sha256Bytes(bytes) === upload.sha256) receipt.verification.attachments.sha256Matched += 1;
      if (bytes.length !== upload.bytes || sha256Bytes(bytes) !== upload.sha256) throw new EvidenceError('ATTACHMENT_READBACK_MISMATCH', `strict verification failed for ${upload.captureId}`);
      persist();
    }
    receipt.reconciliation.verified = claimSet.uniqueBlobs.length;
    receipt.verification.logicalBatches = 1;
    receipt.evidenceState = 'VERIFIED';
    receipt.releaseEligibility = manifest.terminal.outcome === 'PASS' && manifest.codeState?.finality === 'final' ? 'ELIGIBLE' : 'BLOCKED';
    receipt.resultKind = 'success';
    attempt.outcome = 'VERIFIED';
    receipt.cost = {
      ...receipt.cost, ...receiptCost(receipt), logicalVerificationBatches: 1,
      strictNormalPathFormula: `2U+2=${2 * claimSet.uniqueBlobs.length + 2}`,
    };
    const markerPath = join(dirname(manifestFile), FILES.marker);
    receipt.modelSummary = {
      batchIdPrefix: batchId.slice(7, 19), assertion: receipt.assertionOutcome, evidence: 'VERIFIED', release: receipt.releaseEligibility,
      target: `gitlab:${manifest.evidenceTarget.projectId}#${manifest.evidenceTarget.issueIid}`,
      candidate: manifest.codeState?.candidateSha?.slice(0, 12) ?? null,
      N: claimSet.claimRefs.length, U: claimSet.uniqueBlobs.length, verifiedU: claimSet.uniqueBlobs.length,
      totalBytes: totalUniqueBytes, note: receipt.note.noteId, marker: markerPath,
    };
    receipt.cost.modelSummaryUtf8Bytes = utf8Bytes(JSON.stringify(receipt.modelSummary));
    if (receipt.cost.modelSummaryUtf8Bytes > 512) throw new EvidenceError('MODEL_SUMMARY_BUDGET_EXCEEDED', 'normal model summary exceeds 512 UTF-8 bytes');
    receipt.completedAt = new Date().toISOString();
    const receiptText = atomicWriteJson(receiptPath, receipt);
    const marker = {
      schema: 'aes.screenshot-evidence-marker/v1', batchId, qaRoundId: manifest.qaRoundId, attemptId: manifest.attemptId,
      status: 'VERIFIED', assertionOutcome: receipt.assertionOutcome,
      candidateSha: manifest.codeState?.candidateSha ?? null,
      frozenManifestSha256: manifest.frozenManifestSha256,
      claimRefsN: claimSet.claimRefs.length, uniqueSha256U: claimSet.uniqueBlobs.length, verifiedU: claimSet.uniqueBlobs.length,
      totalUniqueBytes, noteId: receipt.note.noteId, receiptSha256: sha256Bytes(Buffer.from(receiptText, 'utf8')),
    };
    atomicWriteJson(markerPath, marker);
    return publicPublishResult(receipt, { newUploads: receipt.uploads.length, newNotes: receipt.note?.noteId ? 1 : 0 });
  } catch (error) {
    attempt.outcome = error instanceof EvidenceError && String(error.code).startsWith('AMBIGUOUS_') ? 'AMBIGUOUS' : 'FAILED';
    receipt.cost = { ...receipt.cost, ...receiptCost(receipt) };
    const controlSummary = {
      batchIdPrefix: batchId.slice(7, 19), assertion: receipt.assertionOutcome, evidence: receipt.evidenceState,
      release: 'BLOCKED', error: error.code || 'GITLAB_OPERATION_FAILED', resumeFrom: receipt.evidenceState,
      uploaded: `${receipt.uploads.length}/${claimSet.uniqueBlobs.length}`, receipt: receiptPath,
    };
    attempt.controlSummaryUtf8Bytes = utf8Bytes(JSON.stringify(controlSummary));
    receipt.modelSummary = controlSummary;
    receipt.lastPublishAttempt = { phase: receipt.evidenceState, outcome: attempt.outcome, code: error.code || 'GITLAB_OPERATION_FAILED', message: error.message, retryable: error.exitCode === 75 };
    persist();
    throw error;
  }
}

export async function resumeEvidence({ receipt: receiptFile, adapterModule = null, adapterOptions = null, recorder = null }) {
  if (!receiptFile) throw new EvidenceError('RECEIPT_PATH_REQUIRED', 'resume requires --receipt', { exitCode: 64 });
  const receipt = readJson(receiptFile, 'PUBLISH_RECEIPT_REQUIRED');
  if (receipt.evidenceState === 'VERIFIED') return publicPublishResult(receipt, { idempotent: true });
  if (receipt.lastPublishAttempt?.code === 'AMBIGUOUS_UPLOAD') {
    throw new EvidenceError('AMBIGUOUS_UPLOAD_REQUIRES_OWNER', 'ambiguous upload cannot be resumed or guessed automatically');
  }
  const manifestFile = join(dirname(receiptFile), FILES.manifest);
  const manifest = readJson(manifestFile, 'CAPTURE_MANIFEST_REQUIRED');
  Object.defineProperty(manifest, '__path', { value: manifestFile, enumerable: false, configurable: true });
  const context = preflightManifest(manifest);
  delete manifest.__path;
  if (receipt.batchId !== context.batchId || receipt.frozenManifestSha256 !== manifest.frozenManifestSha256) {
    throw new EvidenceError('RECEIPT_IDENTITY_MISMATCH', 'receipt does not belong to the frozen manifest');
  }
  if ((receipt.attempts || []).length >= context.retryPolicy.maxPublisherInvocationsPerBatch) {
    throw new EvidenceError('RECOVERY_BUDGET_EXHAUSTED', 'publisher invocation budget R=2 is exhausted');
  }
  for (const previous of receipt.attempts || []) {
    if (previous.outcome === 'RUNNING') previous.outcome = 'CRASH_DETECTED';
  }
  const attempt = { attempt: receipt.attempts.length + 1, command: 'resume', outcome: 'RUNNING', costDelta: zeroCost() };
  receipt.attempts.push(attempt);
  receipt.cost.publisherInvocations = receipt.attempts.length;
  receipt.releaseEligibility = 'BLOCKED';
  const persist = () => atomicWriteJson(receiptFile, receipt);
  persist();

  const options = parseJsonOption(adapterOptions, {}, 'ADAPTER_OPTIONS_JSON_INVALID');
  const rawAdapter = await loadAdapter(adapterModule, options);
  const adapter = createRecordedAdapter(rawAdapter, { recorderPath: recorder, batchId: receipt.batchId });
  const invoke = async (operation, input, bytes = 0) => {
    attempt.costDelta.gitlabHttpRequests += 1;
    if (operation === 'uploadAttachment') { attempt.costDelta.gitlabUploadRequests += 1; attempt.costDelta.uploadedBytes += bytes; }
    if (operation === 'createNote') attempt.costDelta.gitlabNoteCreateRequests += 1;
    if (operation === 'getNote' || operation === 'findNotesByMarker') attempt.costDelta.gitlabNoteReadRequests += 1;
    if (operation === 'downloadAttachment') attempt.costDelta.gitlabAttachmentDownloadRequests += 1;
    try {
      const result = await adapter[operation](input);
      if (operation === 'downloadAttachment') attempt.costDelta.downloadedBytes += Buffer.byteLength(result);
      return result;
    } finally {
      receipt.cost = { ...receipt.cost, ...receiptCost(receipt), publisherInvocations: receipt.attempts.length };
      persist();
    }
  };
  const stageCode = (operation) => ({
    uploadAttachment: 'GITLAB_UPLOAD_FAILED', createNote: 'GITLAB_NOTE_CREATE_FAILED',
    getNote: 'GITLAB_NOTE_READ_FAILED', findNotesByMarker: 'AMBIGUOUS_NOTE',
    downloadAttachment: 'GITLAB_ATTACHMENT_VERIFY_FAILED',
  })[operation] || 'GITLAB_OPERATION_FAILED';
  const invokeStage = async (operation, input, bytes = 0) => {
    for (let stageAttempt = 1; stageAttempt <= context.retryPolicy.maxAttemptsPerStage; stageAttempt += 1) {
      try { return await invoke(operation, input, bytes); }
      catch (error) {
        if (error?.kind === 'ambiguous' || String(error?.code || '').startsWith('AMBIGUOUS_')) {
          throw new EvidenceError(error.code || stageCode(operation), error.message, { exitCode: 75 });
        }
        const transient = error?.kind === 'transient' || /^HTTP_5\d\d$/.test(String(error?.code || ''));
        if (!transient || stageAttempt === context.retryPolicy.maxAttemptsPerStage) {
          throw new EvidenceError(stageCode(operation), error.message, { exitCode: transient ? 75 : 70 });
        }
        if (!process.env.AES_SCREENSHOT_EVIDENCE_TEST_NO_BACKOFF) {
          const delay = context.retryPolicy.retryBackoffMs[stageAttempt - 1] || 0;
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw new EvidenceError(stageCode(operation), `${operation} retry budget exhausted`, { exitCode: 75 });
  };

  const { claimSet, batchId, totalUniqueBytes } = context;
  let newUploads = 0;
  let newNotes = 0;
  try {
    const uploadedBySha = new Map((receipt.uploads || []).map((entry) => [entry.sha256, entry]));
    for (const capture of claimSet.uniqueBlobs) {
      if (uploadedBySha.has(capture.sha256)) continue;
      const filePath = join(dirname(manifestFile), ...capture.spoolRelativePath.split('/'));
      const uploaded = await invokeStage('uploadAttachment', { target: manifest.evidenceTarget, filePath, fileName: capture.displayFileName, bytes: capture.bytes }, capture.bytes);
      const entry = { captureId: capture.captureId, sha256: capture.sha256, bytes: capture.bytes, gitlabUrl: uploaded.url, gitlabMarkdown: uploaded.markdown, uploadState: 'UPLOADED' };
      receipt.uploads.push(entry);
      uploadedBySha.set(capture.sha256, entry);
      newUploads += 1;
      receipt.reconciliation.uploadedOrReused = receipt.uploads.length;
      receipt.evidenceState = receipt.uploads.length === claimSet.uniqueBlobs.length ? 'UPLOADED' : 'BATCH_FROZEN';
      persist();
    }
    const noteBody = renderEvidenceNote({ manifest, batchId, claimSet, uploadsBySha: uploadedBySha });
    if (!receipt.note?.noteId) {
      let note;
      try { note = await invokeStage('createNote', { target: manifest.evidenceTarget, body: noteBody, marker: batchId }); }
      catch (error) {
        if (error instanceof EvidenceError && error.code === 'AMBIGUOUS_NOTE') {
          const found = await invokeStage('findNotesByMarker', { target: manifest.evidenceTarget, marker: batchId });
          if (found.conclusive && found.notes.length === 1) note = found.notes[0];
          else throw error;
        } else throw error;
      }
      receipt.note = { noteId: note.id, noteUrl: note.url, noteState: 'POSTED' };
      newNotes += 1;
    }
    receipt.evidenceState = 'NOTE_POSTED';
    receipt.reconciliation.indexedInNote = claimSet.claimRefs.length;
    persist();
    const readback = await invokeStage('getNote', { target: manifest.evidenceTarget, noteId: receipt.note.noteId });
    if (!receipt.uploads.every((entry) => readback.body.includes(entry.gitlabUrl) && readback.body.includes(entry.sha256)) || !readback.body.includes(batchId)) {
      throw new EvidenceError('NOTE_READBACK_MISMATCH', 'note readback omitted evidence identity');
    }
    receipt.verification.noteRead = { httpStatus: 200, allUrlsAndHashesPresent: true };
    receipt.verification.attachments = { checked: 0, http200: 0, bytesMatched: 0, sha256Matched: 0 };
    for (const upload of receipt.uploads) {
      const bytes = await invokeStage('downloadAttachment', { target: manifest.evidenceTarget, url: upload.gitlabUrl });
      receipt.verification.attachments.checked += 1;
      receipt.verification.attachments.http200 += 1;
      if (bytes.length === upload.bytes) receipt.verification.attachments.bytesMatched += 1;
      if (sha256Bytes(bytes) === upload.sha256) receipt.verification.attachments.sha256Matched += 1;
      if (bytes.length !== upload.bytes || sha256Bytes(bytes) !== upload.sha256) throw new EvidenceError('ATTACHMENT_READBACK_MISMATCH', `strict verification failed for ${upload.captureId}`);
      persist();
    }
    receipt.reconciliation.verified = claimSet.uniqueBlobs.length;
    receipt.verification.logicalBatches = 1;
    receipt.evidenceState = 'VERIFIED';
    receipt.releaseEligibility = manifest.terminal.outcome === 'PASS' && manifest.codeState?.finality === 'final' ? 'ELIGIBLE' : 'BLOCKED';
    receipt.resultKind = 'success';
    attempt.outcome = 'VERIFIED';
    receipt.cost = { ...receipt.cost, ...receiptCost(receipt), publisherInvocations: receipt.attempts.length, logicalVerificationBatches: 1, strictNormalPathFormula: `2U+2=${2 * claimSet.uniqueBlobs.length + 2}` };
    const markerPath = join(dirname(manifestFile), FILES.marker);
    receipt.modelSummary = {
      batchIdPrefix: batchId.slice(7, 19), assertion: receipt.assertionOutcome, evidence: 'VERIFIED', release: receipt.releaseEligibility,
      uploadedNow: newUploads, reused: receipt.uploads.length - newUploads, note: receipt.note.noteId, marker: markerPath,
    };
    attempt.controlSummaryUtf8Bytes = utf8Bytes(JSON.stringify(receipt.modelSummary));
    receipt.completedAt = new Date().toISOString();
    const receiptText = atomicWriteJson(receiptFile, receipt);
    atomicWriteJson(markerPath, {
      schema: 'aes.screenshot-evidence-marker/v1', batchId, qaRoundId: manifest.qaRoundId, attemptId: manifest.attemptId,
      status: 'VERIFIED', assertionOutcome: receipt.assertionOutcome, candidateSha: manifest.codeState?.candidateSha ?? null,
      frozenManifestSha256: manifest.frozenManifestSha256, claimRefsN: claimSet.claimRefs.length,
      uniqueSha256U: claimSet.uniqueBlobs.length, verifiedU: claimSet.uniqueBlobs.length, totalUniqueBytes,
      noteId: receipt.note.noteId, receiptSha256: sha256Bytes(Buffer.from(receiptText, 'utf8')),
    });
    return publicPublishResult(receipt, { newUploads, newNotes });
  } catch (error) {
    attempt.outcome = error instanceof EvidenceError && String(error.code).startsWith('AMBIGUOUS_') ? 'AMBIGUOUS' : 'FAILED';
    const controlSummary = { batchIdPrefix: batchId.slice(7, 19), assertion: receipt.assertionOutcome, evidence: receipt.evidenceState, release: 'BLOCKED', error: error.code || 'GITLAB_OPERATION_FAILED', remainingInvocations: context.retryPolicy.maxPublisherInvocationsPerBatch - receipt.attempts.length, receipt: receiptFile };
    attempt.controlSummaryUtf8Bytes = utf8Bytes(JSON.stringify(controlSummary));
    receipt.modelSummary = controlSummary;
    receipt.cost = { ...receipt.cost, ...receiptCost(receipt), publisherInvocations: receipt.attempts.length };
    receipt.lastPublishAttempt = { phase: receipt.evidenceState, outcome: attempt.outcome, code: error.code || 'GITLAB_OPERATION_FAILED', message: error.message, retryable: error.exitCode === 75 };
    persist();
    throw error;
  }
}

export function reportPilot({ notesFile, projectId }) {
  if (!notesFile) throw new EvidenceError('NOTES_FILE_REQUIRED', 'report requires --notes-file', { exitCode: 64 });
  const source = readJson(notesFile, 'PILOT_NOTES_REQUIRED');
  const wantedProject = Number(projectId);
  if (!Number.isInteger(wantedProject)) throw new EvidenceError('PROJECT_ID_REQUIRED', 'report requires numeric --project-id', { exitCode: 64 });
  const unique = new Map();
  for (const note of source.notes || []) {
    if (Number(note.projectId) !== wantedProject || note.kind !== 'acceptance' || note.status !== 'VERIFIED' || note.synthetic === true || !note.batchId) continue;
    if (!unique.has(note.batchId)) unique.set(note.batchId, note);
  }
  const notes = [...unique.values()].sort((a, b) => String(a.verifiedAt || '').localeCompare(String(b.verifiedAt || ''))).slice(0, 20);
  const percentile = (values, ratio) => {
    if (!values.length) return null;
    const sorted = values.map(Number).sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil(ratio * sorted.length) - 1)];
  };
  const metrics = {};
  for (const key of ['N', 'U', 'bytes', 'noteBytes', 'retries', 'humanReviewMinutes']) {
    const values = notes.map((note) => note[key]).filter((value) => Number.isFinite(Number(value)));
    metrics[key] = { p50: percentile(values, 0.5), p95: percentile(values, 0.95) };
  }
  const rejections = source.rejections || [];
  const legitimateRejectionRate = rejections.length
    ? rejections.filter((entry) => entry.legitimate === true).length / rejections.length
    : 0;
  const due = notes.length >= 20;
  return {
    schema: 'aes.screenshot-evidence-pilot-report/v1', checkpointId: 'AES-SCREENSHOT-EVIDENCE-PILOT-v1',
    projectId: wantedProject, status: due ? 'DUE' : 'PENDING', uniqueVerifiedAcceptanceBatches: notes.length,
    remaining: Math.max(0, 20 - notes.length), metrics, legitimateRejectionRate,
    policyChangeApplied: false, ownerReview: due ? 'REQUIRED' : 'NOT_DUE',
  };
}

export function gateEvidence({ spool, candidate = null }) {
  const manifest = loadManifest(spool);
  if (!manifest.terminal) throw new EvidenceError('TERMINAL_OUTCOME_REQUIRED', 'gate requires a terminal QA attempt');
  const claimSet = deriveClaimSet(manifest);
  if (!claimSet.claimRefs.length) {
    const eligible = manifest.terminal.outcome === 'PASS' && manifest.codeState?.finality === 'final' && (!candidate || candidate === manifest.codeState.candidateSha);
    const payload = {
      schema: 'aes.screenshot-evidence-gate/v1', assertionOutcome: manifest.terminal.outcome,
      evidenceState: manifest.terminal.evidenceState, releaseEligibility: eligible ? 'ELIGIBLE' : 'BLOCKED',
      screenshotEvidence: { required: false }, remoteNoteReads: 0,
      _exitCode: eligible ? 0 : manifest.terminal.outcome === 'FAIL' ? 1 : 65,
    };
    return payload;
  }
  const markerPath = join(spool, FILES.marker);
  const receiptPath = join(spool, FILES.receipt);
  if (!existsSync(markerPath) || !existsSync(receiptPath)) throw new EvidenceError('SCREENSHOT_EVIDENCE_NOT_VERIFIED', 'aggregate VERIFIED marker is missing');
  const marker = readJson(markerPath);
  const receiptText = readFileSync(receiptPath, 'utf8');
  const expectedCandidate = manifest.codeState?.candidateSha ?? null;
  if (candidate && candidate !== expectedCandidate) throw new EvidenceError('SCREENSHOT_EVIDENCE_CANDIDATE_MISMATCH', 'gate candidate differs from evidence candidate');
  const valid = marker.schema === 'aes.screenshot-evidence-marker/v1'
    && marker.status === 'VERIFIED'
    && marker.batchId === canonicalBatchId(manifest)
    && marker.qaRoundId === manifest.qaRoundId && marker.attemptId === manifest.attemptId
    && marker.frozenManifestSha256 === manifest.frozenManifestSha256
    && marker.claimRefsN === claimSet.claimRefs.length && marker.uniqueSha256U === claimSet.uniqueBlobs.length
    && marker.verifiedU === claimSet.uniqueBlobs.length
    && marker.candidateSha === expectedCandidate
    && marker.receiptSha256 === sha256Bytes(Buffer.from(receiptText, 'utf8'));
  if (!valid) throw new EvidenceError('SCREENSHOT_EVIDENCE_MARKER_INVALID', 'aggregate marker identity/digest/reconciliation validation failed');
  const eligible = manifest.terminal.outcome === 'PASS' && manifest.codeState?.finality === 'final';
  const payload = {
    schema: 'aes.screenshot-evidence-gate/v1', batchId: marker.batchId,
    assertionOutcome: manifest.terminal.outcome, evidenceState: marker.status,
    releaseEligibility: eligible ? 'ELIGIBLE' : 'BLOCKED',
    screenshotEvidence: { required: true, aggregateMarker: marker }, remoteNoteReads: 0,
    _exitCode: eligible ? 0 : manifest.terminal.outcome === 'FAIL' ? 1 : 65,
  };
  atomicWriteJson(join(spool, FILES.gateReceipt), {
    schema: 'aes.screenshot-evidence-gate-receipt/v1', batchId: marker.batchId,
    assertionOutcome: manifest.terminal.outcome, evidenceState: marker.status,
    releaseEligibility: payload.releaseEligibility, screenshotEvidence: payload.screenshotEvidence, consumedAt: new Date().toISOString(),
  });
  return payload;
}

export function errorPayload(error) {
  const known = error instanceof EvidenceError;
  return {
    schema: 'aes.screenshot-evidence-error/v1',
    resultKind: known && error.exitCode === 64 ? 'usage_error' : known ? 'business_failure' : 'unexpected_error',
    exitCode: known ? error.exitCode : 70,
    error: {
      code: known ? error.code : 'UNEXPECTED_ERROR',
      message: error.message,
      ...(known && error.field ? { field: error.field } : {}),
      ...(known && error.detail ? { detail: error.detail } : {}),
    },
    remoteWrites: 0,
  };
}
