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
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const context = { exports: {}, require: name => name in overrides ? overrides[name] : require(name),
    get document() { return globalThis.document; }, get window() { return globalThis.window; },
  };
  vm.runInNewContext(code, context);
  return context.exports;
}
const fixtures = [
  { id: 'beta', title: 'Beta', folderId: null, excerpt: 'Root preview' },
  { id: 'alpha', title: 'Alpha', folderId: 'parent', excerpt: '한글 검색어' },
  { id: 'gamma', title: 'Gamma', folderId: 'child', excerpt: 'Nested preview' },
].map(doc => ({ ...doc, updatedAt: new Date('2026-11-15'), isFavorite: false }));
const tree = [{ id: 'parent', name: 'Parent', isExpanded: true, documents: [fixtures[1]],
  children: [{ id: 'child', name: 'Child', isExpanded: true, documents: [fixtures[2]], children: [] }],
}];

async function mounted(run, documents = fixtures, folders = tree, recent = documents) {
  const window = domino.createWindow('<!doctype html><html><body><div id="root"></div></body></html>');
  window.document.oninput = null;
  const previous = new Map(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const dropdown = load('../src/components/ui/dropdown-menu.tsx');
  const documentItem = load('../src/components/features/document/document-item.tsx', {
    '@/lib/utils': { formatDate: () => '지금' }, '@/components/ui/dropdown-menu': dropdown,
  });
  const list = load('../src/components/features/document/document-list.tsx', { './document-item': documentItem });
  const writes = [];
  const state = { theme: 'light', actions: { setTheme() {} } };
  const { Sidebar } = load('../src/components/layout/sidebar.tsx', {
    '../ui/search-input': load('../src/components/ui/search-input.tsx'),
    '../ui/tooltip': { Tooltip: ({ children }) => children },
    '@/components/features/document/document-list': list,
    '@/hooks/use-documents': { useDocuments: () => documents, useRecentDocuments: () => recent },
    '@/hooks/use-folders': { useFolderTree: () => folders },
    '@/stores/ui-store': { useUIStore: selector => selector(state) },
    '@/hooks/use-system-theme': { useSystemTheme: () => false },
    '@/lib/theme': { isDarkTheme: () => false },
    '../../../package.json': { version: 'test' },
    '@/db/folders': Object.fromEntries(['createFolder', 'updateFolder', 'deleteFolder'].map(name => [name, (...args) => writes.push([name, args])])),
    '@/db/documents': { updateDocument: (...args) => writes.push(['updateDocument', args]) },
    '@/components/ui/dropdown-menu': dropdown,
    '@/components/ui/dialog': { PromptDialog: () => null, ConfirmDialog: () => null, AlertDialog: () => null },
    '@/lib/analytics': { analytics: {} },
  });
  const container = window.document.getElementById('root');
  const { createRoot } = require('react-dom/client');
  const root = createRoot(container);
  const selected = [];
  const visible = element => !element.closest('[hidden]');
  const documentsShown = () => Array.from(container.querySelectorAll('button[aria-label$="문서 열기"]')).filter(visible);
  const button = text => Array.from(container.querySelectorAll('button')).find(el => visible(el) && el.textContent.startsWith(text));
  const click = async element => { assert.ok(element); await act(async () => element.click()); };
  const search = async query => {
    const input = container.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setter.call(input, query);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    assert.equal(input.value, query);
  };
  try {
    await act(async () => root.render(React.createElement(Sidebar, { activeDocumentId: 'beta', onSelectDocument: id => selected.push(id) })));
    await run({ container, documentsShown, button, click, search, selected });
    assert.deepEqual(writes, [], 'search and selection must not modify stored documents or folders');
  } finally {
    await act(async () => root.unmount());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}
const titles = context => context.documentsShown().map(el => el.getAttribute('aria-label'));

test('root search excludes unrelated documents in expanded folders', async () => {
  await mounted(async c => { await c.search('Beta'); assert.deepEqual(titles(c), ['Beta 문서 열기']); });
});
test('matching folder document appears once and selects the intended document', async () => {
  await mounted(async c => { await c.search('Alpha'); assert.deepEqual(titles(c), ['Alpha 문서 열기']); await c.click(c.documentsShown()[0]); assert.deepEqual(c.selected, ['alpha']); });
});
test('nested folder matches appear once without unrelated ancestors or siblings', async () => {
  await mounted(async c => { await c.search('Gamma'); assert.deepEqual(titles(c), ['Gamma 문서 열기']); assert.equal(c.button('Parent'), undefined); });
});
test('zero matches show the empty state without stale folder results', async () => {
  await mounted(async c => { await c.search('missing'); assert.deepEqual(titles(c), []); assert.ok(c.container.textContent.includes('문서가 없습니다')); });
});
test('search trims surrounding whitespace and remains case insensitive', async () => {
  await mounted(async c => { await c.search('  aLPHA  '); assert.deepEqual(titles(c), ['Alpha 문서 열기']); });
});
test('excerpt search still finds Korean text in folder documents', async () => {
  await mounted(async c => { await c.search('검색어'); assert.deepEqual(titles(c), ['Alpha 문서 열기']); });
});
test('clearing search restores each document once and the same expanded folder elements', async () => {
  await mounted(async c => {
    const parent = c.button('Parent');
    await c.search('Alpha'); await c.search('');
    assert.equal(c.button('Parent'), parent, 'retain folder component state rather than remounting');
    assert.deepEqual(titles(c).sort(), ['Alpha 문서 열기', 'Beta 문서 열기', 'Gamma 문서 열기']);
  });
});
test('search finds collapsed-folder documents and clearing preserves the collapsed state', async () => {
  await mounted(async c => {
    const parent = c.button('Parent'); await c.click(parent);
    assert.deepEqual(titles(c), ['Beta 문서 열기']);
    await c.search('Gamma'); assert.deepEqual(titles(c), ['Gamma 문서 열기']);
    await c.search(''); assert.equal(c.button('Parent'), parent); assert.deepEqual(titles(c), ['Beta 문서 열기']);
  });
});
test('whitespace-only search keeps the normal folder view', async () => {
  await mounted(async c => { const parent = c.button('Parent'); await c.search('   '); assert.equal(c.button('Parent'), parent); assert.equal(c.documentsShown().length, 3); });
});
test('search without folders retains existing root document behavior', async () => {
  await mounted(async c => { await c.search('missing'); assert.deepEqual(titles(c), []); await c.search('Beta'); assert.deepEqual(titles(c), ['Beta 문서 열기']); await c.search(''); assert.equal(c.documentsShown().length, 1); }, [fixtures[0]], []);
});
test('loading collections remain usable during search', async () => {
  await mounted(async c => { await c.search('Alpha'); assert.deepEqual(titles(c), []); }, null, null);
});

test('recent-view search respects its own collection without leaking older folder documents', async () => {
  await mounted(async c => {
    await c.click(c.button('최근'));
    await c.search('Gamma'); assert.deepEqual(titles(c), []);
    await c.search('Alpha'); assert.deepEqual(titles(c), ['Alpha 문서 열기']);
    await c.click(c.button('모든 문서'));
    await c.search('Gamma'); assert.deepEqual(titles(c), ['Gamma 문서 열기']);
  }, fixtures, tree, fixtures.slice(0, 2));
});
