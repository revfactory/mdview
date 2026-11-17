import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import React, { act } from 'react';
import domino from '@mixmark-io/domino';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, overrides = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const context = { exports: {}, require: name => name in overrides ? overrides[name] : require(name) };
  vm.runInNewContext(code, context);
  return context.exports;
}
const helpers = load('../src/lib/source-indentation.ts');
async function mounted(file, name, run) {
  const window = domino.createWindow('<!doctype html><html><body><div id="root"></div></body></html>');
  window.document.oninput = null;
  const previous = new Map(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { configurable: true, value });
  const changes = [];
  const storedSources = new Map();
  const { [name]: Component } = load(`../src/components/features/editor/${file}.tsx`, {
    '@/lib/source-indentation': helpers,
    '@/components/features/editor/editor': { Editor: () => null },
    '@/components/features/editor/page-navigator': { PageNavigator: () => null },
    '@/components/features/editor/save-conflict-notice': { SaveConflictNotice: () => null },
    '@/components/features/editor/page-load-error': { PageLoadError: () => null },
    '@/db/chunks': {}, '@/lib/document-save-queue': {},
    '@/lib/markdown': { markdownToHtml: value => value },
    '@/hooks/use-paginated-chunks': { usePaginatedChunks: id => ({
      currentPage: 0, chunkHtml: '', chunkMarkdown: storedSources.get(id) ?? 'Synthetic source', editorRef: { current: null }, conflictRaw: null,
      // Like the real hook, publish saved raw text on subsequent renders.
      handleChange: markdown => { changes.push(markdown); storedSources.set(id, markdown); },
      handleSourceInput: async markdown => { changes.push(markdown); storedSources.set(id, markdown); }, publishSourcePreview() {},
    }) },
  });
  const { createRoot } = require('react-dom/client');
  const container = window.document.getElementById('root');
  const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(React.Fragment, null,
      ...['one', 'two'].map(id => React.createElement(Component, { key: id, documentId: id, totalChunks: 1, content: 'Synthetic source', htmlContent: '', onSourceChange: markdown => changes.push(markdown) })))));
    const fields = Array.from(container.querySelectorAll('textarea'));
    for (const field of fields) {
      field.selectionStart = 0; field.selectionEnd = 0; field.selectionDirection = 'backward';
      // Domino does not implement native selection ranges or Tab focus movement.
      field.setSelectionRange = (start, end, direction) => { field.selectionStart = start; field.selectionEnd = end; field.selectionDirection = direction; };
    }
    const key = async (value, props = {}) => {
      const event = new window.Event('keydown', { bubbles: true, cancelable: true });
      for (const [key, val] of Object.entries({ key: value, ...props })) Object.defineProperty(event, key, { value: val });
      await act(async () => fields[0].dispatchEvent(event));
      return event.defaultPrevented;
    };
    await run({ container, fields, key, changes, blur: async () => { await act(async () => fields[0].dispatchEvent(new window.Event('focusout', { bubbles: true }))); } });
  } finally {
    await act(async () => root.unmount());
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
}
for (const [file, name] of [['source-editor', 'SourceEditor'], ['split-view', 'SplitView'], ['paginated-split-view', 'PaginatedSplitView']]) {
  test(`${name}: mounted React events release one Tab and blur resets the bypass`, async () => {
    await mounted(file, name, async ({ fields, key, changes, blur }) => {
      const original = fields[0].value;
      assert.equal(await key('Escape'), false);
      assert.equal(await key('Tab'), false);
      assert.equal(fields[0].value, original); assert.deepEqual(changes, []);
      await key('Escape'); await blur();
      assert.equal(await key('Tab'), true); assert.equal(changes.length, 1);
      assert.equal(fields[0].value, '  ' + original);
    });
  });
  test(`${name}: mounted IME Escape does not arm a navigation bypass`, async () => {
    await mounted(file, name, async ({ fields, key, changes }) => {
      const original = fields[0].value;
      assert.equal(await key('Escape', { isComposing: true }), false);
      assert.equal(await key('Tab', { isComposing: true }), false);
      assert.equal(await key('Tab', { keyCode: 229 }), false);
      assert.equal(fields[0].value, original); assert.deepEqual(changes, []);
      assert.equal(await key('Tab'), true); assert.equal(changes.length, 1);
    });
  });
  test(`${name}: real useId links each mounted textarea to its own visible keyboard hint`, async () => {
    await mounted(file, name, async ({ container, fields }) => {
      assert.equal(fields.length, 2);
      const ids = fields.map(field => field.getAttribute('aria-describedby'));
      assert.ok(ids.every(Boolean)); assert.notEqual(ids[0], ids[1]);
      for (const field of fields) {
        assert.equal(field.getAttribute('aria-label'), '마크다운 소스');
        const hint = Array.from(container.querySelectorAll('[id]')).find(el => el.id === field.getAttribute('aria-describedby'));
        assert.equal(hint.textContent, helpers.SOURCE_KEYBOARD_HELP); assert.equal(hint.closest('[hidden]'), null);
      }
    });
  });
}
