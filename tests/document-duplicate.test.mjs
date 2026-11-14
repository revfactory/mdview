import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

async function fixture(run) {
  const db = new Dexie(`copy-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange });
  db.version(3).stores({ documents: 'id', files: 'id', chunks: '++id,docId,[docId+chunkIndex]' });
  const source = readFileSync(new URL('../src/db/documents.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, Date, require: name => name === '@/db' ? { db } : name === 'nanoid' ? { nanoid: () => crypto.randomUUID() } : name === 'dexie' ? Dexie : {} });
  await db.documents.add({ id: 'source', title: 'Original', content: 'stale original', tags: ['tag'], isChunked: true, chunkCount: 2 });
  await db.chunks.bulkAdd([0, 1].map(chunkIndex => ({ docId: 'source', chunkIndex, markdown: `latest ${chunkIndex}`, htmlContent: `<p>latest ${chunkIndex}</p>` })));
  try { await run(db, exports.duplicateDocument); } finally { await db.delete(); }
}

test('copy preserves latest persisted page edits, metadata and independent chunk ids', () => fixture(async (db, duplicate) => {
  const id = await duplicate('source');
  const copy = await db.documents.get(id);
  assert.equal(copy.isChunked, true); assert.equal(copy.chunkCount, 2);
  assert.equal(copy.title, 'Original (복사본)'); assert.deepEqual(copy.tags, ['tag']);
  const chunks = await db.chunks.where('docId').equals(id).sortBy('chunkIndex');
  assert.deepEqual(chunks.map(c => c.markdown), ['latest 0', 'latest 1']);
  await db.chunks.update(chunks[0].id, { markdown: 'copy only' });
  assert.equal((await db.chunks.where('[docId+chunkIndex]').equals(['source', 0]).first()).markdown, 'latest 0');
}));

test('chunk-copy failure rolls back new metadata and allows retry', () => fixture(async (db, duplicate) => {
  const fail = () => { throw new Error('quota'); };
  db.chunks.hook('creating', fail);
  await assert.rejects(duplicate('source'), /quota/);
  assert.equal(await db.documents.count(), 1); assert.equal(await db.chunks.count(), 2);
  db.chunks.hook('creating').unsubscribe(fail);
  await duplicate('source'); assert.equal(await db.documents.count(), 2);
}));

test('missing pages reject without creating incomplete copies', () => fixture(async (db, duplicate) => {
  await db.chunks.where('[docId+chunkIndex]').equals(['source', 1]).delete();
  await assert.rejects(duplicate('source'), /페이지/);
  assert.equal(await db.documents.count(), 1);
}));

test('plain documents and PDF originals retain their content', () => fixture(async (db, duplicate) => {
  await db.documents.add({ id: 'plain', title: 'Plain', content: 'text', htmlContent: '<p>text</p>', tags: [] });
  assert.equal((await db.documents.get(await duplicate('plain'))).content, 'text');
  await db.documents.add({ id: 'pdf', kind: 'pdf', title: 'PDF', pageCount: 1, tags: [] });
  await assert.rejects(duplicate('pdf'), /原本|원본/);
  await db.files.add({ id: 'pdf', blob: new Blob(['PDF bytes']), name: 'sample.pdf' });
  const id = await duplicate('pdf');
  assert.equal(await (await db.files.get(id)).blob.text(), 'PDF bytes');
}));

test('UI delegates duplication to consistent snapshot operation', () => {
  const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('const handleDuplicateDocument'), source.indexOf('// For chunked documents:'));
  assert.match(handler, /await copyDocumentSnapshot\(id/);
  assert.doesNotMatch(handler, /setActiveDocument/);
  assert.doesNotMatch(handler, /content: doc.content/);
});

test('PDF file-copy failure rolls back metadata without touching original bytes', () => fixture(async (db, duplicate) => {
  await db.documents.add({ id: 'pdf', kind: 'pdf', title: 'PDF', pageCount: 1, tags: [] });
  await db.files.add({ id: 'pdf', blob: new Blob(['original PDF']), name: 'sample.pdf' });
  const fail = () => { throw new Error('file quota'); };
  db.files.hook('creating', fail);
  await assert.rejects(duplicate('pdf'), /file quota/);
  assert.equal(await db.documents.count(), 2); assert.equal(await db.files.count(), 1);
  assert.equal(await (await db.files.get('pdf')).blob.text(), 'original PDF');
  db.files.hook('creating').unsubscribe(fail);
  assert.equal(await (await db.files.get(await duplicate('pdf'))).blob.text(), 'original PDF');
}));
