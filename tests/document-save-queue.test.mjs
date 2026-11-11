import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/document-save-queue.ts', import.meta.url), 'utf8')
  .replace("import { updateContent } from '@/db/documents';", 'const updateContent = async () => {};');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createDocumentSaveQueue } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('starts promptly and serializes Markdown and HTML-only snapshots', async () => {
  const calls = [], gates = [deferred(), deferred(), deferred()];
  const q = createDocumentSaveQueue((...args) => { calls.push(args); return gates[calls.length - 1].promise; });
  const a = q.enqueueDocumentSave('a', 'source', '');
  assert.deepEqual(calls, [['a', 'source', '']]);
  const b = q.enqueueDocumentSave('a', 'source', '<p>source</p>');
  const c = q.enqueueDocumentSave('a', 'new', '<p>new</p>');
  assert.equal(calls.length, 1);
  gates[0].resolve(); await a; await tick();
  assert.deepEqual(calls[1], ['a', 'source', '<p>source</p>']);
  gates[1].resolve(); await b; await tick();
  assert.deepEqual(calls[2], ['a', 'new', '<p>new</p>']);
  gates[2].resolve(); await c; await q.awaitDocumentSaves('a');
});

test('document switching does not block independent documents or cross IDs', async () => {
  const calls = [], a = deferred(), b = deferred();
  const q = createDocumentSaveQueue((...args) => { calls.push(args); return args[0] === 'a' ? a.promise : b.promise; });
  const one = q.enqueueDocumentSave('a', 'A', 'HA');
  const two = q.enqueueDocumentSave('b', 'B', 'HB');
  assert.deepEqual(calls, [['a', 'A', 'HA'], ['b', 'B', 'HB']]);
  b.resolve(); await two; await q.awaitDocumentSaves('b');
  a.resolve(); await one;
});

test('load barrier includes snapshots appended while waiting', async () => {
  const gates = [deferred(), deferred()]; let calls = 0, loaded = false;
  const q = createDocumentSaveQueue(() => gates[calls++].promise);
  const a = q.enqueueDocumentSave('a', 'old', '');
  const loading = q.awaitDocumentSaves('a').then(() => { loaded = true; });
  const b = q.enqueueDocumentSave('a', 'latest', '');
  gates[0].resolve(); await a; await tick(); assert.equal(loaded, false);
  gates[1].resolve(); await b; await loading; assert.equal(loaded, true);
});

test('failed saves reject callers and load barriers, then later saves recover', async () => {
  let fail = true;
  const q = createDocumentSaveQueue(async () => { if (fail) throw new Error('quota'); });
  await assert.rejects(q.enqueueDocumentSave('a', 'first', ''), /quota/);
  await assert.rejects(q.awaitDocumentSaves('a'), /quota/);
  fail = false;
  await q.enqueueDocumentSave('a', 'retry', '');
  await q.awaitDocumentSaves('a');
});

test('synchronous writer exceptions are promises and ignored saves are observed', async () => {
  const q = createDocumentSaveQueue(() => { throw new Error('unavailable'); });
  const promise = q.enqueueDocumentSave('a', 'first', '');
  await assert.rejects(promise, /unavailable/);
  q.enqueueDocumentSave('b', 'ignored', '');
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(q.awaitDocumentSaves('b'), /unavailable/);
});

test('a failed snapshot cannot prevent an already queued newer save or its load', async () => {
  const first = deferred(); let calls = 0;
  const q = createDocumentSaveQueue(() => ++calls === 1 ? first.promise : Promise.resolve());
  const a = q.enqueueDocumentSave('a', 'old', '');
  const b = q.enqueueDocumentSave('a', 'new', '<p>new</p>');
  const loading = q.awaitDocumentSaves('a');
  first.reject(new Error('temporary'));
  await assert.rejects(a, /temporary/);
  await b; await loading;
  assert.equal(calls, 2);
});
