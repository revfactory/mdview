import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('the shared development Node version stays on the supported production LTS', () => {
  assert.equal(read('.nvmrc').trim(), '24');
});

// These workflows use named setup-node steps. Check every such step, rather
// than accepting one matching line while another job still installs Node 20.
for (const name of ['ci', 'release']) {
  test(`${name} uses the shared Node version for every install and build job`, () => {
    const source = read(`.github/workflows/${name}.yml`);
    const lines = source.split(/\r?\n/);
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^( *)uses: actions\/setup-node@\S+\s*$/);
      if (!match) continue;
      count++;
      const indent = match[1].length;
      let end = i + 1;
      while (end < lines.length && (!lines[end].trim() || lines[end].search(/\S/) >= indent)) end++;
      const step = lines.slice(i + 1, end).join('\n');
      assert.match(step, new RegExp(`^ {${indent + 2}}node-version-file: \\.nvmrc\\s*$`, 'm'));
      assert.doesNotMatch(step, /^\s*node-version:/m);
    }
    assert.equal(count, name === 'ci' ? 3 : 1);
    assert.equal(count, (source.match(/uses:\s*actions\/setup-node@/g) ?? []).length,
      'Update this regression contract if setup-node step formatting changes');
  });
}

for (const path of ['README.md', 'README.en.md', 'CONTRIBUTING.md']) {
  test(`${path} recommends the shared supported Node LTS`, () => {
    const source = read(path);
    assert.match(source, /Node\.js 24 LTS/);
    assert.match(source, /`\.nvmrc`/);
    assert.doesNotMatch(source, /Node\.js 20 LTS/);
  });
}
