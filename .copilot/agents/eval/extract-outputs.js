#!/usr/bin/env node
'use strict';

/**
 * extract-outputs.js
 * 从 VS Code Copilot Chat debug-logs 提取 subagent 调用的结构化数据。
 *
 * 扫描所有 workspace 的 debug-logs，解析 JSONL 事件流，
 * 提取每次 subagent 调用的 prompt、output、工具统计、行为标记。
 * 输出结构化 JSON 供 run-eval 消费。
 *
 * Usage:
 *   node extract-outputs.js --output-path ./reports/eval-data.json
 *   node extract-outputs.js --agent-filter "Worker"
 *   node extract-outputs.js --output-path ./reports/eval-data.json --include-main-log
 *   node extract-outputs.js --workspace-path <path-or-hash-prefix>
 */

const fs = require('fs');
const path = require('path');

// ── CLI 参数解析 ─────────────────────────────────────
function parseArgs(argv) {
    const args = {
        workspacePath: null,    // 可选，限定特定 workspace（路径或 hash 前缀）
        sessionId: null,        // 可选，限定特定 session ID
        agentFilter: null,      // 可选，按 agent 名过滤（支持通配符）
        outputPath: null,       // 可选，输出 JSON 文件路径（默认输出到 stdout）
        maxFiles: 500,          // 最大处理文件数
        includeMainLog: false,  // 是否也解析 main.jsonl（提取主控调度决策）
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--workspace-path':
                args.workspacePath = argv[++i];
                break;
            case '--session-id':
                args.sessionId = argv[++i];
                break;
            case '--agent-filter':
                args.agentFilter = argv[++i];
                break;
            case '--output-path':
                args.outputPath = argv[++i];
                break;
            case '--max-files':
                args.maxFiles = parseInt(argv[++i], 10) || 500;
                break;
            case '--include-main-log':
                args.includeMainLog = true;
                break;
            default:
                console.log(`[warn] 未知参数: ${arg}`);
        }
    }

    return args;
}

const args = parseArgs(process.argv);

// ── 常量 ─────────────────────────────────────────────
const PROMPT_MAX_CHARS   = 500;
const OUTPUT_MAX_CHARS   = 500;
const DISPATCH_PROMPT_MAX = 200;
const LARGE_FILE_BYTES   = 50 * 1024 * 1024; // 50 MB
const HEAD_LINES         = 10000;
const TAIL_LINES         = 1000;

const FILE_WRITE_TOOLS = ['create_file', 'replace_string_in_file', 'multi_replace_string_in_file'];
const FLAGGED_TOOL_SET = ['kill_terminal', 'vscode_askQuestions', 'manage_todo_list', 'runSubagent'];

// ── 工具错误分类模式（参考 Claude Code insights 7 种分类） ──
const ERROR_PATTERNS = {
    'CommandFailed': ['exited with code', 'exit code', 'command failed', 'non-zero exit'],
    'EditFailed':    ['string to replace', 'not found in file', 'oldString', 'does not match', 'multiple locations'],
    'FileNotFound':  ['file not found', 'does not exist', 'ENOENT', 'no such file', 'not found:', 'path not found'],
    'FileChanged':   ['modified since', 'changed since', 'has been modified', 'file has changed'],
    'FileTooLarge':  ['exceeds maximum', 'too large', 'file size exceeds', 'too big'],
    'UserRejected':  ['rejected', 'cancelled', 'canceled', 'user declined', 'denied'],
};

function classifyToolError(errorText) {
    if (!errorText) return 'Other';
    const lower = errorText.toLowerCase();
    for (const category of Object.keys(ERROR_PATTERNS)) {
        for (const pattern of ERROR_PATTERNS[category]) {
            if (lower.includes(pattern)) return category;
        }
    }
    return 'Other';
}

// ── 辅助函数 ─────────────────────────────────────────

function readJsonlLines(filePath) {
    /** 读取 JSONL 文件行，大文件只取头尾 */
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const allLines = content.split('\n');

    if (stat.size > LARGE_FILE_BYTES) {
        console.log(`[warn] 大文件 (${(stat.size / (1024 * 1024)).toFixed(1)} MB)，仅解析头尾: ${filePath}`);
        const total = allLines.length;
        if (total <= HEAD_LINES + TAIL_LINES) {
            return allLines;
        }
        const head = allLines.slice(0, HEAD_LINES);
        const tail = allLines.slice(total - TAIL_LINES);
        return head.concat(tail);
    }
    return allLines;
}

function truncateString(text, max) {
    if (!text) return '';
    if (text.length <= max) return text;
    return text.substring(0, max) + '...';
}

function extractResponseText(evt) {
    /** 从 agent_response 事件提取合并的 text 输出 */
    if (!evt || !evt.attrs || !evt.attrs.response) return '';
    const resp = evt.attrs.response;
    // response.parts 可能已经是对象数组，也可能是 JSON 字符串
    let parts = null;
    if (resp.parts) {
        parts = resp.parts;
    } else {
        try {
            const parsed = typeof resp === 'string' ? JSON.parse(resp) : resp;
            if (parsed.parts) parts = parsed.parts;
        } catch (_) {
            return String(resp);
        }
    }
    if (!parts) return String(resp);
    const texts = parts
        .filter(p => p.type === 'text')
        .map(p => p.content);
    return texts.join('\n');
}

/**
 * 简单通配符匹配（支持 * 和 ?）
 * PowerShell 的 -like 操作符的等价实现
 */
function wildcardMatch(text, pattern) {
    if (!pattern) return true;
    // 将通配符模式转为正则
    const regexStr = '^' + pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') + '$';
    return new RegExp(regexStr, 'i').test(text);
}

function safeParseJson(line) {
    try {
        return JSON.parse(line);
    } catch (_) {
        return null;
    }
}

// ── 定位 workspace 目录 ──────────────────────────────
const debugLogsRoot = path.join(process.env.APPDATA || '', 'Code', 'User', 'workspaceStorage');

if (!fs.existsSync(debugLogsRoot)) {
    console.error(`[error] Debug logs 根目录不存在: ${debugLogsRoot}`);
    process.exit(1);
}

let workspaceDirs;
if (args.workspacePath) {
    // 支持完整路径或 hash 前缀
    if (fs.existsSync(args.workspacePath)) {
        workspaceDirs = [{ fullPath: args.workspacePath, name: path.basename(args.workspacePath) }];
    } else {
        // 当作 hash 前缀匹配
        try {
            workspaceDirs = fs.readdirSync(debugLogsRoot, { withFileTypes: true })
                .filter(d => d.isDirectory() && d.name.startsWith(args.workspacePath))
                .map(d => ({ fullPath: path.join(debugLogsRoot, d.name), name: d.name }));
        } catch (_) {
            workspaceDirs = [];
        }
        if (workspaceDirs.length === 0) {
            console.error(`[error] 没有匹配的 workspace: ${args.workspacePath}`);
            process.exit(1);
        }
    }
} else {
    try {
        workspaceDirs = fs.readdirSync(debugLogsRoot, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => ({ fullPath: path.join(debugLogsRoot, d.name), name: d.name }));
    } catch (_) {
        workspaceDirs = [];
    }
}

// ── 收集 JSONL 文件 ──────────────────────────────────
const allJsonlFiles = [];

for (const wsDir of workspaceDirs) {
    const logsDir = path.join(wsDir.fullPath, 'GitHub.copilot-chat', 'debug-logs');
    if (!fs.existsSync(logsDir)) continue;

    const workspaceId = wsDir.name;

    let sessionDirNames;
    try {
        sessionDirNames = fs.readdirSync(logsDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);
    } catch (_) {
        continue;
    }

    if (args.sessionId) {
        sessionDirNames = sessionDirNames.filter(n => n === args.sessionId);
    }

    for (const sDirName of sessionDirNames) {
        const sDirPath = path.join(logsDir, sDirName);

        let jsonlFileNames;
        try {
            jsonlFileNames = fs.readdirSync(sDirPath)
                .filter(f => f.startsWith('runSubagent-') && f.endsWith('.jsonl'));
        } catch (_) {
            continue;
        }

        for (const fname of jsonlFileNames) {
            const fullPath = path.join(sDirPath, fname);
            const stat = fs.statSync(fullPath);
            allJsonlFiles.push({
                fullPath,
                name: fname,
                baseName: fname.replace(/\.jsonl$/, ''),
                size: stat.size,
                lastWriteTime: stat.mtime,
                workspaceId,
                sessionId: sDirName,
            });
        }
    }
}

// 限制文件数
let filesToProcess = allJsonlFiles;
if (filesToProcess.length > args.maxFiles) {
    console.log(`[info] 文件数 ${filesToProcess.length} 超过上限 ${args.maxFiles}，只处理最近 ${args.maxFiles} 个`);
    filesToProcess.sort((a, b) => b.lastWriteTime - a.lastWriteTime);
    filesToProcess = filesToProcess.slice(0, args.maxFiles);
}

console.log(`[info] 待处理 ${filesToProcess.length} 个 subagent 日志文件`);

// ── 解析 subagent 日志 ───────────────────────────────
const invocations = [];
let fileIdx = 0;

for (const entry of filesToProcess) {
    fileIdx++;
    const jsonlFile   = entry;
    const workspaceId = entry.workspaceId;
    const sid         = entry.sessionId;

    // 从文件名提取 agent 名称：runSubagent-<AgentName>-(call|toolu)_*
    const baseName  = entry.baseName;
    const agentName = baseName.replace(/^runSubagent-/, '').replace(/-(call|toolu)_.*$/, '');

    // 通配符过滤
    if (args.agentFilter && !wildcardMatch(agentName, args.agentFilter)) continue;

    if (fileIdx % 50 === 0) {
        console.log(`[progress] ${fileIdx} / ${filesToProcess.length} ...`);
    }

    let lines;
    try {
        lines = readJsonlLines(jsonlFile.fullPath);
    } catch (e) {
        console.log(`[warn] 跳过无法读取: ${jsonlFile.name} — ${e.message}`);
        continue;
    }

    let prompt            = '';
    let lastAgentResp     = null;
    const toolCounts      = {};
    let hasFileWrites     = false;
    let hasNestedDispatch = false;
    let hasKillTerminal   = false;
    let hasAskQuestions   = false;
    let hasTodoList       = false;
    const flaggedTools    = [];
    let firstTs           = null;
    let lastTs            = null;
    let totalDurMs        = 0;
    // 工具错误分类
    const toolErrorCats   = {};
    let totalToolErrors   = 0;
    // 代码变更统计
    let filesCreated      = 0;
    let filesModified     = 0;
    let replacements      = 0;
    const changedFilePaths = new Set();
    // 记录上一个 tool_call 名称
    let lastToolCallName  = '';

    for (const line of lines) {
        if (!line || !line.trim()) continue;
        const evt = safeParseJson(line);
        if (!evt) continue;

        // 时间戳追踪
        if (evt.ts) {
            if (!firstTs) firstTs = evt.ts;
            lastTs = evt.ts;
        }

        if (evt.type === 'user_message') {
            if (!prompt && evt.attrs && evt.attrs.content) {
                prompt = String(evt.attrs.content);
            }
        } else if (evt.type === 'agent_response') {
            lastAgentResp = evt;
        } else if (evt.type === 'tool_call') {
            const toolName = evt.name ? String(evt.name) : 'unknown';
            toolCounts[toolName] = (toolCounts[toolName] || 0) + 1;
            lastToolCallName = toolName;

            // 文件写入检测
            if (FILE_WRITE_TOOLS.includes(toolName)) {
                hasFileWrites = true;
            }

            // 代码变更统计
            if (toolName === 'create_file') {
                filesCreated++;
                if (evt.attrs && evt.attrs.args) {
                    try {
                        const argsObj = typeof evt.attrs.args === 'string'
                            ? JSON.parse(evt.attrs.args)
                            : evt.attrs.args;
                        if (argsObj && argsObj.filePath) changedFilePaths.add(String(argsObj.filePath));
                    } catch (_) { /* ignore */ }
                }
            }
            if (toolName === 'replace_string_in_file') {
                filesModified++;
                replacements++;
                if (evt.attrs && evt.attrs.args) {
                    try {
                        const argsObj = typeof evt.attrs.args === 'string'
                            ? JSON.parse(evt.attrs.args)
                            : evt.attrs.args;
                        if (argsObj && argsObj.filePath) changedFilePaths.add(String(argsObj.filePath));
                    } catch (_) { /* ignore */ }
                }
            }
            if (toolName === 'multi_replace_string_in_file') {
                filesModified++;
                if (evt.attrs && evt.attrs.args) {
                    try {
                        const argsObj = typeof evt.attrs.args === 'string'
                            ? JSON.parse(evt.attrs.args)
                            : evt.attrs.args;
                        if (argsObj && argsObj.replacements && Array.isArray(argsObj.replacements)) {
                            replacements += argsObj.replacements.length;
                            for (const rep of argsObj.replacements) {
                                if (rep.filePath) changedFilePaths.add(String(rep.filePath));
                            }
                        }
                    } catch (_) { /* ignore */ }
                }
            }

            // 嵌套调度检测
            if (toolName === 'runSubagent') {
                hasNestedDispatch = true;
                if (!flaggedTools.includes('runSubagent')) flaggedTools.push('runSubagent');
            }
            // kill_terminal
            if (toolName === 'kill_terminal') {
                hasKillTerminal = true;
                if (!flaggedTools.includes('kill_terminal')) flaggedTools.push('kill_terminal');
            }
            // vscode_askQuestions（subagent 越权）
            if (toolName === 'vscode_askQuestions') {
                hasAskQuestions = true;
                if (!flaggedTools.includes('vscode_askQuestions')) flaggedTools.push('vscode_askQuestions');
            }
            // manage_todo_list（subagent 越权）
            if (toolName === 'manage_todo_list') {
                hasTodoList = true;
                if (!flaggedTools.includes('manage_todo_list')) flaggedTools.push('manage_todo_list');
            }

            // 工具持续时间
            if (evt.dur) {
                totalDurMs += Number(evt.dur) || 0;
            }

            // 工具错误检测与分类（JSONL 中错误在 tool_call 事件的 status 字段）
            let isError = false;
            let errText = '';
            if (evt.status === 'error') {
                isError = true;
                if (evt.attrs && evt.attrs.result) {
                    errText = String(evt.attrs.result);
                } else if (evt.attrs && evt.attrs.error) {
                    errText = String(evt.attrs.error);
                }
            }
            if (isError) {
                totalToolErrors++;
                const cat = classifyToolError(errText);
                toolErrorCats[cat] = (toolErrorCats[cat] || 0) + 1;
            }
        }
    }

    // 提取输出文本
    const outputText = extractResponseText(lastAgentResp);

    // 计算整体持续时间（首尾时间戳差）
    let durationMs = 0;
    if (firstTs && lastTs && firstTs !== lastTs) {
        try {
            const startTime = new Date(String(firstTs)).getTime();
            const endTime   = new Date(String(lastTs)).getTime();
            if (!isNaN(startTime) && !isNaN(endTime)) {
                durationMs = Math.round(endTime - startTime);
            }
        } catch (_) {
            durationMs = 0;
        }
    }

    const logSizeKB  = Math.round((jsonlFile.size / 1024) * 10) / 10;
    const timestamp  = firstTs ? String(firstTs) : '';
    let totalCalls   = 0;
    for (const v of Object.values(toolCounts)) totalCalls += v;

    // 计算工具成功率
    let toolSuccessRate = 100.0;
    if (totalCalls > 0) {
        toolSuccessRate = Math.round(((totalCalls - totalToolErrors) / totalCalls) * 1000) / 10;
    }

    invocations.push({
        logFile:             jsonlFile.fullPath,
        agentName:           agentName,
        sessionId:           sid,
        workspaceId:         workspaceId,
        logSizeKB:           logSizeKB,
        prompt:              truncateString(prompt, PROMPT_MAX_CHARS),
        output:              truncateString(outputText, OUTPUT_MAX_CHARS),
        toolCalls:           toolCounts,
        totalToolCalls:      totalCalls,
        totalToolErrors:     totalToolErrors,
        toolSuccessRate:     toolSuccessRate,
        toolErrorCategories: toolErrorCats,
        codeChanges: {
            filesCreated:    filesCreated,
            filesModified:   filesModified,
            replacements:    replacements,
            uniqueFilePaths: Array.from(changedFilePaths),
        },
        hasFileWrites:       hasFileWrites,
        hasNestedDispatch:   hasNestedDispatch,
        hasKillTerminal:     hasKillTerminal,
        hasAskQuestions:     hasAskQuestions,
        hasTodoList:         hasTodoList,
        timestamp:           timestamp,
        durationMs:          durationMs,
        flaggedTools:        flaggedTools,
    });
}

console.log(`[info] 解析完成，共 ${invocations.length} 条 subagent 调用记录`);

// ── 解析 main.jsonl（主控调度） ──────────────────────
const dispatches = [];

if (args.includeMainLog) {
    console.log('[info] 正在解析 main.jsonl 主控调度记录 ...');

    for (const wsDir of workspaceDirs) {
        const logsDir = path.join(wsDir.fullPath, 'GitHub.copilot-chat', 'debug-logs');
        if (!fs.existsSync(logsDir)) continue;
        const workspaceId = wsDir.name;

        let sessionDirNames;
        try {
            sessionDirNames = fs.readdirSync(logsDir, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name);
        } catch (_) {
            continue;
        }

        if (args.sessionId) {
            sessionDirNames = sessionDirNames.filter(n => n === args.sessionId);
        }

        for (const sDirName of sessionDirNames) {
            const sDirPath = path.join(logsDir, sDirName);
            const mainFile = path.join(sDirPath, 'main.jsonl');
            if (!fs.existsSync(mainFile)) continue;

            let mainLines;
            try {
                mainLines = readJsonlLines(mainFile);
            } catch (e) {
                console.log(`[warn] 跳过无法读取的 main.jsonl: ${mainFile}`);
                continue;
            }

            for (const line of mainLines) {
                if (!line || !line.trim()) continue;
                const evt = safeParseJson(line);
                if (!evt) continue;
                if (evt.type !== 'tool_call' || evt.name !== 'runSubagent') continue;

                let dispatchAgentName = '';
                let dispatchDesc      = '';
                let dispatchPrompt    = '';
                const dispatchTs      = evt.ts ? String(evt.ts) : '';

                if (evt.attrs && evt.attrs.args) {
                    try {
                        const argsObj = typeof evt.attrs.args === 'string'
                            ? JSON.parse(evt.attrs.args)
                            : evt.attrs.args;
                        if (argsObj) {
                            if (argsObj.agentName)   dispatchAgentName = String(argsObj.agentName);
                            if (argsObj.description) dispatchDesc = String(argsObj.description);
                            if (argsObj.prompt)      dispatchPrompt = truncateString(String(argsObj.prompt), DISPATCH_PROMPT_MAX);
                        }
                    } catch (_) {
                        // args 解析失败，跳过
                    }
                }

                if (args.agentFilter && !wildcardMatch(dispatchAgentName, args.agentFilter)) continue;

                dispatches.push({
                    workspaceId: workspaceId,
                    sessionId:   sDirName,
                    agentName:   dispatchAgentName,
                    description: dispatchDesc,
                    prompt:      dispatchPrompt,
                    timestamp:   dispatchTs,
                });
            }
        }
    }

    console.log(`[info] 提取 ${dispatches.length} 条主控调度记录`);
}

// ── 聚合 summary ─────────────────────────────────────
const byAgent     = {};
const agentSizes  = {};
const byWorkspace = {};
const flagCounts  = { nestedDispatch: 0, askQuestions: 0, killTerminal: 0, todoList: 0 };
const timestamps  = [];
// 聚合：工具错误分类
const aggToolErrorCats = {};
// 聚合：代码变更
let aggFilesCreated  = 0;
let aggFilesModified = 0;
let aggReplacements  = 0;
// 聚合：成功率
const successRates = [];

for (const inv of invocations) {
    const an = inv.agentName;
    byAgent[an] = (byAgent[an] || 0) + 1;
    if (!agentSizes[an]) agentSizes[an] = [];
    agentSizes[an].push(inv.logSizeKB);

    const wid = inv.workspaceId;
    byWorkspace[wid] = (byWorkspace[wid] || 0) + 1;

    if (inv.hasNestedDispatch) flagCounts.nestedDispatch++;
    if (inv.hasAskQuestions)   flagCounts.askQuestions++;
    if (inv.hasKillTerminal)   flagCounts.killTerminal++;
    if (inv.hasTodoList)       flagCounts.todoList++;

    if (inv.timestamp) timestamps.push(inv.timestamp);

    // 聚合工具错误分类
    if (inv.toolErrorCategories) {
        for (const [k, v] of Object.entries(inv.toolErrorCategories)) {
            aggToolErrorCats[k] = (aggToolErrorCats[k] || 0) + v;
        }
    }
    // 聚合代码变更
    if (inv.codeChanges) {
        aggFilesCreated  += inv.codeChanges.filesCreated;
        aggFilesModified += inv.codeChanges.filesModified;
        aggReplacements  += inv.codeChanges.replacements;
    }
    // 聚合成功率
    if (inv.totalToolCalls > 0) {
        successRates.push(inv.toolSuccessRate);
    }
}

// 按 agent 构建 byAgent 详情
const byAgentDetail = {};
for (const an of Object.keys(byAgent)) {
    const sizes = agentSizes[an] || [];
    let avg = 0;
    if (sizes.length > 0) {
        avg = Math.round((sizes.reduce((a, b) => a + b, 0) / sizes.length) * 10) / 10;
    }
    byAgentDetail[an] = {
        count:     byAgent[an],
        avgSizeKB: avg,
    };
}

// 时间范围
let timeRange = { earliest: '', latest: '' };
if (timestamps.length > 0) {
    const sorted = timestamps.slice().sort();
    timeRange = {
        earliest: sorted[0],
        latest:   sorted[sorted.length - 1],
    };
}

const avgToolSuccessRate = successRates.length > 0
    ? Math.round((successRates.reduce((a, b) => a + b, 0) / successRates.length) * 10) / 10
    : 100.0;

const summary = {
    totalInvocations:    invocations.length,
    timeRange:           timeRange,
    byAgent:             byAgentDetail,
    byWorkspace:         byWorkspace,
    flaggedInvocations: {
        nestedDispatch:  flagCounts.nestedDispatch,
        askQuestions:    flagCounts.askQuestions,
        killTerminal:   flagCounts.killTerminal,
        todoList:       flagCounts.todoList,
    },
    toolErrorCategories: aggToolErrorCats,
    codeChanges: {
        filesCreated:    aggFilesCreated,
        filesModified:   aggFilesModified,
        replacements:    aggReplacements,
    },
    avgToolSuccessRate:  avgToolSuccessRate,
};

// ── 输出 ─────────────────────────────────────────────
const resultObj = {
    summary:     summary,
    invocations: invocations,
};
if (args.includeMainLog) {
    resultObj.dispatches = dispatches;
}

const json = JSON.stringify(resultObj, null, 2);

if (args.outputPath) {
    const parentDir = path.dirname(args.outputPath);
    if (parentDir && !fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(args.outputPath, json, 'utf8');
    console.log(`[done] 已输出 ${invocations.length} 条记录到 ${args.outputPath}`);
} else {
    process.stdout.write(json + '\n');
}
