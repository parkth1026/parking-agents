import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROLES = new Set(['entry', 'state', 'requirement', 'decision', 'prototype', 'contract', 'verification', 'asset', 'derived']);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inside = (root, target) => { const r = path.relative(root, target); return !path.isAbsolute(r) && r !== '..' && !r.startsWith('..' + path.sep); };
const forbidden = item => /(^|\/)(node_modules|\.git|drafts|test-results|playwright-report)(\/|$)|\.tmp$/i.test(item.path)
  || (/\.(log|trace|zip)$/i.test(item.path) && !['verification', 'asset'].includes(item.role));
const isContract = p => /^3-contract\/contract(?:[.-][^/]*)?\.md$/i.test(p) || p === '3-contract/contract.md';
const repositoryIssuePath = root => root.replaceAll('\\','/').match(/(?:^|\/)(\.aes-workflow\/grilling\/[^/]+)$/)?.[1] ?? path.relative(findRepo(root),root).split(path.sep).join('/');

export function localPath(root, name, { excluded = false } = {}) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.includes('\0') || path.isAbsolute(name) || /^[a-z]:/i.test(name) || name.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('INVALID_DELIVERY_PATH: ' + name);
  const target = path.resolve(root, name);
  if (!inside(path.resolve(root), target)) throw new Error('OUTSIDE_ISSUE: ' + name);
  let current = path.resolve(root);
  for (const part of name.split('/')) { current = path.join(current, part); if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) { if (excluded) break; throw new Error('SYMLINK_NOT_ALLOWED: ' + name); } }
  return target;
}

export function listIssueFiles(root, dir = root) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const file = path.join(dir, e.name), rel = path.relative(root, file).split(path.sep).join('/');
    if (fs.lstatSync(file).isSymbolicLink()) return [rel];
    return e.isDirectory() ? listIssueFiles(root, file) : [rel];
  }).sort();
}

export function makeDelivery(root, plan, { registered = false } = {}) {
  if (!Array.isArray(plan.files) || !Array.isArray(plan.excluded)) throw new Error('DELIVERY_PLAN_REQUIRED: files[], excluded[]');
  const seen = new Set();
  const files = plan.files.map(item => {
    const file = localPath(root, item.path);
    if (seen.has(item.path) || !ROLES.has(item.role) || forbidden(item)) throw new Error('INVALID_DELIVERY_ENTRY: ' + item.path);
    seen.add(item.path);
    if (item.path === 'manifest.json' && item.role !== 'state' || item.path === 'dossier.html' && item.role !== 'derived' || item.role === 'derived' && item.path !== 'dossier.html') throw new Error('INVALID_CORE_ROLE: ' + item.path);
    if (isContract(item.path) && item.role !== 'contract') throw new Error('INVALID_CONTRACT_ROLE: ' + item.path);
    if (item.role !== 'derived' && (!fs.existsSync(file) || !fs.statSync(file).isFile())) throw new Error('MISSING_DELIVERY: ' + item.path);
    return { path: item.path, role: item.role, ...(item.path !== 'manifest.json' && item.role !== 'derived' ? { sha256: sha(fs.readFileSync(file)) } : {}) };
  });
  for (const p of ['manifest.json', '1-interview/context.md', '1-interview/rounds.jsonl']) if (!seen.has(p)) throw new Error('CORE_DELIVERY_REQUIRED: ' + p);
  for (const p of ['2-prototype/impact-surface.md', '3-contract/contract.md']) if (fs.existsSync(path.join(root, p)) && !seen.has(p)) throw new Error('CORE_DELIVERY_REQUIRED: ' + p);
  const excluded = plan.excluded.map(item => {
    localPath(root, item.path, { excluded: true });
    if (seen.has(item.path) || typeof item.reason !== 'string' || !item.reason.trim()) throw new Error('INVALID_EXCLUSION: ' + item.path);
    seen.add(item.path); return { path: item.path, reason: item.reason };
  });
  const delivery = { schema_version: 1, files: files.sort((a,b) => a.path.localeCompare(b.path)), excluded: excluded.sort((a,b) => a.path.localeCompare(b.path)) };
  if (!registered) {
    const inputs = [];
    for (const item of files.filter(f => f.role === 'contract')) {
      const text = fs.readFileSync(localPath(root,item.path),'utf8');
      for (const ref of markdownReferences(text, { contract:true }).filter(r => r.repository&&!r.directory)) {
        const hints=Array.isArray(plan.repository_inputs)?plan.repository_inputs.filter(r=>r.source===item.path&&r.path===ref.raw&&r.repository===ref.repositoryRoot):[];
        if(hints.length>1)throw new Error('DUPLICATE_REPOSITORY_INPUT: '+item.path+' -> '+ref.raw);
        const record = repositoryInput(root,item.path,ref.raw,ref.repositoryRoot,hints[0]?.commit);
        if (!inputs.some(r=>r.source===record.source&&r.path===record.path&&r.repository===record.repository)) inputs.push(record);
      }
    }
    if (inputs.length) delivery.repository_inputs = inputs;
  } else if (plan.repository_inputs) delivery.repository_inputs = plan.repository_inputs;
  return delivery;
}

export function publishedPaths(manifest) {
  return manifest?.delivery ? new Set(manifest.delivery.files.map(f => f.path)) : null;
}

// The contract distinguishes existing issue inputs from future product outputs,
// verbatim history, and source files read from the host repository.
const HISTORY_SECTIONS = new Set(['原始请求','用户原话','访谈原话','原始任务','任务陈述']);
const SOURCE_ROOTS = /^(?:skills|src|apps|engine|tools|docs|tests|packages|crates)\//;
function markdownReferences(text, { contract = false, issuePrefixes = [] } = {}) {
  const refs = [], headings = [];
  let fence = null;
  for (const [lineNo,line] of text.split(/\r?\n/).entries()) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) { if (!fence) fence = marker[1][0]; else if (marker[1][0]===fence) fence=null; continue; }
    if (fence) continue;
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) { while(headings.length&&headings.at(-1).level>=heading[1].length)headings.pop();headings.push({level:heading[1].length,title:heading[2].trim()}); }
    const titles=headings.map(h=>h.title), section=headings.at(-1)?.title??'';
    const links=[...line.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map(m=>({raw:m[1],position:m.index})),linkValues=links.map(m=>m.raw);
    const history=titles.some(t=>HISTORY_SECTIONS.has(t));
    if(contract&&titles.includes('要落盘的东西')){refs.push(...linkValues.map(raw=>({raw,kind:'future-output',lineNo})));continue;}
    const code=contract?[...line.matchAll(/`([^`]+)`/g)]:[];
    const tokenRefs=code.flatMap(m=>[...m[1].matchAll(/\S+/g)].map(token=>({raw:token[0],position:m.index+1+token.index,command:/Verify:\s*\[[ABCD]\]/.test(line)&&/^\s*(?:cd|node|npm|npx|pnpm|yarn|cargo|dotnet|python|pwsh|powershell|cmd|bash|sh|git|\.\/run|run(?:\.cmd)?)\s+\S/.test(m[1])})));
    // Only the contract's read-before-execution section admits repository source
    // pointers. Fixture/verification paths always remain issue inputs.
    const externalScopes=section==='读什么'?[...line.matchAll(/(?:[A-Za-z]:[\\/]|\/)[^\s`<>\[\]()]+/g)].filter(m=>m.index===0||/[\s`：:；;]/.test(line[m.index-1])):[];
    for(const {raw:tokenRaw,position,command} of [...links,...tokenRefs]) {
      let raw=tokenRaw;
      if(command){
        const unquote=value=>/^(["']).*\1$/.test(value)?value.slice(1,-1):value;
        raw=unquote(raw);
        const option=raw.match(/^--[A-Za-z][\w-]*=(.+)$/);
        if(option)raw=unquote(option[1]);
      }
      const issuePrefix=issuePrefixes.find(p=>raw.startsWith(p+'/'));
      if(issuePrefix){refs.push({raw:'/ISSUE/'+raw.slice(issuePrefix.length+1)});continue;}
      if(command&&!/(?:^|\/)(?:verification|fixtures)\//.test(raw))continue;
      if(history&&linkValues.includes(raw)&&/^(?:[A-Za-z]:[\\/]|\/|[a-z][a-z\d+.-]*:)/i.test(raw)){refs.push({raw,kind:'history',lineNo});continue;}
      const scope=externalScopes.filter(m=>m.index<position).at(-1);
      if(contract&&section==='读什么'&&SOURCE_ROOTS.test(raw)){refs.push({raw,repository:true,lineNo,...(raw.endsWith('/')?{directory:true}:{}),...(scope?{repositoryRoot:scope[0].replaceAll('\\','/')}:{})});continue;}
      const anchor=section==='读什么'?[...links,...tokenRefs].filter(r=>r.position<position&&(!scope||r.position>scope.index)&&SOURCE_ROOTS.test(r.raw)).sort((a,b)=>a.position-b.position).at(-1):null;
      if(anchor&&/^(?:references|scripts)\//.test(raw)) {
        const split=anchor.raw.match(/^(.*)\/(?:references|scripts)\//);
        if(split){refs.push({raw:split[1]+'/'+raw,displayRaw:raw,repository:true,lineNo,...(scope?{repositoryRoot:scope[0].replaceAll('\\','/')}:{})});continue;}
      }
      if(linkValues.includes(raw)||/^\.\.?\//.test(raw)||!(/^[a-z][a-z\d+.-]*:/i.test(raw))&&/^[\w.-]+\/[^\s`]+\.[a-z\d]+$/i.test(raw)&&(section==='读什么'||!/^(artifacts|docs)\//.test(raw)))refs.push({raw,lineNo});
    }
  }
  if(contract){
    const declared=refs.filter(r=>r.repository&&!r.directory);
    for(const ref of refs.filter(r=>!r.repository&&!r.kind&&/^(references|scripts)\//.test(r.raw))){
      const candidates=[...new Map(declared.filter(r=>r.raw.endsWith('/'+ref.raw)).map(r=>[(r.repositoryRoot??'')+'\0'+r.raw,r])).values()];
      if(candidates.length>1)throw new Error('AMBIGUOUS_REPOSITORY_INPUT: '+ref.raw+'; use an explicit issue input or complete repository pointer');
      if(candidates.length===1){const target=candidates[0];Object.assign(ref,{displayRaw:ref.raw,raw:target.raw,repository:true,...(target.repositoryRoot?{repositoryRoot:target.repositoryRoot}:{})});}
    }
  }
  return refs;
}

// Rendering keeps original source/JSON unchanged. Non-input links remain readable
// with their paths, without creating broken package links in the generated page.
export function projectMarkdownReferences(text, options = {}) {
  const refs=markdownReferences(text,options).filter(r=>r.repository||r.kind);
  return text.split(/\r?\n/).map((line,lineNo)=>line.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g,(whole,label,raw)=>refs.some(r=>r.lineNo===lineNo&&(r.displayRaw??r.raw)===raw)?label+'（`'+raw+'`）':whole)).join('\n');
}

function repositoryInput(root, source, name, repository, commitHint, checkoutHint) {
  const repo=repository?path.resolve(repository):findRepo(root), target=localPath(repo,name);
  if(repository&&!fs.existsSync(path.join(repo,'.git')))throw new Error('REPOSITORY_INPUT_RECOVERY_REQUIRED: '+repository+'; explicit repository scope must name a Git root');
  if(!fs.existsSync(target)||!fs.statSync(target).isFile())throw new Error('REPOSITORY_INPUT_MISSING: '+name);
  const git=(...args)=>spawnSync('git',['-c','core.longpaths=true','-C',repo,...args],{encoding:null,maxBuffer:16*1024*1024});
  const head=commitHint?null:git('rev-parse','--verify','HEAD'),commit=commitHint??head?.stdout?.toString('utf8').trim();
  if(head?.status!==undefined&&head.status!==0||!/^([a-f\d]{40}|[a-f\d]{64})$/.test(commit??''))throw new Error('REPOSITORY_INPUT_RECOVERY_REQUIRED: '+name+'; record a recoverable repository version or issue snapshot');
  const committed=git('show',commit+':'+name), bytes=fs.readFileSync(target);
  if(committed.status!==0)throw new Error('REPOSITORY_INPUT_RECOVERY_REQUIRED: '+name+'; file is not recoverable from the named commit');
  const attrsResult=git('check-attr','-z','filter','text','eol','--',name),attrs={};
  if(attrsResult.status!==0)throw new Error('REPOSITORY_INPUT_ATTRIBUTES_UNVERIFIED: '+name);
  const attrFields=attrsResult.stdout.toString('utf8').split('\0');for(let i=0;i+2<attrFields.length;i+=3)attrs[attrFields[i+1]]=attrFields[i+2];
  if(!['unspecified','unset'].includes(attrs.filter))throw new Error('REPOSITORY_INPUT_FILTER_NOT_SUPPORTED: '+name+'; register an explicit issue snapshot instead');
  let checkout_eol=checkoutHint??'identity',expected=committed.stdout;
  if(checkoutHint!==undefined&&!['identity','crlf'].includes(checkoutHint))throw new Error('INVALID_REPOSITORY_INPUT_EOL: '+name);
  if(checkoutHint==='crlf'||checkoutHint===undefined&&sha(expected)!==sha(bytes)){
    const config=key=>{const result=git('config','--get',key);return result.status===0?result.stdout.toString('utf8').trim():'';};
    const autocrlf=config('core.autocrlf'),eol=config('core.eol');
    const permitted=checkoutHint==='crlf'||attrs.text!=='unset'&&(attrs.eol==='crlf'||attrs.eol==='unspecified'&&(autocrlf==='true'||attrs.text==='set'&&(eol==='crlf'||(!eol||eol==='native')&&process.platform==='win32')));
    // Only the built-in LF -> CRLF checkout transformation is supported. Do not
    // run filters or normalize arbitrary content differences into a match.
    if(permitted&&!expected.includes(0)&&!expected.includes(13)){expected=Buffer.from(expected.toString('latin1').replaceAll('\n','\r\n'),'latin1');checkout_eol='crlf';}
  }
  if(sha(expected)!==sha(bytes))throw new Error('REPOSITORY_INPUT_RECOVERY_REQUIRED: '+name+'; current bytes do not match the named commit and checkout recipe; record the actual version or issue snapshot');
  return {source,path:name,sha256:sha(bytes),commit,gitPath:name,blob_sha256:sha(committed.stdout),checkout_eol,...(repository?{repository}: {})};
}

// Dynamic/computed dependencies require explicit plan entries. External service
// prerequisites remain contract blockers; this scanner never executes product code.
function references(name, text, options = {}) {
  const refs = [];
  if (/\.html?$/i.test(name)) {
    const markup = text.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>').replace(/<!--[\s\S]*?-->/g, '');
    for (const m of markup.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) refs.push(m[1]);
    for (const m of text.matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/g)) refs.push(m[1]);
  }
  if (/\.(md|css|mjs|js|json)$/i.test(name)) {
    if (/\.md$/i.test(name)) refs.push(...markdownReferences(text,options).filter(r=>!r.repository&&!r.kind).map(r=>r.raw));
    if (/\.(mjs|js)$/.test(name)) {
      for (const m of text.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["'](\.[^"']+)["']/g)) refs.push(m[1]);
      for (const m of text.matchAll(/new URL\(['"]([^'"]+)['"],\s*import\.meta\.url\)/g)) if (m[1] !== '.' && m[1] !== '..' && !m[1].endsWith('/') && !m[1].startsWith('node_modules/')) refs.push(m[1]);
      for (const m of text.matchAll(/globalSetup\s*:\s*['"]([^'"]+)['"]/g)) refs.push(m[1]);
    }
    if (name.endsWith('.css')) for (const m of text.matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/g)) refs.push(m[1]);
  }
  return refs;
}

export function checkDelivery(root, manifest, { allowMissingDerived = false } = {}) {
  const errors = [], warnings = [], dependencies = [], delivery = manifest.delivery;
  if (!delivery) return { ok: false, errors: ['DELIVERY_NOT_REGISTERED'], warnings, dependencies, files: [] };
  if (delivery.schema_version !== 1) errors.push('UNSUPPORTED_DELIVERY_SCHEMA');
  if (!allowMissingDerived && !delivery.files.some(f=>f.path==='dossier.html'&&f.role==='derived')) errors.push('DOSSIER_REQUIRED: register dossier.html as derived');
  const selected = publishedPaths(manifest), excluded = new Set(delivery.excluded.map(e => e.path));
  const repositoryInputs=Array.isArray(delivery.repository_inputs)?delivery.repository_inputs:[],usedRepositoryInputs=new Set();
  if(delivery.repository_inputs!==undefined&&!Array.isArray(delivery.repository_inputs))errors.push('INVALID_REPOSITORY_INPUTS');
  try { makeDelivery(root, delivery, {registered:true}); } catch(e) { errors.push(e.message); }
  for (const file of listIssueFiles(root)) if (!selected.has(file) && !excluded.has(file)) errors.push('UNCLASSIFIED: ' + file);
  const issueRel = repositoryIssuePath(root);
  const logicalIssue = `.aes-workflow/grilling/${manifest.slug}`;
  for (const item of delivery.files) {
    let file; try { file = localPath(root, item.path); } catch(e) { errors.push(e.message); continue; }
    if (!fs.existsSync(file)) { if (!(allowMissingDerived && item.role === 'derived')) errors.push('MISSING_DELIVERY: ' + item.path); continue; }
    if (!fs.statSync(file).isFile()) { errors.push('NOT_A_FILE: ' + item.path); continue; }
    const bytes = fs.readFileSync(file);
    if (item.path !== 'manifest.json' && item.role !== 'derived' && !/^[a-f0-9]{64}$/.test(item.sha256 ?? '')) errors.push('DELIVERY_HASH_REQUIRED: ' + item.path);
    if (item.sha256 && sha(bytes) !== item.sha256) errors.push('DELIVERY_CHANGED: ' + item.path);
    if (item.role === 'derived' && allowMissingDerived) continue;
    const text = bytes.toString('utf8');
    if (item.role === 'derived') {
      try {
        const payload = text.match(/<script type="application\/json" id="decision-dossier-data">([\s\S]*?)<\/script>/)?.[1];
        const data = JSON.parse(payload);
        if (data.slug !== manifest.slug || data.state?.slug !== manifest.slug) errors.push('DOSSIER_IDENTITY_MISMATCH');
        if (JSON.stringify(data.manifest) !== JSON.stringify(manifest)) errors.push('DOSSIER_STALE: manifest changed; export again');
        const expected = delivery.files.filter(f=>f.path!=='manifest.json'&&f.role!=='derived').map(f=>[f.path,f.sha256]).sort();
        const actual = data.sources.map(f=>[f.path,f.sha256]).sort();
        if (JSON.stringify(expected)!==JSON.stringify(actual)) errors.push('DOSSIER_STALE: published sources differ');
      } catch { errors.push('DOSSIER_INVALID: export the official dossier'); }
    }
    const contract = item.role === 'contract' || isContract(item.path);
    const refs = references(item.path, text, {contract,issuePrefixes:[...new Set([issueRel,logicalIssue])]});
    if(contract)for(const ref of markdownReferences(text,{contract:true,issuePrefixes:[...new Set([issueRel,logicalIssue])]}).filter(r=>r.repository&&!r.directory)){
      const records=repositoryInputs.filter(r=>r&&r.source===item.path&&r.path===ref.raw&&r.repository===ref.repositoryRoot),record=records[0];
      if(!record){errors.push('REPOSITORY_INPUT_NOT_REGISTERED: '+item.path+' -> '+ref.raw);continue;}
      usedRepositoryInputs.add(record);
      if(records.length!==1)errors.push('DUPLICATE_REPOSITORY_INPUT: '+item.path+' -> '+ref.raw);
      if(record.gitPath!==record.path||!/^[a-f\d]{64}$/.test(record.sha256??'')||!/^[a-f\d]{64}$/.test(record.blob_sha256??'')||!['identity','crlf'].includes(record.checkout_eol)||!/^([a-f\d]{40}|[a-f\d]{64})$/.test(record.commit??'')){errors.push('INVALID_REPOSITORY_INPUT: '+ref.raw);continue;}
      try{localPath(record.repository?path.resolve(record.repository):findRepo(root),record.path);}catch(e){errors.push(e.message);continue;}
      // A submission preview contains the frozen identity, not a copy of product
      // source. Its recovery still requires the named host Git commit.
      const originalIssue=/\.aes-workflow\/grilling\/[^/]+$/.test(fs.realpathSync.native(root).replaceAll('\\','/'));
      if(originalIssue){
        try{
          const current=repositoryInput(root,item.path,record.path,record.repository,record.commit,record.checkout_eol);
          if(current.sha256!==record.sha256||current.blob_sha256!==record.blob_sha256)errors.push('REPOSITORY_INPUT_CHANGED: '+record.path);
          const committed=spawnSync('git',['-c','core.longpaths=true','-C',record.repository?path.resolve(record.repository):findRepo(root),'show',record.commit+':'+record.gitPath],{encoding:null,maxBuffer:16*1024*1024});
          if(committed.status!==0||sha(committed.stdout)!==record.blob_sha256)errors.push('REPOSITORY_INPUT_RECOVERY_MISMATCH: '+record.path);
        }catch(e){errors.push(e.message);}
      } else warnings.push('REPOSITORY_INPUT_RECOVERY_NOT_VERIFIED: '+record.path+' at '+record.commit+'; restore from the host repository before execution');
    }
    for (const raw of refs) {
      if (/^(#|https?:|mailto:|data:|node:|plugin:|app:)/i.test(raw)) continue;
      let ref; try { ref = decodeURIComponent(raw.replaceAll('&amp;', '&').split('#')[0].split('?')[0]); } catch { errors.push('INVALID_URL: ' + raw); continue; }
      if (!ref) continue;
      const target = ref.startsWith('/ISSUE/') ? path.resolve(root, ref.slice(7)) : path.resolve(root, path.dirname(item.path), ref);
      const rel = path.relative(root, target).split(path.sep).join('/');
      dependencies.push({ source: item.path, target: rel });
      if (!inside(root, target)) { errors.push('DEPENDENCY_OUTSIDE_ISSUE: ' + item.path + ' -> ' + raw); continue; }
      if (!selected.has(rel)) errors.push('DEPENDENCY_NOT_PUBLISHED: ' + item.path + ' -> ' + rel);
      else if (!fs.existsSync(target) && !(allowMissingDerived && delivery.files.some(f=>f.path===rel&&f.role==='derived'))) errors.push('DEPENDENCY_MISSING: ' + rel);
    }
    if (item.path.endsWith('/spec-lock.json')) {
      try { for (const [p,h] of Object.entries(JSON.parse(text))) { const rel = path.posix.join(path.posix.dirname(item.path),p), target = localPath(root,rel); if (!selected.has(rel) || !fs.existsSync(target) || sha(fs.readFileSync(target)) !== h) errors.push('SPEC_LOCK_MISMATCH: ' + rel); } } catch(e) { errors.push('INVALID_SPEC_LOCK: ' + e.message); }
    }
    if (/(^|\/)package\.json$/.test(item.path)) {
      const lockPath = path.posix.join(path.posix.dirname(item.path),'package-lock.json');
      if (!selected.has(lockPath)) errors.push('PACKAGE_LOCK_NOT_PUBLISHED: ' + lockPath);
      else { try { const pkg=JSON.parse(text), lock=JSON.parse(fs.readFileSync(localPath(root,lockPath))); for (const key of ['dependencies','devDependencies']) if (JSON.stringify(pkg[key]??{})!==JSON.stringify(lock.packages?.['']?.[key]??{})) errors.push('PACKAGE_LOCK_DRIFT: '+item.path); } catch(e) { errors.push('INVALID_PACKAGE_LOCK: '+e.message); } }
    }
  }
  for(const record of repositoryInputs)if(!usedRepositoryInputs.has(record))errors.push('UNREFERENCED_REPOSITORY_INPUT: '+(record?.path??'<invalid>'));
  warnings.push('STATIC_SCOPE: computed imports, remote credentials and product acceptance require separate verification; this check never executes product commands.');
  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings, dependencies, files: delivery.files.map(f=>f.path) };
}

export function findRepo(root) {
  let dir=path.resolve(root);for(;;){if(fs.existsSync(path.join(dir,'.git')))return dir;const up=path.dirname(dir);if(up===dir)return path.dirname(root);dir=up;}
}

export function writePreview(root, manifest, output, exportDossier) {
  const report=checkDelivery(root,manifest);if(!report.ok)throw new Error(report.errors.join('\n'));
  const dest=path.resolve(output);
  if(inside(root,dest)||inside(dest,root))throw new Error('PREVIEW_MUST_BE_SEPARATE');
  if(fs.existsSync(dest))throw new Error('PREVIEW_ALREADY_EXISTS: '+dest);
  // Validate ancestors before creating or copying; never write through a junction.
  let ancestor=dest;while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);
  if(fs.realpathSync(ancestor).toLowerCase()!==path.resolve(ancestor).toLowerCase())throw new Error('PREVIEW_SYMLINK_ANCESTOR');
  fs.mkdirSync(dest,{recursive:true});
  const issue=path.join(dest,'issue');fs.mkdirSync(issue);
  for(const f of manifest.delivery.files){if(f.role==='derived')continue;const target=path.join(issue,f.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(localPath(root,f.path),target);}
  if(manifest.delivery.files.some(f=>f.path==='dossier.html'))exportDossier(issue,path.join(issue,'dossier.html'));
  const previewCheck=checkDelivery(issue,manifest);if(!previewCheck.ok)throw new Error('PREVIEW_DEPENDENCIES_INVALID: '+previewCheck.errors.join('; '));
  const previewReport={...report,warnings:[...new Set([...report.warnings,...previewCheck.warnings])]};
  const issuePath=repositoryIssuePath(root);
  const files=manifest.delivery.files.map(f=>({path:issuePath+'/'+f.path,previewPath:'issue/'+f.path,role:f.role,bytes:fs.statSync(path.join(issue,f.path)).size,sha256:sha(fs.readFileSync(path.join(issue,f.path)))}));
  fs.writeFileSync(path.join(dest,'submission.json'),JSON.stringify({schema_version:1,scope:'Submission preview only; no Git or product acceptance',files,check:previewReport},null,2)+'\n');
  fs.writeFileSync(path.join(dest,'submission-files.txt'),files.map(f=>f.path).join('\n')+'\n');
  return {output:dest,files:files.length,report:previewReport};
}
