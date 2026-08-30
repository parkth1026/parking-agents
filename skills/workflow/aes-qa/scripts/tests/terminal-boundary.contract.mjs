import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeAsserter, readJson, runCli, writeManifest } from './contract-test-kit.mjs';

const t = makeAsserter('terminal-boundary');
const root = mkdtempSync(join(tmpdir(), 'aes-screenshot-terminal-'));
try {
  const spool = join(root, 'qa-contract-round', 'attempt-1');
  writeManifest(spool, {
    requiredEvidence: [{ claimId: 'AC-UI-1', requiredVariants: ['light@1x1'] }],
  });
  const source = join(root, 'source.png');
  writeFileSync(source, Buffer.from('stable-image-v1'));

  const capture = runCli([
    'capture', '--spool', spool, '--capture-id', 'cap-001', '--claim', 'AC-UI-1',
    '--role', 'acceptance', '--file', source, '--viewport', '1x1', '--theme', 'light', '--sensitivity', 'CLEAR',
  ]);
  t.check('capture ACKs only after durable image and manifest', capture.code === 0 && capture.json?.durability === 'FILE_CLOSED_AND_MANIFEST_ATOMICALLY_REPLACED', capture.stderr || capture.stdout);
  t.check('capture reports zero remote writes', capture.json?.remoteWrites === 0);
  const afterCapture = readJson(join(spool, 'capture-manifest.json'));
  const stableImage = join(spool, afterCapture.captures?.[0]?.spoolRelativePath || 'missing');
  t.check('stable content-addressed image exists with original bytes', existsSync(stableImage) && readFileSync(stableImage).equals(readFileSync(source)));

  const conflictSource = join(root, 'conflict.png');
  writeFileSync(conflictSource, Buffer.from('different-image'));
  const conflict = runCli([
    'capture', '--spool', spool, '--capture-id', 'cap-001', '--claim', 'AC-UI-1',
    '--role', 'acceptance', '--file', conflictSource, '--viewport', '1x1', '--theme', 'light', '--sensitivity', 'CLEAR',
  ]);
  t.check('capture id conflict fails closed without overwrite', conflict.code === 65 && conflict.json?.error?.code === 'CAPTURE_ID_CONFLICT');
  t.check('conflicting capture leaves stable bytes intact', readFileSync(stableImage).equals(readFileSync(source)));

  const terminal = runCli(['terminal', '--spool', spool, '--outcome', 'PASS', '--candidate', '1111111111111111111111111111111111111111']);
  t.check('terminal freezes one claim-complete batch', terminal.code === 0 && terminal.json?.evidenceState === 'BATCH_FROZEN' && terminal.json?.N === 1 && terminal.json?.U === 1, terminal.stderr || terminal.stdout);
  t.check('terminal performs zero remote writes', terminal.json?.remoteWrites === 0);
  const late = runCli([
    'capture', '--spool', spool, '--capture-id', 'cap-late', '--claim', 'AC-UI-1',
    '--role', 'acceptance', '--file', source, '--viewport', '1x1', '--theme', 'light', '--sensitivity', 'CLEAR',
  ]);
  t.check('frozen attempt rejects late claim-bearing capture', late.code === 65 && late.json?.error?.code === 'BATCH_ALREADY_FROZEN');

  const cleanupEarly = runCli(['cleanup', '--spool', spool]);
  t.check('cleanup refuses an unverified frozen batch', cleanupEarly.code === 65 && existsSync(stableImage));

  const abandonedSpool = join(root, 'qa-abandoned', 'attempt-1');
  writeManifest(abandonedSpool, { qaRoundId: 'qa-abandoned' });
  const abandonSource = join(root, 'abandon.png');
  writeFileSync(abandonSource, Buffer.from('abandon-me'));
  runCli(['capture', '--spool', abandonedSpool, '--capture-id', 'cap-abandon', '--claim', 'AC-X', '--role', 'actual', '--file', abandonSource, '--viewport', '1x1', '--theme', 'light', '--sensitivity', 'CLEAR']);
  const abandoned = runCli(['cleanup', '--spool', abandonedSpool, '--abandon', '--reason', 'operator cancelled run', '--actor', 'contract-owner']);
  t.check('explicit abandon records immutable terminal and permits byte cleanup', abandoned.code === 0 && existsSync(join(abandonedSpool, 'abandon-record.json')));
  const abandonTerminal = runCli(['terminal', '--spool', abandonedSpool, '--outcome', 'PASS', '--candidate', '1111111111111111111111111111111111111111']);
  t.check('abandoned attempt is permanently barred from terminal evidence', abandonTerminal.code === 65 && abandonTerminal.json?.error?.code === 'ATTEMPT_ABANDONED');

  const noScreenshotSpool = join(root, 'qa-no-screenshot', 'attempt-1');
  writeManifest(noScreenshotSpool, { qaRoundId: 'qa-no-screenshot' });
  const noScreenshot = runCli(['terminal', '--spool', noScreenshotSpool, '--outcome', 'PASS', '--candidate', '1111111111111111111111111111111111111111']);
  t.check('no-screenshot terminal has no publication obligation', noScreenshot.code === 0 && noScreenshot.json?.screenshotEvidenceRequired === false && noScreenshot.json?.N === 0 && noScreenshot.json?.U === 0);

  const recovered = runCli(['terminal', '--spool', spool, '--outcome', 'PASS', '--candidate', '1111111111111111111111111111111111111111']);
  t.check('same-machine rerun recovers same frozen identity idempotently', recovered.code === 0 && recovered.json?.frozenManifestSha256 === terminal.json?.frozenManifestSha256);
} finally {
  rmSync(root, { recursive: true, force: true });
}
t.finish();
