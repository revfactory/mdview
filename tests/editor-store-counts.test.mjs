import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

test('document selection clears previous counts, while reselecting the loaded document preserves them', () => {
  const source = readFileSync(new URL('../src/stores/editor-store.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: createRequire(import.meta.url) });
  const store = exports.useEditorStore;
  const { setActiveDocument, updateCounts } = store.getState().actions;
  const counts = () => [store.getState().wordCount, store.getState().charCount];
  setActiveDocument('first');
  updateCounts(410, 1758);
  setActiveDocument('first');
  assert.deepEqual(counts(), [410, 1758]);
  setActiveDocument('second');
  assert.deepEqual(counts(), [0, 0]);
  updateCounts(2, 9);
  setActiveDocument(null);
  assert.deepEqual(counts(), [0, 0]);
});
