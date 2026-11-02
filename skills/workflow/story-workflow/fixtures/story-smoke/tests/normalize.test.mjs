import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNames } from '../src/normalize.mjs';
test('顺序/去重/空白/大小写', () => assert.deepEqual(normalizeNames([' Bob ', '', 'Alice', 'Bob', '  ', 'bob']), ['Bob','Alice','bob']));
test('空数组与Unicode', () => { assert.deepEqual(normalizeNames([]),[]); assert.deepEqual(normalizeNames([' 张三 ','李四','张三']),['张三','李四']); });
test('非法输入', () => { for(const value of [null, {}, 'Bob', ['Bob',3]]) assert.throws(()=>normalizeNames(value),TypeError); });
