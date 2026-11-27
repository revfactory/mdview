import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import domino from '@mixmark-io/domino';
import React, { act } from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function load(path, overrides = {}, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } });
  const context = { exports: {}, require: name => overrides[name] ?? require(name), ...globals };
  vm.runInNewContext(outputText, context);
  return context.exports;
}

async function mounted(run) {
  const window = domino.createWindow('<!doctype html><div id="root"></div>');
  const { document } = window;
  document.oninput = null;
  const focusCalls = [];
  // Domino does not model native focus; record app-initiated focus instead.
  const createElement = document.createElement.bind(document);
  document.createElement = (...args) => {
    const element = createElement(...args);
    Object.defineProperty(element, 'focus', { value: () => focusCalls.push(element) });
    return element;
  };
  const globals = { window, document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  let root;
  try {
    const timers = [];
    const store = load('../src/stores/toast-store.ts', {}, {
      setTimeout(callback, delay) { timers.push({ callback, delay }); },
    });
    const { ToastContainer } = load('../src/components/ui/toast.tsx', { '@/stores/toast-store': store });
    const container = document.getElementById('root');
    root = require('react-dom/client').createRoot(container);
    await act(async () => root.render(React.createElement(ToastContainer)));
    await run({
      container, timers, focusCalls,
      add: async (message, type = 'info') =>
        act(async () => store.useToastStore.getState().actions.addToast(message, type)),
      expire: async index => act(async () => timers[index].callback()),
      region: () => container.querySelector('[role="status"]'),
      buttons: () => Array.from(container.querySelectorAll('button[aria-label="닫기"]')),
    });
  } finally {
    if (root) await act(async () => root.unmount());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

const split = '대용량 문서가 3개 페이지로 분할되었습니다.';

test('the same empty polite status region receives split feedback and survives expiry', async () => {
  await mounted(async ({ add, expire, region, buttons, focusCalls }) => {
    const status = region();
    assert.ok(status, 'status region must exist before a message is shown');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(status.textContent, '');
    await add(split);
    assert.equal(region(), status);
    assert.equal(status.textContent, split);
    assert.equal(status.querySelectorAll('button').length, 0);
    assert.equal(buttons().length, 1);
    await expire(0);
    assert.equal(region(), status);
    assert.equal(status.textContent, '');
    assert.deepEqual(focusCalls, []);
  });
});

test('a second identical notification appends a new node without replacing the first', async () => {
  await mounted(async ({ add, expire, region }) => {
    await add(split);
    const status = region();
    assert.ok(status);
    assert.equal(status.getAttribute('aria-atomic'), 'false');
    assert.equal(status.getAttribute('aria-relevant'), 'additions');
    const first = status.firstElementChild;
    await add(split);
    const second = status.lastElementChild;
    assert.notEqual(second, first);
    assert.equal(status.firstElementChild, first);
    assert.deepEqual(Array.from(status.children).map(child => child.textContent), [split, split]);
    await expire(0);
    assert.equal(status.children.length, 1);
    assert.equal(status.firstElementChild, second);
  });
});

test('visible toast dismissal and three-second expiry remain independent', async () => {
  await mounted(async ({ add, buttons, expire, timers, focusCalls }) => {
    await add(split, 'success');
    await add('문서 제목을 저장하지 못했습니다.', 'error');
    assert.deepEqual(timers.map(timer => timer.delay), [3000, 3000]);
    assert.equal(buttons().length, 2);
    assert.equal(buttons()[0].parentElement.textContent.trim(), split);
    await act(async () => buttons()[0].click());
    assert.equal(buttons().length, 1);
    assert.equal(buttons()[0].parentElement.textContent.trim(), '문서 제목을 저장하지 못했습니다.');
    await expire(0);
    assert.equal(buttons().length, 1);
    await expire(1);
    assert.equal(buttons().length, 0);
    assert.deepEqual(focusCalls, []);
  });
});
