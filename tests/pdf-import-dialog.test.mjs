import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/components/features/import-export/pdf-import.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const result = { markdown: '합성 본문', warnings: [], metadata: { title: '합성 제목', pageCount: 1, parsedPageCount: 1 } };
function setup({ busy = false, parse = async () => result, save = async () => {} } = {}) {
  let index = 0, resets = 0, closed = 0;
  const values = [], refs = [], imported = [];
  const react = {
    useState(initial) { const i = index++; if (!(i in values)) values[i] = initial; return [values[i], v => { values[i] = v; }]; },
    useRef(initial) { const i = index++; return refs[i] ??= { current: initial }; },
    useCallback: fn => fn, useEffect() {},
  };
  const jsx = (type, props) => ({ type, props }); const exports = {};
  vm.runInNewContext(js, { exports, Error, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/lib/pdf-limits') return { PDF_MAX_FILE_BYTES: 25 * 1024 * 1024 };
    if (name === '@/hooks/use-pdf') return { usePdfImport: () => ({ isImporting: busy, reset: () => resets++, importFile: file => { imported.push(file); return parse(file); } }) };
    return {};
  } });
  return { render() { index = 0; return exports.PdfImport({ open: true, onClose: () => closed++, onImportComplete: save }); }, imported, values, counts: () => ({ resets, closed }) };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.map(n => find(n, predicate)).find(Boolean);
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const file = { name: '합성.pdf', size: 100 };
function select(root, selected = file) { const target = { files: [selected], value: selected.name }; find(root, n => n.type === 'input').props.onChange({ target }); return target; }

test('busy dialog close cancels and closes', () => {
  const ui = setup({ busy: true }); ui.render().props.onClose();
  assert.deepEqual(ui.counts(), { resets: 1, closed: 1 });
});
test('same file can be reselected and oversized input never starts parser', async () => {
  const ui = setup({ parse: async () => { throw new Error('read failed'); } });
  assert.equal(select(ui.render()).value, ''); await flush();
  assert.equal(select(ui.render()).value, ''); await flush();
  select(ui.render(), { ...file, size: 26 * 1024 * 1024 }); await flush();
  assert.equal(ui.imported.length, 2); assert.ok(ui.values.includes('PDF는 25MB 이하만 가져올 수 있습니다.'));
});
test('late parse completion after close cannot restore discarded result', async () => {
  let resolve; const ui = setup({ parse: () => new Promise(r => { resolve = r; }) });
  select(ui.render()); ui.render().props.onClose(); resolve(result); await flush();
  assert.equal(find(ui.render(), n => n.props?.children === '문서 만들기'), undefined);
});
test('save is awaited; double confirm and close are blocked; failures retain result for retry', async () => {
  let reject, calls = 0;
  const ui = setup({ save: () => { calls++; return new Promise((_, r) => { reject = r; }); } });
  select(ui.render()); await flush();
  const confirm = find(ui.render(), n => n.props?.children === '문서 만들기'); assert.ok(confirm);
  const pending = confirm.props.onClick(); await confirm.props.onClick(); ui.render().props.onClose();
  assert.equal(calls, 1); assert.equal(ui.counts().closed, 0);
  reject(new Error('storage full')); await pending;
  assert.ok(find(ui.render(), n => n.props?.role === 'alert'));
  assert.ok(find(ui.render(), n => n.props?.children === '문서 만들기'));
});
test('successful save closes once and resets state for reopen', async () => {
  const ui = setup(); select(ui.render()); await flush();
  await find(ui.render(), n => n.props?.children === '문서 만들기').props.onClick();
  assert.equal(ui.counts().closed, 1); assert.ok(find(ui.render(), n => n.type === 'input'));
});
