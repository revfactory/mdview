import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Vercel uses one region without requiring a paid multi-region plan', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.regions, ['icn1']);
  assert.equal(config.functionFailoverRegions, undefined);
});
