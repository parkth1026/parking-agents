import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const run=input=>spawnSync(process.execPath,['src/cli.mjs'],{input,encoding:'utf8'});
test('CLI无末尾换行和Unicode',()=>{const r=run('[" 张三 ","","李四","张三"]');assert.equal(r.status,0);assert.equal(r.stdout,'["张三","李四"]\n');assert.equal(r.stderr,'');});
test('CLI非法输入',()=>{for(const input of ['{','[1]','null']){const r=run(input);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.ok(r.stderr.trim());}});
