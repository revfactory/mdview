import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Keep the repository's uses-first checkout step format explicit. Semantic YAML
// validation and real Actions runs complement this small regression contract.
for (const name of ['ci', 'codeql', 'release']) {
  test(`${name} checkouts do not persist authentication for later steps`, async () => {
    const source = await readFile(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
    const lines = source.split(/\r?\n/);
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^( *)- uses: actions\/checkout@\S+\s*$/);
      if (!match) continue;
      count++;
      const indent = match[1].length;
      let end = i + 1;
      while (end < lines.length && (!lines[end].trim() || lines[end].search(/\S/) > indent)) end++;
      const step = lines.slice(i + 1, end).join('\n');
      assert.match(step, new RegExp(`^ {${indent + 2}}with:\\s*$`, 'm'));
      assert.match(step, new RegExp(`^ {${indent + 4}}persist-credentials: false\\s*$`, 'm'));
    }
    assert.ok(count > 0, 'Expected at least one checkout step');
    assert.equal(count, (source.match(/uses:\s*actions\/checkout@/g) ?? []).length,
      'Update the checkout regression contract when the workflow step format changes');
  });
}
