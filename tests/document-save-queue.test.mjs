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

test('multiple load barriers follow the newest queued failure without affecting other documents', async () => {
  const first = deferred(), second = deferred();
  let calls = 0;
  const failure = new Error('newest snapshot failed');
  const q = createDocumentSaveQueue(id => id === 'a' ? (++calls === 1 ? first.promise : second.promise) : Promise.resolve());
  const oldSave = q.enqueueDocumentSave('a', 'old', '');
  const firstBarrier = q.awaitDocumentSaves('a');
  const newSave = q.enqueueDocumentSave('a', 'new', '');
  const secondBarrier = q.awaitDocumentSaves('a');
  const checks = [newSave, firstBarrier, secondBarrier].map(p => assert.rejects(p, e => e === failure));
  first.resolve(); await oldSave; await tick();
  await q.enqueueDocumentSave('b', 'independent', '');
  await q.awaitDocumentSaves('b');
  second.reject(failure);
  await Promise.all(checks);
  await assert.rejects(q.awaitDocumentSaves('a'), e => e === failure);
});

test('a third snapshot appended during recovery keeps every loader waiting', async () => {
  const gates = [deferred(), deferred(), deferred()];
  let calls = 0, loaded = 0;
  const q = createDocumentSaveQueue(() => gates[calls++].promise);
  const a = q.enqueueDocumentSave('a', 'old', '');
  const aRejected = assert.rejects(a, /first/);
  const b = q.enqueueDocumentSave('a', 'retry', '');
  const barriers = [q.awaitDocumentSaves('a'), q.awaitDocumentSaves('a')].map(p => p.then(() => loaded++));
  gates[0].reject(new Error('first')); await aRejected; await tick();
  const c = q.enqueueDocumentSave('a', 'latest', '');
  gates[1].resolve(); await b; await tick();
  assert.equal(loaded, 0);
  gates[2].resolve(); await c; await Promise.all(barriers);
  assert.equal(loaded, 2);
  assert.equal(calls, 3);
});

test('settled old saves never remove a newer synchronous write failure', async () => {
  const gate = deferred(); let calls = 0;
  const failure = new Error('writer unavailable');
  const q = createDocumentSaveQueue(() => {
    if (++calls === 1) return gate.promise;
    throw failure;
  });
  const oldSave = q.enqueueDocumentSave('a', 'old', '');
  const newSave = q.enqueueDocumentSave('a', 'latest', '');
  const rejected = assert.rejects(newSave, e => e === failure);
  gate.resolve(); await oldSave; await rejected;
  await assert.rejects(q.awaitDocumentSaves('a'), e => e === failure);
});

test('chunk/source operations share snapshot barrier and preserve document isolation', async () => {
  const q = createDocumentSaveQueue(async () => {});
  const gate = deferred(), calls = [];
  const first = q.enqueueDocumentOperation('a', async () => { await gate.promise; calls.push('chunks'); });
  const second = q.enqueueDocumentOperation('a', async () => { calls.push('source'); });
  await q.enqueueDocumentOperation('b', async () => { calls.push('other'); });
  let done = false;
  const barrier = q.awaitDocumentSaves('a').then(() => { done = true; });
  await tick(); assert.equal(done, false); assert.deepEqual(calls, ['other']);
  gate.resolve(); await Promise.all([first, second, barrier]);
  assert.deepEqual(calls, ['other', 'chunks', 'source']);
});
