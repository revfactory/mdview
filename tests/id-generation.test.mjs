import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nanoid } from 'nanoid';

test('document and block identifiers retain URL-safe lengths and distinct values', () => {
  for (const size of [10, 21]) {
    const values = Array.from({ length: 1000 }, () => nanoid(size));
    assert.equal(new Set(values).size, values.length);
    for (const value of values) assert.match(value, new RegExp(`^[A-Za-z0-9_-]{${size}}$`));
  }
});
