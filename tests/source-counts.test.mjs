import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/source-counts.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(js, { exports });
const count = value => JSON.parse(JSON.stringify(exports.countSourceText(value)));

test('source counts empty and whitespace-only input', () => {
  assert.deepEqual(count(''), {characters: 0, words: 0});
  assert.deepEqual(count(' \t\n'), {characters: 3, words: 0});
});
test('source counts Korean, ASCII, emoji and Markdown syntax without requiring a visual editor', () => {
  assert.deepEqual(count('안녕 world 😀'), {characters: 10, words: 3});
  assert.deepEqual(count('# 제목\n\n**hello**'), {characters: 15, words: 3});
});
test('large source updates and document switches do not retain prior counts', () => {
  assert.deepEqual(count('가 x\n'.repeat(15000)), {characters: 60000, words: 30000});
  assert.deepEqual(count('B'), {characters: 1, words: 1});
  assert.deepEqual(count(''), {characters: 0, words: 0});
});
test('status bar selects current source counts over stale visual counts and labels the convention', () => {
  const bar = readFileSync(new URL('../src/components/layout/status-bar.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  assert.match(bar, /sourceCounts\?\.characters \?\? editorCharCount/);
  assert.match(bar, /sourceCounts\?\.words \?\? editorWordCount/);
  assert.match(bar, /단어는 공백으로 구분합니다/);
  assert.match(page, /<StatusBar sourceContent=/);
});
