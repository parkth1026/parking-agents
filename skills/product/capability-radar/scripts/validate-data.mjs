import {validateRadarData} from './contract.mjs';
import {readJSON,stop} from './io.mjs';
try{if(process.argv.length!==3)throw Error('用法：node validate-data.mjs <capabilities.json>');const data=validateRadarData(readJSON(process.argv[2]));console.log(JSON.stringify({status:'PASS',capabilities:data.capabilities.length,domains:data.domains.length,scope:'数据契约，不代表技术证据核验'},null,2));}catch(error){stop(error);}
