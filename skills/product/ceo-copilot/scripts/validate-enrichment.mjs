#!/usr/bin/env node
// Offline structural provenance checks; no external raw or report directory is needed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {skillRoot as skill,inside,inspectPackage} from './validate-portability.mjs';

const wiki=inside(skill,'references/wiki');
const read=p=>fs.readFileSync(p,'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceMap=JSON.parse(read(inside(skill,'references/wiki/enrichment/source-map.json')));
const failures=[...inspectPackage().failures],warnings=[];
const check=(yes,message)=>{if(!yes)failures.push(message);};
const guard=(f,label)=>{try{return f();}catch(e){failures.push(`${label}: ${e.message}`);return null;}};
check(process.argv.slice(2).length===0,'External source overrides are not supported; validate the bundled evidence.');
check(sourceMap.schema_version===2&&sourceMap.path_base==='skill_root','portable source schema required');
const reportText=guard(()=>{
  const buf=fs.readFileSync(inside(skill,sourceMap.report.path));
  check(hash(buf)===sourceMap.report.sha256,'bundled report hash changed');return buf.toString('utf8');
},'report');
guard(()=>{
  const coverage=JSON.parse(read(inside(skill,'references/wiki/coverage-manifest.json')));
  check(hash(fs.readFileSync(inside(skill,coverage.source.path)))===coverage.source.sha256,'historical report HTML changed');
  check(hash(fs.readFileSync(inside(skill,coverage.source.text_path)))===coverage.source.text_sha256,'historical report text changed');
},'historical report');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const markdown=walk(wiki).filter(f=>f.endsWith('.md'));
const names=new Map();
for(const f of markdown){const name=path.basename(f,'.md');check(!names.has(name),`duplicate wiki title ${name}`);names.set(name,f);}
const index=read(path.join(wiki,'index.md'));
for(const f of markdown){
  const t=read(f),name=path.basename(f,'.md');
  if(!['index','log','SCHEMA'].includes(name))check(index.includes(`[[${name}]]`),`unindexed page ${name}`);
  const live=t.replace(/`[^`\n]+`/g,'');
  for(const m of live.matchAll(/\[\[([^\]#|]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g))check(names.has(m[1]),`broken link ${name} -> ${m[1]}`);
}
const ids=new Set(),caseIds=new Set();let theoryCount=0,actionCount=0,sourceCount=0,anchorCount=0;
for(const b of sourceMap.books){
  check(!ids.has(b.id),`duplicate book ${b.id}`);ids.add(b.id);
  guard(()=>{
    const evidenceDir=inside(skill,`${sourceMap.evidence_root}/${b.evidence_dir}`);
    const manifestFile=inside(skill,path.relative(skill,path.join(evidenceDir,'manifest.json')).replaceAll('\\','/'));
    check(hash(fs.readFileSync(manifestFile))===b.manifest_sha256,`${b.id} bundled manifest changed`);
    const manifest=JSON.parse(read(manifestFile));
    check(manifest.book_id===b.id&&manifest.origin_manifest_sha256===b.origin_manifest_sha256,`${b.id} manifest identity changed`);
    const pageFile=inside(skill,`references/wiki/${b.wiki}`),t=read(pageFile);
    check(hash(t)===b.wiki_sha256,`${b.id} wiki hash changed; review and update source map`);
    check(t.split(/\r?\n/).length<=200,`${b.id} page exceeds 200 lines`);
    const sourceIds=new Set(b.sources.map(s=>s.id));
    check(sourceIds.size===b.sources.length,`${b.id} duplicate source ID`);
    for(const s of b.sources){
      sourceCount++;
      const section=manifest.sections.find(x=>x.file===s.file);
      check(Boolean(section),`${b.id}/${s.file} absent from bundled manifest`);
      const file=inside(skill,`${sourceMap.evidence_root}/${b.evidence_dir}/${s.file}`),buf=fs.readFileSync(file),evidence=JSON.parse(buf);
      check(hash(buf)===s.sha256&&section?.sha256===s.sha256,`${b.id}/${s.file} bundled source hash changed`);
      check(evidence.book_id===b.id&&evidence.source_id===s.id&&evidence.original_file===s.original_file&&evidence.origin_file_sha256===s.origin_file_sha256,`${b.id}/${s.id} evidence identity changed`);
      const blocks=new Map(evidence.pages.map(p=>[p.page,p.text]));
      check(blocks.size===evidence.pages.length&&blocks.size===s.pages.length,`${b.id}/${s.id} duplicate or unexpected pages`);
      const selected=s.pages.map(n=>{anchorCount++;check(blocks.has(n),`${b.id}/${s.file} missing p.${n}`);return blocks.get(n)??'';});
      check(s.page_hashes.length===s.pages.length,`${b.id}/${s.id} page hash inventory incomplete`);
      for(const p of s.page_hashes)check(blocks.has(p.page)&&hash(blocks.get(p.page))===p.sha256&&evidence.pages.find(x=>x.page===p.page)?.sha256===p.sha256,`${b.id}/${s.file} page text changed p.${p.page}`);
      if(s.witness&&!selected.join('\n').normalize('NFKC').toLowerCase().includes(s.witness.normalize('NFKC').toLowerCase()))warnings.push(`${b.id}/${s.id}: witness absent from selected pages (${s.witness})`);
      const link=path.relative(path.dirname(pageFile),file).replaceAll('\\','/');
      const footnote=new RegExp(`^\\[\\^${s.id}\\]:.*$`,'m').exec(t)?.[0]??'';
      check(footnote.includes(`(<${link}>)`),`${b.id}/${s.id} bundled citation mismatches registry`);
    }
    for(const m of t.matchAll(/\[\^(s\d+)\]/g))check(sourceIds.has(m[1]),`${b.id} undefined citation ${m[1]}`);
    const historical=read(inside(skill,`references/wiki/${b.book_page}`));
    for(const v of b.theories){
      theoryCount++;check(t.includes(v.id),`${v.id} missing from supplement`);
      check(v.refs.length>0&&v.refs.every(r=>sourceIds.has(r)),`${v.id} missing source`);
      if(reportText)check(reportText.split(/\r?\n/)[v.line-1]?.includes(v.name),`${v.id} report line drift`);
    }
    for(const v of b.actions){actionCount++;check(historical.includes(v.id),`${v.id} lost from legacy book page`);}
    for(const c of b.cases){check(t.includes(c.title),`${b.id} missing case ${c.title}`);check(c.refs.length&&c.refs.every(r=>sourceIds.has(r)),`${b.id} case source missing`);caseIds.add(`${b.id}/${c.title}`);}
  },b.id);
}
check(ids.size===26&&Array.from({length:26},(_,i)=>`B${String(i).padStart(2,'0')}`).every(id=>ids.has(id)),'report book roster incomplete');
check(theoryCount===113,'report theory inventory incomplete');
check(actionCount===104,'report application inventory incomplete');
const result={status:failures.length?'FAIL':'PASS',scope:'bundled_structural_provenance',books:ids.size,theories:theoryCount,report_actions_preserved:actionCount,representative_cases:caseIds.size,bundled_source_files:sourceCount,page_anchors:anchorCount,wiki_pages:markdown.length-3,failures,warnings,origin_raw_files:'hash identifiers retained; external files not read',semantic_verification:'NOT_CERTIFIED_BY_SCRIPT',decision_gain:'NOT_RUN'};
console.log(JSON.stringify(result,null,2));process.exitCode=failures.length?1:0;
