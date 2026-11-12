import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function loadUIStore() {
  const source = readFileSync(new URL('../src/stores/ui-store.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: createRequire(import.meta.url) });
  return exports.useUIStore;
}

function withStorage(initial, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const entries = new Map(initial ? [['mdview-ui', JSON.stringify(initial)]] : []);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key),
  } } });
  try { run(entries); } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  }
}

test('UI preferences hydrate while transient mobile state and actions remain local', () => {
  const preferences = { sidebarOpen: false, sidebarWidth: 340, viewMode: 'source', tocOpen: true, focusMode: true, theme: 'dark' };
  withStorage({ state: preferences, version: 0 }, () => {
    const store = loadUIStore();
    assert.equal(store.persist.hasHydrated(), true);
    for (const [key, value] of Object.entries(preferences)) assert.equal(store.getState()[key], value);
    assert.equal(store.getState().isMobile, false);
    store.getState().actions.toggleSidebar();
    assert.equal(store.getState().sidebarOpen, true);
    store.getState().actions.setViewMode('split');
    assert.equal(store.getState().viewMode, 'split');
  });
});

test('UI preference writes survive reload without persisting mobile state or actions', () => {
  withStorage(null, entries => {
    const store = loadUIStore();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => { notifications++; });
    const actions = store.getState().actions;
    actions.setTheme('dark');
    actions.setMobile(true);
    actions.setViewMode('source');
    actions.setSidebarWidth(360);
    assert.equal(notifications, 4);
    unsubscribe();
    actions.closeSidebar();
    assert.equal(notifications, 4);
    const saved = JSON.parse(entries.get('mdview-ui'));
    assert.deepEqual(Object.keys(saved.state).sort(), ['focusMode', 'sidebarOpen', 'sidebarWidth', 'theme', 'tocOpen', 'viewMode']);
    assert.equal(saved.version, 0);
    const reloaded = loadUIStore();
    assert.equal(reloaded.getState().theme, 'dark');
    assert.equal(reloaded.getState().viewMode, 'source');
    assert.equal(reloaded.getState().sidebarWidth, 360);
    assert.equal(reloaded.getState().sidebarOpen, false);
    assert.equal(reloaded.getState().isMobile, false);
    assert.equal(typeof reloaded.getState().actions.setTheme, 'function');
  });
});

test('malformed stored preferences retain usable defaults and can be replaced', () => {
  withStorage(null, entries => {
    entries.set('mdview-ui', '{broken JSON');
    const store = loadUIStore();
    assert.equal(store.getState().theme, 'system');
    assert.equal(store.getState().viewMode, 'wysiwyg');
    store.getState().actions.setTheme('light');
    assert.equal(JSON.parse(entries.get('mdview-ui')).state.theme, 'light');
  });
});
