import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/features/import-export/hwp-import.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function render(isImporting) {
  let resets = 0, closed = 0;
  const imported = [];
  const react = { useState: initial => [initial, () => {}], useRef: current => ({ current }), useCallback: fn => fn };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  vm.runInNewContext(js, { exports, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/hooks/use-hwp') return { useHwpImport: () => ({ isImporting, reset: () => resets++, importFile: async file => { imported.push(file); throw new Error('synthetic failed file'); } }) };
    return {};
  } });
  const root = exports.HwpImport({ open: true, onClose: () => closed++, onImportComplete() {} });
  return { root, imported, counts: () => ({ resets, closed }) };
}
function findInput(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.map(findInput).find(Boolean);
  if (node.type === 'input') return node;
  return findInput(node.props?.children);
}

test('closing the HWP dialog while importing calls reset and closes', () => {
  const { root, counts } = render(true);
  root.props.onClose();
  assert.deepEqual(counts(), { resets: 1, closed: 1 });
});

test('file selection clears input so the same failed file can be selected again', async () => {
  const { root, imported } = render(false);
  const input = findInput(root); assert.ok(input);
  const file = { name: '합성.hwpx' };
  const target = { files: [file], value: '합성.hwpx' };
  input.props.onChange({ target });
  assert.equal(target.value, '');
  target.value = '합성.hwpx';
  input.props.onChange({ target });
  assert.equal(target.value, '');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(imported.length, 2); assert.equal(imported[0], file); assert.equal(imported[1], file);
});
