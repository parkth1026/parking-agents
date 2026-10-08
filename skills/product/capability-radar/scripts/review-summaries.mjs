import path from 'node:path';
import {readJSON,stop} from './io.mjs';
const checks=[
 {type:'productization',source:/未产品化|尚未产品化/,summary:/未产品化|尚未产品化|未对外产品化/,reason:'完整限制含未产品化，主图摘要没有表达'},
 {type:'internal-only',source:/仅内部|只在内部|仅供内部|内部使用/,summary:/内部/,reason:'完整限制含内部使用范围，主图摘要没有表达'},
 {type:'generalization',source:/不能承诺泛化|泛化.{0,6}未|未.{0,6}泛化/,summary:/泛化/,reason:'完整限制含泛化未证明或未承诺，主图摘要没有表达'}
];
export function reviewSummaries(data){
 return (data.capabilities||[]).flatMap(c=>{
  const findings=checks.filter(check=>check.source.test(c.limits||'')&&!check.summary.test(c.summary||'')).map(check=>({id:c.id,name:c.name,type:check.type,reason:check.reason,limits:c.limits,summary:c.summary||''}));
  if(/未证|未验证|未实测|待验证|不能承诺/.test(c.limits||'')&&/不能做到|无法实现|不可能|不能泛化|无法泛化/.test(c.summary||''))findings.push({id:c.id,name:c.name,type:'predicate-strength',reason:'原限制含未证或未承诺，摘要出现不能或无法；核对是否加强了否定',limits:c.limits,summary:c.summary});
  return findings;
 });
}
if(process.argv[1]&&path.basename(process.argv[1])==='review-summaries.mjs')try{
 if(process.argv.length!==3)throw Error('用法：node review-summaries.mjs <capabilities.json>');
 const findings=reviewSummaries(readJSON(process.argv[2]));console.log(JSON.stringify({status:findings.length?'NEEDS_REVIEW':'NO_PATTERN_FINDINGS',scope:'有限词形的遗漏提示；仍须逐项与原文做语义核对',findings},null,2));
 if(findings.length)process.exitCode=2;
}catch(error){stop(error);}
