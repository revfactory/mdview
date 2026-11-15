import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
