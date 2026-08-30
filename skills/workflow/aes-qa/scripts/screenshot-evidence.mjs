#!/usr/bin/env node

import {
  EvidenceError, captureEvidence, cleanupEvidence, errorPayload, freezeTerminal, gateEvidence, publishEvidence,
  reportPilot, resumeEvidence,
} from './screenshot-evidence-core.mjs';

function parseArgs(argv) {
  const operation = argv.shift();
  if (!operation || operation.startsWith('--')) throw new EvidenceError('OPERATION_REQUIRED', 'operation is required', { exitCode: 64 });
  const args = { operation };
  while (argv.length) {
    const token = argv.shift();
    if (!token.startsWith('--')) throw new EvidenceError('UNEXPECTED_ARGUMENT', `unexpected positional argument: ${token}`, { exitCode: 64 });
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (['json', 'diagnosticOnly', 'abandon'].includes(key)) {
      args[key] = true;
      continue;
    }
    if (!argv.length || argv[0].startsWith('--')) throw new EvidenceError('ARGUMENT_VALUE_REQUIRED', `missing value for ${token}`, { exitCode: 64, field: key });
    args[key] = argv.shift();
  }
  return args;
}

async function dispatch(args) {
  if (args.operation === 'capture') return captureEvidence(args);
  if (args.operation === 'terminal') return freezeTerminal(args);
  if (args.operation === 'publish') return publishEvidence(args);
  if (args.operation === 'resume') return resumeEvidence(args);
  if (args.operation === 'gate') return gateEvidence(args);
  if (args.operation === 'cleanup') return cleanupEvidence(args);
  if (args.operation === 'report') return reportPilot(args);
  throw new EvidenceError('OPERATION_UNSUPPORTED', `unsupported operation: ${args.operation}`, { exitCode: 64 });
}

try {
  const args = parseArgs(process.argv.slice(2));
  const result = await dispatch(args);
  const exitCode = result._exitCode ?? 0;
  delete result._exitCode;
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(exitCode);
} catch (error) {
  const payload = errorPayload(error);
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exit(payload.exitCode);
}
