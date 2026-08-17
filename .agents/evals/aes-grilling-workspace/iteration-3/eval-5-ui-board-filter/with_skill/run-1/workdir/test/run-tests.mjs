import assert from 'node:assert';

// 现有测试：任务数据形状
const task = { id: 1, title: 't', assignee: 'a', status: 'todo' };
assert.ok(['todo', 'doing', 'done'].includes(task.status));
assert.equal(typeof task.assignee, 'string');
console.log('ok - 2 assertions');
