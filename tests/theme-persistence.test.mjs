import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const themeSource = readFileSync(new URL('../src/lib/theme.ts', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../src/stores/ui-store.ts', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
function load(source, browser, modules = {}) {
  const exports = {};
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(js, { exports, window: browser, require: id => modules[id] ?? require(id) });
  return exports;
}

function withBrowser(initial, systemDark, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const entries = new Map(initial === undefined ? [] : [['mdview-ui', typeof initial === 'string' ? initial : JSON.stringify(initial)]]);
  const classes = new Set(['unrelated']);
  const listeners = new Set();
  const media = {
    matches: systemDark,
    addEventListener: (type, listener) => { assert.equal(type, 'change'); listeners.add(listener); },
    removeEventListener: (type, listener) => { assert.equal(type, 'change'); listeners.delete(listener); },
  };
  let writes = 0;
  const browser = { matchMedia: query => { assert.equal(query, '(prefers-color-scheme: dark)'); return media; }, localStorage: {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => { writes++; entries.set(key, value); },
    removeItem: key => entries.delete(key),
  } };
  const root = { classList: { toggle: (name, force) => { if (force) classes.add(name); else classes.delete(name); } } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  const theme = load(themeSource, browser);
  const bootstrap = () => vm.runInNewContext(theme.THEME_BOOTSTRAP_SCRIPT, { window: browser, localStorage: browser.localStorage, document: { documentElement: root } });
  const loadStore = () => load(storeSource, browser, { '@/lib/theme': theme }).useUIStore;
  const changeSystem = value => { media.matches = value; for (const listener of listeners) listener(); };
  try { run({ browser, entries, classes, root, listeners, theme, bootstrap, loadStore, changeSystem, writes: () => writes }); }
  finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  }
}

for (const [savedTheme, systemDark, expectedDark] of [
  ['dark', false, true], ['light', true, false], ['system', true, true], ['system', false, false],
]) {
  test(`bootstrap and hydrated store agree: ${savedTheme}, system dark=${systemDark}`, () => {
    withBrowser({ state: { theme: savedTheme, viewMode: 'source' }, version: 0 }, systemDark, ctx => {
      ctx.entries.set('mdview-theme', expectedDark ? 'light' : 'dark'); // Never let an obsolete key override saved UI preferences.
      ctx.bootstrap();
      assert.equal(ctx.classes.has('dark'), expectedDark);
      assert.equal(ctx.writes(), 0);
      const store = ctx.loadStore();
      const stop = ctx.theme.syncTheme(store, ctx.root);
      assert.equal(ctx.classes.has('dark'), expectedDark);
      assert.equal(ctx.theme.isDarkTheme(store.getState().theme, ctx.theme.getSystemTheme()), expectedDark);
      assert.equal(store.getState().viewMode, 'source');
      assert.ok(ctx.classes.has('unrelated'));
      stop();
    });
  });
}

test('repeated explicit light/dark choices persist and repaint after reload', () => {
  withBrowser(undefined, false, ctx => {
    let store = ctx.loadStore();
    let stop = ctx.theme.syncTheme(store, ctx.root);
    for (const chosen of ['dark', 'light', 'dark', 'light']) {
      store.getState().actions.setTheme(chosen);
      assert.equal(ctx.classes.has('dark'), chosen === 'dark');
      assert.equal(JSON.parse(ctx.entries.get('mdview-ui')).state.theme, chosen);
      stop();
      ctx.root.classList.toggle('dark', chosen !== 'dark');
      ctx.bootstrap();
      assert.equal(ctx.classes.has('dark'), chosen === 'dark');
      store = ctx.loadStore();
      stop = ctx.theme.syncTheme(store, ctx.root);
      assert.equal(ctx.classes.has('dark'), chosen === 'dark');
    }
    stop();
  });
});

test('system changes repaint only system preference; remount and cleanup avoid duplicate listeners', () => {
  withBrowser(undefined, true, ctx => {
    const store = ctx.loadStore();
    let stop = ctx.theme.syncTheme(store, ctx.root);
    assert.equal(ctx.classes.has('dark'), true);
    ctx.changeSystem(false);
    assert.equal(ctx.classes.has('dark'), false);
    store.getState().actions.setTheme('dark');
    ctx.changeSystem(true);
    ctx.changeSystem(false);
    assert.equal(ctx.classes.has('dark'), true);
    store.getState().actions.setTheme('light');
    ctx.changeSystem(true);
    assert.equal(ctx.classes.has('dark'), false);
    store.getState().actions.setTheme('system');
    assert.equal(ctx.classes.has('dark'), true);
    stop();
    assert.equal(ctx.listeners.size, 0);
    ctx.changeSystem(false);
    assert.equal(ctx.classes.has('dark'), true);
    store.getState().actions.setTheme('light');
    assert.equal(ctx.classes.has('dark'), true);
    stop = ctx.theme.syncTheme(store, ctx.root);
    assert.equal(ctx.listeners.size, 1);
    assert.equal(ctx.classes.has('dark'), false);
    stop();
    assert.equal(ctx.listeners.size, 0);
  });
});

test('missing, malformed, invalid and unsupported storage fall back to system without rewriting', () => {
  for (const saved of [undefined, '{bad JSON', 'null', '5', { state: { theme: 'invalid' }, version: 0 }, { state: { theme: 'light' }, version: 1 }]) {
    withBrowser(saved, true, ctx => {
      const before = ctx.entries.get('mdview-ui');
      ctx.bootstrap();
      assert.equal(ctx.classes.has('dark'), true);
      assert.equal(ctx.entries.get('mdview-ui'), before);
      assert.equal(ctx.writes(), 0);
    });
  }
  withBrowser(undefined, true, ctx => {
    ctx.browser.localStorage.getItem = () => { throw new Error('storage blocked'); };
    ctx.bootstrap();
    assert.equal(ctx.classes.has('dark'), true);
    assert.equal(ctx.writes(), 0);
    const store = ctx.loadStore();
    assert.equal(store.getState().theme, 'system');
    const stop = ctx.theme.syncTheme(store, ctx.root);
    assert.equal(ctx.classes.has('dark'), true);
    ctx.changeSystem(false);
    assert.equal(ctx.classes.has('dark'), false);
    stop();
  });
});

test('missing matchMedia safely defaults to light while preserving explicit dark', () => {
  withBrowser(undefined, false, ctx => {
    delete ctx.browser.matchMedia;
    ctx.bootstrap();
    assert.equal(ctx.classes.has('dark'), false);
    const store = ctx.loadStore();
    const stop = ctx.theme.syncTheme(store, ctx.root);
    store.getState().actions.setTheme('dark');
    assert.equal(ctx.classes.has('dark'), true);
    ctx.bootstrap();
    assert.equal(ctx.classes.has('dark'), true);
    stop();
  });
});

test('root wires pre-paint bootstrap and live synchronization; sidebar uses resolved theme and package version', () => {
  const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
  const sidebar = readFileSync(new URL('../src/components/layout/sidebar.tsx', import.meta.url), 'utf8');
  const sync = readFileSync(new URL('../src/components/layout/theme-sync.tsx', import.meta.url), 'utf8');
  assert.match(layout, /<head>[\s\S]*?__html: THEME_BOOTSTRAP_SCRIPT[\s\S]*?<\/head>/);
  assert.match(layout, /<ThemeSync\s*\/>/);
  assert.match(sync, /useEffect\(\(\) => syncTheme\(useUIStore, document.documentElement\), \[\]\)/);
  assert.match(sidebar, /const isDark = isDarkTheme\(theme, systemDark\)/);
  assert.match(sidebar, /const newTheme = isDark \? 'light' : 'dark'/);
  assert.doesNotMatch(sidebar, /document.documentElement.classList/);
  assert.match(sidebar, /import packageInfo from '\.\.\/\.\.\/\.\.\/package.json'/);
  assert.match(sidebar, /v\{packageInfo.version\} \(Beta\)/);
});
