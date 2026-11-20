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
  const window = domino.createWindow('<!doctype html><html><body><button id="opener">Open</button><button id="new-editor">Editor</button><div id="root"></div></body></html>');
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const opener = window.document.getElementById('opener');
  const newEditor = window.document.getElementById('new-editor');
  let focused = opener;
  Object.defineProperty(window.document, 'activeElement', { get: () => focused });
  // Domino does not model native focus; record only the component's focus calls.
  const withFocus = element => {
    Object.defineProperty(element, 'focus', { value: () => { focused = element; } });
    return element;
  };
  withFocus(opener);
  withFocus(newEditor);
  const createElement = window.document.createElement.bind(window.document);
  Object.defineProperty(window.document, 'createElement', {
    value: (...args) => withFocus(createElement(...args)),
  });
  let nextFrame = 0;
  const frames = new Map();
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
  const context = {
    exports: {},
    document: window.document,
    HTMLElement: window.HTMLElement,
    requestAnimationFrame(fn) { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); },
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
      open,
      onSelectDocument: id => { selected.push(id); newEditor.focus(); },
      onClose: () => { closed++; },
    })));
    for (const [id, fn] of frames) {
      frames.delete(id);
      fn();
    }
  };
  const key = async (target, value, modifiers = {}) => {
    const event = new window.Event('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'key', { value });
    for (const [name, value] of Object.entries(modifiers)) Object.defineProperty(event, name, { value });
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
    await run({ container, selected, closed: () => closed, render, key, activate, opener, newEditor, focus: () => focused,
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


test('Tab wraps only at the last result and Shift+Tab wraps at the search field', async () => {
  await mounted(async ({ input, buttons, key, focus }) => {
    assert.equal(focus(), input());
    assert.equal((await key(input(), 'Tab')).defaultPrevented, false);
    assert.equal((await key(buttons()[0], 'Tab')).defaultPrevented, false);
    assert.equal((await key(buttons().at(-1), 'Tab')).defaultPrevented, true);
    assert.equal(focus(), input());
    assert.equal((await key(input(), 'Tab', { shiftKey: true })).defaultPrevented, true);
    assert.equal(focus(), buttons().at(-1));
    assert.equal((await key(buttons().at(-1), 'Tab', { shiftKey: true })).defaultPrevented, false);
  });
});

test('no results keep focus in the search field without intercepting modified Tab shortcuts', async () => {
  await mounted(async ({ input, key, focus }) => {
    assert.equal(focus(), input());
    for (const modifiers of [{}, { shiftKey: true }]) {
      assert.equal((await key(input(), 'Tab', modifiers)).defaultPrevented, true);
      assert.equal(focus(), input());
    }
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
      assert.equal((await key(input(), 'Tab', { [modifier]: true })).defaultPrevented, false);
    }
  }, []);
});

test('Escape cancellation restores opener focus when the modal closes', async () => {
  await mounted(async ({ input, key, render, focus, opener, closed }) => {
    assert.equal(focus(), input());
    await key(input(), 'Escape');
    assert.equal(closed(), 1);
    await render(false);
    assert.equal(focus()?.id, opener.id);
  });
});

test('document selection does not steal the new editor focus when the modal closes', async () => {
  await mounted(async ({ input, key, render, selected, focus, newEditor }) => {
    await key(input(), 'Enter');
    await render(false);
    assert.deepEqual(selected, ['0']);
    assert.equal(focus(), newEditor);
  });
});
