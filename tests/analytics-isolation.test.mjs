import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/analytics.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function load(window) {
  const context = { exports: {} };
  if (window !== undefined) context.window = window;
  vm.runInNewContext(compiled, context);
  return context.exports;
}

function invokeAll(analytics) {
  for (const [name, track] of Object.entries(analytics)) {
    if (name === 'startAction') track('new', 'home');
    else track('test');
  }
}

test('analytics is optional during SSR, before load, and when disabled', () => {
  for (const window of [undefined, {}, { gtag: null }, { gtag: false }, { gtag: 'blocked' }]) {
    assert.doesNotThrow(() => invokeAll(load(window).analytics));
  }
});

test('throwing analytics never interrupts any product event', () => {
  let calls = 0;
  const { analytics } = load({ gtag() { calls++; throw new Error('analytics unavailable'); } });
  assert.doesNotThrow(() => invokeAll(analytics));
  assert.equal(calls, Object.keys(analytics).length);
});

test('an inaccessible analytics property cannot break a product operation', () => {
  const window = {};
  Object.defineProperty(window, 'gtag', { get() { throw new Error('blocked property'); } });
  assert.doesNotThrow(() => invokeAll(load(window).analytics));
});

test('normal event payload and receiver remain unchanged', () => {
  const calls = [];
  const window = { gtag(...args) { assert.equal(this, window); calls.push(args); } };
  const { trackEvent, analytics } = load(window);
  trackEvent({ action: 'save', category: 'test', label: 'fixed', value: 3 });
  analytics.startAction('new', 'home');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['event', 'save', { event_category: 'test', event_label: 'fixed', value: 3 }],
    ['event', 'editor_start', { entry_action: 'new', entry_source: 'home' }],
  ]);
});

test('a failed event is not retried and later tracking can recover', () => {
  let failures = 0;
  const window = { gtag() { failures++; throw new Error('temporary'); } };
  const { analytics } = load(window);
  assert.doesNotThrow(() => analytics.documentCreate());
  assert.equal(failures, 1);
  const calls = [];
  window.gtag = (...args) => calls.push(args);
  analytics.documentOpen();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'open');
});

const sidebar = readFileSync(new URL('../src/components/layout/sidebar.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('sidebar.tsx', sidebar, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let createCallback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'handleFolderCreate') {
    createCallback = node.initializer.arguments[0].getText(parsed);
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(createCallback, 'use the real folder-create callback');
function folderCallback(createFolder, analytics) {
  const code = ts.transpileModule(`const run = ${createCallback};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return vm.runInNewContext(`${code}\nrun`, { createFolder, analytics });
}

test('real folder-create callback resolves after committed write even if tracking fails', async () => {
  const writes = [];
  const { analytics } = load({ gtag() { throw new Error('tracking failure'); } });
  const run = folderCallback(async (folder) => { writes.push(folder.name); }, analytics);
  await assert.doesNotReject(run('새 폴더'));
  assert.deepEqual(writes, ['새 폴더']);
});

test('real storage failure still rejects and does not emit a success event', async () => {
  let events = 0;
  const { analytics } = load({ gtag() { events++; } });
  const failure = new Error('storage unavailable');
  const run = folderCallback(async () => { throw failure; }, analytics);
  await assert.rejects(run('새 폴더'), (error) => error === failure);
  assert.equal(events, 0);
});
