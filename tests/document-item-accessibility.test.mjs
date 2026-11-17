import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import domino from '@mixmark-io/domino';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, overrides = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => name in overrides ? overrides[name] : require(name),
    get document() { return globalThis.window?.document; },
  });
  return exports;
}
const { DocumentItem } = load('../src/components/features/document/document-item.tsx', {
  '@/lib/utils': { formatDate: () => '11월 15일' },
  '@/components/ui/dropdown-menu': load('../src/components/ui/dropdown-menu.tsx'),
});
const defaults = { id: 'fixture-doc', title: '회의록', excerpt: '문서 미리보기', updatedAt: new Date('2026-11-15T00:00:00Z'), isFavorite: false, isActive: false, onSelect() {} };
function markup(props = {}) {
  return domino.createWindow(renderToStaticMarkup(React.createElement(DocumentItem, { ...defaults, ...props }))).document;
}
const openButton = doc => doc.querySelector('button[aria-label$="문서 열기"]');
for (const [title, kind, label] of [
  ['회의록', undefined, '회의록 문서 열기'],
  ['', undefined, '제목 없음 문서 열기'],
  ['보고서', 'pdf', '보고서 PDF 문서 열기'],
  ['', 'pdf', '제목 없음 PDF 문서 열기'],
  ['<안건> & "결정"', undefined, '<안건> & "결정" 문서 열기'],
]) {
  test(`document title provides a native named open button: ${label}`, () => {
    const doc = markup({ title, kind });
    const button = openButton(doc);
    assert.ok(button, 'document opening must be available through a native button');
    assert.equal(button.getAttribute('type'), 'button', 'must not submit a parent form');
    assert.equal(button.getAttribute('aria-label'), label);
    assert.equal(button.hasAttribute('tabindex'), false, 'keep native keyboard behavior');
    assert.equal(button.querySelectorAll('button, a, input, select, textarea, div, p').length, 0, 'no nested interactive controls or non-phrasing content');
    assert.ok(button.textContent.includes(title || '제목 없음'));
    assert.ok(button.textContent.includes('문서 미리보기'));
    assert.ok(button.textContent.includes('11월 15일'));
    if (kind === 'pdf') assert.ok(button.textContent.includes('PDF'));
    assert.ok(button.className.includes('text-left'));
    assert.ok(button.className.includes('focus-visible:outline-2'));
    assert.equal(doc.querySelectorAll('button').length, 2, 'open and menu remain separate buttons');
  });
}

test('current document and empty previews retain meaningful presentation', () => {
  const current = openButton(markup({ isActive: true, isFavorite: true, excerpt: '' }));
  assert.ok(current);
  assert.equal(current.getAttribute('aria-current'), 'true');
  assert.equal(openButton(markup()).hasAttribute('aria-current'), false);
  assert.equal(current.querySelectorAll('p').length, 0);
  assert.ok(current.querySelector('svg'), 'favorite pin stays visible');
});

async function mounted(run) {
  const window = domino.createWindow('<!doctype html><html><body><div id="root"></div></body></html>');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  const container = window.document.getElementById('root');
  const root = createRoot(container);
  const calls = [];
  const props = { ...defaults, onSelect: id => calls.push(['select', id]), onToggleFavorite: id => calls.push(['favorite', id]), onDuplicate: id => calls.push(['duplicate', id]), onDelete: id => calls.push(['delete', id]) };
  try {
    await act(async () => root.render(React.createElement(DocumentItem, props)));
    await run({ window, container, calls, click: async el => { assert.ok(el); await act(async () => el.click()); } });
  } finally {
    await act(async () => root.unmount());
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
    if (previousAct) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousAct);
    else delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
}

test('native open click and existing row background click each select exactly once', async () => {
  await mounted(async ({ container, calls, click }) => {
    await click(openButton(container));
    assert.deepEqual(calls, [['select', 'fixture-doc']]);
    await click(container.firstElementChild);
    assert.deepEqual(calls, [['select', 'fixture-doc'], ['select', 'fixture-doc']]);
  });
});

test('menu trigger and favorite/duplicate/delete actions never also open the document', async () => {
  await mounted(async ({ container, calls, click }) => {
    for (const [label, action] of [['즐겨찾기 추가', 'favorite'], ['복제', 'duplicate'], ['삭제', 'delete']]) {
      await click(container.querySelector('button[aria-label="메뉴"]'));
      assert.equal(calls.some(([name]) => name === 'select'), false);
      await click(Array.from(container.querySelectorAll('button')).find(el => el.textContent === label));
      assert.equal(calls.at(-1)[0], action);
      assert.equal(calls.at(-1)[1], 'fixture-doc');
    }
    assert.equal(calls.length, 3);
    assert.equal(calls.some(([name]) => name === 'select'), false);
  });
});

test('drag start from the title button retains the document payload without selection', async () => {
  await mounted(async ({ window, container, calls }) => {
    const payload = [];
    const dataTransfer = { setData: (type, value) => payload.push([type, value]), effectAllowed: '' };
    const event = new window.Event('dragstart', { bubbles: true });
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    await act(async () => openButton(container).dispatchEvent(event));
    assert.equal(container.firstElementChild.getAttribute('draggable'), 'true');
    assert.deepEqual(payload, [['application/x-doc-id', 'fixture-doc']]);
    assert.equal(dataTransfer.effectAllowed, 'move');
    assert.deepEqual(calls, []);
  });
});
