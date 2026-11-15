import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
const keyboard = read('hooks/use-keyboard-shortcuts.ts');
const toolbar = read('components/layout/toolbar.tsx');

test('toolbar mode click delegates without changing store or emitting premature success', () => {
  const ast = ts.createSourceFile('toolbar.tsx', toolbar, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let arrow;
  function visit(node) {
    if (ts.isArrowFunction(node) && node.body.getText(ast) === 'onViewModeChange(mode)') arrow = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(arrow, 'mode button must delegate to the owner');
  const calls = [];
  const fn = vm.runInNewContext('(' + arrow + ')', { mode: 'source', onViewModeChange: mode => calls.push(mode) });
  fn();
  assert.deepEqual(calls, ['source']);
  assert.doesNotMatch(toolbar, /\bsetViewMode\b|analytics\.viewModeChange/);
});

test('keyboard cycles request a transition and preserve unrelated shortcuts and cleanup', () => {
  let handler, cleanup, mode = 'wysiwyg';
  const requests = [], events = [];
  const actions = { toggleSidebar: () => events.push('sidebar'), toggleFocusMode: () => events.push('focus') };
  const store = () => ({ actions });
  store.getState = () => ({ viewMode: mode, focusMode: true });
  const exports = {};
  const js = ts.transpileModule(keyboard, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, require: name => name === 'react' ? { useEffect: fn => { cleanup = fn(); } } : { useUIStore: store }, window: {
    addEventListener: (name, fn) => { assert.equal(name, 'keydown'); handler = fn; },
    removeEventListener: (name, fn) => { assert.equal(name, 'keydown'); assert.equal(fn, handler); events.push('cleanup'); },
  } });
  exports.useKeyboardShortcuts({ onViewModeChange: next => requests.push(next), onNewDocument: () => events.push('new'), onForceSave: () => events.push('save') });
  const press = (key, shiftKey = false) => handler({ key, shiftKey, ctrlKey: true, preventDefault() {} });
  for (mode of ['wysiwyg', 'split', 'source']) press('E', true);
  assert.deepEqual(requests, ['split', 'source', 'wysiwyg']);
  press('n'); press('s'); press('\\'); cleanup();
  assert.deepEqual(events, ['new', 'save', 'sidebar', 'cleanup']);
  assert.doesNotMatch(keyboard, /\bsetViewMode\b/);
});
