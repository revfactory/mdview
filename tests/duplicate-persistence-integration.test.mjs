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
    const openPeer = async () => {
      const peer = new Dexie(name, { indexedDB, IDBKeyRange });
      await peer.open();
      return peer;
    };
    // Simulate an editor's loaded identity: capture once, never at save time.
    const loadedIds = await Promise.all([0, 1].map(async page => (await chunks.getChunk('source', page)).id));
    const loadedChunks = { ...chunks, updateChunk: (...args) => chunks.updateChunk(...args,
      ...(args.length === 4 ? [loadedIds[args[1]]] : [])) };
    await run({ db, documents, chunks: loadedChunks, queue, copy, openPeer });
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

test('independent DB connection sees coherent pages when rechunk and copy overlap', () => fixture(async ({ db, chunks, copy, openPeer }) => {
  const peer = await openPeer();
  try {
    const replacement = peer.transaction('rw', peer.table('documents'), peer.table('chunks'), async () => {
      await peer.table('chunks').where('docId').equals('source').delete();
      await peer.table('chunks').add({ docId: 'source', chunkIndex: 0, markdown: 'peer replacement', htmlContent: '', updatedAt: new Date() });
      await peer.table('documents').update('source', { content: 'peer replacement', chunkCount: 1 });
    });
    const copying = copy();
    await replacement;
    const id = await copying;
    db.close(); await db.open();
    const document = await db.documents.get(id);
    const pages = await db.chunks.where('docId').equals(id).sortBy('chunkIndex');
    assert.equal(pages.length, document.chunkCount);
    // Either complete old or complete new snapshot is legal; mixing is not.
    assert.ok(
      (pages.length === 1 && document.content === 'peer replacement' && pages[0].markdown === 'peer replacement') ||
      (pages.length === 2 && document.content === 'stale' && pages[0].markdown === 'old 0' && pages[1].markdown === 'old 1'),
    );
    assert.equal(await chunks.getChunkCount('source'), 1);
  } finally { peer.close(); }
}));

test('copy transaction abort is visible as no partial document from another connection', () => fixture(async ({ db, copy, openPeer }) => {
  const peer = await openPeer();
  const fail = () => { throw Error('copy quota'); };
  try {
    db.chunks.hook('creating', fail);
    await assert.rejects(copy(), /copy quota/);
    assert.equal(await peer.table('documents').count(), 1);
    assert.equal(await peer.table('chunks').count(), 2);
    assert.equal((await peer.table('documents').get('source')).title, '한글 원본');
    db.chunks.hook('creating').unsubscribe(fail);
    const id = await copy();
    assert.equal((await peer.table('documents').get(id)).chunkCount, 2);
    assert.equal(await peer.table('chunks').where('docId').equals(id).count(), 2);
  } finally { db.chunks.hook('creating').unsubscribe(fail); peer.close(); }
}));

test('delayed page edit after document deletion must reject without orphan resurrection', () => fixture(async ({ db, documents, chunks, queue }) => {
  await documents.deleteDocument('source');
  await assert.rejects(queue.enqueueDocumentOperation('source',
    () => chunks.updateChunk('source', 0, 'late edit', '<p>late edit</p>'), { scope: 'page', page: 0 }));
  assert.equal(await db.documents.count(), 0);
  assert.equal(await db.chunks.count(), 0);
}));

test('delayed page edit after rechunk removes its page must not recreate it', () => fixture(async ({ db, documents, chunks, queue }) => {
  await db.transaction('rw', db.documents, db.chunks, async () => {
    await chunks.saveChunks('source', [{ index: 0, markdown: 'replacement' }]);
    await documents.updateDocument('source', { content: 'replacement', chunkCount: 1 });
  });
  await assert.rejects(queue.enqueueDocumentOperation('source',
    () => chunks.updateChunk('source', 1, 'stale page one', ''), { scope: 'page', page: 1 }));
  assert.equal(await chunks.getChunkCount('source'), 1);
  assert.equal((await chunks.getChunk('source', 0)).markdown, 'replacement');
}));

test('missing page rejects without silently creating replacement text', () => fixture(async ({ db, chunks, queue }) => {
  await db.chunks.where('[docId+chunkIndex]').equals(['source', 0]).delete();
  await assert.rejects(queue.enqueueDocumentOperation('source',
    () => chunks.updateChunk('source', 0, 'replacement text', ''), { scope: 'page', page: 0 }), /페이지/);
  await assert.rejects(queue.awaitDocumentSaves('source'), /페이지/);
  assert.equal(await chunks.getChunkCount('source'), 1);
  assert.equal((await chunks.getChunk('source', 1)).markdown, 'old 1');
}));

test('same-index replacement rejects a previously loaded editor snapshot', () => fixture(async ({ db, documents, chunks, queue }) => {
  const old = await chunks.getChunk('source', 0);
  await db.transaction('rw', db.documents, db.chunks, async () => {
    await chunks.saveChunks('source', [{ index: 0, markdown: 'new generation' }]);
    await documents.updateDocument('source', { content: 'new generation', chunkCount: 1 });
  });
  const replacement = await chunks.getChunk('source', 0);
  assert.notEqual(replacement.id, old.id);
  await assert.rejects(queue.enqueueDocumentOperation('source',
    () => chunks.updateChunk('source', 0, 'stale old editor', '', old.id), { scope: 'page', page: 0 }), /다시 구성/);
  assert.equal((await chunks.getChunk('source', 0)).markdown, 'new generation');
  // A newly loaded editor can save; the matching successful retry clears failure.
  await queue.enqueueDocumentOperation('source',
    () => chunks.updateChunk('source', 0, 'new edit', '', replacement.id), { scope: 'page', page: 0 });
  await queue.awaitDocumentSaves('source');
  assert.equal((await chunks.getChunk('source', 0)).markdown, 'new edit');
}));

test('page writes without a loaded identity fail closed', () => fixture(async ({ chunks }) => {
  await assert.rejects(chunks.updateChunk('source', 0, 'unidentified edit', '', undefined), /다시 구성/);
  assert.equal((await chunks.getChunk('source', 0)).markdown, 'old 0');
}));

test('automatic pagination commits metadata and pages together and rolls back metadata failure',()=>fixture(async({db,chunks})=>{
 await db.chunks.where('docId').equals('source').delete();
 await db.documents.update('source',{isChunked:false,chunkCount:0,content:'raw original'});
 const expected=await db.documents.get('source');
 const fail=()=>{throw Error('metadata quota');};db.documents.hook('updating',fail);
 await assert.rejects(chunks.autoChunkDocument('source',expected,[{index:0,markdown:'raw original'}]),/metadata quota/);
 assert.equal(await chunks.getChunkCount('source'),0);assert.equal((await db.documents.get('source')).isChunked,false);
 db.documents.hook('updating').unsubscribe(fail);
 await chunks.autoChunkDocument('source',expected,[{index:0,markdown:'raw original'}]);
 assert.equal((await db.documents.get('source')).isChunked,true);assert.equal(await chunks.getChunkCount('source'),1);
}));
test('automatic pagination refuses a stale peer-edited or deleted document snapshot',()=>fixture(async({db,chunks,openPeer})=>{
 await db.chunks.where('docId').equals('source').delete();await db.documents.update('source',{isChunked:false,chunkCount:0,content:'old raw'});
 const expected=await db.documents.get('source');const peer=await openPeer();
 try{
  await peer.table('documents').update('source',{content:'peer newer'});
  await assert.rejects(chunks.autoChunkDocument('source',expected,[{index:0,markdown:'old raw'}]),/문서가 변경/);
  assert.equal(await chunks.getChunkCount('source'),0);assert.equal((await db.documents.get('source')).content,'peer newer');
  await peer.table('documents').delete('source');
  await assert.rejects(chunks.autoChunkDocument('source',expected,[{index:0,markdown:'old raw'}]),/문서가 변경/);
  assert.equal(await chunks.getChunkCount('source'),0);
 }finally{peer.close();}
}));
test('automatic pagination does not replace existing or already-paginated page records',()=>fixture(async({db,chunks})=>{
 let expected=await db.documents.get('source');
 await assert.rejects(chunks.autoChunkDocument('source',expected,[{index:0,markdown:'replacement'}]),/문서가 변경/);
 await db.documents.update('source',{isChunked:false,chunkCount:0});expected=await db.documents.get('source');
 await assert.rejects(chunks.autoChunkDocument('source',expected,[{index:0,markdown:'replacement'}]),/문서가 변경/);
 assert.equal((await chunks.getChunk('source',0)).markdown,'old 0');assert.equal(await chunks.getChunkCount('source'),2);
}));

test('ordinary save after peer deletion rejects instead of reporting a successful no-op', () => fixture(async ({ db, documents, queue, openPeer }) => {
  await db.documents.add({ id: 'plain', title: 'plain', content: 'original', tags: [] });
  const peer = await openPeer();
  try { await peer.table('documents').delete('plain'); } finally { peer.close(); }
  await assert.rejects(queue.enqueueDocumentSave('plain', 'unsaved local edit', ''), /문서/);
  await assert.rejects(queue.awaitDocumentSaves('plain'), /문서/);
  assert.equal(await db.documents.get('plain'), undefined);
  assert.equal((await db.documents.get('source')).content, 'stale');
  await assert.rejects(documents.updateContent('missing', 'raw', ''), /문서/);
}));

test('ordinary existing document save still writes content and completes its barrier', () => fixture(async ({ db, queue }) => {
  await db.documents.add({ id: 'plain', title: 'plain', content: 'original', tags: [] });
  await queue.enqueueDocumentSave('plain', 'new raw', '<p>new raw</p>');
  await queue.awaitDocumentSaves('plain');
  const saved = await db.documents.get('plain');
  assert.equal(saved.content, 'new raw');
  assert.equal(saved.htmlContent, '<p>new raw</p>');
  assert.equal(saved.charCount, 7);
}));
