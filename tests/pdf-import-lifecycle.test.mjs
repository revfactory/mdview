import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/features/import-export/pdf-import.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup({ opening, excerpt, destroyRejects = false } = {}) {
  let unmount, destroyed = 0, opened = 0, imported = 0;
  const loading = deferred();
  const task = { promise: loading.promise, destroy() { destroyed++; return destroyRejects ? Promise.reject(new Error('cleanup failed')) : Promise.resolve(); } };
  const react = { useState: initial => [initial, () => {}], useRef: current => ({ current }), useCallback: fn => fn, useEffect: fn => { unmount = fn(); } };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  vm.runInNewContext(js, { exports, Error, Promise, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/lib/pdf-file') return { validatePdfFileMeta: () => null, hasPdfHeader: () => true, pdfTitleFromFileName: () => 'test', formatFileSize: () => '1 KB' };
    if (name === '@/lib/pdfjs') return { openPdfDocument: async () => { opened++; return opening ? opening.promise : task; }, readPdfExcerpt: async () => excerpt ? excerpt.promise : 'text', describePdfError: () => 'error' };
    return {};
  } });
  const root = exports.PdfImport({ open: true, onClose() {}, onImportComplete: async () => { imported++; } });
  function find(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.map(find).find(Boolean); return node.type === 'input' ? node : find(node.props?.children); }
  const input = find(root);
  const file = { name: 'test.pdf', size: 10, slice: () => ({ arrayBuffer: async () => new ArrayBuffer(1) }), arrayBuffer: async () => new ArrayBuffer(1) };
  return { start: (f = file) => input.props.onChange({ target: { files: [f], value: 'test.pdf' } }), close: root.props.onClose, unmount: () => unmount(), counts: () => ({ destroyed, opened, imported }), loading, task, file };
}

test('closing a pending PDF load destroys immediately and ignores late completion', async () => {
  const h = setup(); h.start(); await flush(); h.close();
  assert.equal(h.counts().destroyed, 1);
  h.loading.resolve({ numPages: 1 }); await flush();
  assert.deepEqual(h.counts(), { destroyed: 1, opened: 1, imported: 0 });
});
test('unmount cancels excerpt work and consumes rejected destroy promises', async () => {
  const excerpt = deferred(); const h = setup({ excerpt, destroyRejects: true });
  h.start(); await flush(); h.loading.resolve({ numPages: 1 }); await flush(); h.unmount();
  assert.equal(h.counts().destroyed, 1); excerpt.resolve('late'); await flush();
  assert.equal(h.counts().imported, 0);
});
test('task created after close is immediately destroyed without importing', async () => {
  const opening = deferred(); const h = setup({ opening }); h.start(); await flush(); h.close();
  opening.resolve(h.task); await flush();
  assert.deepEqual(h.counts(), { destroyed: 1, opened: 1, imported: 0 });
});
test('closing during file read does not start PDF loading', async () => {
  const reading = deferred(); const h = setup(); h.start({ ...h.file, arrayBuffer: () => reading.promise }); await flush(); h.close();
  reading.resolve(new ArrayBuffer(1)); await flush();
  assert.equal(h.counts().opened, 0);
});
test('successful import commits once and disposes once', async () => {
  const h = setup(); h.start(); await flush(); h.loading.resolve({ numPages: 1 }); await flush();
  assert.deepEqual(h.counts(), { destroyed: 1, opened: 1, imported: 1 });
});
