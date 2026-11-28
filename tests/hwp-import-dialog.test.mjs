import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/features/import-export/hwp-import.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function render(isImporting, error = null) {
  let resets = 0, closed = 0, picks = 0;
  const imported = [];
  const react = { useState: initial => [initial, () => {}], useRef: current => ({ current: current === null ? { click: () => picks++ } : current }), useCallback: fn => fn, useEffect: () => {} };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  vm.runInNewContext(js, { exports, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/hooks/use-hwp') return { useHwpImport: () => ({ isImporting, error, reset: () => resets++, importFile: async file => { imported.push(file); throw new Error('synthetic failed file'); } }) };
    return {};
  } });
  const root = exports.HwpImport({ open: true, onClose: () => closed++, onImportComplete() {} });
  return { root, imported, counts: () => ({ resets, closed }), picks: () => picks };
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

function findPicker(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.map(findPicker).find(Boolean);
  if (node.props?.role === 'button') return node;
  return findPicker(node.props?.children);
}
for (const error of [null, '합성 변환 실패']) {
  test(`HWP picker is keyboard operable${error ? ' after failure' : ''}`, () => {
    const h = render(false, error), picker = findPicker(h.root);
    assert.ok(picker);
    assert.equal(picker.props.tabIndex, 0);
    assert.equal(picker.props['aria-label'], 'HWP/HWPX 파일 선택');
    assert.match(picker.props.className, /focus-visible:outline/);
    for (const key of ['Enter', ' ']) {
      let prevented = 0;
      picker.props.onKeyDown({ key, nativeEvent: {}, preventDefault: () => prevented++ });
      assert.equal(prevented, 1);
    }
    assert.equal(h.picks(), 2);
    for (const event of [{key:'Tab'}, {key:'Escape'}, {key:'Enter',repeat:true}, {key:'Enter',nativeEvent:{isComposing:true}}, {key:'Enter',keyCode:229}]) {
      picker.props.onKeyDown({nativeEvent: {}, ...event, preventDefault: () => assert.fail('unhandled keys must retain native behavior')});
    }
    assert.equal(h.picks(), 2);
    picker.props.onClick(); assert.equal(h.picks(), 3);
  });
}
test('processing HWP dialog exposes no active drop-zone picker', () => {
  assert.equal(findPicker(render(true).root), undefined);
});
