import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drafts/v6-story-work-graph.html');
const html=fs.readFileSync(file,'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const context=vm.createContext({});
vm.runInContext(script.slice(0,script.indexOf('\nfunction path(')),context);
const evaluate=code=>vm.runInContext(code,context);
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
check('embedded JavaScript parses',()=>new vm.Script(script));
check('no remote assets or domain networking',()=>assert.equal(/(?:<script[^>]+src=|<link[^>]+href=|fetch\s*\(|XMLHttpRequest|new WebSocket|new EventSource)/i.test(html),false));
check('default REAL current Discovery',()=>assert.equal(evaluate("state.dataset+'/'+state.phase+'/'+state.revision"),'real/discovery/current'));
check('current dossier not tracker membership',()=>assert.equal(evaluate("graph().nodes.some(n=>n.type==='historical-issue')"),false));
check('current Contract unpublished',()=>assert.match(evaluate("graph().nodes.find(n=>n.id==='CONTRACT-NOT-PUBLISHED').meta"),/null/));
evaluate("state.revision='historical'");
check('13 historical nodes including root',()=>assert.equal(evaluate('graph().nodes.length'),13));
check('12 native membership',()=>assert.equal(evaluate("graph().edges.filter(e=>e.kind==='membership').length"),12));
check('7 native dependencies',()=>assert.equal(evaluate("graph().edges.filter(e=>e.kind==='dependency').length"),7));
check('raw full titles preserved',()=>assert.match(evaluate("historical.find(n=>n.id==='ISSUE-152').rawTitle"),/升级 interview 家族/));
check('historical assignee never runtime owner',()=>assert.equal(evaluate('historical.every(n=>n.owner===null)'),true));
evaluate("state.phase='delivery'");
check('REAL Delivery empty',()=>assert.equal(evaluate('graph().nodes.length'),0));
check('REAL Delivery frontier empty',()=>assert.equal(evaluate('graph().nodes.filter(frontier).length'),0));
evaluate("state.dataset='sim'");
for(const scenario of ['qa','candidate','merged','done','return','degraded']){
 evaluate("state.scenario="+JSON.stringify(scenario));
 check(scenario+' IDs isolated',()=>assert.equal(evaluate("graph().nodes.every(n=>n.id.startsWith('SIM-'))"),true));
 check(scenario+' edges have endpoints',()=>assert.equal(evaluate("graph().edges.every(e=>graph().nodes.some(n=>n.id===e.a)&&graph().nodes.some(n=>n.id===e.b))"),true));
 check(scenario+' complete work-ticket axes',()=>assert.equal(evaluate("graph().nodes.filter(n=>n.type==='work-ticket').every(n=>n.axes.lifecycle&&n.axes.control&&n.axes.gate&&n.profile.digest)"),true));
 check(scenario+' frontier never includes Gate/reducer/claimed/active',()=>assert.equal(evaluate("graph().nodes.filter(frontier).every(n=>n.type==='work-ticket'&&n.axes.lifecycle==='open'&&!n.claimed)"),true));
 check(scenario+' actor separation',()=>assert.equal(evaluate("graph().nodes.find(n=>n.id==='SIM-WT-SKILL-42').owner!==graph().nodes.find(n=>n.id==='SIM-WT-SKILL-42').qaActor"),true));
}
evaluate("state.scenario='qa'");
check('running QA is not frontier',()=>assert.equal(evaluate("graph().nodes.filter(frontier).map(n=>n.id).join(',')"),'SIM-WT-RUNTIME-DOCS'));
evaluate("state.scenario='candidate'");
check('candidate PASS cannot make Story done',()=>assert.equal(evaluate("graph().nodes.find(n=>n.type==='reducer').status"),'BLOCKED'));
check('candidate has no integration subject',()=>assert.equal(evaluate("graph().nodes.find(n=>n.id==='SIM-GATE-SKILL-INTEGRATION').meta"),'integration: null'));
evaluate("state.scenario='merged'");
check('integration exists but Gate remains pending',()=>assert.equal(evaluate("graph().nodes.find(n=>n.id==='SIM-GATE-SKILL-INTEGRATION').status"),'PENDING'));
evaluate("state.scenario='done'");
check('required done coexists with optional blocked',()=>assert.equal(evaluate("graph().nodes.find(n=>n.type==='reducer').status==='DONE'&&graph().nodes.find(n=>n.id==='SIM-WT-REPORTS-DEMO').axes.control==='blocked'&&graph().nodes.find(n=>n.id==='SIM-WT-REPORTS-DEMO').axes.gate==='pending'"),true));
check('optional debt has owner / explanation / recovery',()=>assert.equal(evaluate("Boolean(graph().nodes.find(n=>n.id==='SIM-WT-REPORTS-DEMO').owner&&graph().nodes.find(n=>n.id==='SIM-WT-REPORTS-DEMO').why&&graph().nodes.find(n=>n.id==='SIM-WT-REPORTS-DEMO').next)"),true));
evaluate("state.scenario='return'");
check('revised Contract stales Runtime Gate',()=>assert.equal(evaluate("graph().nodes.find(n=>n.id==='SIM-GATE-RUNTIME-INTEGRATION').status"),'STALE'));
check('new WorkTicket in next wave',()=>assert.equal(evaluate("graph().nodes.some(n=>n.id==='SIM-WT-SKILL-43')"),true));
evaluate("state.phase='discovery'");
check('trace target decision and Contract exist',()=>assert.equal(evaluate("graph().nodes.some(n=>n.id==='SIM-WT-DECISION-18')&&graph().nodes.some(n=>n.id==='SIM-DISC-CONTRACT-3')"),true));
evaluate("state.phase='delivery';state.scenario='degraded'");
check('Registry degradation empties frontier',()=>assert.equal(evaluate("graph().nodes.filter(frontier).length"),0));
check('Registry degradation prevents done',()=>assert.equal(evaluate("graph().nodes.find(n=>n.type==='reducer').status"),'DEGRADED'));
console.log(JSON.stringify({status:'STATIC_FIXTURE_CHECKS_PASSED',checks,browser:'NOT_RUN',runtime:'NOT_CONNECTED',scope:'Prototype data and static boundaries only; not actual domain implementation or visual QA'}));

