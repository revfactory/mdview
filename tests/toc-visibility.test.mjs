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
const source = readFileSync(new URL('../src/components/features/editor/toc-panel.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const fixture = [
  { level: 1, text: '첫 번째 제목', pos: 0 },
  { level: 2, text: '두 번째 제목', pos: 12 },
  { level: 3, text: '', pos: 24 },
];
// Render the real component with controlled hooks/editor data. This verifies
// its markup contract, not browser focus, accessibility-tree updates or effects.
function render(open, headings = fixture) {
  const calls = [];
  class Element {
    scrollIntoView(options) { calls.push(['scroll', options.block]); }
  }
  const chain = {
    focus() { calls.push(['focus']); return this; },
    setTextSelection(pos) { calls.push(['selection', pos]); return this; },
    run() { calls.push(['run']); },
  };
  const editor = {
    state: { doc: { descendants(fn) { headings.forEach(h => fn({ type: { name: 'heading' }, attrs: { level: h.level }, textContent: h.text }, h.pos)); } } },
    view: { nodeDOM() { return new Element(); } },
    chain() { return chain; },
  };
  const state = { tocOpen: open, actions: { toggleToc() { calls.push(['toggle']); } } };
  const overrides = {
    react: { ...React, useState: value => [value, () => {}], useEffect() {}, useMemo: fn => fn(), useCallback: fn => fn, useRef: value => ({ current: value }) },
    '@/stores/ui-store': { useUIStore: selector => selector(state) },
    '@tiptap/react': { useEditorState: ({ editor, selector }) => selector({ editor }) },
  };
  const context = { exports: {}, HTMLElement: Element, require: name => name in overrides ? overrides[name] : require(name) };
  vm.runInNewContext(code, context);
  const tree = context.exports.TocPanel({ editor });
  const doc = domino.createWindow(renderToStaticMarkup(tree)).document;
  return { tree, doc, calls, panel: doc.body.firstElementChild };
}
function* elements(node) {
  if (Array.isArray(node)) { for (const child of node) yield* elements(child); }
  else if (node && typeof node === 'object' && node.props) {
    yield node;
    yield* elements(node.props.children);
  }
}

for (const headings of [[], fixture]) {
  test(`closed outline makes all ${headings.length + 1} controls inert and hides its accessibility subtree`, () => {
    const { panel } = render(false, headings);
    assert.equal(panel.style.width, '0');
    assert.equal(panel.hasAttribute('inert'), true);
    assert.equal(panel.getAttribute('aria-hidden'), 'true');
    assert.equal(panel.querySelectorAll('button').length, headings.length + 1);
    for (const button of Array.from(panel.querySelectorAll('button'))) {
      let ancestor = button;
      while (ancestor && !ancestor.hasAttribute('inert')) ancestor = ancestor.parentElement;
      assert.equal(ancestor, panel);
    }
  });
  test(`open outline restores access with ${headings.length} headings`, () => {
    const { panel } = render(true, headings);
    assert.equal(panel.style.width, '240px');
    assert.equal(panel.hasAttribute('inert'), false);
    assert.notEqual(panel.getAttribute('aria-hidden'), 'true');
    assert.ok(panel.querySelector('button[aria-label="목차 닫기"]'));
    assert.ok(panel.textContent.includes(headings.length ? '첫 번째 제목' : '제목(H1~H3)을 추가하면 목차가 표시됩니다.'));
  });
}

test('outline presentation and existing navigation callbacks stay intact', () => {
  const { tree, panel, calls } = render(true);
  assert.deepEqual(Array.from(panel.querySelectorAll('nav button'), el => el.textContent), ['첫 번째 제목', '두 번째 제목', '(빈 제목)']);
  const buttons = [...elements(tree)].filter(node => node.type === 'button');
  buttons[2].props.onClick();
  buttons[0].props.onClick();
  assert.deepEqual(calls, [['scroll', 'start'], ['focus'], ['selection', 13], ['run'], ['toggle']]);
});

test('each open/closed render derives inert and aria-hidden from visibility', () => {
  for (const open of [false, true, false, true]) {
    const { panel } = render(open);
    assert.equal(panel.hasAttribute('inert'), !open);
    assert.equal(panel.getAttribute('aria-hidden'), String(!open));
  }
});

test('React removes and restores inert on the same mounted panel when visibility changes', async () => {
  const window = domino.createWindow('<!doctype html><html><body><div id="root"></div></body></html>');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  const container = window.document.getElementById('root');
  const root = createRoot(container);
  try {
    let panel;
    for (const open of [false, true, false, true]) {
      await act(async () => root.render(render(open).tree));
      if (panel) assert.equal(container.firstElementChild, panel, 'update the existing panel rather than remounting');
      panel = container.firstElementChild;
      assert.equal(panel.hasAttribute('inert'), !open);
      assert.equal(panel.getAttribute('aria-hidden'), String(!open));
      assert.equal(panel.querySelectorAll('button').length, 4);
    }
  } finally {
    await act(async () => root.unmount());
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
    if (previousAct) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousAct);
    else delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test('outline exposes only the current heading as scroll position changes', async () => {
  const window = domino.createWindow('<!doctype html><div id="root"></div><div class="overflow-y-auto"><div id="editor"></div></div>');
  const { document } = window;
  const editorDom = document.getElementById('editor');
  const scrollParent = editorDom.parentElement;
  scrollParent.getBoundingClientRect = () => ({ top: 100 });
  const nodes = new Map();
  const editor = {
    state: { doc: { descendants(fn) { fixture.forEach(h => fn({ type: { name: 'heading' }, attrs: { level: h.level }, textContent: h.text }, h.pos)); } } },
    view: { dom: editorDom, nodeDOM: pos => nodes.get(pos) ?? null },
  };
  const state = { tocOpen: true, actions: { toggleToc() {} } };
  const overrides = {
    '@/stores/ui-store': { useUIStore: selector => selector(state) },
    '@tiptap/react': { useEditorState: ({ editor, selector }) => selector({ editor }) },
  };
  const context = { exports: {}, HTMLElement: window.HTMLElement, require: name => overrides[name] ?? require(name) };
  vm.runInNewContext(code, context);
  const { TocPanel } = context.exports;
  const globals = { window, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const container = document.getElementById('root');
  const root = createRoot(container);
  const current = () => Array.from(container.querySelectorAll('nav [aria-current]'), el => [el.textContent, el.getAttribute('aria-current')]);
  const scroll = async tops => {
    fixture.forEach(({ pos }, index) => {
      const node = nodes.get(pos) ?? document.createElement('h2');
      node.getBoundingClientRect = () => ({ top: tops[index] });
      nodes.set(pos, node);
    });
    await act(async () => scrollParent.dispatchEvent(new window.Event('scroll')));
  };
  try {
    await act(async () => root.render(React.createElement(TocPanel, { editor })));
    const buttons = Array.from(container.querySelectorAll('nav button'));
    assert.equal(buttons.length, 3);
    assert.deepEqual(current(), [], 'no rendered heading has been found yet');

    await scroll([90, 500, 700]);
    assert.deepEqual(current(), [['첫 번째 제목', 'location']]);
    await scroll([-200, 110, 550]);
    assert.deepEqual(current(), [['두 번째 제목', 'location']]);
    assert.equal(buttons[0].hasAttribute('aria-current'), false);
    assert.equal(container.querySelectorAll('nav button')[1], buttons[1], 'preserve the same native buttons');

    await act(async () => root.render(React.createElement(TocPanel, { editor: null })));
    assert.deepEqual(current(), [], 'no current item after the document clears');
  } finally {
    await act(async () => root.unmount());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
