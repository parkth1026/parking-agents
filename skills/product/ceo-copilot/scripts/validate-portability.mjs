#!/usr/bin/env node
// Validate the skill's own runtime files. Design notes are explicitly excluded.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const skillRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function inside(root,relative){
  if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||path.win32.isAbsolute(relative)||relative.includes('\\'))throw Error(`Not a portable relative locator: ${relative}`);
  const target=path.resolve(root,relative),rel=path.relative(root,target);
  if(rel==='..'||rel.startsWith(`..${path.sep}`)||path.isAbsolute(rel))throw Error(`Locator escapes skill: ${relative}`);
  if(fs.existsSync(target)){
    const physical=path.relative(fs.realpathSync(root),fs.realpathSync(target));
    if(physical==='..'||physical.startsWith(`..${path.sep}`)||path.isAbsolute(physical))throw Error(`Locator resolves outside skill: ${relative}`);
  }
  return target;
}
export function inspectPackage(root=skillRoot){
  const failures=[],files=[];
  const walk=dir=>{
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const file=path.join(dir,ent.name);
      if(ent.isSymbolicLink()){failures.push(`Linked runtime resource: ${path.relative(root,file)}`);continue;}
      if(ent.isDirectory())walk(file);else if(ent.isFile())files.push(file);
    }
  };
  walk(root);
  let localLinks=0,sourceIdentifiers=0,runtimeFiles=0;
  const absolute=/(?<![A-Za-z0-9])[A-Za-z]:[\\/]|file:\/\/|(?:^|[\s"'(<])\\\\[A-Za-z0-9_.-]+\\|["'<`]\s*\/(?!\/)[A-Za-z0-9_.-]+\//m;
  const verify=(base,locator,label)=>{
    try{if(path.isAbsolute(locator)||path.win32.isAbsolute(locator))throw Error(`Nonrelative source locator: ${locator}`);const target=inside(root,path.relative(root,path.resolve(base,locator)).replaceAll('\\','/'));if(!fs.existsSync(target))failures.push(`Missing local target ${label}: ${locator}`);}
    catch(e){failures.push(`${label}: ${e.message}`);}
  };
  for(const file of files){
    const relative=path.relative(root,file).replaceAll('\\','/');
    if(relative==='references/design.md')continue;
    runtimeFiles++;
    const text=fs.readFileSync(file,'utf8');
    if(absolute.test(text))failures.push(`Absolute locator in ${relative}`);
    if(file.endsWith('.md')){
      for(const match of text.matchAll(/\[[^\]\n]*\]\((?:<([^>\n]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)){
        let locator=match[1]??match[2];
        if(/^(?:https?:|mailto:)/i.test(locator)){sourceIdentifiers++;continue;}
        if(locator.startsWith('#'))continue;
        locator=decodeURIComponent(locator.split('#')[0]).replace(/:\d+$/,'');
        if(path.isAbsolute(locator)||path.win32.isAbsolute(locator)||/^[a-z]+:/i.test(locator)){failures.push(`Nonrelative file link in ${relative}: ${locator}`);continue;}
        localLinks++;verify(path.dirname(file),locator,relative);
      }
      for(const m of text.matchAll(/^\s*url:\s*"?([^"\s]+)"?\s*$/gm)){
        if(/^https?:/i.test(m[1]))continue;
        localLinks++;verify(path.dirname(file),m[1],`${relative}: source metadata`);
      }
      if(relative==='SKILL.md')for(const m of text.matchAll(/`((?:references|scripts|agents)\/[^`]+)`/g))verify(root,m[1],relative);
    }
  }
  return {status:failures.length?'FAIL':'PASS',scope:'self_contained_runtime_package',runtime_files:runtimeFiles,design_exclusions:['references/design.md'],local_links:localLinks,external_urls:'bibliographic_identifiers_only_not_runtime_dependencies',source_identifiers:sourceIdentifiers,failures,semantic_verification:'NOT_CERTIFIED_BY_SCRIPT',decision_gain:'NOT_RUN'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=inspectPackage();console.log(JSON.stringify(result,null,2));process.exitCode=result.failures.length?1:0;
}
