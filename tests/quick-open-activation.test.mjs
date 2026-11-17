import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import React, { act } from 'react';
import domino from '@mixmark-io/domino';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/components/features/quick-open/quick-open.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const fixtures = ['Beta', 'Alpha'].map((title, index) => ({
  id: String(index), title, excerpt: `Synthetic ${title}`, updatedAt: new Date('2026-11-15T00:00:00Z'),
}));

async function mounted(run, documents = fixtures) {
  const window = domino.createWindow('<!doctype html><html><body><div id="root"></div></body></html>');
  window.HTMLElement.prototype.scrollIntoView = () => {};
  // Initialize ReactDOM against the modern DOM fixture, not its legacy IE
  // input-event fallback selected when imported without window/document.
  window.document.oninput = null;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  const overrides = {
    '@/hooks/use-documents': { useDocuments: () => documents },
    'date-fns': { formatDistanceToNow: () => '지금' },
    'date-fns/locale': {},
  };
  const context = { exports: {}, requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    require: name => name in overrides ? overrides[name] : require(name),
  };
  vm.runInNewContext(code, context);
  const { QuickOpen } = context.exports;
  const container = window.document.getElementById('root');
  const { createRoot } = require('react-dom/client');
  const root = createRoot(container);
  const selected = [];
  let closed = 0;
  const render = async (open = true) => {
    await act(async () => root.render(React.createElement(QuickOpen, {
      open, onSelectDocument: id => selected.push(id), onClose: () => { closed++; },
    })));
  };
  const key = async (target, value) => {
    const event = new window.Event('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'key', { value });
    await act(async () => target.dispatchEvent(event));
    return event;
  };
  // Domino has no native keyboard defaults. Model the browser's single click
  // only when keydown was not canceled; actual Tab/Enter is separate browser QA.
  const activate = async (button, value = 'Enter', target = button) => {
    const event = await key(target, value);
    if (!event.defaultPrevented) await act(async () => button.click());
    return event;
  };
  try {
    await render();
    await run({ container, selected, closed: () => closed, render, key, activate,
      input: () => container.querySelector('input'),
      buttons: () => Array.from(container.querySelectorAll('[data-quick-open-item]')),
    });
  } finally {
    await act(async () => root.unmount());
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
    if (previousAct) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousAct);
    else delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
}

test('Enter on the second result preserves native activation of that result', async () => {
  await mounted(async ({ buttons, activate, selected, closed }) => {
    const event = await activate(buttons()[1]);
    assert.equal(event.defaultPrevented, false);
    assert.deepEqual(selected, ['1']);
    assert.equal(closed(), 1);
  });
});

test('button Enter ignores a different highlighted result', async () => {
  await mounted(async ({ input, buttons, key, activate, selected, closed }) => {
    await key(input(), 'ArrowDown');
    assert.equal((await activate(buttons()[0])).defaultPrevented, false);
    assert.deepEqual(selected, ['0']);
    assert.equal(closed(), 1);
  });
});

test('Enter bubbling from result content also keeps native button activation', async () => {
  await mounted(async ({ buttons, activate, selected }) => {
    const button = buttons()[1];
    assert.equal((await activate(button, 'Enter', button.querySelector('div'))).defaultPrevented, false);
    assert.deepEqual(selected, ['1']);
  });
});

test('search input Enter still opens the initially highlighted result once', async () => {
  await mounted(async ({ input, key, selected, closed }) => {
    assert.equal((await key(input(), 'Enter')).defaultPrevented, true);
    assert.deepEqual(selected, ['0']);
    assert.equal(closed(), 1);
  });
});

test('search input arrows and Enter still navigate results', async () => {
  await mounted(async ({ input, key, selected, closed }) => {
    for (const name of ['ArrowDown', 'ArrowUp', 'ArrowDown']) {
      assert.equal((await key(input(), name)).defaultPrevented, true);
    }
    await key(input(), 'Enter');
    assert.deepEqual(selected, ['1']);
    assert.equal(closed(), 1);
  });
});

test('Space on a result retains its existing native activation', async () => {
  await mounted(async ({ buttons, activate, selected, closed }) => {
    assert.equal((await activate(buttons()[1], ' ')).defaultPrevented, false);
    assert.deepEqual(selected, ['1']);
    assert.equal(closed(), 1);
  });
});

test('Escape still closes from both search and result without opening anything', async () => {
  await mounted(async ({ input, buttons, key, selected, closed }) => {
    assert.equal((await key(input(), 'Escape')).defaultPrevented, true);
    assert.equal((await key(buttons()[1], 'Escape')).defaultPrevented, true);
    assert.deepEqual(selected, []);
    assert.equal(closed(), 2);
  });
});

test('reopening resets highlighted selection while native result activation remains independent', async () => {
  await mounted(async ({ input, buttons, key, activate, render, selected, closed }) => {
    await key(input(), 'ArrowDown');
    await render(false);
    await render(true);
    await key(input(), 'Enter');
    await activate(buttons()[1]);
    assert.deepEqual(selected, ['0', '1']);
    assert.equal(closed(), 2);
  });
});

test('Enter with no results does not select or close', async () => {
  await mounted(async ({ input, key, selected, closed }) => {
    assert.equal((await key(input(), 'Enter')).defaultPrevented, true);
    assert.deepEqual(selected, []);
    assert.equal(closed(), 0);
  }, []);
});
