import fs from 'node:fs';
import path from 'node:path';
export function flags(argv,allowed){const result={};for(let i=0;i<argv.length;i+=2){const key=argv[i];if(!key?.startsWith('--')||!allowed.includes(key.slice(2))||argv[i+1]===undefined||argv[i+1].startsWith('--'))throw Error('参数必须为已知 --key value；路径使用引号。');result[key.slice(2)]=argv[i+1];}return result;}
export function readJSON(file){return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
export function writeNew(file,text){fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});fs.writeFileSync(file,text,{encoding:'utf8',flag:'wx'});}
export function stop(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
