import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const BEGIN = '# BEGIN workflow-interview managed';
const END = '# END workflow-interview managed';
const TEMPLATE = fileURLToPath(new URL('../../assets/grilling.gitignore', import.meta.url));
const canonical = s => s.replaceAll('\r\n', '\n').replace(/\n*$/, '\n');
const hash = s => createHash('sha256').update(s).digest('hex');
const within = (root, p) => { const r=path.relative(root,p);return !path.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+path.sep); };
const processOutput = p => /(?:^|\/)(?:node_modules|drafts|test-results|playwright-report)(?:\/|$)/i.test(p);
const literalScope = p => ':('+(process.platform==='win32'?'icase,literal':'literal')+')'+p;

function assertNoLinks(target) {
  let p=path.resolve(target);
  for(;;){if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw new Error('IGNORE_SYMLINK_NOT_ALLOWED: '+p);const parent=path.dirname(p);if(parent===p)break;p=parent;}
}

export function resolveSourceDirectory(target) {
  const supplied=path.resolve(target);assertNoLinks(supplied);
  return fs.realpathSync.native(supplied);
}

function templateBlock() {
  const body=canonical(fs.readFileSync(TEMPLATE,'utf8'));
  const version=Number(body.match(/^# template-version: (\d+)$/m)?.[1]);
  if(!Number.isInteger(version)||version<1)throw new Error('INVALID_IGNORE_TEMPLATE');
  return {version,body,block:BEGIN+'\n# template-sha256: '+hash(body)+'\n'+body+END+'\n'};
}

function planIgnore(text, template) {
  if(text.startsWith('\uFEFF')){const planned=planIgnore(text.slice(1),template);return {...planned,text:'\uFEFF'+planned.text};}
  const starts=[...text.matchAll(/^# BEGIN workflow-interview managed\r?$/gm)];
  const ends=[...text.matchAll(/^# END workflow-interview managed\r?$/gm)];
  const eol=text.includes('\r\n')?'\r\n':'\n',block=template.block.replaceAll('\n',eol);
  if(!starts.length&&!ends.length){
    if(text.includes(BEGIN)||text.includes(END))throw new Error('IGNORE_MANAGED_BLOCK_INVALID');
    const separator=text.length?(text.endsWith('\n')?'\n': '\n\n').replaceAll('\n',eol):'';
    return {text:text+separator+block,status:text.length?'appended':'created'};
  }
  if(starts.length!==1||ends.length!==1||starts[0].index>=ends[0].index)throw new Error('IGNORE_MANAGED_BLOCK_INVALID');
  const start=starts[0].index,end=ends[0].index+ends[0][0].length+(text[ends[0].index+ends[0][0].length]==='\n'?1:0);
  const installed=canonical(text.slice(start,end)),lines=installed.split('\n');
  const checksum=lines[1]?.match(/^# template-sha256: ([a-f0-9]{64})$/)?.[1];
  const body=canonical(lines.slice(2,-2).join('\n'));
  const version=Number(body.match(/^# template-version: (\d+)$/m)?.[1]);
  if(!checksum||hash(body)!==checksum)throw new Error('IGNORE_MANAGED_BLOCK_MODIFIED: preserve custom edits; review the block before setup');
  if(!Number.isInteger(version)||version<1||version>template.version)throw new Error('IGNORE_TEMPLATE_VERSION_UNSUPPORTED');
  if(installed===template.block)return {text,status:'unchanged'};
  return {text:text.slice(0,start)+block+text.slice(end),status:'updated'};
}

export function ensureGrillingIgnore(grillingRoot) {
  const root=path.resolve(grillingRoot),file=path.join(root,'.gitignore');assertNoLinks(file);
  const exists=fs.existsSync(file),before=exists?fs.readFileSync(file,'utf8'):'';
  const planned=planIgnore(before,templateBlock());
  if(planned.status!=='unchanged'){
    fs.mkdirSync(root,{recursive:true});
    if(!exists)fs.writeFileSync(file,planned.text,{encoding:'utf8',flag:'wx'});
    else{
      const temporary=file+'.'+process.pid+'.'+randomUUID()+'.tmp';
      try{
        fs.writeFileSync(temporary,planned.text,{encoding:'utf8',flag:'wx'});
        assertNoLinks(file);if(fs.readFileSync(file,'utf8')!==before)throw new Error('IGNORE_CHANGED_DURING_SETUP');
        fs.renameSync(temporary,file);
      }finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
    }
  }
  return {path:file,status:planned.status,version:templateBlock().version};
}

function git(cwd,args,input){return spawnSync('git',['-c','core.longpaths=true','-C',cwd,...args],{encoding:'utf8',input,maxBuffer:16*1024*1024});}
function ignoreMatches(repo,paths,context=[]){
  if(!paths.length)return new Map();
  const result=git(repo,[...context,'check-ignore','--no-index','-v','-z','--stdin'],paths.join('\0')+'\0');
  if(result.error||![0,1].includes(result.status))throw new Error('GIT_IGNORE_CHECK_FAILED: '+(result.error?.message||result.stderr));
  const fields=result.stdout.split('\0'),matches=new Map();
  for(let i=0;i+3<fields.length;i+=4)matches.set(fields[i+3],{source:fields[i],line:Number(fields[i+1]),pattern:fields[i+2],ignored:!fields[i+2].startsWith('!')});
  return matches;
}

// Use the source worktree with empty temporary Git metadata. No local config,
// info/exclude, global ignore file or source index participates in this proof.
function repositoryIgnoreContext(repo) {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'workflow-ignore-context-'));
  const close=()=>{
    const relative=path.relative(path.resolve(os.tmpdir()),path.resolve(temporary));
    if(!relative.startsWith('workflow-ignore-context-')||relative.includes(path.sep))throw new Error('IGNORE_CONTEXT_CLEANUP_OUTSIDE_TEMP');
    fs.rmSync(temporary,{recursive:true,force:true});
  };
  try{
    const metadata=path.join(temporary,'.git');
    const initialized=git(temporary,['--git-dir='+metadata,'--work-tree='+temporary,'init','--quiet','--template=']);
    if(initialized.status!==0)throw new Error('IGNORE_CONTEXT_INIT_FAILED: '+(initialized.error?.message||initialized.stderr));
    const context=['--git-dir='+metadata,'--work-tree='+repo,'-c','core.excludesFile='];
    // Keep the repository's filename matching semantics without importing its
    // local configuration. In particular, never fold Linux paths to lowercase.
    const ignoreCase=git(repo,['config','--bool','--get','core.ignorecase']);
    if(ignoreCase.status===0)context.push('-c','core.ignorecase='+ignoreCase.stdout.trim());
    else if(ignoreCase.status!==1)throw new Error('IGNORE_CONTEXT_CONFIG_FAILED: '+ignoreCase.stderr);
    return {context,close,ignoreCase:ignoreCase.status===0&&ignoreCase.stdout.trim()==='true'};
  }catch(error){close();throw error;}
}

// Normalize managed directory prefixes, not output files: a file symlink must
// keep its ownership even when its target is in another task. Missing suffixes
// use Git's Windows case semantics; existing distinct directories stay distinct.
function directoryIdentity(repo,foldMissing) {
  const cache=new Map();
  return target=>{
    const supplied=path.resolve(target);
    if(cache.has(supplied))return cache.get(supplied);
    let existing=supplied;const missing=[];
    while(!fs.existsSync(existing)){
      missing.unshift(path.basename(existing));const parent=path.dirname(existing);
      if(parent===existing)throw new Error('IGNORE_DIRECTORY_UNAVAILABLE: '+supplied);
      existing=parent;
    }
    assertNoLinks(existing);
    const identity=path.join(fs.realpathSync.native(existing),...missing.map(p=>foldMissing?p.toLowerCase():p));
    if(!within(repo,identity))throw new Error('IGNORE_DIRECTORY_OUTSIDE_REPOSITORY: '+supplied);
    cache.set(supplied,identity);return identity;
  };
}
function sameDirectory(a,b) {
  if(a===b)return true;
  if(process.platform==='win32'&&a.toLowerCase()===b.toLowerCase()&&(!fs.existsSync(a)||!fs.existsSync(b)))throw new Error('AMBIGUOUS_TASK_IDENTITY: '+a+' <> '+b);
  return false;
}
function portableSource(repo,source,target){
  const absolute=path.resolve(repo,source),rel=path.relative(repo,absolute).replaceAll('\\','/');
  if(!within(repo,absolute)||rel.startsWith('.git/')||path.basename(absolute)!=='.gitignore'||!within(path.dirname(absolute),path.resolve(repo,target)))return false;
  try{assertNoLinks(absolute);return fs.statSync(absolute).isFile();}catch{return false;}
}

// Source-directory Git policy only. Never call this for output/issue copies.
export function inspectIgnorePolicy(issueDir, formalPaths=[]) {
  const errors=[],warnings=[];
  let issue=path.resolve(issueDir);
  try{issue=resolveSourceDirectory(issue);}catch(error){errors.push(error.message);}
  const grilling=path.dirname(issue),file=path.join(grilling,'.gitignore');
  const result={ok:false,errors,warnings,publicIgnore:file,requiredRepositoryFiles:[],formalMatches:[],outputMatches:[],trackedCurrent:[],trackedHistorical:[]};
  if(errors.length)return result;
  try{
    assertNoLinks(file);
    if(!fs.existsSync(file))errors.push('PUBLIC_IGNORE_MISSING: run session.mjs init for this task');
    else if(planIgnore(fs.readFileSync(file,'utf8'),templateBlock()).status!=='unchanged')errors.push('PUBLIC_IGNORE_OUTDATED: run session.mjs init');
  }catch(e){errors.push(e.message);}
  const discovered=git(issue,['rev-parse','--show-toplevel']);
  if(discovered.status!==0){errors.push('GIT_CONTEXT_UNAVAILABLE: static material checks remain available; ignore policy NOT_VERIFIED');return result;}
  const repo=resolveSourceDirectory(discovered.stdout.trim());result.repository=repo;
  const publicPath=path.relative(repo,file).replaceAll('\\','/'),issueRel=path.relative(repo,issue).replaceAll('\\','/');
  if(!within(repo,file)){errors.push('PUBLIC_IGNORE_OUTSIDE_REPOSITORY');return result;}
  result.requiredRepositoryFiles=[publicPath];
  const published=[publicPath,...formalPaths.map(p=>path.posix.join(issueRel,p))];
  const probePrefix=path.posix.join(issueRel,'2-prototype/drafts/__workflow_ignore_probe__.html');
  let repositoryContext;
  try{
    repositoryContext=repositoryIgnoreContext(repo);
    const identity=directoryIdentity(repo,process.platform==='win32'&&repositoryContext.ignoreCase);
    const repositoryPath=p=>path.relative(repo,p).replaceAll('\\','/');
    const artifacts=identity(path.join(repo,'artifacts/workflow-interview'));
    const currentArtifacts=identity(path.join(artifacts,path.basename(issue)));
    const artifactsRel=repositoryPath(artifacts),currentArtifactsRel=repositoryPath(currentArtifacts);
    const grillingRel=repositoryPath(grilling);
    const recordIn=(p,base,baseRel,current)=>{
      const parts=p.split('/'),depth=baseRel?baseRel.split('/').length:0;
      if(parts.length<depth||!sameDirectory(identity(path.join(repo,...parts.slice(0,depth))),base))return null;
      if(parts.length===depth)return {current:false,local:''};
      return {current:sameDirectory(identity(path.join(repo,...parts.slice(0,depth+1))),current),local:parts.slice(depth+1).join('/')};
    };
    const artifactRecord=p=>recordIn(p,artifacts,artifactsRel,currentArtifacts);
    const taskRecord=p=>recordIn(p,grilling,grillingRel,issue);
    const probes=[probePrefix,...['node_modules/probe.js','test-results/probe.json','playwright-report/index.html'].map(p=>path.posix.join(issueRel,'3-contract/verification',p)),artifactsRel+'/__workflow_ignore_probe__.json'];
    // Without exclude flags Git enumerates ignored files too. Checking only
    // visible files would miss local-only exclusions and custom exceptions.
    const existing=git(repo,['ls-files','--cached','--others','-z','--',literalScope(issueRel),literalScope(currentArtifactsRel)]);
    if(existing.status!==0||existing.stderr.trim())throw new Error('GIT_OUTPUT_ENUMERATION_FAILED: '+(existing.error?.message||existing.stderr));
    const currentOutputs=existing.stdout.split('\0').filter(p=>{
      if(!p)return false;
      if(artifactRecord(p)?.current)return true;
      const task=taskRecord(p);return task?.current&&processOutput(task.local);
    });
    const outputs=[...new Set([...probes,...currentOutputs])];
    const matches=ignoreMatches(repo,[...published,...outputs]);
    const repositoryMatches=ignoreMatches(repo,outputs,repositoryContext.context);
    for(const p of published){const match=matches.get(p);result.formalMatches.push({path:p,match});if(match?.ignored)errors.push('FORMAL_FILE_IGNORED: '+p);}
    for(const p of outputs){
      const match=matches.get(p),repositoryMatch=repositoryMatches.get(p);
      result.outputMatches.push({path:p,match,repositoryMatch});
      if(!match?.ignored)errors.push('OUTPUT_NOT_IGNORED: '+p);
      else if(!repositoryMatch?.ignored||!portableSource(repo,repositoryMatch.source,p))errors.push('IGNORE_RULE_NOT_PORTABLE: '+p);
      else result.requiredRepositoryFiles.push(path.relative(repo,path.resolve(repo,repositoryMatch.source)).replaceAll('\\','/'));
    }
    // Visibility can depend on ancestor negations even when they are not the
    // final matching source. Git does not read configs inside excluded dirs.
    const configs=new Map();
    for(const p of [...published,...outputs]){
      let dir=path.dirname(path.resolve(repo,p));
      while(within(repo,dir)){
        const config=path.join(dir,'.gitignore');
        // These directories exist. Appending '/' can match a child wildcard
        // such as /parent/* against the parent directory itself.
        if(fs.existsSync(config))configs.set(path.relative(repo,config).replaceAll('\\','/'),dir===repo?'':path.relative(repo,dir).replaceAll('\\','/'));
        if(dir===repo)break;dir=path.dirname(dir);
      }
    }
    const directories=ignoreMatches(repo,[...new Set([...configs.values()].filter(Boolean))],repositoryContext.context);
    for(const [config,dir] of configs){
      if(dir&&directories.get(dir)?.ignored)continue;
      assertNoLinks(path.resolve(repo,config));result.requiredRepositoryFiles.push(config);
    }
    result.requiredRepositoryFiles=[...new Set(result.requiredRepositoryFiles)];
    const configVisibility=git(repo,['check-ignore','-z','--stdin'],result.requiredRepositoryFiles.join('\0')+'\0');
    if(![0,1].includes(configVisibility.status))throw new Error('GIT_CONFIG_VISIBILITY_FAILED: '+configVisibility.stderr);
    for(const p of configVisibility.stdout.split('\0').filter(Boolean))errors.push('IGNORE_PREREQUISITE_IGNORED: '+p);
    const tracked=git(repo,['ls-files','-z','--',literalScope(grillingRel),literalScope(artifactsRel)]);
    if(tracked.status!==0||tracked.stderr.trim())throw new Error('GIT_TRACKED_CHECK_FAILED: '+tracked.stderr);
    for(const p of tracked.stdout.split('\0').filter(Boolean)){
      const artifact=artifactRecord(p),task=taskRecord(p);
      if(!artifact&&(!task||!processOutput(task.local)))continue;
      (artifact?.current||task?.current?result.trackedCurrent:result.trackedHistorical).push(p);
    }
    if(result.trackedCurrent.length)errors.push('TRACKED_CURRENT_OUTPUTS: '+result.trackedCurrent.length+'; preserve files and resolve index separately');
    if(result.trackedHistorical.length)warnings.push('TRACKED_HISTORICAL_OUTPUTS: '+result.trackedHistorical.length+'; history retained, index not modified');
  }catch(e){errors.push(e.message);}finally{repositoryContext?.close();}
  result.ok=errors.length===0;return result;
}

export function copyIgnorePrerequisites(output, policy) {
  if(!policy.ok)throw new Error('IGNORE_POLICY_NOT_READY');
  return policy.requiredRepositoryFiles.map(p=>{
    const source=path.resolve(policy.repository,p),target=path.resolve(output,'repository-files',p);
    if(!within(policy.repository,source)||!within(path.resolve(output,'repository-files'),target))throw new Error('IGNORE_PREREQUISITE_OUTSIDE_SCOPE');
    assertNoLinks(source);assertNoLinks(target);
    const bytes=fs.readFileSync(source);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
    return {path:p,previewPath:'repository-files/'+p,role:'repository-ignore',bytes:bytes.length,sha256:hash(bytes)};
  });
}
