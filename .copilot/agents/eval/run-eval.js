#!/usr/bin/env node
'use strict';

/**
 * run-eval.js
 * 对 subagent 行为数据运行声明式断言测试。
 *
 * 从 extract-outputs.js 的 JSON 输出中读取 subagent invocation 数据，
 * 加载 YAML 测试用例，逐条运行断言，输出带格式的评估报告。
 *
 * Usage:
 *   node run-eval.js --data-path ./eval-data.json
 *   node run-eval.js --data-path ./eval-data.json --agent-filter Worker --detail
 *   node run-eval.js --data-path ./eval-data.json --json
 */

const fs = require('fs');
const path = require('path');

// ── CLI 参数解析 ─────────────────────────────────────
function parseArgs(argv) {
    const args = {
        dataPath: null,
        testDir: null,
        agentFilter: null,
        detail: false,
        json: false,
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--data-path':
                args.dataPath = argv[++i];
                break;
            case '--test-dir':
                args.testDir = argv[++i];
                break;
            case '--agent-filter':
                args.agentFilter = argv[++i];
                break;
            case '--detail':
                args.detail = true;
                break;
            case '--json':
                args.json = true;
                break;
            default:
                console.log(`[warn] 未知参数: ${arg}`);
        }
    }

    if (!args.dataPath) {
        console.error('[error] 必须指定 --data-path <path>');
        process.exit(1);
    }

    if (!args.testDir) {
        args.testDir = path.join(__dirname, 'test-cases');
    }

    return args;
}

const args = parseArgs(process.argv);

// ── 加载评估数据 ─────────────────────────────────────
if (!fs.existsSync(args.dataPath)) {
    console.error(`数据文件不存在: ${args.dataPath}`);
    process.exit(1);
}

let data;
try {
    let rawJson = fs.readFileSync(args.dataPath, 'utf-8');
    if (rawJson.charCodeAt(0) === 0xFEFF) rawJson = rawJson.slice(1);
    data = JSON.parse(rawJson);
} catch (err) {
    console.error(`无法解析数据文件: ${err.message}`);
    process.exit(1);
}

if (!data.invocations) {
    console.error('数据文件缺少 invocations 字段');
    process.exit(1);
}

// ── 简易 YAML 解析器（零依赖，纯正则逐行） ─────────
// 仅处理本项目 test-cases 使用的格式:
//   agent: <name>
//   tests:
//     - name: ...
//       check_type: ...
//       value: ...
//       severity: ...
function parseTestYaml(filePath) {
    const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
    let agent = '';
    const tests = [];
    let currentTest = null;
    let inList = false;
    let listKey = '';
    let listItems = null;

    for (const line of lines) {
        // 跳过注释和空行
        if (/^\s*#/.test(line) || !line.trim()) continue;

        // 结束前一个 list（如果遇到非 list-item 行）
        if (inList && !/^\s+-\s+/.test(line)) {
            if (currentTest && listKey && listItems) {
                currentTest[listKey] = listItems;
            }
            inList = false;
            listKey = '';
            listItems = null;
        }

        // 顶层 agent 字段
        let m = line.match(/^agent:\s*(.+)$/);
        if (m) {
            agent = m[1].trim().replace(/^["']|["']$/g, '');
            continue;
        }

        // tests: 头（跳过）
        if (/^tests:\s*$/.test(line)) continue;

        // 新测试项: "  - name: ..."
        m = line.match(/^\s+-\s+name:\s*(.+)$/);
        if (m) {
            if (currentTest) tests.push(currentTest);
            currentTest = { name: m[1].trim().replace(/^["']|["']$/g, '') };
            continue;
        }

        // 测试属性: "    key: value" 或 "    key:"（list 开始）
        m = line.match(/^\s{4,}(\w[\w_]*):\s*(.*)$/);
        if (currentTest && m) {
            const key = m[1].trim();
            let val = m[2].trim();

            if (!val) {
                // 可能是 list 的开始
                inList = true;
                listKey = key;
                listItems = [];
                continue;
            }

            // 去引号
            val = val.replace(/^["']|["']$/g, '');

            // 布尔值
            if (val === 'true') { currentTest[key] = true; continue; }
            if (val === 'false') { currentTest[key] = false; continue; }

            // 数值（整数或浮点）
            if (/^\d+\.?\d*$/.test(val)) {
                currentTest[key] = parseFloat(val);
                continue;
            }

            currentTest[key] = val;
            continue;
        }

        // 单层 list item: "      - item"
        if (inList) {
            m = line.match(/^\s+-\s+(.+)$/);
            if (m) {
                listItems.push(m[1].trim().replace(/^["']|["']$/g, ''));
                continue;
            }
        }
    }

    // 收尾
    if (inList && currentTest && listKey && listItems) {
        currentTest[listKey] = listItems;
    }
    if (currentTest) tests.push(currentTest);

    return { agent, tests };
}

// ── 加载测试用例 ─────────────────────────────────────
if (!fs.existsSync(args.testDir)) {
    console.error(`测试用例目录不存在: ${args.testDir}`);
    process.exit(1);
}

const yamlFiles = fs.readdirSync(args.testDir)
    .filter(f => /\.(yaml|yml)$/i.test(f))
    .map(f => path.join(args.testDir, f));

if (yamlFiles.length === 0) {
    console.error(`未找到测试用例文件 (*.yaml / *.yml) in ${args.testDir}`);
    process.exit(1);
}

const testSuites = [];
for (const yf of yamlFiles) {
    try {
        const suite = parseTestYaml(yf);
        if (suite.agent && suite.tests.length > 0) {
            testSuites.push(suite);
        }
    } catch (err) {
        console.warn(`跳过无法解析的测试文件: ${path.basename(yf)} — ${err.message}`);
    }
}

if (testSuites.length === 0) {
    console.error('未解析到有效的测试套件');
    process.exit(1);
}

// ── 严重级别 → 通过阈值 ─────────────────────────────
const severityThresholds = {
    critical: 1.0,
    high: 0.90,
    medium: 0.80,
    low: 0.50,
};

function getPassThreshold(severity) {
    if (!severity) return 0.80;
    const sev = severity.toLowerCase();
    return severityThresholds[sev] ?? 0.80;
}

// ── 断言执行（11 种 check_type） ────────────────────
function testInvocation(invocation, testCase) {
    const checkType = testCase.check_type;
    const value = testCase.value;
    const out = invocation.output ? String(invocation.output) : '';
    const toolCallsObj = invocation.toolCalls || {};

    switch (checkType) {
        case 'output_regex': {
            if (!value) return false;
            return new RegExp(value).test(out);
        }
        case 'output_contains': {
            if (!value) return false;
            return out.includes(String(value));
        }
        case 'output_not_contains': {
            if (!value) return true;
            return !out.includes(String(value));
        }
        case 'trace_has_tool': {
            if (!value) return false;
            return Object.prototype.hasOwnProperty.call(toolCallsObj, value);
        }
        case 'trace_no_tool': {
            if (!value) return true;
            return !Object.prototype.hasOwnProperty.call(toolCallsObj, value);
        }
        case 'log_size_max': {
            const maxKb = Number(value);
            return invocation.logSizeKB <= maxKb;
        }
        case 'log_size_min': {
            const minKb = Number(value);
            return invocation.logSizeKB >= minKb;
        }
        case 'flag_absent': {
            if (!value) return true;
            return !invocation[value];
        }
        case 'tool_error_absent': {
            if (!value) return true;
            const errCats = invocation.toolErrorCategories;
            if (!errCats) return true;
            return !Object.prototype.hasOwnProperty.call(errCats, value);
        }
        case 'tool_success_rate_min': {
            const minRate = Number(value);
            const rate = invocation.toolSuccessRate;
            if (rate == null) {
                return invocation.totalToolCalls === 0;
            }
            return Number(rate) >= minRate;
        }
        case 'code_changes_max': {
            const maxChanges = parseInt(value, 10);
            const changes = invocation.codeChanges;
            if (!changes) return true;
            let total = 0;
            if (changes.filesCreated) total += Number(changes.filesCreated);
            if (changes.filesModified) total += Number(changes.filesModified);
            return total <= maxChanges;
        }
        default: {
            console.warn(`未知的 check_type: ${checkType}`);
            return false;
        }
    }
}

// ── 执行评估 ─────────────────────────────────────────
const agentResults = new Map();
const allTestResults = [];
let totalAgents = 0;

for (const suite of testSuites) {
    const agent = suite.agent;
    if (args.agentFilter && agent !== args.agentFilter) continue;

    const agentInvocations = data.invocations.filter(inv => inv.agentName === agent);
    const invCount = agentInvocations.length;

    // 没有匹配的 invocation 时跳过（不报错）
    if (invCount === 0) continue;

    totalAgents++;

    if (!agentResults.has(agent)) {
        agentResults.set(agent, {
            invocationCount: invCount,
            tests: [],
        });
    }

    for (const test of suite.tests) {
        let passCount = 0;
        const failExamples = [];

        for (const inv of agentInvocations) {
            const passed = testInvocation(inv, test);
            if (passed) {
                passCount++;
            } else {
                if (failExamples.length < 3) {
                    failExamples.push({
                        logFile: inv.logFile,
                        output: inv.output ? String(inv.output) : '',
                    });
                }
            }
        }

        const rate = invCount > 0 ? passCount / invCount : 0;
        const sev = test.severity ? String(test.severity) : 'medium';
        const threshold = getPassThreshold(sev);
        const testPassed = rate >= threshold;

        const testResult = {
            agent,
            name: test.name,
            check_type: test.check_type,
            severity: sev,
            passCount,
            total: invCount,
            rate,
            threshold,
            passed: testPassed,
            failExamples,
        };

        agentResults.get(agent).tests.push(testResult);
        allTestResults.push(testResult);
    }
}

// ── 统计汇总 ─────────────────────────────────────────
const totalTests = allTestResults.length;
const totalPassed = allTestResults.filter(t => t.passed).length;
const deadRules = allTestResults.filter(t => t.rate < 0.10).length;
const weakRules = allTestResults.filter(t => t.rate >= 0.10 && t.rate < 0.50).length;
const effectiveRules = allTestResults.filter(t => t.rate >= 0.80).length;

const totalInv = (data.summary && data.summary.totalInvocations)
    ? data.summary.totalInvocations
    : data.invocations.length;

// ── JSON 输出模式 ────────────────────────────────────
if (args.json) {
    const jsonOutput = { agents: {}, summary: {} };

    for (const [agent, ar] of agentResults) {
        jsonOutput.agents[agent] = {
            invocations: ar.invocationCount,
            tests: ar.tests.map(tr => ({
                name: tr.name,
                check_type: tr.check_type,
                severity: tr.severity,
                passed: tr.passCount,
                total: tr.total,
                rate: Math.round(tr.rate * 10000) / 10000,
                result: tr.passed ? 'PASS' : 'FAIL',
            })),
        };
    }

    jsonOutput.summary = {
        totalTests,
        passedThreshold: totalPassed,
        deadRules,
        weakRules,
        effectiveRules,
    };

    console.log(JSON.stringify(jsonOutput, null, 2));
    process.exit(0);
}

// ── 终端报告输出 ─────────────────────────────────────
const borderH = '\u2550';
const borderTL = '\u2554';
const borderTR = '\u2557';
const borderBL = '\u255A';
const borderBR = '\u255D';
const borderV = '\u2551';
const thinBar = '\u2501';

const boxWidth = 54;

function padRight(text, width) {
    if (text.length >= width) return text;
    return text + ' '.repeat(width - text.length);
}

const topBorder = borderTL + borderH.repeat(boxWidth) + borderTR;
const botBorder = borderBL + borderH.repeat(boxWidth) + borderBR;

const line1 = padRight('  Parking Agents \u2014 Behavioral Eval Report', boxWidth);
const line2 = padRight(`  Data: ${path.basename(args.dataPath)} (${totalInv} invocations)`, boxWidth);
const line3 = padRight(`  Test cases: ${totalAgents} agents, ${totalTests} tests`, boxWidth);

console.log('');
console.log(topBorder);
console.log(`${borderV}${line1}${borderV}`);
console.log(`${borderV}${line2}${borderV}`);
console.log(`${borderV}${line3}${borderV}`);
console.log(botBorder);
console.log('');

const checkMark = '\u2705';  // ✅
const crossMark = '\u274C';  // ❌
const warnMark = '\u26A0';   // ⚠
const arrowDown = '\u2190';  // ←
const treeT = '\u251C';      // ├
const treeL = '\u2514';      // └
const treeV = '\u2502';      // │

// ANSI color helpers
const color = {
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    gray: (s) => `\x1b[90m${s}\x1b[0m`,
};

for (const [agent, ar] of agentResults) {
    const invCount = ar.invocationCount;

    let sectionHeader = `${thinBar}${thinBar}${thinBar} ${agent} (${invCount} invocations) `;
    const pad = Math.max(0, 54 - sectionHeader.length);
    sectionHeader += thinBar.repeat(pad);
    console.log(sectionHeader);
    console.log('');

    for (const tr of ar.tests) {
        const pctVal = tr.rate * 100;
        const pctStr = pctVal.toFixed(1) + '%';
        const countStr = `${tr.passCount}/${tr.total}`;
        const sevStr = `[${tr.severity}]`;

        let icon, colorFn;
        if (tr.passed) {
            icon = `${checkMark} PASS`;
            colorFn = color.green;
        } else {
            icon = `${crossMark} FAIL`;
            colorFn = color.red;
            if (tr.rate >= tr.threshold * 0.9 && tr.severity !== 'critical') {
                icon = `${warnMark} WARN`;
                colorFn = color.yellow;
            }
        }

        const nameStr = tr.name;
        const namePad = Math.max(1, 24 - nameStr.length);
        const sevPad = Math.max(1, 12 - sevStr.length);

        let line = `  ${icon}  ${nameStr}${' '.repeat(namePad)}${sevStr}${' '.repeat(sevPad)}${countStr} (${pctStr})`;
        if (!tr.passed) {
            const thresholdPct = (tr.threshold * 100).toFixed(0) + '%';
            line += ` ${arrowDown} threshold ${thresholdPct}`;
        }

        console.log(colorFn(line));

        // --detail 模式：显示失败示例
        if (!tr.passed && args.detail && tr.failExamples.length > 0) {
            const exCount = tr.failExamples.length;
            for (let i = 0; i < exCount; i++) {
                const ex = tr.failExamples[i];
                const exNum = i + 1;
                const logName = ex.logFile ? path.basename(ex.logFile) : '(unknown)';
                const connector = i < exCount - 1 ? treeT : treeL;
                const cont = i < exCount - 1 ? treeV : ' ';

                console.log(color.gray(`    ${connector}\u2500 Example ${exNum}: ${logName}`));
                if (ex.output) {
                    let snippet = ex.output;
                    if (snippet.length > 80) snippet = snippet.substring(0, 80) + '...';
                    console.log(color.gray(`    ${cont}   Output: "${snippet}"`));
                }
            }
        }
    }
    console.log('');
}

// ── 总览 ─────────────────────────────────────────────
const summaryBorder = borderH.repeat(boxWidth + 2);
console.log(summaryBorder);
console.log('');

console.log('\uD83D\uDCCA Rule Health Summary:');
console.log(`  Dead rules    (<10% pass rate):  ${deadRules}`);
console.log(`  Weak rules    (10-50%):          ${weakRules}`);
console.log(`  Effective     (>80%):            ${effectiveRules}`);
console.log('');

console.log(`\uD83C\uDFC6 Overall: ${totalPassed}/${totalTests} rules passed threshold`);
console.log('');
