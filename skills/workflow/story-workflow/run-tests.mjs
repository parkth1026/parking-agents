#!/usr/bin/env node
// 静态分发回归：校验实际引用与评测可追溯性，不替代模型行为或真实Story验收。
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const skill = read('SKILL.md');
const routing = read('references/matt-routing.md');
const design = read('references/design.md');
let count = 0;
function check(name, fn) { fn(); count++; console.log(`ok ${name}`); }

check('入口名称与目录一致', () => {
  assert.match(skill, /^---\r?\nname: story-workflow\r?\n/);
});
check('入口的本地文档引用均可恢复', () => {
  for (const match of skill.matchAll(/\]\((references\/[^)]+)\)/g)) {
    assert.ok(existsSync(resolve(root, match[1])), match[1]);
  }
});
check('复用表中的matt依赖实际存在', () => {
  let ancestor = root;
  while (!existsSync(resolve(ancestor, 'skills/matt-skills'))) {
    const parent = dirname(ancestor);
    assert.notEqual(parent, ancestor, '未找到matt-skills源码；请在技能源码仓运行分发检查');
    ancestor = parent;
  }
  for (const match of routing.matchAll(/(?:engineering|productivity)\/[\w-]+\/SKILL\.md/g)) {
    assert.ok(existsSync(resolve(ancestor, 'skills/matt-skills', match[0])), match[0]);
  }
});
check('行为用例身份唯一且所有判据指向真实设计依据', () => {
  const { evals } = JSON.parse(read('output-evals.json'));
  assert.equal(new Set(evals.map(item => item.name ?? item.id)).size, evals.length);
  for (const item of evals) {
    assert.ok(item.prompt.length > 0 && item.assertions.length > 0, item.id);
    for (const assertion of item.assertions) {
      assert.ok(design.includes(`| ${assertion.ac} |`), assertion.ac);
    }
  }
});
check('评测历史采用Creator可续接的runs结构', () => {
  const history = JSON.parse(read('history.json'));
  assert.equal(history.skill, 'story-workflow');
  assert.ok(Array.isArray(history.runs) && history.runs.length > 0);
  for (const run of history.runs) {
    assert.ok(run.iteration_ref && run.gates);
  }
});
check('名字触发题库覆盖正反例且ID唯一', () => {
  const bank = JSON.parse(read('trigger-evals.json'));
  assert.equal(bank.skill, 'story-workflow');
  assert.equal(new Set(bank.queries.map(q => q.id)).size, bank.queries.length);
  assert.ok(bank.queries.some(q => q.should_trigger === true));
  assert.ok(bank.queries.some(q => q.should_trigger === false));
});
console.log(`${count} static checks passed; model behavior is recorded separately in history.json.`);
