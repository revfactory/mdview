import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { Marked } from 'marked';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/lib/marked-extensions.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const exports = {};
vm.runInNewContext(js, { exports, require });
const parser = new Marked(exports.markedMathExtension());

test('math extension renders inline and display formulas while retaining editable LaTeX', () => {
  const inline = parser.parse('수식 $x^2 + \\frac{1}{2}$ 입니다.');
  assert.match(inline, /class="math-inline"/);
  assert.match(inline, /data-math="x\^2 \+ \\frac\{1\}\{2\}"/);
  assert.match(inline, /class="katex"/);
  const block = parser.parse('$$\\sum_{i=1}^{n} i$$');
  assert.match(block, /class="math-block"/);
  assert.match(block, /katex-display/);
});

test('invalid formulas remain visible and untrusted math does not create active links', () => {
  const invalid = parser.parse('$\\unknowncommand{x}$');
  assert.match(invalid, /unknowncommand/);
  assert.match(invalid, /class="math-inline"/);
  const untrusted = parser.parse('$\\href{javascript:alert(1)}{link}$');
  assert.doesNotMatch(untrusted, /<a\b/);
});
