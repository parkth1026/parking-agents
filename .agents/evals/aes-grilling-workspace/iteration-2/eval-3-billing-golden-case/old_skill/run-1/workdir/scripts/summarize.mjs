// 目前只是透传打印，汇总逻辑还没写
import { readFileSync } from 'node:fs';
console.log(readFileSync(process.argv[2], 'utf8'));
