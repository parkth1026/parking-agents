import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRadarData} from './contract.mjs';
import {flags,readJSON,writeNew,stop} from './io.mjs';
export function buildRadar(input,out){
  const data=validateRadarData(readJSON(input));
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  let template=fs.readFileSync(path.join(root,'assets/radar-template.html'),'utf8');
  const start='/*__RADAR_CONTRACT_BEGIN__*/',end='/*__RADAR_CONTRACT_END__*/';
  if(template.split(start).length!==2||template.split(end).length!==2)throw Error('模板契约边界不完整或重复。');
  const a=template.indexOf(start)+start.length,b=template.indexOf(end);
  template=template.slice(0,a)+'\n'+validateRadarData.toString()+'\nconst validate=validateRadarData;\n'+template.slice(b);
  const opening='<script type="application/json" id="initial-data">';
  if(template.split(opening).length!==2)throw Error('模板数据节点不完整或重复。');
  const c=template.indexOf(opening)+opening.length,d=template.indexOf('</script>',c);
  template=template.slice(0,c)+JSON.stringify(data,null,2).replace(/</g,'\\u003c')+template.slice(d);
  const files={json:path.resolve(out,'capabilities.json'),html:path.resolve(out,'能力雷达.html'),receipt:path.resolve(out,'build-receipt.json')};
  for(const p of Object.values(files))if(fs.existsSync(p))throw Error(`输出已存在，拒绝覆盖：${p}`);
  writeNew(files.json,JSON.stringify(data,null,2)+'\n');writeNew(files.html,template);
  const receipt={status:'BUILT_NOT_BROWSER_VERIFIED',capabilities:data.capabilities.length,domains:data.domains.length,files,sourceInput:path.resolve(input)};
  writeNew(files.receipt,JSON.stringify(receipt,null,2)+'\n');return receipt;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{const a=flags(process.argv.slice(2),['input','out']);if(!a.input||!a.out)throw Error('用法：node build-radar.mjs --input <json> --out <新目录>');console.log(JSON.stringify(buildRadar(a.input,a.out),null,2));}catch(error){stop(error);}
