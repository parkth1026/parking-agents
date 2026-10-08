import path from 'node:path';
import {flags,readJSON,stop} from './io.mjs';
export function verifyProvenance(data,extracted){
 const sources=new Map((extracted.sources||[]).map(s=>[s.id,s])),findings=[];
 const metas=new Map((data.sources||[]).map(s=>[s.id,s]));
 for(const c of data.capabilities||[]){
  if(!c.sourceRefs?.length){findings.push({id:c.id,reason:'能力没有来源引用'});continue;}
  for(const ref of c.sourceRefs){
   const source=sources.get(ref.source);
   if(!source){findings.push({id:c.id,reason:'来源不在提取记录中',ref});continue;}
   if(metas.get(source.id)?.sha256!==source.sha256)findings.push({id:c.id,reason:'来源 hash 与提取记录不一致',ref});
   const located=[];
   const locator=ref.locator.split(' / ')[0];
   for(const line of source.lines||[])if(line.locator===locator)located.push(line.text);
   if(!source.lines&&source.text&&/^line:\d+$/.test(locator)){const i=Number(locator.slice(5))-1;const lines=source.text.split(/\r?\n/);if(i>=0&&i<lines.length)located.push(lines[i]);}
   for(const table of source.tables||[])for(const row of table.rows||[]){
    if(row.locator===locator)located.push(row.values.join(' | '));
    for(let i=0;i<(row.cells||[]).length;i++)if(`${table.name}!${row.cells[i]}`===locator)located.push(row.values[i]);
   }
   if(source.data&&locator==='$')located.push(JSON.stringify(source.data));
   if(!located.length){findings.push({id:c.id,reason:'来源定位不存在或该格式定位尚未验证',ref});continue;}
   if(typeof ref.quote!=='string'||!ref.quote.trim()){findings.push({id:c.id,reason:'来源缺少可核对原文片段 quote',ref});continue;}
   if(!located.some(text=>text.includes(ref.quote)))findings.push({id:c.id,reason:'原文片段与指定定位不匹配',ref});
  }
 }
 return findings;
}
if(process.argv[1]&&path.basename(process.argv[1])==='verify-provenance.mjs')try{
 const a=flags(process.argv.slice(2),['data','extracted']);if(!a.data||!a.extracted)throw Error('用法：node verify-provenance.mjs --data <capabilities.json> --extracted <extracted.json>');
 const findings=verifyProvenance(readJSON(a.data),readJSON(a.extracted));console.log(JSON.stringify({status:findings.length?'NEEDS_REVIEW':'PASS',scope:'来源 hash、定位与原文片段匹配；不证明完整语义支持或技术事实',findings},null,2));if(findings.length)process.exitCode=2;
}catch(error){stop(error);}
