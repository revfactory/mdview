import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import ts from 'typescript';

function load(file, dependencies = {}) {
  const source = readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } });
  const exports = {};
  vm.runInNewContext(outputText, { Date, exports, require(name) {
    if (!(name in dependencies)) throw new Error('Unexpected dependency ' + name);
    return dependencies[name];
  } });
  return exports;
}

async function withImport(run) {
  class TestDexie extends Dexie {
    constructor() { super('atomic-import-' + crypto.randomUUID(), { indexedDB, IDBKeyRange }); }
  }
  const { db } = load('db/index.ts', { dexie: TestDexie });
  const documents = load('db/documents.ts', {
    '@/db': { db }, dexie: Dexie, nanoid: { nanoid: () => crypto.randomUUID() },
    '@/lib/utils': { calculateWordCount: () => 1, extractExcerpt: () => 'excerpt' },
  });
  const chunks = load('db/chunks.ts', { './index': { db } });
  const { createImportedDocument } = load('lib/import-document.ts', {
    '@/db': { db }, '@/db/documents': documents, '@/db/chunks': chunks,
    '@/lib/chunk-document': load('lib/chunk-document.ts'),
    '@/lib/markdown': { markdownToHtmlAsync: async () => '<h1>small</h1>' },
  });
  try {
    await db.open();
    await run({ db, createImportedDocument, ...documents, ...chunks });
  } finally {
    await db.delete();
  }
}

const source = '# 한글 😀\r\n\r\n' + ('문단 내용 🐚\r\n\r\n'.repeat(30000));

test('large import stores source, folder, and every ordered page with matching metadata', () => withImport(async ({
  db, createImportedDocument, getAllChunksMarkdown,
}) => {
  const result = await createImportedDocument(source, 'large', { folderId: 'folder' });
  assert.ok(result.chunkCount > 2);
  const document = await db.documents.get(result.id);
  assert.equal(document.content, source);
  assert.equal(document.folderId, 'folder');
  assert.equal(document.isChunked, true);
  assert.equal(document.chunkCount, result.chunkCount);
  const pages = await db.chunks.where('docId').equals(result.id).sortBy('chunkIndex');
  assert.equal(pages.length, result.chunkCount);
  assert.ok(pages.every((page, i) => page.chunkIndex === i));
  assert.equal(await getAllChunksMarkdown(result.id), source);
}));

test('chunk transaction abort rolls back new document; previous content and PDF bytes survive retry', () => withImport(async ({
  db, createImportedDocument, saveChunks, getAllChunksMarkdown,
}) => {
  await db.documents.add({ id: 'prior', content: 'keep' });
  await saveChunks('prior', [{ index: 0, markdown: 'keep' }]);
  await db.files.add({ id: 'original-pdf', blob: new Blob(['original bytes']) });
  const beforeDocuments = await db.documents.toArray();
  const beforeChunks = await db.chunks.toArray();
  let aborted = false;
  function abortAfterSecondChunk(_key, object, trans) {
    if (object.chunkIndex !== 1) return;
    this.onsuccess = () => { aborted = true; trans.abort(); };
  }
  db.chunks.hook('creating', abortAfterSecondChunk);
  try {
    await assert.rejects(createImportedDocument(source, 'failed'));
  } finally {
    db.chunks.hook('creating').unsubscribe(abortAfterSecondChunk);
  }
  assert.equal(aborted, true);
  db.close();
  await db.open();
  assert.deepEqual(await db.documents.toArray(), beforeDocuments);
  assert.deepEqual(await db.chunks.toArray(), beforeChunks);
  assert.equal(await (await db.files.get('original-pdf')).blob.text(), 'original bytes');
  const retry = await createImportedDocument(source, 'retry');
  assert.equal(await db.documents.count(), 2);
  assert.equal(await getAllChunksMarkdown(retry.id), source);
}));

test('small import stays unpaginated and retains its rendered HTML', () => withImport(async ({
  db, createImportedDocument,
}) => {
  const result = await createImportedDocument('# small', 'small');
  const document = await db.documents.get(result.id);
  assert.equal(result.chunkCount, null);
  assert.equal(document.isChunked, undefined);
  assert.equal(document.chunkCount, undefined);
  assert.equal(document.htmlContent, '<h1>small</h1>');
  assert.equal(await db.chunks.count(), 0);
}));


test('rejection of the document write never leaves newly imported pages', () => withImport(async ({
  db, createImportedDocument,
}) => {
  const fail = () => { throw new Error('document write rejected'); };
  db.documents.hook('creating', fail);
  try {
    await assert.rejects(createImportedDocument(source, 'failed'), /document write rejected/);
  } finally {
    db.documents.hook('creating').unsubscribe(fail);
  }
  assert.equal(await db.documents.count(), 0);
  assert.equal(await db.chunks.count(), 0);
}));

test('PDF original write failure rolls back metadata and preserves earlier original bytes',()=>withImport(async h=>{
 const original=new Blob(['original-pdf-bytes'],{type:'application/pdf'});
 const id=await h.createPdfDocument({title:'original',file:original,fileName:'original.pdf',pageCount:2});
 const fail=()=>{throw new Error('PDF quota');};h.db.files.hook('creating',fail);
 await assert.rejects(h.createPdfDocument({title:'failed',file:new Blob(['new']),fileName:'new.pdf',pageCount:1}),/PDF quota/);
 h.db.files.hook('creating').unsubscribe(fail);
 assert.equal(await h.db.documents.count(),1);assert.equal(await h.db.files.count(),1);
 assert.equal((await h.db.documents.get(id)).kind,'pdf');
 assert.equal(await (await h.db.files.get(id)).blob.text(),'original-pdf-bytes');
 const retry=await h.createPdfDocument({title:'retry',file:new Blob(['retry-bytes']),fileName:'retry.pdf',pageCount:3});
 assert.equal((await h.db.documents.get(retry)).pageCount,3);
 assert.equal(await (await h.db.files.get(retry)).blob.text(),'retry-bytes');
}));
