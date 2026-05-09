#!/usr/bin/env node
'use strict';

/**
 * analyze-interactions.js
 * Full-precision JSONL analysis of all VS Code Copilot debug-logs.
 * Extracts user messages, askQuestions interactions, subagent invocations,
 * and child_session_ref links. Outputs interaction-analysis.json.
 *
 * Usage:
 *   node analyze-interactions.js
 *   node analyze-interactions.js --output-path ./interaction-analysis.json
 *   node analyze-interactions.js --base-path "C:\Users\...\workspaceStorage"
 */

const fs = require('fs');
const path = require('path');

// ── CLI 参数解析 ─────────────────────────────────────
function parseArgs(argv) {
    const args = {
        basePath: path.join(process.env.APPDATA || '', 'Code', 'User', 'workspaceStorage'),
        outputPath: path.join('D:\\GIT\\parking-agents', 'interaction-analysis.json'),
        maxLineLen: 8000000,
        fileTimeout: 60,
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--output-path':
                args.outputPath = argv[++i];
                break;
            case '--base-path':
                args.basePath = argv[++i];
                break;
            case '--max-line-len':
                args.maxLineLen = parseInt(argv[++i], 10) || 8000000;
                break;
            case '--file-timeout':
                args.fileTimeout = parseInt(argv[++i], 10) || 60;
                break;
            default:
                console.log(`[warn] Unknown argument: ${arg}`);
        }
    }

    return args;
}

const args = parseArgs(process.argv);
const startTime = Date.now();

// ── Helper: safe JSON parse ──────────────────────────
let parseErrors = 0;

function parseJsonLine(line) {
    if (line.length > args.maxLineLen) return null;
    try {
        return JSON.parse(line);
    } catch (_) {
        parseErrors++;
        return null;
    }
}

// ── Resolve workspace mapping ────────────────────────
function resolveWorkspaceMap(basePath) {
    const wsMap = {};
    let wsDirs;
    try {
        wsDirs = fs.readdirSync(basePath, { withFileTypes: true }).filter(d => d.isDirectory());
    } catch (_) {
        return wsMap;
    }

    for (const d of wsDirs) {
        const wsId = d.name;
        const wsJsonPath = path.join(basePath, wsId, 'workspace.json');
        try {
            if (!fs.existsSync(wsJsonPath)) continue;
            const ws = JSON.parse(fs.readFileSync(wsJsonPath, 'utf8'));
            let folder = ws.folder || '';
            folder = folder.replace(/^file:\/\/\//, '/').replace(/%3A/gi, ':');
            const parts = folder.split('/');
            const name = parts[parts.length - 1] || wsId.substring(0, 8);
            wsMap[wsId] = name;
        } catch (_) {
            wsMap[wsId] = wsId.substring(0, 8);
        }
    }

    return wsMap;
}

// ── Collect all JSONL files ──────────────────────────
function collectAllFiles(basePath, wsMap) {
    const allFiles = [];
    let wsDirs;
    try {
        wsDirs = fs.readdirSync(basePath, { withFileTypes: true }).filter(d => d.isDirectory());
    } catch (_) {
        return allFiles;
    }

    for (const wsDir of wsDirs) {
        const wsId = wsDir.name;
        const logsDir = path.join(basePath, wsId, 'GitHub.copilot-chat', 'debug-logs');
        if (!fs.existsSync(logsDir)) continue;

        let sessions;
        try {
            sessions = fs.readdirSync(logsDir, { withFileTypes: true }).filter(d => d.isDirectory());
        } catch (_) {
            continue;
        }

        for (const sess of sessions) {
            const sessDir = path.join(logsDir, sess.name);
            let files;
            try {
                files = fs.readdirSync(sessDir).filter(f => f.endsWith('.jsonl'));
            } catch (_) {
                continue;
            }

            for (const fname of files) {
                const fullPath = path.join(sessDir, fname);
                let sizeKB = 0;
                try {
                    sizeKB = Math.round(fs.statSync(fullPath).size / 1024 * 10) / 10;
                } catch (_) { /* ignore */ }

                let type = 'other';
                if (fname === 'main.jsonl') type = 'main';
                else if (fname.startsWith('runSubagent-')) type = 'subagent';
                else if (fname.startsWith('title-')) type = 'title';

                allFiles.push({
                    path: fullPath,
                    name: fname,
                    sizeKB,
                    sessionId: sess.name,
                    workspaceId: wsId,
                    workspace: wsMap[wsId] || wsId.substring(0, 8),
                    type,
                });
            }
        }
    }

    return allFiles;
}

// ── Main ─────────────────────────────────────────────

const wsMap = resolveWorkspaceMap(args.basePath);
const allFiles = collectAllFiles(args.basePath, wsMap);

const totalSizeMB = Math.round(allFiles.reduce((sum, f) => sum + f.sizeKB, 0) / 1024 * 10) / 10;
const mainFiles = allFiles.filter(f => f.type === 'main');
const subagentFiles = allFiles.filter(f => f.type === 'subagent');
const titleFiles = allFiles.filter(f => f.type === 'title');

console.log(`Files: ${allFiles.length} (main=${mainFiles.length}, subagent=${subagentFiles.length}, title=${titleFiles.length}) Total=${totalSizeMB}MB`);

// ── Data containers ──────────────────────────────────
const userMessages = [];
const askQInteractions = [];
const subagentInvocations = [];
const childSessionRefs = {};
const skippedFiles = [];

// ── PHASE 1: Process main.jsonl files ────────────────
console.log(`\n=== Phase 1: Processing ${mainFiles.length} main.jsonl files ===`);
let umIndex = 0;
let aqIndex = 0;

for (const mf of mainFiles) {
    const fileStart = Date.now();
    console.log(`  main: ${mf.workspace}/${mf.sessionId} (${mf.sizeKB}KB)`);

    let lines;
    try {
        lines = fs.readFileSync(mf.path, 'utf8').split('\n');
    } catch (err) {
        console.log(`    ERROR: ${err.message}`);
        skippedFiles.push(mf.path);
        continue;
    }

    for (const line of lines) {
        if (!line.trim()) continue;

        // Timeout check
        if ((Date.now() - fileStart) / 1000 > args.fileTimeout) {
            console.log(`    TIMEOUT after ${args.fileTimeout}s, skipping rest`);
            skippedFiles.push(mf.path);
            break;
        }

        const evt = parseJsonLine(line);
        if (!evt) continue;

        if (evt.type === 'user_message') {
            umIndex++;
            let content = '';
            if (evt.attrs && evt.attrs.content) content = evt.attrs.content;

            const isTerminal = /^\[Terminal [0-9a-f-]+ notification:/.test(content);
            const isTryAgain = /^Try Again$/.test(content);

            userMessages.push({
                index: umIndex,
                sessionId: mf.sessionId,
                workspacePath: mf.workspace,
                timestamp: evt.ts,
                content,
                contentLength: content.length,
                isTerminalNotification: isTerminal,
                isTryAgain,
            });

        } else if (evt.type === 'tool_call') {
            if (evt.name === 'vscode_askQuestions' || (evt.name && /askQuestions/.test(evt.name))) {
                aqIndex++;
                const questions = [];
                const responses = [];
                let hasFreeText = false;
                let hasSelection = false;

                // Parse args (questions array)
                if (evt.attrs && evt.attrs.args) {
                    try {
                        const argsObj = typeof evt.attrs.args === 'string'
                            ? JSON.parse(evt.attrs.args) : evt.attrs.args;
                        if (argsObj.questions) {
                            for (const q of argsObj.questions) {
                                const opts = [];
                                if (q.options) {
                                    for (const o of q.options) {
                                        opts.push({ label: o.label, description: o.description });
                                    }
                                }
                                questions.push({
                                    header: q.header,
                                    question: q.question,
                                    options: opts,
                                });
                            }
                        }
                    } catch (_) { /* ignore */ }
                }

                // Parse result (user responses)
                if (evt.attrs && evt.attrs.result) {
                    try {
                        const resObj = typeof evt.attrs.result === 'string'
                            ? JSON.parse(evt.attrs.result) : evt.attrs.result;
                        if (resObj.answers) {
                            for (const [propName, ans] of Object.entries(resObj.answers)) {
                                const sel = [];
                                if (ans.selected) {
                                    sel.push(...(Array.isArray(ans.selected) ? ans.selected : [ans.selected]));
                                    hasSelection = true;
                                }
                                let ft = null;
                                if (ans.freeText) { ft = String(ans.freeText); hasFreeText = true; }
                                responses.push({
                                    header: propName,
                                    selected: sel,
                                    freeText: ft,
                                    skipped: Boolean(ans.skipped),
                                });
                            }
                        }
                    } catch (_) { /* ignore */ }
                }

                askQInteractions.push({
                    index: aqIndex,
                    sessionId: mf.sessionId,
                    workspacePath: mf.workspace,
                    timestamp: evt.ts,
                    questions,
                    responses,
                    hasFreeText,
                    hasSelection,
                });
            }

        } else if (evt.type === 'child_session_ref') {
            if (evt.attrs) {
                const label = evt.attrs.label;
                const childSid = evt.attrs.childSessionId;
                const childLog = evt.attrs.childLogFile;
                if (!childSessionRefs[mf.sessionId]) {
                    childSessionRefs[mf.sessionId] = [];
                }
                childSessionRefs[mf.sessionId].push({
                    agentName: label,
                    childSessionId: childSid,
                    childLogFile: childLog,
                    timestamp: evt.ts,
                });
            }
        }
    }
}

let totalChildRefs = 0;
for (const refs of Object.values(childSessionRefs)) {
    totalChildRefs += refs.length;
}
console.log(`  Found: ${umIndex} user_messages, ${aqIndex} askQ interactions, ${totalChildRefs} child_session_refs`);

// ── PHASE 2: Process subagent JSONL files ────────────
console.log(`\n=== Phase 2: Processing ${subagentFiles.length} subagent files ===`);
let saIndex = 0;
let processed = 0;

for (const sf of subagentFiles) {
    processed++;
    if (processed % 100 === 0) console.log(`  Progress: ${processed} / ${subagentFiles.length}`);

    const fileStart = Date.now();
    saIndex++;

    let promptLen = 0;
    let promptPreview = '';
    let outputLen = 0;
    const toolCalls = {};
    let toolCallCount = 0;
    let agentName = '';

    // Extract agent name from filename: runSubagent-<Name>-<uuid>.jsonl
    const nameMatch = sf.name.match(/^runSubagent-(.+)-[0-9a-f]{8}-/);
    if (nameMatch) agentName = nameMatch[1];

    let lines;
    try {
        lines = fs.readFileSync(sf.path, 'utf8').split('\n');
    } catch (_) {
        skippedFiles.push(sf.path);
        continue;
    }

    for (const line of lines) {
        if (!line.trim()) continue;

        if ((Date.now() - fileStart) / 1000 > args.fileTimeout) {
            console.log(`    TIMEOUT on ${sf.name}`);
            skippedFiles.push(sf.path);
            break;
        }

        if (line.length > args.maxLineLen) continue;

        // Pre-filter: only parse lines containing relevant event types
        if (!/"type"\s*:\s*"(session_start|user_message|tool_call|agent_response)"/.test(line)) continue;

        const evt = parseJsonLine(line);
        if (!evt) continue;

        if (evt.type === 'session_start') {
            if (evt.attrs && evt.attrs.label && !agentName) agentName = evt.attrs.label;
        } else if (evt.type === 'user_message') {
            if (evt.attrs && evt.attrs.content) {
                promptLen = evt.attrs.content.length;
                promptPreview = evt.attrs.content.substring(0, Math.min(200, evt.attrs.content.length));
            }
        } else if (evt.type === 'tool_call') {
            toolCallCount++;
            const tn = evt.name;
            if (tn) {
                toolCalls[tn] = (toolCalls[tn] || 0) + 1;
            }
        } else if (evt.type === 'agent_response') {
            if (evt.attrs && evt.attrs.response) {
                outputLen = String(evt.attrs.response).length;
            }
        }
    }

    subagentInvocations.push({
        index: saIndex,
        sessionId: sf.sessionId,
        agentName,
        promptLength: promptLen,
        promptPreview,
        outputLength: outputLen,
        toolCallCount,
        toolNames: Object.keys(toolCalls).sort(),
        logSizeKB: sf.sizeKB,
        workspacePath: sf.workspace,
    });
}

console.log(`  Processed ${processed} subagent files`);

// ── PHASE 3: Compute summary ─────────────────────────
console.log(`\n=== Phase 3: Computing summary ===`);

const realInputs = userMessages.filter(m => !m.isTerminalNotification && !m.isTryAgain);
const termNotifs = userMessages.filter(m => m.isTerminalNotification);
const tryAgains = userMessages.filter(m => m.isTryAgain);
const aqFreeText = askQInteractions.filter(a => a.hasFreeText);
const aqSelection = askQInteractions.filter(a => a.hasSelection);

// By workspace
const allWorkspaces = new Set();
for (const m of userMessages) allWorkspaces.add(m.workspacePath);
for (const a of askQInteractions) allWorkspaces.add(a.workspacePath);
for (const s of subagentInvocations) allWorkspaces.add(s.workspacePath);

const byWorkspace = {};
for (const ws of [...allWorkspaces].sort()) {
    byWorkspace[ws] = {
        userMessages: userMessages.filter(m => m.workspacePath === ws).length,
        realInputs: realInputs.filter(m => m.workspacePath === ws).length,
        termNotifs: termNotifs.filter(m => m.workspacePath === ws).length,
        tryAgains: tryAgains.filter(m => m.workspacePath === ws).length,
        askQ: askQInteractions.filter(a => a.workspacePath === ws).length,
        subagents: subagentInvocations.filter(s => s.workspacePath === ws).length,
    };
}

// By session
const allSessions = new Set();
for (const m of userMessages) allSessions.add(m.sessionId);
for (const a of askQInteractions) allSessions.add(a.sessionId);
for (const s of subagentInvocations) allSessions.add(s.sessionId);

const bySession = {};
for (const sid of [...allSessions].sort()) {
    let wsName = '';
    const um = userMessages.find(m => m.sessionId === sid);
    if (um) wsName = um.workspacePath;

    bySession[sid] = {
        workspace: wsName,
        userMessages: userMessages.filter(m => m.sessionId === sid).length,
        realInputs: realInputs.filter(m => m.sessionId === sid).length,
        askQ: askQInteractions.filter(a => a.sessionId === sid).length,
        subagents: subagentInvocations.filter(s => s.sessionId === sid).length,
    };
}

const summary = {
    totalUserMessages: userMessages.length,
    realUserInputs: realInputs.length,
    terminalNotifications: termNotifs.length,
    tryAgainCount: tryAgains.length,
    totalAskQuestions: askQInteractions.length,
    askQWithFreeText: aqFreeText.length,
    askQWithSelection: aqSelection.length,
    totalSubagentCalls: subagentInvocations.length,
    totalInteractions: realInputs.length + askQInteractions.length,
    parseErrors,
    skippedFiles: skippedFiles.length,
    byWorkspace,
    bySession,
};

// ── Build output ─────────────────────────────────────
const processingTime = Math.round((Date.now() - startTime) / 1000 * 10) / 10;

const output = {
    meta: {
        totalFiles: allFiles.length,
        totalSizeMB,
        scanDate: new Date().toLocaleDateString('sv-SE'),
        sessions: mainFiles.length,
        mainFiles: mainFiles.length,
        subagentFiles: subagentFiles.length,
        titleFiles: titleFiles.length,
        processingTime,
    },
    userMessages,
    askQuestionsInteractions: askQInteractions,
    subagentInvocations,
    summary,
};

// ── Write JSON ───────────────────────────────────────
console.log(`\n=== Writing output to ${args.outputPath} ===`);
const json = JSON.stringify(output, null, 2);
fs.writeFileSync(args.outputPath, json, 'utf8');
const outSize = Math.round(fs.statSync(args.outputPath).size / 1024 * 10) / 10;
console.log(`Output: ${args.outputPath} (${outSize}KB)`);

// ── Print summary ────────────────────────────────────
console.log(`\n========== SUMMARY ==========`);
console.log(`Processing time: ${processingTime}s`);
console.log(`Total user messages: ${summary.totalUserMessages}`);
console.log(`  Real user inputs:  ${summary.realUserInputs}`);
console.log(`  Terminal notifs:   ${summary.terminalNotifications}`);
console.log(`  Try Again:         ${summary.tryAgainCount}`);
console.log(`Total askQuestions:  ${summary.totalAskQuestions}`);
console.log(`  With free text:    ${summary.askQWithFreeText}`);
console.log(`  With selection:    ${summary.askQWithSelection}`);
console.log(`Total subagents:    ${summary.totalSubagentCalls}`);
console.log(`Total interactions: ${summary.totalInteractions}`);
console.log(`Parse errors:       ${summary.parseErrors}`);
console.log(`Skipped files:      ${summary.skippedFiles}`);
console.log('');
console.log('--- By Workspace ---');
for (const ws of Object.keys(byWorkspace).sort()) {
    const w = byWorkspace[ws];
    console.log(`  ${ws}: msgs=${w.userMessages} real=${w.realInputs} term=${w.termNotifs} try=${w.tryAgains} askQ=${w.askQ} sub=${w.subagents}`);
}
console.log('');
console.log('--- By Session ---');
for (const sid of Object.keys(bySession).sort()) {
    const s = bySession[sid];
    console.log(`  ${sid.substring(0, 8)}... [${s.workspace}]: msgs=${s.userMessages} real=${s.realInputs} askQ=${s.askQ} sub=${s.subagents}`);
}
console.log('\n========== DONE ==========');
