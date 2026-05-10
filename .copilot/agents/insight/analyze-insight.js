'use strict';

/**
 * analyze-insight.js
 * 从 VS Code Copilot debug-logs 提取定量统计数据，输出结构化 JSON。
 *
 * 扫描所有 workspace 的 debug-logs JSONL 文件，解析事件流，
 * 提取 session 级别的 token、工具调用、错误分类、代码变更、
 * 时间分布等定量指标。纯本地计算，不调用 LLM。
 *
 * Usage:
 *   node analyze-insight.js --output-path ./reports/insight-data.json
 *   node analyze-insight.js --output-path ./reports/insight-data.json --days-back 7
 *   node analyze-insight.js --output-path ./reports/insight-data.json --workspace-path "D:\GIT\my-project"
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// ── CLI 参数解析 ─────────────────────────────────────
function parseArgs(argv) {
    const args = {
        outputPath: null,
        workspacePath: null,
        sessionId: null,
        maxFiles: 0,
        daysBack: 30,
        extractTranscripts: false,
        transcriptOutput: 'reports/session-transcripts',
        cachePath: 'reports/insight-cache',
        extractTurns: false,
        turnsOutput: 'reports/conversation-turns',
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--output-path':
                args.outputPath = argv[++i];
                break;
            case '--workspace-path':
                args.workspacePath = argv[++i];
                break;
            case '--session-id':
                args.sessionId = argv[++i];
                break;
            case '--max-files':
                args.maxFiles = parseInt(argv[++i], 10) || 0;
                break;
            case '--days-back':
                args.daysBack = parseInt(argv[++i], 10) || 30;
                break;
            case '--extract-transcripts':
                args.extractTranscripts = true;
                break;
            case '--transcript-output':
                args.transcriptOutput = argv[++i];
                break;
            case '--cache-path':
                args.cachePath = argv[++i];
                break;
            case '--extract-turns':
                args.extractTurns = true;
                break;
            case '--turns-output':
                args.turnsOutput = argv[++i];
                break;
            default:
                console.log(`[warn] 未知参数: ${arg}`);
        }
    }

    if (!args.outputPath) {
        console.error('[error] 必须指定 --output-path <path>');
        process.exit(1);
    }

    return args;
}

const args = parseArgs(process.argv);
const startTime = Date.now();

// ── 常量 ─────────────────────────────────────────────
const USER_RESPONSE_MIN_SEC = 2;
const USER_RESPONSE_MAX_SEC = 3600;

// 语言扩展名映射
const LANG_MAP = {
    '.ts': 'typescript', '.tsx': 'typescript',
    '.js': 'javascript', '.jsx': 'javascript',
    '.py': 'python',
    '.cs': 'csharp',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.c': 'c', '.h': 'c',
    '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
    '.ps1': 'powershell', '.psm1': 'powershell',
    '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
    '.md': 'markdown',
    '.json': 'json',
    '.yaml': 'yaml', '.yml': 'yaml',
    '.html': 'html', '.htm': 'html',
    '.css': 'css', '.scss': 'css', '.less': 'css',
    '.sql': 'sql',
    '.xml': 'xml',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.dart': 'dart',
    '.lua': 'lua',
    '.r': 'r',
};

// 工具错误分类模式（有序：具体模式优先匹配）
const ERROR_PATTERNS = [
    ['EditFailed',       ['string to replace', 'not found in file', 'oldString', 'does not match', 'multiple locations', 'did not match', 'matches multiple']],
    ['FileNotFound',     ['file not found', 'does not exist', 'ENOENT', 'no such file', 'not found:', 'path not found', 'could not find', 'cannot find']],
    ['FileExists',       ['file already exists', 'already exists', 'EEXIST']],
    ['FileChanged',      ['modified since', 'changed since', 'has been modified', 'file has changed', 'file changed']],
    ['FileTooLarge',     ['exceeds maximum', 'too large', 'file size exceeds', 'too big', 'content too large']],
    ['CommandFailed',    ['exited with code', 'exit code', 'command failed', 'non-zero exit', 'non zero']],
    ['Timeout',          ['timeout', 'timed out', 'time out', 'deadline exceeded']],
    ['PermissionDenied', ['permission denied', 'access denied', 'EACCES', 'unauthorized', 'forbidden']],
    ['ValidationError',  ['syntax error', 'malformed', 'parse error', 'is not valid', 'invalid argument', 'invalid path', 'invalid file']],
    ['UserRejected',     ['rejected', 'cancelled', 'canceled', 'user declined', 'user aborted', 'user denied']],
];

// ── Helper Functions ─────────────────────────────────

function classifyToolError(text) {
    if (!text) return 'Other';
    const lower = text.toLowerCase();
    for (const [category, patterns] of ERROR_PATTERNS) {
        for (const pattern of patterns) {
            if (lower.includes(pattern)) return category;
        }
    }
    return 'Other';
}

function detectLanguage(filePath) {
    if (!filePath) return null;
    const ext = path.extname(filePath).toLowerCase();
    return LANG_MAP[ext] || null;
}

function extractFilePathFromArgs(argsObj) {
    if (!argsObj) return null;
    const argsStr = typeof argsObj === 'string' ? argsObj : JSON.stringify(argsObj);
    try {
        const parsed = typeof argsObj === 'string' ? JSON.parse(argsStr) : argsObj;
        if (parsed.filePath) return String(parsed.filePath);
        if (parsed.path) return String(parsed.path);
        // multi_replace_string_in_file
        if (parsed.replacements && Array.isArray(parsed.replacements) && parsed.replacements.length > 0) {
            return String(parsed.replacements[0].filePath);
        }
    } catch (_) { /* ignore */ }
    return null;
}

function tryReadWorkspaceJson(wsDir) {
    const wsJsonPath = path.join(wsDir, 'workspace.json');
    try {
        if (!fs.existsSync(wsJsonPath)) return null;
        const content = fs.readFileSync(wsJsonPath, 'utf8');
        const wsJson = JSON.parse(content);
        if (wsJson.folder) {
            const uri = String(wsJson.folder);
            // file:///D%3A/GIT/xxx → D:\GIT\xxx
            if (uri.startsWith('file:///')) {
                const decoded = decodeURIComponent(uri.substring(8));
                return decoded.replace(/\//g, '\\');
            }
            return uri;
        }
    } catch (_) { /* ignore */ }
    return null;
}

function incrementMap(map, key, amount) {
    map[key] = (map[key] || 0) + amount;
}

function safeParseJson(line) {
    try {
        return JSON.parse(line);
    } catch (_) {
        return null;
    }
}

function formatLocalDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function formatLocalDateTime(d) {
    return `${formatLocalDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function tsToIso(ts) {
    try {
        const d = new Date(Number(ts));
        return formatLocalDateTime(d);
    } catch (_) {
        return '';
    }
}

function tsToHour(ts) {
    try {
        return new Date(Number(ts)).getHours();
    } catch (_) {
        return -1;
    }
}

function tsToTimeTag(ts) {
    try {
        const d = new Date(Number(ts));
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    } catch (_) {
        return '??:??';
    }
}

function countNewlines(s) {
    if (!s) return 1;
    return String(s).split('\n').length;
}

function md5Hash(text) {
    return crypto.createHash('md5').update(text, 'utf8').digest('hex');
}

/**
 * Parse agent_response.attrs.response JSON string into structured parts.
 * Handles the 5011-char truncation gracefully.
 */
function parseParts(responseStr) {
  if (!responseStr) return { textParts: [], toolCallParts: [], reasoning: null, isTruncated: false };

  const isTruncated = responseStr.length >= 5010;
  let parsed = null;

  try {
    parsed = JSON.parse(responseStr);
  } catch (_) {
    // 5011 truncation broke the JSON — extract text via regex
    const textMatches = [];
    const re = /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(responseStr)) !== null) {
      try { textMatches.push(JSON.parse('"' + m[1] + '"')); } catch (_) { textMatches.push(m[1]); }
    }
    return { textParts: textMatches, toolCallParts: [], reasoning: null, isTruncated: true };
  }

  const textParts = [];
  const toolCallParts = [];

  if (Array.isArray(parsed)) {
    for (const msg of parsed) {
      if (msg && Array.isArray(msg.parts)) {
        for (const part of msg.parts) {
          if (part.type === 'text' && part.content) {
            textParts.push(part.content);
          } else if (part.type === 'tool_call') {
            toolCallParts.push({ name: part.name, id: part.id, arguments: part.arguments });
          }
        }
      }
    }
  }

  return { textParts, toolCallParts, reasoning: null, isTruncated };
}

/**
 * Builds conversation turns from JSONL events using native turn_start/turn_end boundaries.
 */
class TurnBuilder {
  constructor() {
    this.turns = [];
    this.currentTurn = null;
    this.orphanEvents = []; // events before first turn_start
    this.pendingUserMessage = null; // buffered user_message before turn_start
  }

  onTurnStart(evt) {
    if (this.currentTurn) {
      // Previous turn wasn't closed — force close it
      this.turns.push(this._finalize(this.currentTurn));
    }
    const turnId = (evt.attrs && evt.attrs.turnId) || String(this.turns.length);
    this.currentTurn = {
      turnId,
      startTs: Number(evt.ts) || 0,
      endTs: null,
      durMs: null,
      userMessage: null,
      agentResponses: [],
      toolCalls: [],
      llmRequests: [],
      subagentCalls: [],
      askQuestions: [],
    };
    // Attach buffered user_message that arrived before this turn_start
    if (this.pendingUserMessage) {
      this.currentTurn.userMessage = this.pendingUserMessage;
      this.pendingUserMessage = null;
    }
  }

  onTurnEnd(evt) {
    if (!this.currentTurn) return;
    this.currentTurn.endTs = Number(evt.ts) || 0;
    this.currentTurn.durMs = this.currentTurn.endTs - this.currentTurn.startTs;
    this.turns.push(this._finalize(this.currentTurn));
    this.currentTurn = null;
  }

  onUserMessage(evt) {
    const msg = {
      content: (evt.attrs && evt.attrs.content) || '',
      ts: Number(evt.ts) || 0,
    };
    if (this.currentTurn) {
      this.currentTurn.userMessage = msg;
    } else {
      // Buffer — will be attached to next turn_start
      this.pendingUserMessage = msg;
    }
  }

  onAgentResponse(evt) {
    if (!this.currentTurn) return;
    const responseStr = evt.attrs && (evt.attrs.response || evt.attrs.content);
    const parts = parseParts(typeof responseStr === 'string' ? responseStr : null);
    parts.reasoning = (evt.attrs && evt.attrs.reasoning) || null;
    parts.ts = Number(evt.ts) || 0;
    this.currentTurn.agentResponses.push(parts);
  }

  onToolCall(evt) {
    if (!this.currentTurn) return;
    const toolName = evt.name || '';
    let argsParsed = null;
    let resultParsed = null;

    if (evt.attrs && evt.attrs.args) {
      try { argsParsed = typeof evt.attrs.args === 'string' ? JSON.parse(evt.attrs.args) : evt.attrs.args; } catch (_) { argsParsed = evt.attrs.args; }
    }
    if (evt.attrs && evt.attrs.result) {
      const raw = evt.attrs.result;
      const resultTruncated = typeof raw === 'string' && raw.length >= 5010;
      try { resultParsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { resultParsed = raw; }

      // askQuestions exchange
      if (toolName === 'vscode_askQuestions' || toolName === 'askQuestions') {
        const aq = {
          questions: [],
          answers: {},
        };
        if (argsParsed && argsParsed.questions) {
          aq.questions = argsParsed.questions.map(q => ({
            header: q.header || '',
            question: q.question || '',
            options: q.options || [],
          }));
        }
        if (resultParsed && resultParsed.answers) {
          aq.answers = resultParsed.answers;
        }
        this.currentTurn.askQuestions.push(aq);
      }

      // runSubagent exchange
      if (toolName === 'runSubagent') {
        this.currentTurn.subagentCalls.push({
          agentName: (argsParsed && argsParsed.agentName) || 'unknown',
          description: (argsParsed && argsParsed.description) || '',
          prompt: (argsParsed && argsParsed.prompt) || '',
          result: typeof resultParsed === 'string' ? resultParsed : JSON.stringify(resultParsed || ''),
          resultTruncated: typeof raw === 'string' && raw.length >= 5010,
          childLogFile: null, // linked later
        });
      }
    }

    this.currentTurn.toolCalls.push({
      name: toolName,
      status: evt.status || 'ok',
      dur: Number(evt.dur) || 0,
      ts: Number(evt.ts) || 0,
      resultTruncated: evt.attrs && typeof evt.attrs.result === 'string' && evt.attrs.result.length >= 5010,
    });
  }

  onLlmRequest(evt) {
    if (!this.currentTurn) return;
    this.currentTurn.llmRequests.push({
      model: (evt.attrs && evt.attrs.model) || (evt.name || '').replace('chat:', ''),
      inputTokens: Number((evt.attrs && evt.attrs.inputTokens) || 0),
      outputTokens: Number((evt.attrs && evt.attrs.outputTokens) || 0),
      ttft: Number((evt.attrs && evt.attrs.ttft) || 0),
      dur: Number(evt.dur) || 0,
    });
  }

  onChildSessionRef(evt) {
    if (!this.currentTurn) return;
    const childLogFile = evt.attrs && evt.attrs.childLogFile;
    const label = evt.attrs && evt.attrs.label;
    if (childLogFile) {
      // Try to link to the most recent unlinked subagent call
      for (let i = this.currentTurn.subagentCalls.length - 1; i >= 0; i--) {
        if (!this.currentTurn.subagentCalls[i].childLogFile) {
          this.currentTurn.subagentCalls[i].childLogFile = childLogFile;
          break;
        }
      }
    }
  }

  _finalize(turn) {
    const totalToolCalls = turn.toolCalls.length;
    const totalLlmCalls = turn.llmRequests.length;
    let totalInput = 0, totalOutput = 0;
    for (const lr of turn.llmRequests) { totalInput += lr.inputTokens; totalOutput += lr.outputTokens; }

    turn.summary = {
      totalToolCalls,
      totalLlmCalls,
      totalTokens: { input: totalInput, output: totalOutput },
      hasUserMessage: !!turn.userMessage,
      hasTextResponse: turn.agentResponses.some(r => r.textParts.length > 0),
      hasAskQuestions: turn.askQuestions.length > 0,
      hasSubagent: turn.subagentCalls.length > 0,
    };
    return turn;
  }

  build() {
    if (this.currentTurn) {
      this.turns.push(this._finalize(this.currentTurn));
      this.currentTurn = null;
    }
    return this.turns;
  }
}

/**
 * Create a compact turn summary for LLM facets analysis.
 * Strips large content, keeps structure and key signals.
 */
function buildTurnSummaryForLLM(turns) {
  if (!turns || turns.length === 0) return null;

  const significantTurns = turns.filter(t =>
    t.userMessage || t.askQuestions.length > 0 || t.subagentCalls.length > 0
  );

  return {
    totalTurns: turns.length,
    significantTurns: significantTurns.length,
    turnSummaries: significantTurns.map(t => {
      const s = {
        turnId: t.turnId,
        durSec: Math.round((t.durMs || 0) / 1000),
      };
      if (t.userMessage) {
        s.userMessage = t.userMessage.content.length > 500
          ? t.userMessage.content.substring(0, 500) + '...'
          : t.userMessage.content;
      }
      if (t.agentResponses.length > 0) {
        const allText = t.agentResponses.flatMap(r => r.textParts).join('\n');
        s.aiResponse = allText.length > 500 ? allText.substring(0, 500) + '...' : allText;
        s.aiResponseTruncatedInLog = t.agentResponses.some(r => r.isTruncated);
      }
      if (t.askQuestions.length > 0) {
        s.askQuestions = t.askQuestions.map(aq => ({
          questions: aq.questions.map(q => q.question),
          answers: aq.answers,
        }));
      }
      if (t.subagentCalls.length > 0) {
        s.subagents = t.subagentCalls.map(sc => ({
          agent: sc.agentName,
          desc: sc.description,
          resultTruncated: sc.resultTruncated,
        }));
      }
      if (t.summary) {
        s.toolCalls = t.summary.totalToolCalls;
        s.tokens = t.summary.totalTokens;
      }
      return s;
    }),
    stats: {
      turnsWithUserMsg: turns.filter(t => t.userMessage).length,
      turnsWithAskQ: turns.filter(t => t.askQuestions.length > 0).length,
      turnsWithSubagent: turns.filter(t => t.subagentCalls.length > 0).length,
      truncatedResponses: turns.reduce((c, t) => c + t.agentResponses.filter(r => r.isTruncated).length, 0),
      totalResponses: turns.reduce((c, t) => c + t.agentResponses.length, 0),
    }
  };
}

// ── 定位 workspace 目录 ──────────────────────────────
const debugLogsRoot = path.join(process.env.APPDATA || '', 'Code', 'User', 'workspaceStorage');
if (!fs.existsSync(debugLogsRoot)) {
    console.error(`[error] Debug logs 根目录不存在: ${debugLogsRoot}`);
    process.exit(1);
}

const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - args.daysBack);

let workspaceDirs;
if (args.workspacePath) {
    if (fs.existsSync(args.workspacePath)) {
        workspaceDirs = [{ fullPath: args.workspacePath, name: path.basename(args.workspacePath) }];
    } else {
        // 模糊匹配
        const allDirs = fs.readdirSync(debugLogsRoot, { withFileTypes: true })
            .filter(d => d.isDirectory() && d.name.startsWith(args.workspacePath));
        workspaceDirs = allDirs.map(d => ({ fullPath: path.join(debugLogsRoot, d.name), name: d.name }));
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

console.log(`[info] 扫描 ${workspaceDirs.length} 个 workspace 目录...`);

// ── 收集 session 目录 ────────────────────────────────
const sessionEntries = [];

for (const wsDir of workspaceDirs) {
    const logsDir = path.join(wsDir.fullPath, 'GitHub.copilot-chat', 'debug-logs');
    if (!fs.existsSync(logsDir)) continue;

    const workspaceId = wsDir.name;
    const workspaceFolderPath = tryReadWorkspaceJson(wsDir.fullPath);

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

        // 日期过滤：用目录最后修改时间
        try {
            const stat = fs.statSync(sDirPath);
            if (stat.mtime < cutoffDate) continue;
        } catch (_) {
            continue;
        }

        const mainFile = path.join(sDirPath, 'main.jsonl');
        if (!fs.existsSync(mainFile)) continue;

        // 收集 subagent 文件
        let subagentFiles = [];
        try {
            subagentFiles = fs.readdirSync(sDirPath)
                .filter(f => f.startsWith('runSubagent-') && f.endsWith('.jsonl'))
                .map(f => path.join(sDirPath, f));
        } catch (_) { /* ignore */ }

        const wsName = workspaceFolderPath
            ? path.basename(workspaceFolderPath)
            : workspaceId.substring(0, Math.min(8, workspaceId.length));

        sessionEntries.push({
            sessionDirPath: sDirPath,
            sessionDirMtime: fs.statSync(sDirPath).mtime,
            sessionId: sDirName,
            workspaceId,
            workspacePath: workspaceFolderPath,
            workspaceName: wsName,
            mainFile,
            subagentFiles,
        });
    }
}

// 限制处理数
if (args.maxFiles > 0 && sessionEntries.length > args.maxFiles) {
    console.log(`[info] Session 数 ${sessionEntries.length} 超过上限 ${args.maxFiles}，只处理最近的`);
    sessionEntries.sort((a, b) => b.sessionDirMtime - a.sessionDirMtime);
    sessionEntries.length = args.maxFiles;
}

// 统计总文件大小
let totalSizeBytes = 0;
let totalFiles = sessionEntries.length;
for (const se of sessionEntries) {
    try { totalSizeBytes += fs.statSync(se.mainFile).size; } catch (_) { /* ignore */ }
    for (const sf of se.subagentFiles) {
        try { totalSizeBytes += fs.statSync(sf).size; } catch (_) { /* ignore */ }
        totalFiles++;
    }
}

console.log(`[info] 待处理 ${sessionEntries.length} 个 session，${totalFiles} 个文件，总计 ${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB`);

// ── 缓存目录 ─────────────────────────────────────────
let cachePath = args.cachePath;
if (!path.isAbsolute(cachePath)) {
    cachePath = path.resolve(cachePath);
}
fs.mkdirSync(cachePath, { recursive: true });

// ── 解析每个 session ─────────────────────────────────
const sessions = [];
let transcriptFilesWritten = 0;
let cachedCount = 0;
let newCount = 0;

/**
 * Parse tool_call event and update session tracking variables.
 * Shared between main.jsonl and subagent JSONL parsing.
 */
function processToolCall(evt, ctx) {
    const toolName = evt.name ? String(evt.name) : 'unknown';
    incrementMap(ctx.toolCounts, toolName, 1);

    // Subagent 调用
    if (toolName === 'runSubagent') {
        ctx.subagentCalls++;
        if (evt.attrs && evt.attrs.args) {
            try {
                const argsObj = typeof evt.attrs.args === 'string' ? JSON.parse(evt.attrs.args) : evt.attrs.args;
                const saName = argsObj.agentName || argsObj.agent || '';
                if (saName) {
                    incrementMap(ctx.subagentNames, saName, 1);
                }
            } catch (_) { /* ignore */ }
        }
    }

    // 代码变更统计
    if (toolName === 'create_file') ctx.filesCreated++;
    if (toolName === 'replace_string_in_file') { ctx.filesModified++; ctx.replacements++; }
    if (toolName === 'multi_replace_string_in_file') {
        ctx.filesModified++;
        if (evt.attrs && evt.attrs.args) {
            try {
                const argsObj = typeof evt.attrs.args === 'string' ? JSON.parse(evt.attrs.args) : evt.attrs.args;
                if (argsObj.replacements && Array.isArray(argsObj.replacements)) {
                    ctx.replacements += argsObj.replacements.length;
                } else {
                    ctx.replacements++;
                }
            } catch (_) { ctx.replacements++; }
        }
    }

    // Git 操作检测
    if (toolName === 'run_in_terminal' && evt.attrs && evt.attrs.args) {
        try {
            const cmdObj = typeof evt.attrs.args === 'string' ? JSON.parse(evt.attrs.args) : evt.attrs.args;
            const cmdStr = (cmdObj.command || '').toLowerCase();
            if (/git\s+commit/.test(cmdStr)) ctx.gitOperations.commits++;
            if (/git\s+push/.test(cmdStr)) ctx.gitOperations.pushes++;
            if (/git\s+(merge|rebase)/.test(cmdStr)) ctx.gitOperations.merges++;
            if (/git\s+stash/.test(cmdStr)) ctx.gitOperations.stashes++;
        } catch (_) { /* ignore */ }
    }

    // Diff 行数统计
    if (toolName === 'replace_string_in_file' && evt.attrs && evt.attrs.args) {
        try {
            const diffObj = typeof evt.attrs.args === 'string' ? JSON.parse(evt.attrs.args) : evt.attrs.args;
            if (diffObj.oldString && diffObj.newString) {
                const oldLines = countNewlines(diffObj.oldString);
                const newLines = countNewlines(diffObj.newString);
                if (newLines > oldLines) ctx.diffLines.added += (newLines - oldLines);
                else ctx.diffLines.removed += (oldLines - newLines);
            }
        } catch (_) { /* ignore */ }
    }
    if (toolName === 'multi_replace_string_in_file' && evt.attrs && evt.attrs.args) {
        try {
            const diffObj = typeof evt.attrs.args === 'string' ? JSON.parse(evt.attrs.args) : evt.attrs.args;
            if (diffObj.replacements && Array.isArray(diffObj.replacements)) {
                for (const rep of diffObj.replacements) {
                    if (rep.oldString && rep.newString) {
                        const oldLines = countNewlines(rep.oldString);
                        const newLines = countNewlines(rep.newString);
                        if (newLines > oldLines) ctx.diffLines.added += (newLines - oldLines);
                        else ctx.diffLines.removed += (oldLines - newLines);
                    }
                }
            }
        } catch (_) { /* ignore */ }
    }

    // Feature 使用检测
    if (toolName.startsWith('mcp_')) ctx.usesMcp = true;
    if (toolName === 'fetch_webpage') ctx.usesWebFetch = true;
    if (/browser|playwright/.test(toolName)) ctx.usesBrowser = true;
    if (/search/.test(toolName) && /web|bing|google/.test(toolName)) ctx.usesWebSearch = true;

    // Transcript: askQuestions
    if (ctx.extractTranscripts && toolName === 'vscode_askQuestions' && evt.attrs && evt.attrs.args) {
        const timeTag = evt.ts ? tsToTimeTag(evt.ts) : '??:??';
        try {
            const aqObj = typeof evt.attrs.args === 'string' ? JSON.parse(evt.attrs.args) : evt.attrs.args;
            let summary;
            if (aqObj.questions && Array.isArray(aqObj.questions)) {
                summary = aqObj.questions.map(q => q.question).join('; ');
            } else {
                summary = '[questions]';
            }
            if (summary.length > 300) summary = summary.substring(0, 300) + '...';
            ctx.transcriptAskQs.push(`[${timeTag}] askQuestions: ${summary}`);
        } catch (_) {
            ctx.transcriptAskQs.push(`[${timeTag}] askQuestions: [parse error]`);
        }
    }

    // Extract askQuestions answers
    if ((toolName === 'vscode_askQuestions' || toolName === 'askQuestions') && evt.attrs && evt.attrs.result) {
        try {
            const resultObj = typeof evt.attrs.result === 'string' ? JSON.parse(evt.attrs.result) : evt.attrs.result;
            if (resultObj && resultObj.answers) {
                const answerParts = [];
                for (const [header, ans] of Object.entries(resultObj.answers)) {
                    const parts = [];
                    if (ans.selected && ans.selected.length) parts.push(`选: ${ans.selected.join(', ')}`);
                    if (ans.freeText) parts.push(`自由: ${ans.freeText}`);
                    if (ans.skipped) parts.push('(已跳过)');
                    if (parts.length) answerParts.push(`${header}: ${parts.join(' | ')}`);
                }
                if (answerParts.length) {
                    ctx.transcriptAskQs.push(`  → 回答: ${answerParts.join('; ')}`);
                }
            }
        } catch (_) {}
    }

    // 语言检测
    if (evt.attrs && evt.attrs.args) {
        const fp = extractFilePathFromArgs(evt.attrs.args);
        if (fp) {
            const lang = detectLanguage(fp);
            if (lang) incrementMap(ctx.languages, lang, 1);
        }
    }

    // 工具错误
    if (evt.status === 'error') {
        ctx.toolErrors++;
        let errText = '';
        if (evt.attrs && evt.attrs.result) errText = String(evt.attrs.result);
        else if (evt.attrs && evt.attrs.error) errText = String(evt.attrs.error);
        const cat = classifyToolError(errText);
        incrementMap(ctx.toolErrorCats, cat, 1);

        // Transcript: tool error
        if (ctx.extractTranscripts) {
            const timeTag = evt.ts ? tsToTimeTag(evt.ts) : '??:??';
            const snippet = errText.length > 150 ? errText.substring(0, 150) + '...' : errText;
            ctx.transcriptToolErrs.push(`[${timeTag}] ${toolName}: ${snippet}`);
        }
    }
}

/**
 * Parse llm_request event and update session tracking variables.
 * Shared between main.jsonl and subagent JSONL parsing.
 */
function processLlmRequest(evt, ctx) {
    ctx.llmCalls++;
    if (!evt.attrs) return;

    // Token 统计
    if (evt.attrs.inputTokens) ctx.inputTokens += Number(evt.attrs.inputTokens) || 0;
    if (evt.attrs.outputTokens) ctx.outputTokens += Number(evt.attrs.outputTokens) || 0;
    if (evt.attrs.usage) {
        if (evt.attrs.usage.input_tokens) ctx.inputTokens += Number(evt.attrs.usage.input_tokens) || 0;
        if (evt.attrs.usage.output_tokens) ctx.outputTokens += Number(evt.attrs.usage.output_tokens) || 0;
    }

    // 模型统计
    let modelName = null;
    if (evt.attrs.model) modelName = String(evt.attrs.model);
    if (modelName) {
        let modelTokens = 0;
        if (evt.attrs.inputTokens) modelTokens = Number(evt.attrs.inputTokens) || 0;
        else if (evt.attrs.usage && evt.attrs.usage.input_tokens) modelTokens = Number(evt.attrs.usage.input_tokens) || 0;
        incrementMap(ctx.models, modelName, modelTokens);
    }
}

for (let sessionIdx = 0; sessionIdx < sessionEntries.length; sessionIdx++) {
    const se = sessionEntries[sessionIdx];

    if ((sessionIdx + 1) % 5 === 0) {
        console.log(`[progress] ${sessionIdx + 1} / ${sessionEntries.length} sessions ...`);
    }

    // === 缓存检查 ===
    const cacheFile = path.join(cachePath, `${se.sessionId}.json`);
    let sourceLastWrite;
    try {
        sourceLastWrite = fs.statSync(se.mainFile).mtimeMs;
    } catch (_) {
        continue;
    }

    if (fs.existsSync(cacheFile)) {
        try {
            const cacheLastWrite = fs.statSync(cacheFile).mtimeMs;
            if (cacheLastWrite >= sourceLastWrite) {
                const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                sessions.push(cachedData);
                cachedCount++;
                continue;
            }
        } catch (_) {
            console.log(`[warn] 缓存文件损坏，重新处理: ${se.sessionId}`);
        }
    }

    // === 初始化追踪变量 ===
    const ctx = {
        userMsgCount: 0,
        assistantMsgCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        models: {},
        toolCounts: {},
        toolErrors: 0,
        toolErrorCats: {},
        subagentCalls: 0,
        subagentNames: {},
        filesCreated: 0,
        filesModified: 0,
        replacements: 0,
        userInterruptions: 0,
        languages: {},
        messageHours: [],
        firstPrompt: '',
        firstTs: null,
        lastTs: null,
        userMsgTimestamps: [],
        assistantMsgTimestamps: [],
        llmCalls: 0,
        gitOperations: { commits: 0, pushes: 0, merges: 0, stashes: 0 },
        diffLines: { added: 0, removed: 0 },
        usesMcp: false,
        usesWebSearch: false,
        usesWebFetch: false,
        usesBrowser: false,
        transcriptUserMsgs: [],
        transcriptToolErrs: [],
        transcriptAskQs: [],
        transcriptAssistMsgs: [],
        extractTranscripts: args.extractTranscripts,
        turnBuilder: new TurnBuilder(),
    };

    // === 解析 main.jsonl ===
    try {
        const content = fs.readFileSync(se.mainFile, 'utf8');
        const lines = content.split('\n');

        for (const line of lines) {
            if (!line.trim()) continue;

            const evt = safeParseJson(line);
            if (!evt) continue;

            // 时间戳追踪
            if (evt.ts) {
                if (ctx.firstTs === null) ctx.firstTs = evt.ts;
                ctx.lastTs = evt.ts;
            }

            switch (evt.type) {
                case 'user_message': {
                    ctx.userMsgCount++;
                    if (evt.ts) {
                        ctx.userMsgTimestamps.push(String(evt.ts));
                        const hr = tsToHour(evt.ts);
                        if (hr >= 0) ctx.messageHours.push(hr);
                    }
                    if (!ctx.firstPrompt && evt.attrs && evt.attrs.content) {
                        const content = String(evt.attrs.content);
                        ctx.firstPrompt = content.length > 500 ? content.substring(0, 500) + '...' : content;
                    }
                    // 中断检测
                    if (evt.attrs && evt.attrs.content) {
                        const c = String(evt.attrs.content);
                        if (/\[Request interrupted by user/.test(c)) {
                            ctx.userInterruptions++;
                        }
                    }
                    // Transcript: user message
                    if (ctx.extractTranscripts && evt.attrs && evt.attrs.content) {
                        const timeTag = evt.ts ? tsToTimeTag(evt.ts) : '??:??';
                        let txt = String(evt.attrs.content);
                        if (txt.length > 500) txt = txt.substring(0, 500) + '...';
                        ctx.transcriptUserMsgs.push(`[${timeTag}] ${txt}`);
                    }
                    ctx.turnBuilder.onUserMessage(evt);
                    break;
                }
                case 'agent_response': {
                    ctx.assistantMsgCount++;
                    if (evt.ts) {
                        ctx.assistantMsgTimestamps.push(String(evt.ts));
                        const hr = tsToHour(evt.ts);
                        if (hr >= 0) ctx.messageHours.push(hr);
                    }
                    // Transcript: assistant message (first 200 chars)
                    if (ctx.extractTranscripts && evt.attrs && evt.attrs.content) {
                        const timeTag = evt.ts ? tsToTimeTag(evt.ts) : '??:??';
                        let txt = String(evt.attrs.content);
                        if (txt.length > 200) txt = txt.substring(0, 200) + '...';
                        ctx.transcriptAssistMsgs.push(`[${timeTag}] ${txt}`);
                    }
                    ctx.turnBuilder.onAgentResponse(evt);
                    break;
                }
                case 'llm_request': {
                    processLlmRequest(evt, ctx);
                    if (ctx.turnBuilder.currentTurn) ctx.turnBuilder.onLlmRequest(evt);
                    break;
                }
                case 'tool_call': {
                    processToolCall(evt, ctx);
                    if (ctx.turnBuilder.currentTurn) ctx.turnBuilder.onToolCall(evt);
                    break;
                }
                case 'child_session_ref': {
                    if (evt.attrs && evt.attrs.agentName) {
                        const saName = String(evt.attrs.agentName);
                        if (!(saName in ctx.subagentNames)) {
                            ctx.subagentNames[saName] = 0;
                        }
                    }
                    ctx.turnBuilder.onChildSessionRef(evt);
                    break;
                }
                case 'turn_start': {
                    ctx.turnBuilder.onTurnStart(evt);
                    break;
                }
                case 'turn_end': {
                    ctx.turnBuilder.onTurnEnd(evt);
                    break;
                }
            }
        }
    } catch (e) {
        console.log(`[warn] 解析 main.jsonl 失败: ${se.mainFile} — ${e.message}`);
    }

    // === 解析 subagent JSONL 文件 ===
    for (const saFilePath of se.subagentFiles) {
        try {
            const saContent = fs.readFileSync(saFilePath, 'utf8');
            const saLines = saContent.split('\n');

            for (const saLine of saLines) {
                if (!saLine.trim()) continue;
                const saEvt = safeParseJson(saLine);
                if (!saEvt) continue;

                if (saEvt.type === 'llm_request') {
                    processLlmRequest(saEvt, ctx);
                }
                if (saEvt.type === 'tool_call') {
                    processToolCall(saEvt, ctx);
                }
            }
        } catch (e) {
            console.log(`[warn] 解析 subagent 日志失败: ${path.basename(saFilePath)} — ${e.message}`);
        }
    }

    // === 计算 session 级指标 ===

    // 会话时长（分钟）
    let durationMinutes = 0;
    if (ctx.firstTs && ctx.lastTs) {
        durationMinutes = Math.round(((Number(ctx.lastTs) - Number(ctx.firstTs)) / 60000) * 10) / 10;
    }

    // 工具成功率
    let totalToolCalls = 0;
    for (const v of Object.values(ctx.toolCounts)) totalToolCalls += v;
    let toolSuccessRate = 100.0;
    if (totalToolCalls > 0) {
        toolSuccessRate = Math.round(((totalToolCalls - ctx.toolErrors) / totalToolCalls) * 1000) / 10;
    }

    // 用户响应时间：assistant→user 消息时间差
    const userResponseTimes = [];
    if (ctx.assistantMsgTimestamps.length > 0 && ctx.userMsgTimestamps.length > 0) {
        const allMsgs = [];
        for (const ts of ctx.userMsgTimestamps) {
            allMsgs.push({ time: Number(ts), role: 'user' });
        }
        for (const ts of ctx.assistantMsgTimestamps) {
            allMsgs.push({ time: Number(ts), role: 'assistant' });
        }
        allMsgs.sort((a, b) => a.time - b.time);

        for (let i = 0; i < allMsgs.length - 1; i++) {
            if (allMsgs[i].role === 'assistant' && allMsgs[i + 1].role === 'user') {
                const diffSec = (allMsgs[i + 1].time - allMsgs[i].time) / 1000;
                if (diffSec >= USER_RESPONSE_MIN_SEC && diffSec <= USER_RESPONSE_MAX_SEC) {
                    userResponseTimes.push(Math.round(diffSec * 10) / 10);
                }
            }
        }
    }

    // startTime ISO 8601
    let startTimeIso = '';
    let startDateUtc = '';
    if (ctx.firstTs) {
        startTimeIso = tsToIso(ctx.firstTs);
        const _d = new Date(Number(ctx.firstTs));
        startDateUtc = `${_d.getUTCFullYear()}-${String(_d.getUTCMonth() + 1).padStart(2, '0')}-${String(_d.getUTCDate()).padStart(2, '0')}`;
    }

    // 构建 session 对象
    const sessionObj = {
        sessionId: se.sessionId,
        workspacePath: se.workspacePath,
        workspaceName: se.workspaceName,
        startTime: startTimeIso,
        startDate: startDateUtc,
        durationMinutes,
        userMessageCount: ctx.userMsgCount,
        assistantMessageCount: ctx.assistantMsgCount,
        llmCalls: ctx.llmCalls,
        toolCounts: ctx.toolCounts,
        toolErrors: ctx.toolErrors,
        toolErrorCategories: ctx.toolErrorCats,
        toolSuccessRate,
        inputTokens: ctx.inputTokens,
        outputTokens: ctx.outputTokens,
        models: ctx.models,
        subagentCalls: ctx.subagentCalls,
        subagentNames: ctx.subagentNames,
        codeChanges: {
            filesCreated: ctx.filesCreated,
            filesModified: ctx.filesModified,
            replacements: ctx.replacements,
        },
        userInterruptions: ctx.userInterruptions,
        userResponseTimes,
        messageHours: ctx.messageHours,
        firstPrompt: ctx.firstPrompt,
        languages: ctx.languages,
        gitOperations: ctx.gitOperations,
        diffLines: ctx.diffLines,
        featureUsage: {
            usesMcp: ctx.usesMcp,
            usesWebSearch: ctx.usesWebSearch,
            usesWebFetch: ctx.usesWebFetch,
            usesBrowser: ctx.usesBrowser,
        },
        isSubstantive: (ctx.userMsgCount >= 2 || durationMinutes >= 1),
        multiClauding: false,
        turnCount: ctx.turnBuilder.turns.length + (ctx.turnBuilder.currentTurn ? 1 : 0),
    };

    // ── 输出 session 文稿 ──
    if (args.extractTranscripts && (ctx.transcriptUserMsgs.length > 0 || ctx.transcriptToolErrs.length > 0)) {
        const parts = [];
        parts.push(`=== Session: ${se.sessionId} ===`);
        parts.push(`Workspace: ${se.workspacePath || se.workspaceId}`);
        parts.push(`Duration: ${durationMinutes}min | Messages: ${ctx.userMsgCount}/${ctx.assistantMsgCount}`);
        parts.push('');

        if (ctx.transcriptUserMsgs.length > 0) {
            parts.push('--- User Messages ---');
            for (const m of ctx.transcriptUserMsgs) parts.push(m);
            parts.push('');
        }

        if (ctx.transcriptToolErrs.length > 0) {
            parts.push('--- Tool Errors ---');
            for (const m of ctx.transcriptToolErrs) parts.push(m);
            parts.push('');
        }

        if (ctx.transcriptAskQs.length > 0) {
            parts.push('--- Key Interactions ---');
            for (const m of ctx.transcriptAskQs) parts.push(m);
            parts.push('');
        }

        if (ctx.transcriptAssistMsgs.length > 0) {
            parts.push('--- Assistant Highlights ---');
            const maxAssist = Math.min(ctx.transcriptAssistMsgs.length, 5);
            for (let ai = 0; ai < maxAssist; ai++) parts.push(ctx.transcriptAssistMsgs[ai]);
            if (ctx.transcriptAssistMsgs.length > 5) {
                parts.push(`... (+${ctx.transcriptAssistMsgs.length - 5} more)`);
            }
            parts.push('');
        }

        let txDir = args.transcriptOutput;
        if (!path.isAbsolute(txDir)) {
            txDir = path.resolve(txDir);
        }
        fs.mkdirSync(txDir, { recursive: true });

        const txFile = path.join(txDir, `${se.sessionId}.txt`);
        const transcriptContent = parts.join('\n') + '\n';
        fs.writeFileSync(txFile, transcriptContent, 'utf8');
        transcriptFilesWritten++;

        // Compute transcript hash (MD5)
        sessionObj.transcriptHash = md5Hash(transcriptContent);
    }

    // === 写入缓存 ===
    try {
        fs.writeFileSync(cacheFile, JSON.stringify(sessionObj, null, 2), 'utf8');
    } catch (e) {
        console.log(`[warn] 写入缓存失败: ${se.sessionId} — ${e.message}`);
    }
    newCount++;

    // Attach turnBuilder for turn extraction (excluded from JSON serialization)
    sessionObj._turnBuilder = ctx.turnBuilder;

    sessions.push(sessionObj);
}

console.log(`[info] 解析完成，共 ${sessions.length} 个 session (Cached: ${cachedCount}, New: ${newCount}, Total: ${sessions.length})`);

// ── Turn 提取输出 ────────────────────────────────────
if (args.extractTurns) {
    let turnsOutputPath = args.turnsOutput;
    if (!path.isAbsolute(turnsOutputPath)) {
        turnsOutputPath = path.resolve(turnsOutputPath);
    }
    fs.mkdirSync(turnsOutputPath, { recursive: true });
    let turnFilesWritten = 0;
    for (const sess of sessions) {
        if (sess._turnBuilder) {
            const turns = sess._turnBuilder.build();
            const turnFile = path.join(turnsOutputPath, `${sess.sessionId}.json`);
            fs.writeFileSync(turnFile, JSON.stringify({ sessionId: sess.sessionId, turnCount: turns.length, turns }, null, 2));
            turnFilesWritten++;

            const turnSummary = buildTurnSummaryForLLM(turns);
            if (turnSummary) {
                const summaryFile = path.join(turnsOutputPath, `${sess.sessionId}.summary.json`);
                fs.writeFileSync(summaryFile, JSON.stringify(turnSummary, null, 2));
            }
        }
    }
    console.log(`[turn-extract] Wrote ${turnFilesWritten} turn files to ${turnsOutputPath}`);
}

// ── Multi-clauding 检测 ──────────────────────────────
const sortedByTime = sessions
    .filter(s => s.startTime && String(s.startTime).trim())
    .sort((a, b) => {
        const sa = String(a.startTime);
        const sb = String(b.startTime);
        return sa < sb ? -1 : sa > sb ? 1 : 0;
    });

for (let i = 0; i < sortedByTime.length - 1; i++) {
    try {
        const startIStr = String(sortedByTime[i].startTime);
        const startNextStr = String(sortedByTime[i + 1].startTime);
        if (!startIStr || !startNextStr) continue;

        const startI = new Date(startIStr).getTime();
        const startNext = new Date(startNextStr).getTime();

        let durI = Number(sortedByTime[i].durationMinutes) || 0;
        if (durI < 0.5) durI = 0.5; // 最短假设 0.5 分钟
        const endI = startI + durI * 60000;

        const gapMinutes = (startNext - endI) / 60000;
        // 重叠（gap < 0）或间隔 < 2 分钟即视为 multi-clauding
        if (gapMinutes < 2) {
            sortedByTime[i].multiClauding = true;
            sortedByTime[i + 1].multiClauding = true;
        }
    } catch (_) {
        // startTime 解析失败，跳过此对
    }
}
const multiClaudingCount = sessions.filter(s => s.multiClauding === true).length;

if (args.extractTranscripts && transcriptFilesWritten > 0) {
    console.log(`[info] 文稿已输出: ${transcriptFilesWritten} 个文件`);
}

// ── 聚合数据 ─────────────────────────────────────────
let totalUserMessages = 0;
let totalAssistantMessages = 0;
let totalInputTokens = 0;
let totalOutputTokens = 0;
let totalLLMCalls = 0;
let totalToolCalls = 0;
let totalToolErrors = 0;
let totalSubagentCalls = 0;
let totalFilesCreated = 0;
let totalFilesModified = 0;
let totalReplacements = 0;
let totalInterruptions = 0;
const toolCountsAgg = {};
const toolErrorCatsAgg = {};
const subagentDistAgg = {};
const modelDistAgg = {};
const languageDistAgg = {};
const hourlyDist = new Array(24).fill(0);
const byWorkspace = {};
const allDurations = [];
const allResponseTimes = [];
const activeDays = new Set();
const successRates = [];

for (const s of sessions) {
    totalUserMessages += s.userMessageCount || 0;
    totalAssistantMessages += s.assistantMessageCount || 0;
    totalInputTokens += s.inputTokens || 0;
    totalOutputTokens += s.outputTokens || 0;
    totalLLMCalls += s.llmCalls || 0;
    totalToolErrors += s.toolErrors || 0;
    totalSubagentCalls += s.subagentCalls || 0;
    totalFilesCreated += (s.codeChanges && s.codeChanges.filesCreated) || 0;
    totalFilesModified += (s.codeChanges && s.codeChanges.filesModified) || 0;
    totalReplacements += (s.codeChanges && s.codeChanges.replacements) || 0;
    totalInterruptions += s.userInterruptions || 0;

    allDurations.push(s.durationMinutes || 0);
    if (s.userResponseTimes && Array.isArray(s.userResponseTimes)) {
        for (const rt of s.userResponseTimes) allResponseTimes.push(rt);
    }
    if (s.toolSuccessRate != null && s.toolSuccessRate <= 100.1) {
        successRates.push(s.toolSuccessRate);
    }

    // 活跃天数 — 提取 startTime 日期部分（本地日历日）
    if (s.startTime) {
        const day = String(s.startTime).substring(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
            activeDays.add(day);
        }
    }

    // 工具聚合
    if (s.toolCounts) {
        for (const [name, count] of Object.entries(s.toolCounts)) {
            const v = Number(count) || 0;
            totalToolCalls += v;
            incrementMap(toolCountsAgg, name, v);
        }
    }

    // 错误类别聚合
    if (s.toolErrorCategories) {
        for (const [name, count] of Object.entries(s.toolErrorCategories)) {
            incrementMap(toolErrorCatsAgg, name, Number(count) || 0);
        }
    }

    // Subagent 分布聚合
    if (s.subagentNames) {
        for (const [name, count] of Object.entries(s.subagentNames)) {
            incrementMap(subagentDistAgg, name, Number(count) || 0);
        }
    }

    // 模型分布聚合
    if (s.models) {
        for (const [name, tokens] of Object.entries(s.models)) {
            incrementMap(modelDistAgg, name, Number(tokens) || 0);
        }
    }

    // 语言分布聚合
    if (s.languages) {
        for (const [name, count] of Object.entries(s.languages)) {
            incrementMap(languageDistAgg, name, Number(count) || 0);
        }
    }

    // 小时分布
    if (s.messageHours && Array.isArray(s.messageHours)) {
        for (const h of s.messageHours) {
            if (h >= 0 && h < 24) hourlyDist[h]++;
        }
    }

    // 按 workspace 聚合
    const wsName = s.workspaceName || 'unknown';
    if (!byWorkspace[wsName]) {
        byWorkspace[wsName] = { sessions: 0, userMessages: 0, inputTokens: 0 };
    }
    byWorkspace[wsName].sessions++;
    byWorkspace[wsName].userMessages += s.userMessageCount || 0;
    byWorkspace[wsName].inputTokens += s.inputTokens || 0;
}

// 计算统计值
const daysActive = activeDays.size;
const messagesPerDay = daysActive > 0 ? Math.round((totalUserMessages / daysActive) * 100) / 100 : 0;
const avgSessionDuration = allDurations.length > 0
    ? Math.round((allDurations.reduce((a, b) => a + b, 0) / allDurations.length) * 10) / 10
    : 0;

// 中位数响应时间
let medianResponseTime = 0;
let avgResponseTime = 0;
if (allResponseTimes.length > 0) {
    const sortedRT = allResponseTimes.slice().sort((a, b) => a - b);
    const mid = Math.floor(sortedRT.length / 2);
    medianResponseTime = sortedRT.length % 2 === 0
        ? Math.round(((sortedRT[mid - 1] + sortedRT[mid]) / 2) * 10) / 10
        : sortedRT[mid];
    avgResponseTime = Math.round((allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length) * 10) / 10;
}

const avgToolSuccessRate = totalToolCalls > 0
    ? Math.round(((totalToolCalls - totalToolErrors) / totalToolCalls * 100) * 10) / 10
    : 100.0;

// 排序 byWorkspace keys
const byWorkspaceOut = {};
for (const k of Object.keys(byWorkspace).sort()) {
    byWorkspaceOut[k] = {
        sessions: byWorkspace[k].sessions,
        userMessages: byWorkspace[k].userMessages,
        inputTokens: byWorkspace[k].inputTokens,
    };
}

const scanDurationMs = Date.now() - startTime;

// ── 构建输出 ─────────────────────────────────────────
const output = {
    meta: {
        scanDate: formatLocalDate(new Date()),
        totalFiles,
        totalSizeMB: Math.round(totalSizeBytes / (1024 * 1024)),
        daysBack: args.daysBack,
        scanDurationMs,
    },
    sessions,
    aggregated: {
        totalSessions: sessions.length,
        totalUserMessages,
        totalAssistantMessages,
        totalInputTokens,
        totalOutputTokens,
        totalLLMCalls,
        totalToolCalls,
        totalToolErrors,
        avgToolSuccessRate,
        totalSubagentCalls,
        totalFilesCreated,
        totalFilesModified,
        totalReplacements,
        daysActive,
        messagesPerDay,
        avgSessionDuration,
        medianResponseTime,
        avgResponseTime,
        toolCountsAggregated: toolCountsAgg,
        toolErrorCategoriesAggregated: toolErrorCatsAgg,
        subagentDistribution: subagentDistAgg,
        modelDistribution: modelDistAgg,
        languageDistribution: languageDistAgg,
        hourlyDistribution: hourlyDist,
        byWorkspace: byWorkspaceOut,
        multiClaudingSessions: multiClaudingCount,
        totalInterruptions,
        avgInterruptionsPerSession: sessions.length > 0 ? Math.round((totalInterruptions / sessions.length) * 100) / 100 : 0,
    },
};

// ── 输出 ─────────────────────────────────────────────
const json = JSON.stringify(output, (key, value) => key === '_turnBuilder' ? undefined : value, 2);
const parentDir = path.dirname(path.resolve(args.outputPath));
if (parentDir) {
    fs.mkdirSync(parentDir, { recursive: true });
}
fs.writeFileSync(path.resolve(args.outputPath), json, 'utf8');

console.log(`[done] Insight 数据已输出: ${args.outputPath} (${(json.length / 1024).toFixed(1)} KB)`);
console.log(`[stat] ${sessions.length} sessions, ${totalToolCalls} tool calls, ${scanDurationMs} ms`);
