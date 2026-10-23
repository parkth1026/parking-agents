// Regression cases from the 2026-10-23 adversarial review. Git writes only in the
// temporary fixture repository; no product commands or real index operations.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureGrillingIgnore } from './lib/grilling-ignore.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-review-regression-'));
fs.mkdirSync(path.join(root, '.git'));
if(spawnSync('git',['init','-q',root]).status!==0)throw new Error('Git fixture init failed');
fs.writeFileSync(path.join(root,'.gitignore'),'/artifacts/\n');
ensureGrillingIgnore(path.join(root,'.aes-workflow/grilling'));
let passed = 0;
function assert(name, condition, detail = '') {
  if (!condition) throw new Error(name + '\n' + detail);
  passed++; console.log('ok ' + name);
}
function fixture(name) {
  const dir = path.join(root, '.aes-workflow', 'grilling', name);
  const files = [], excluded = [];
  const write = (p, text) => { fs.mkdirSync(path.dirname(path.join(dir,p)), { recursive:true }); fs.writeFileSync(path.join(dir,p),text); };
  const add = (p,role,text) => { write(p,text); files.push({path:p,role}); };
  add('manifest.json','state',JSON.stringify({slug:name,stage_gates:{},validation:{status:'valid'}}));
  add('1-interview/context.md','requirement','## 任务\n独立回归样例');
  add('1-interview/rounds.jsonl','decision','');
  files.push({path:'dossier.html',role:'derived'});
  const call = (...args) => spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});
  const register = () => { const plan=path.join(root,name+'-plan.json');fs.writeFileSync(plan,JSON.stringify({files,excluded}));return call(path.join(here,'session.mjs'),'delivery',dir,'--plan',plan); };
  const exp = () => call(path.join(here,'export-dossier.mjs'),'--issue-dir',dir);
  const check = () => call(path.join(here,'session.mjs'),'submission-check',dir);
  const preview = () => call(path.join(here,'session.mjs'),'submission-check',dir,'--output',path.join(root,name+'-preview'));
  const payload = () => JSON.parse(fs.readFileSync(path.join(dir,'dossier.html'),'utf8').match(/id="decision-dossier-data">([\s\S]*?)<\/script>/)[1]);
  return {dir,files,excluded,write,add,call,register,exp,check,preview,payload};
}
try {
  const a=fixture('F01-script');a.add('2-prototype/mock.html','prototype','<script src="essential.js"></script>');a.register();
  assert('F01: 缺失script src阻止导出与预览',a.exp().status!==0&&a.preview().status!==0);
  a.write('2-prototype/essential.js','window.ready=true');a.excluded.push({path:'2-prototype/essential.js',reason:'误排除'});a.register();
  assert('F01: 被排除script src同样被拦',a.exp().status!==0);
  a.excluded.pop();a.files.push({path:'2-prototype/essential.js',role:'asset'});a.register();a.exp();
  assert('F01: 补齐脚本后预览成功',a.preview().status===0);

  const b=fixture('F02-role');b.add('3-contract/contract.md','requirement','## 读什么\n`../2-prototype/missing.json`');
  assert('F02: 主契约角色误标拒绝登记',b.register().stderr.includes('INVALID_CONTRACT_ROLE'));
  b.files.find(f=>f.path==='3-contract/contract.md').role='contract';b.register();
  assert('F02: 正确角色仍须检查输入',b.exp().status!==0);

  const c=fixture('F03-relative');c.add('3-contract/contract.md','contract','## 读什么\n`verification/expected.json`');c.register();
  assert('F03: 普通相对输入缺失被拦',c.exp().status!==0);
  c.write('3-contract/contract.md','## 强约束\n`fixtures/expected.json`');c.register();
  assert('F03: 其他输入目录和章节同样检查',c.exp().status!==0);
  c.write('3-contract/contract.md','## 读什么\n`verification/expected.json`');
  c.add('3-contract/verification/expected.json','verification','{"expected":1}');c.register();c.exp();
  assert('F03: 输入补齐后通过',c.check().status===0);

  const d=fixture('F04-lock');d.add('3-contract/verification/package.json','verification','{"devDependencies":{"example":"1.0.0"}}');
  d.write('3-contract/verification/package-lock.json','{"packages":{"":{"devDependencies":{"example":"1.0.0"}}}}');d.excluded.push({path:'3-contract/verification/package-lock.json',reason:'误排除'});d.register();
  assert('F04: 缺包锁是错误而非告警',d.exp().stderr.includes('PACKAGE_LOCK_NOT_PUBLISHED'));
  d.excluded.pop();d.files.push({path:'3-contract/verification/package-lock.json',role:'verification'});d.register();d.exp();
  assert('F04: 锁与包声明匹配后通过',d.check().status===0);

  const e=fixture('F05-dossier');e.files.pop();e.register();
  assert('F05: 完全不登记档案不能提交或预览',e.check().stdout.includes('DOSSIER_REQUIRED')&&e.preview().status!==0);

  for (const bad of [false,true]) {
    const f=fixture(bad?'F06-corrupt':'F06-absent');
    f.write('web/state.json',JSON.stringify({slug:'legacy-web',opening:'旧任务',rounds:[],phases:[],locked:[],open_ambiguities:0}));
    if(bad)f.write('manifest.json','{broken');else fs.unlinkSync(path.join(f.dir,'manifest.json'));
    const result=f.exp();
    assert('F06: '+(bad?'坏manifest':'无manifest')+'旧Web任务仍可导出',result.status===0,result.stderr);
    assert('F06: 旧Web默认位置保持',fs.existsSync(path.join(f.dir,'web/exports/legacy-web-decision-dossier.html')));
  }

  const g=fixture('F07-registered-web');fs.mkdirSync(path.join(g.dir,'web'),{recursive:true});g.register();
  assert('F07: 带web目录登记任务默认导出到正式入口',g.exp().status===0&&fs.existsSync(path.join(g.dir,'dossier.html'))&&!fs.existsSync(path.join(g.dir,'web/exports')));
  assert('F07: 默认导出、检查、预览连续完成',g.check().status===0&&g.preview().status===0);
  const gw=fixture('F07-with-state');gw.add('web/state.json','decision',JSON.stringify({slug:'F07-with-state',opening:'Web任务',rounds:[],phases:[],locked:[],open_ambiguities:0}));gw.register();gw.exp();
  assert('F07: 显式发布Web state也可完成预览',gw.check().status===0&&gw.preview().status===0);

  const h=fixture('F08-identity');h.register();h.exp();h.preview();
  const previewHtml=fs.readFileSync(path.join(root,'F08-identity-preview/issue/dossier.html'),'utf8');
  const previewData=JSON.parse(previewHtml.match(/id="decision-dossier-data">([\s\S]*?)<\/script>/)[1]);
  assert('F08: 预览标题与所有任务标识保持',previewData.title==='F08-identity'&&previewData.slug==='F08-identity'&&previewData.state.slug===previewData.manifest.slug);

  const i=fixture('F09-encoding');i.add('3-contract/notes.md','decision','[空格](a%20b.md) [中文](%E4%B8%AD%E6%96%87.md) [百分号](a%2520.md)');
  i.add('3-contract/a b.md','asset','空格');i.add('3-contract/中文.md','asset','中文');i.add('3-contract/a%20.md','asset','字面百分号');i.register();
  assert('F09: 编码路径只解析序列化一次',i.exp().status===0&&i.check().status===0&&i.preview().status===0);

  const j=fixture('F10-fixtures');
  for(const ext of ['zip','log','trace'])j.add('3-contract/verification/sample.'+ext,'verification','固定验收样本');
  const lock=Object.fromEntries(['zip','log','trace'].map(ext=>['sample.'+ext,crypto.createHash('sha256').update('固定验收样本').digest('hex')]));
  j.add('3-contract/verification/spec-lock.json','verification',JSON.stringify(lock));
  assert('F10: 锁定ZIP与日志样本可登记并预览',j.register().status===0&&j.exp().status===0&&j.preview().status===0);
  j.add('2-prototype/drafts/fixture.zip','verification','不允许草稿成为正式输入');
  assert('F10: 用途例外不放开草稿目录',j.register().status!==0);

  const outputForms=['output/result.json','./output/result.json','../output/result.json','[未来输出](./output/result.json)','[未来输出](../output/result.json)'];
  for(const [n,output] of outputForms.entries()){
    const k=fixture('F11-output-'+n);k.add('3-contract/contract.md','contract','## 要落盘的东西\n- D-01: '+(output.startsWith('[')?output:'`'+output+'`')+'，由产品实现生成。');
    const registered=k.register(),exported=k.exp(),previewed=k.preview();
    assert('F11: 未来输出不因路径写法提前成为输入 '+output,registered.status===0&&exported.status===0&&previewed.status===0,exported.stderr+previewed.stdout+previewed.stderr);
  }
  const history=fixture('F12-history');history.add('3-contract/contract.md','contract','## 原始请求\n> 请参考 [旧技能](G:\\old\\missing\\SKILL.md) 做调研。\n## 读什么\n[当前输入](verification/input.json)');
  history.add('3-contract/verification/input.json','verification','{"locked":true}');history.add('1-interview/raw-request.md','requirement','## 任务陈述\n请参考 [旧技能](G:\\old\\missing\\SKILL.md)。');history.register();
  assert('F12: 保留原始请求和任务陈述的本机历史链接',history.exp().status===0&&history.preview().status===0);
  const outside=fixture('F12-current-outside');outside.add('3-contract/contract.md','contract','## 读什么\n[当前必需输入](G:\\old\\missing\\input.json)');outside.register();
  assert('F12: 当前外部输入不得借历史例外通过',outside.exp().status!==0);
  const missing=fixture('F12-current-missing');missing.add('3-contract/contract.md','contract','## 原始请求\n> [旧技能](G:\\old\\missing\\SKILL.md)\n## 读什么\n[当前必需输入](../2-prototype/missing.json)');missing.register();
  assert('F12: 历史区不遮蔽后续当前缺失输入',missing.exp().status!==0);
  const sourcePath='skills/sample/references/design.md',sourceText='宿主源码阅读前提\n',sourceFile=path.join(root,sourcePath);
  fs.mkdirSync(path.dirname(sourceFile),{recursive:true});fs.writeFileSync(sourceFile,sourceText);
  const git=(...args)=>spawnSync('git',['-C',root,...args],{encoding:'utf8'});
  if(git('add','--',sourcePath).status!==0||git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','fixture source baseline').status!==0)throw new Error('Isolated source recovery fixture failed');
  const source=fixture('F13-source');source.add('3-contract/contract.md','contract','## 读什么\n- 在 `skills/sample/` 浏览；必需文件为 `'+sourcePath+'`，亦见[同基准短路径](references/design.md)。\n- [源码同路径]('+sourcePath+')\n- [当前输入](verification/input.json)\n## 范围\n- 使用 `references/design.md`，参见[同一已声明源码](references/design.md)。\n## 要落盘的东西\n- D-01: `skills/sample/result.json`。');source.add('3-contract/verification/input.json','verification','{"expected":1}');
  const sourceRegistered=source.register();
  assert('F13: 明确仓库源码指路按宿主路径登记',sourceRegistered.status===0,sourceRegistered.stdout+sourceRegistered.stderr);
  const registeredSource=JSON.parse(fs.readFileSync(path.join(source.dir,'manifest.json'))).delivery.repository_inputs;
  assert('F13: 源码前提保留唯一可恢复版本而不复制产品源码',registeredSource.length===1&&registeredSource[0].path===sourcePath&&registeredSource[0].gitPath===sourcePath&&registeredSource[0].sha256===crypto.createHash('sha256').update(sourceText).digest('hex')&&/^[a-f0-9]{40,64}$/.test(registeredSource[0].commit)&&!fs.existsSync(path.join(source.dir,sourcePath)));
  const sourceExport=source.exp(),sourcePreview=source.preview();
  assert('F13: 源码前提与正式输入同时完成导出和预览',sourceExport.status===0&&sourcePreview.status===0,sourceExport.stderr+sourcePreview.stdout+sourcePreview.stderr);
  const sourceReceipt=JSON.parse(fs.readFileSync(path.join(root,'F13-source-preview/submission.json'))),sourcePreviewResult=JSON.parse(sourcePreview.stdout);
  assert('F13: 预览回执与CLI明确保留恢复NOT_VERIFIED',sourceReceipt.check.warnings.some(w=>w.startsWith('REPOSITORY_INPUT_RECOVERY_NOT_VERIFIED:'))&&sourcePreviewResult.report.warnings.some(w=>w.startsWith('REPOSITORY_INPUT_RECOVERY_NOT_VERIFIED:')));
  fs.writeFileSync(sourceFile,'未经登记的脏源码\n');
  assert('F13: 源码变更不能沿用已登记可恢复身份',source.exp().status!==0&&source.register().status!==0);
  fs.writeFileSync(sourceFile,sourceText);
  const absentSource=fixture('F13-source-absent');absentSource.add('3-contract/contract.md','contract','## 读什么\n`skills/sample/missing.mjs`');
  assert('F13: 真正缺失的仓库输入不获源码豁免',absentSource.register().status!==0);
  const mislabeledSource=fixture('F13-source-outside-read');mislabeledSource.add('3-contract/contract.md','contract','## 强约束\n`'+sourcePath+'`');mislabeledSource.register();
  assert('F13: 非读什么章节不自动推断仓库源码例外',mislabeledSource.exp().status!==0);
  const traversal=fixture('F13-input-traversal');traversal.add('3-contract/contract.md','contract','## 读什么\n`../../../../escape.json`');traversal.register();
  assert('F13: 真正输入越界仍拒绝',traversal.exp().status!==0);
  const historyInput=fixture('F14-history-input');historyInput.add('3-contract/contract.md','contract','## 原始请求\n> [历史本机技能](G:\\old\\SKILL.md)，[本issue输入](../2-prototype/missing.json)');historyInput.register();
  assert('F14: 历史区明确本issue输入仍须闭合',historyInput.exp().status!==0);
  const mixed=fixture('F14-same-url');mixed.add('3-contract/contract.md','contract','## 要落盘的东西\n[未来输出](./verification/missing.json)\n## 读什么\n[同路径当前输入](./verification/missing.json)');mixed.register();
  assert('F14: 相同URL的输出语境不豁免当前输入',mixed.exp().status!==0);
  const upper=fixture('F14-upper-contract');upper.add('3-contract/Contract.MD','contract','## 读什么\n`verification/missing.json`');
  if(fs.existsSync(path.join(upper.dir,'3-contract/contract.md')))upper.files.find(f=>f.path==='3-contract/Contract.MD').path='3-contract/contract.md';
  assert('F14: Windows契约文件名大小写不绕过依赖检查',upper.register().status===0&&upper.exp().status!==0);
  const externalRepos=[];
  for(const suffix of ['a','b']){
    const external=path.join(root,'external-source-'+suffix),file=path.join(external,'src/run.mjs');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'export const fixture="'+suffix+'";\n');
    for(const name of ['base.md','design.md']){const reference=path.join(external,'skills/sample/references',name);fs.mkdirSync(path.dirname(reference),{recursive:true});fs.writeFileSync(reference,suffix+' '+name+'\n');}
    const command=(...args)=>spawnSync('git',['-C',external,...args],{encoding:'utf8'});
    if(command('init','--quiet').status!==0||command('add','--','src/run.mjs','skills/sample/references/base.md','skills/sample/references/design.md').status!==0||command('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','external fixture source').status!==0)throw new Error('External source fixture init failed');
    externalRepos.push(external.split(path.sep).join('/'));
  }
  const external=fixture('F15-external-source');external.add('3-contract/contract.md','contract','## 读什么\n- 冻结只读源：'+externalRepos[0]+' 的 `src/run.mjs`；'+externalRepos[1]+' 的 `src/run.mjs`。\n- 外部附属来源：'+externalRepos[0]+' 的 `skills/sample/references/base.md` 和[同基准短路径](references/design.md)。');
  const externalRegistered=external.register();
  assert('F15: 同一行两个明确外部Git仓库作用域各自登记',externalRegistered.status===0,externalRegistered.stderr);
  const externalInputs=JSON.parse(fs.readFileSync(path.join(external.dir,'manifest.json'))).delivery.repository_inputs;
  const sharedNameInputs=externalInputs.filter(r=>r.path==='src/run.mjs');
  assert('F15: 同名外部源码和短路径按仓库身份分别保留',externalInputs.length===4&&sharedNameInputs.length===2&&new Set(sharedNameInputs.map(r=>r.repository)).size===2&&new Set(sharedNameInputs.map(r=>r.sha256)).size===2&&externalInputs.some(r=>r.path==='skills/sample/references/design.md'&&r.repository===externalRepos[0]));
  const externalExport=external.exp(),externalPreview=external.preview();
  assert('F15: 外部仓库身份保留到dossier和提交预览',externalExport.status===0&&externalPreview.status===0,externalExport.stderr+externalPreview.stderr+externalPreview.stdout);
  const ambiguous=fixture('F17-ambiguous');ambiguous.add('3-contract/contract.md','contract','## 读什么\n'+externalRepos[0]+' 的 `skills/sample/references/design.md`\n'+externalRepos[1]+' 的 `skills/sample/references/design.md`\n## 范围\n`references/design.md`');
  assert('F17: 跨章节短路径声明歧义拒绝',ambiguous.register().status!==0);
  const undeclared=fixture('F17-undeclared');undeclared.add('3-contract/contract.md','contract','## 强约束\n`references/missing.md`');undeclared.register();
  assert('F17: 未声明短路径仍是严格issue输入',undeclared.exp().status!==0);
  const command=fixture('F18-command');command.add('3-contract/contract.md','contract','## 验收条件\n- AC-001: 实现后验证\n  - Verify: [A] `cd "G:/explicit/product" && node scripts/run.mjs test.console`');command.register();
  assert('F18: 可识别Verify命令参数不冒充issue文件',command.exp().status===0&&command.preview().status===0);
  const commandInput=fixture('F18-command-input');commandInput.add('3-contract/contract.md','contract','## 验收条件\n- AC-001: 验证锁定脚本\n  - Verify: [A] `node verification/missing.mjs`');commandInput.register();
  assert('F18: Verify命令内明确verification输入仍拒缺件',commandInput.exp().status!==0);
  const commandIssue=fixture('F18-command-issue');commandIssue.add('3-contract/contract.md','contract','## 验收条件\n- AC-001: 验证当前输入\n  - Verify: [A] `node .aes-workflow/grilling/F18-command-issue/3-contract/locked.json`');commandIssue.register();
  assert('F18: Verify命令内显式issue前缀仍检查发布输入',commandIssue.exp().status!==0);
  const optionMissing=fixture('F19-option-missing');optionMissing.add('3-contract/contract.md','contract','## 验收条件\n- AC-001: 验证明确输入\n  - Verify: [A] `node scripts/product-run.mjs --input="verification/missing.json"`');optionMissing.register();
  assert('F19: 带引号命令选项的verification缺件仍拒绝',optionMissing.exp().status!==0&&optionMissing.preview().status!==0);
  const optionIssue=fixture('F19-option-issue');optionIssue.add('3-contract/contract.md','contract','## 验收条件\n- AC-001: 验证明确输入\n  - Verify: [A] `node scripts/product-run.mjs --input=\'.aes-workflow/grilling/F19-option-issue/3-contract/locked.json\'`');optionIssue.register();
  assert('F19: 命令选项的逻辑issue前缀缺件仍拒绝',optionIssue.exp().status!==0&&optionIssue.preview().status!==0);
  const optionReady=fixture('F19-option-ready');optionReady.add('3-contract/contract.md','contract','## 验收条件\n- AC-001: 验证已发布输入\n  - Verify: [A] `node scripts/product-run.mjs --input="verification/input.json" --expected=\'.aes-workflow/grilling/F19-option-ready/3-contract/locked.json\'`');optionReady.add('3-contract/verification/input.json','verification','{"input":true}');optionReady.add('3-contract/locked.json','verification','{"expected":true}');optionReady.register();
  assert('F19: 命令选项的明确输入发布后可导出并预览',optionReady.exp().status===0&&optionReady.preview().status===0);
  const eolRepo=externalRepos[0],eolFile=path.join(eolRepo,'src/run.mjs'),eolGit=(...args)=>spawnSync('git',['-C',eolRepo,...args],{encoding:'utf8'}),oldCommit=eolGit('rev-parse','HEAD').stdout.trim();
  eolGit('config','core.autocrlf','true');const lf=fs.readFileSync(eolFile,'utf8'),crlf=lf.replaceAll('\n','\r\n');fs.writeFileSync(eolFile,crlf);
  const eol=fixture('F16-eol');eol.add('3-contract/contract.md','contract','## 读什么\n- 冻结只读源：'+eolRepo+' 的 `src/run.mjs`。');
  const eolRegistered=eol.register();
  assert('F16: 干净CRLF检出不是源码漂移',eolRegistered.status===0,eolRegistered.stderr);
  const eolRecord=JSON.parse(fs.readFileSync(path.join(eol.dir,'manifest.json'))).delivery.repository_inputs[0];
  assert('F16: CRLF配方保留物理SHA与原blobSHA',eolRecord.checkout_eol==='crlf'&&eolRecord.sha256===crypto.createHash('sha256').update(crlf).digest('hex')&&eolRecord.blob_sha256===crypto.createHash('sha256').update(lf).digest('hex'));
  assert('F16: CRLF身份可完成源检查与冻结预览',eol.exp().status===0&&eol.preview().status===0);
  fs.writeFileSync(eolFile,crlf+'// actual drift\r\n');
  assert('F16: CRLF规则不掩盖内容漂移',eol.exp().status!==0&&eol.register().status!==0);
  if(eolGit('add','--','src/run.mjs').status!==0||eolGit('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','new isolated source version').status!==0)throw new Error('Version hint fixture commit failed');
  fs.writeFileSync(eolFile,crlf);const hintPlan=path.join(root,'historical-version-plan.json');fs.writeFileSync(hintPlan,JSON.stringify({files:eol.files,excluded:eol.excluded,repository_inputs:[{source:'3-contract/contract.md',path:'src/run.mjs',repository:eolRepo,commit:oldCommit}]}));
  assert('F16: 显式历史commit经实际字节校验可恢复',eol.call(path.join(here,'session.mjs'),'delivery',eol.dir,'--plan',hintPlan).status===0&&eol.exp().status===0);
  fs.writeFileSync(path.join(eolRepo,'.gitattributes'),'src/run.mjs filter=unsafe\n');const filterMarker=path.join(root,'unsafe-filter-executed');eolGit('config','filter.unsafe.clean','node -e "require(\'fs\').writeFileSync(\''+filterMarker.replaceAll('\\','/')+'\',\'BAD\')"');
  assert('F16: 外部filter拒绝且不执行',eol.call(path.join(here,'session.mjs'),'delivery',eol.dir,'--plan',hintPlan).status!==0&&!fs.existsSync(filterMarker));
  console.log(`review-regressions: ${passed}/${passed} passed`);
} finally {
  if(path.dirname(root)!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('delivery-review-regression-'))throw new Error('Unexpected cleanup target');
  fs.rmSync(root,{recursive:true,force:true});
}
