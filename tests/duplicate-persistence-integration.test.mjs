import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import Dexie from 'dexie';
import { createRequire } from 'node:module';
const requireDependency = createRequire(import.meta.url);
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

// Load the actual versioned schema, writers, queue and copy barrier together.
// fake-indexeddb is deliberate: this does not assert native browser/UI coverage.
async function fixture(run) {
  const name = 'integration-' + crypto.randomUUID();
  class IsolatedDexie extends Dexie {
    constructor() { super(name, { indexedDB, IDBKeyRange }); }
  }
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const exports = {};
    modules.set(path, exports);
    const source = readFileSync(new URL('../src/' + path + '.ts', import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, { exports, Date, require(name) {
      if (name === 'dexie') return IsolatedDexie;
      if (name === 'nanoid') return { nanoid: () => crypto.randomUUID() };
      if (name === '@/db' || name === './index') return load('db/index');
      if (name.startsWith('./')) return load(path.slice(0, path.lastIndexOf('/') + 1) + name.slice(2));
      if (name.startsWith('@/')) return load(name.slice(2));
      if (['clsx', 'tailwind-merge'].includes(name)) return requireDependency(name);
      throw new Error('Unexpected import: ' + name);
    } });
    return exports;
  }
  const { db } = load('db/index');
  const documents = load('db/documents');
  const chunks = load('db/chunks');
  const queue = load('lib/document-save-queue');
  const { copyDocumentSnapshot } = load('lib/copy-document-snapshot');
  const copy = (flush) => copyDocumentSnapshot('source', flush, queue.awaitDocumentSaves, documents.duplicateDocument);
  try {
    await db.documents.add({ id: 'source', title: '한글 원본', content: 'stale', tags: [], isChunked: true, chunkCount: 2 });
    await chunks.saveChunks('source', [{ index: 0, markdown: 'old 0' }, { index: 1, markdown: 'old 1' }]);
    await run({ db, documents, chunks, queue, copy });
  } finally { await db.delete(); }
}
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};

test('real schema + queue + barrier copies flushed page data that survives DB reopen', () => fixture(async ({ db, chunks, queue, copy }) => {
  const id = await copy(() => queue.enqueueDocumentOperation('source',
    () => chunks.updateChunk('source', 0, '최신 😀', '<p>최신 😀</p>'), { scope: 'page', page: 0 }));
  db.close(); await db.open();
  assert.equal((await chunks.getChunk(id, 0)).markdown, '최신 😀');
  assert.equal((await chunks.getChunk('source', 0)).markdown, '최신 😀');
  assert.equal((await db.documents.get(id)).chunkCount, 2);
}));

test('copy waits for a second queued edit appended during first write', () => fixture(async ({ chunks, queue, copy }) => {
  const gate = deferred();
  const first = queue.enqueueDocumentOperation('source', async () => {
    await gate.promise; await chunks.updateChunk('source', 0, 'first', '');
  });
  const pending = copy();
  const second = queue.enqueueDocumentOperation('source', () => chunks.updateChunk('source', 0, 'second', ''), { scope: 'page', page: 0 });
  gate.resolve(); await Promise.all([first, second]);
  const id = await pending;
  assert.equal((await chunks.getChunk(id, 0)).markdown, 'second');
}));

test('failed queued write blocks copy and retry restores a durable consistent copy', () => fixture(async ({ db, chunks, queue, copy }) => {
  const fail = () => { throw Error('write quota'); };
  db.chunks.hook('updating', fail);
  await assert.rejects(queue.enqueueDocumentOperation('source',
    () => chunks.updateChunk('source', 0, 'failed', ''), { scope: 'page', page: 0 }), /write quota/);
  await assert.rejects(copy(), /write quota/);
  assert.equal(await db.documents.count(), 1);
  assert.equal((await chunks.getChunk('source', 0)).markdown, 'old 0');
  db.chunks.hook('updating').unsubscribe(fail);
  await queue.enqueueDocumentOperation('source', () => chunks.updateChunk('source', 0, 'retry', ''), { scope: 'page', page: 0 });
  const id = await copy(); db.close(); await db.open();
  assert.equal((await chunks.getChunk(id, 0)).markdown, 'retry');
}));

test('atomic re-chunk failure rolls back metadata and pages through actual source queue', () => fixture(async ({ db, documents, chunks, queue, copy }) => {
  const fail = () => { throw Error('metadata quota'); };
  db.documents.hook('updating', fail);
  await assert.rejects(queue.enqueueDocumentOperation('source', () =>
    db.transaction('rw', db.documents, db.chunks, async () => {
      await chunks.saveChunks('source', [{ index: 0, markdown: 'replacement' }]);
      await documents.updateDocument('source', { content: 'replacement', chunkCount: 1 });
    }), { scope: 'document' }), /metadata quota/);
  assert.equal((await db.documents.get('source')).chunkCount, 2);
  assert.equal((await chunks.getChunk('source', 0)).markdown, 'old 0');
  assert.equal(await chunks.getChunkCount('source'), 2);
  await assert.rejects(copy(), /metadata quota/);
  assert.equal(await db.documents.count(), 1);
}));

test('copy must not forget a failed page when another page later saves successfully', () => fixture(async ({ db, chunks, queue, copy }) => {
  const fail = () => { throw Error('page zero quota'); };
  db.chunks.hook('updating', fail);
  await assert.rejects(queue.enqueueDocumentOperation('source',
    () => chunks.updateChunk('source', 0, 'unsaved page zero', ''), { scope: 'page', page: 0 }), /page zero quota/);
  db.chunks.hook('updating').unsubscribe(fail);
  await queue.enqueueDocumentOperation('source', () => chunks.updateChunk('source', 1, 'new page one', ''), { scope: 'page', page: 1 });
  assert.equal((await chunks.getChunk('source', 0)).markdown, 'old 0');
  await assert.rejects(copy(), /page zero quota/, 'copy must stop until the failed page is recovered');
}));
