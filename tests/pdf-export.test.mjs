import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

test('PDF cleanup handles synchronous afterprint, retries, failure and unmount', () => {
  const source = readFileSync(new URL('../src/components/features/import-export/pdf-export.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  let unmount, nodes = [], printAction;
  const listeners = new Set();
  const document = { title: 'Original', createElement() { return { style: {}, remove() { nodes = nodes.filter((node) => node !== this); } }; }, body: { prepend(node) { nodes.push(node); } } };
  const window = { onafterprint: null, addEventListener(type, fn) { listeners.add(fn); }, removeEventListener(type, fn) { listeners.delete(fn); }, print() { printAction(); } };
  const context = { exports: {}, document, window, setTimeout, clearTimeout, require() { return { useCallback: (fn) => fn, useEffect: (fn) => { unmount = fn(); }, useRef: () => ({ current: null }) }; } };
  vm.runInNewContext(js, context);
  const { exportPdf } = context.exports.usePdfExport({ documentTitle: 'Test document' });
  printAction = () => { assert.equal(document.title, 'Test document'); assert.equal(nodes.length, 1); for (const fn of listeners) fn(); };
  exportPdf(); assert.equal(document.title, 'Original'); assert.equal(nodes.length, 0); assert.equal(listeners.size, 0);
  exportPdf(); assert.equal(document.title, 'Original');
  printAction = () => {}; exportPdf(); exportPdf(); assert.equal(nodes.length, 1); assert.equal(listeners.size, 1); for (const fn of listeners) fn();
  printAction = () => { throw Error('print failed'); }; assert.throws(exportPdf); assert.equal(document.title, 'Original'); assert.equal(nodes.length, 0);
  printAction = () => {}; exportPdf(); unmount(); assert.equal(document.title, 'Original'); assert.equal(nodes.length, 0);
});
