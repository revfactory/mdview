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
const source = readFileSync(new URL('../src/components/layout/app-shell.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;

// Exercise the real AppShell rendering branches. The DOM harness verifies
// attributes and mount identity, not browser focus or accessibility behavior.
function render({ sidebarOpen = true, focusMode = false, isMobile = false, sidebarWidth = 280 } = {}) {
  const calls = [];
  const state = { sidebarOpen, sidebarWidth, isMobile, actions: {
    setMobile() {}, closeSidebar() { calls.push('close'); },
  } };
  const overrides = {
    react: { ...React, useEffect() {} },
    '@/stores/ui-store': { useUIStore: selector => selector(state) },
  };
  const context = { exports: {}, require: name => name in overrides ? overrides[name] : require(name) };
  vm.runInNewContext(code, context);
  const tree = context.exports.AppShell({
    focusMode,
    sidebar: React.createElement('div', null,
      React.createElement('button', null, '새 문서'),
      React.createElement('input', { 'aria-label': '문서 검색', defaultValue: '검색 상태' }),
      React.createElement('a', { href: '/guides' }, '가이드')),
    children: React.createElement('button', null, '사이드바 토글'),
  });
  const doc = domino.createWindow(renderToStaticMarkup(tree)).document;
  return { tree, doc, calls, aside: doc.querySelector('aside'), main: doc.querySelector('main') };
}

for (const sidebarOpen of [false, true]) {
  for (const focusMode of [false, true]) {
    test(`desktop sidebar access follows visibility: open=${sidebarOpen}, focus=${focusMode}`, () => {
      const { aside, main, doc } = render({ sidebarOpen, focusMode });
      const visible = sidebarOpen && !focusMode;
      assert.ok(aside, 'desktop keeps sidebar mounted');
      assert.equal(aside.hasAttribute('inert'), !visible);
      assert.equal(aside.getAttribute('aria-hidden'), String(!visible));
      assert.equal(doc.body.firstElementChild.style.gridTemplateColumns, visible ? '280px 1fr' : '0px 1fr');
      assert.equal(aside.querySelectorAll('button, input, a').length, 3);
      assert.equal(main.hasAttribute('inert'), false);
      assert.notEqual(main.getAttribute('aria-hidden'), 'true');
      assert.equal(main.querySelector('button').textContent, '사이드바 토글');
    });
  }
}

test('mobile keeps conditional sidebar mounting and the existing backdrop close callback', () => {
  for (const sidebarOpen of [false, true]) {
    for (const focusMode of [false, true]) {
      const { tree, aside, main, calls } = render({ sidebarOpen, focusMode, isMobile: true });
      const visible = sidebarOpen && !focusMode;
      assert.equal(Boolean(aside), visible);
      assert.equal(main.hasAttribute('inert'), false);
      if (visible) {
        assert.equal(aside.hasAttribute('inert'), false);
        assert.notEqual(aside.getAttribute('aria-hidden'), 'true');
        const overlay = tree.props.children[1];
        overlay.props.children[0].props.onClick();
        assert.deepEqual(calls, ['close']);
      }
    }
  }
});

test('desktop width remains clamped without changing visibility semantics', () => {
  for (const [sidebarWidth, expected] of [[100, 220], [280, 280], [500, 360]]) {
    const { doc, aside } = render({ sidebarWidth });
    assert.equal(doc.body.firstElementChild.style.gridTemplateColumns, `${expected}px 1fr`);
    assert.equal(aside.hasAttribute('inert'), false);
  }
});

test('repeated closing and focus-mode transitions update the same mounted sidebar and keep its controls', async () => {
  const window = domino.createWindow('<!doctype html><html><body><div id="root"></div></body></html>');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  const container = window.document.getElementById('root');
  const root = createRoot(container);
  try {
    let originalAside, originalInput;
    for (const [sidebarOpen, focusMode] of [[true, false], [false, false], [true, false], [true, true], [false, true], [true, false]]) {
      await act(async () => root.render(render({ sidebarOpen, focusMode }).tree));
      const aside = container.querySelector('aside');
      const input = aside.querySelector('input');
      if (originalAside) {
        assert.equal(aside, originalAside, 'do not remount the sidebar');
        assert.equal(input, originalInput, 'keep mounted search state');
      } else { originalAside = aside; originalInput = input; }
      const visible = sidebarOpen && !focusMode;
      assert.equal(aside.hasAttribute('inert'), !visible);
      assert.equal(aside.getAttribute('aria-hidden'), String(!visible));
      assert.equal(input.value, '검색 상태');
      assert.equal(container.querySelector('main').hasAttribute('inert'), false);
    }
  } finally {
    await act(async () => root.unmount());
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
    if (previousAct) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousAct);
    else delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
