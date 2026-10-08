import path from 'node:path';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {flags,readJSON,writeNew,stop} from './io.mjs';
const aliases={name:['能力单元','能力名称','能力','name','capability'],group:['能力域','组','能力层','领域','group','domain'],status:['三档分类','能力状态','状态','status'],id:['#','编号','能力ID','id'],input:['输入数据源','输入','input'],output:['产出结果','产出','output'],proof:['证据与数字（出处）','证据与数字(出处)','验证记录','证据','proof'],evidence:['证据档','证据等级','evidence'],limits:['限制/注','限制','边界','limits'],scenarios:['覆盖应用场景','应用场景','scenarios'],shortLabel:['图上简称','图上短说明','shortLabel'],summary:['图上限制摘要','限制摘要','summary']};
const mappedStatuses=new Map([['已具备','已具备'],['现在已经能做到','已具备'],['当前已实现','已具备'],['确定能做到','确定能做到'],['未来肯定能做到','确定能做到'],['确定可实现','确定能做到'],['可能做到','可能做到'],['未来可能可以做到','可能做到']]);
const outside=new Set(['不具备','不能做到','范围外','不在范围','暂不投入','已放弃']);
const clean=v=>String(v??'').trim().replace(/^\*\*(.*)\*\*$/,'$1');
export function convert(extracted,{title='技术能力雷达',date,center='能力范围'}={}){
 const report={status:'DRAFT_REQUIRES_REVIEW',included:[],pending:[],excluded:[],ignoredTables:[],warnings:[],readFailures:extracted.failures||[]};
 const candidates=[];
 for(const source of extracted.sources||[])for(const table of source.tables||[]){
  let indices=null;
  for(const row of table.rows||[]){
   const headers=row.values.map(clean);
   const found={};for(const [key,names] of Object.entries(aliases)){const ix=headers.findIndex(h=>names.includes(h));if(ix>=0)found[key]=ix;}
   if(found.name!==undefined&&(found.status!==undefined||found.group!==undefined)){indices=found;continue;}
   if(!indices)continue;
   const c={};for(const [key,ix] of Object.entries(indices))c[key]=clean(row.values[ix]);
   if(!c.name)continue;
   const ref={source:source.id,locator:row.locator,quote:c.name};
   const rawStatus=c.status, rawId=c.id;
   c.id=rawId||'CAP-'+createHash('sha256').update(c.group+'\0'+c.name).digest('hex').slice(0,10);
   c.sourceRefs=[ref];
   const record={id:c.id,name:c.name,sourceRefs:[ref],rawStatus};
   if(outside.has(rawStatus)){report.excluded.push({...record,reason:rawStatus});continue;}
   const reasons=[];
   if(!mappedStatuses.has(rawStatus))reasons.push('状态缺失或不在明确映射词表中');
   if(!c.group)reasons.push('能力域缺失');
   if(c.shortLabel&&Array.from(c.shortLabel).length>20)reasons.push('图上短说明超过 20 字');
   if(!c.shortLabel&&Array.from(c.name).length>20)reasons.push('完整名称过长，需人工编写 shortLabel');
   if(c.summary&&Array.from(c.summary).length>32)reasons.push('限制摘要超过 32 字');
   if(reasons.length){report.pending.push({...record,reasons,raw:c});continue;}
   c.status=mappedStatuses.get(rawStatus);c.shortLabel=c.shortLabel||c.name;
   if(!c.summary&&c.limits){if(Array.from(c.limits).length<=32)c.summary=c.limits;else report.warnings.push({id:c.id,reason:'完整限制过长；需人工编写 summary，关键限制仍须在主图显示'});}
   const formulas=(table.formulas||[]).filter(f=>row.cells?.includes(f.cell));
   if(formulas.length)report.warnings.push({id:c.id,reason:'该行包含未重算公式缓存值；用于能力分类前核实',formulas});
   candidates.push(c);report.included.push({...record,mappedStatus:c.status});
  }
  if(!indices)report.ignoredTables.push({source:source.id,table:table.name,reason:'没有识别到能力表头；保留为背景材料，由 Agent 判读'});
 }
 const duplicateIds=new Set(candidates.filter((c,i)=>candidates.findIndex(x=>String(x.id)===String(c.id))!==i).map(c=>String(c.id)));
 const duplicateNames=new Set(candidates.filter((c,i)=>candidates.findIndex(x=>x.group===c.group&&x.name===c.name)!==i).map(c=>c.group+'\0'+c.name));
 const capabilities=candidates.filter(c=>{
  if(!duplicateIds.has(String(c.id))&&!duplicateNames.has(c.group+'\0'+c.name))return true;
  report.pending.push({id:c.id,name:c.name,sourceRefs:c.sourceRefs,raw:c,reasons:['重复编号或同名能力；核对是否冲突后显式合并']});return false;
 });
 const includedIds=new Set(capabilities.map(c=>String(c.id)));report.included=report.included.filter(r=>includedIds.has(String(r.id)));
 report.warnings.push(...(extracted.sources||[]).flatMap(s=>(s.warnings||[]).map(reason=>({source:s.id,reason}))),...report.readFailures.map(f=>({reason:'输入读取失败',...f})));
 const domains=[...new Set(capabilities.map(c=>c.group))];
 const data={schemaVersion:1,title,centerLabel:center,...(date?{date}:{}),domains,subtitle:'能力与关键限制直接入图',note:`工作稿；仅沿用明确分类，未独立复验技术证据。待核对 ${report.pending.length} 项；摘要或输入警告 ${report.warnings.length} 项。`,sources:(extracted.sources||[]).map(({id,name,sha256,kind})=>({id,name,sha256,kind})),capabilities};
 report.counts={included:capabilities.length,pending:report.pending.length,excluded:report.excluded.length,ignoredTables:report.ignoredTables.length,warnings:report.warnings.length};
 return {data,report};
}
if(process.argv[1]&&path.basename(process.argv[1])==='convert-tables.mjs')try{
 const a=flags(process.argv.slice(2),['input','out','title','date','center']);if(!a.input||!a.out)throw Error('用法：node convert-tables.mjs --input <extracted.json> --out <新目录> [--title <标题>] [--date YYYY-MM-DD] [--center <简称>]');
 const paths=[path.resolve(a.out,'capabilities.draft.json'),path.resolve(a.out,'conversion-report.json')];
 for(const p of paths)if(fs.existsSync(p))throw Error(`输出已存在，拒绝覆盖：${p}`);
 const result=convert(readJSON(a.input),a);writeNew(paths[0],JSON.stringify(result.data,null,2)+'\n');writeNew(paths[1],JSON.stringify(result.report,null,2)+'\n');
 console.log(JSON.stringify({status:result.report.status,...result.report.counts,files:paths},null,2));
}catch(error){stop(error);}
