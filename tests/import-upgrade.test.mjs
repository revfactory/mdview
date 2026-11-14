import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

function load(file, mocks) {
  const source = readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, Date, require: (name) => {
    if (!(name in mocks)) throw new Error('Unexpected dependency: ' + name);
    return mocks[name];
  } });
  return exports;
}

test('actual v3 schema preserves v2 data and atomically imports real chunk output', async () => {
  const name = 'upgrade-' + crypto.randomUUID();
  const old = new Dexie(name, { indexedDB, IDBKeyRange });
  old.version(2).stores({
    documents: 'id, [folderId+sortOrder], updatedAt, isFavorite, *tags',
    folders: 'id, [parentId+sortOrder], name',
    settings: 'id',
    chunks: '++id, docId, [docId+chunkIndex]',
  });
  await old.open();
  const original = { id: 'old', content: 'preserved', tags: ['keep'], folderId: 'folder', sortOrder: 1 };
  await old.documents.add(original);
  await old.folders.add({ id: 'folder', name: 'keep folder' });
  await old.settings.add({ id: 'settings', theme: 'dark' });
  await old.chunks.add({ docId: 'old', chunkIndex: 0, markdown: 'preserved chunk' });
  old.close();
  class TestDexie extends Dexie {
    constructor() { super(name, { indexedDB, IDBKeyRange }); }
  }
  const { db } = load('db/index.ts', { dexie: TestDexie });
  try {
    await db.open();
    assert.equal(db.verno, 3);
    assert.deepEqual(await db.documents.get('old'), original);
    assert.equal((await db.folders.get('folder')).name, 'keep folder');
    assert.equal((await db.settings.get('settings')).theme, 'dark');
    assert.equal((await db.chunks.where('docId').equals('old').first()).markdown, 'preserved chunk');
    await db.files.add({ id: 'original-pdf', blob: new Blob(['PDF original bytes']) });
    const docs = load('db/documents.ts', {
      dexie: Dexie, '@/db': { db },
      nanoid: { nanoid: () => crypto.randomUUID() },
      '@/lib/utils': { calculateWordCount: () => 1, extractExcerpt: () => '' },
    });
    const chunks = load('db/chunks.ts', { './index': { db } });
    const chunker = load('lib/chunk-document.ts', {});
    const importer = load('lib/import-document.ts', {
      '@/db': { db }, '@/db/documents': docs,
      '@/db/chunks': chunks, '@/lib/chunk-document': chunker,
    });
    const source = ('# Heading\n\n' + 'paragraph '.repeat(2000) + '\n\n').repeat(20);
    const expected = chunker.chunkDocument(source);
    assert.ok(expected.length > 1);
    const fail = () => { throw new Error('simulated quota'); };
    db.chunks.hook('creating', fail);
    await assert.rejects(importer.createImportedDocument(source, 'failure'), /simulated quota/);
    db.chunks.hook('creating').unsubscribe(fail);
    assert.equal(await db.documents.count(), 1);
    assert.equal(await db.chunks.count(), 1);
    const result = await importer.createImportedDocument(source, 'retry');
    assert.equal(result.chunkCount, expected.length);
    assert.equal((await db.documents.get(result.id)).isChunked, true);
    const stored = await db.chunks.where('docId').equals(result.id).sortBy('chunkIndex');
    assert.deepEqual(stored.map(c => c.markdown), Array.from(expected, c => c.markdown));
    assert.deepEqual(await db.documents.get('old'), original);
    assert.equal(await (await db.files.get('original-pdf')).blob.text(), 'PDF original bytes');
  } finally {
    await db.delete();
  }
});
