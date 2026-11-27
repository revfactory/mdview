import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

async function withDatabase(run) {
  const db = new Dexie(`copy-pages-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange });
  db.version(3).stores({ documents: 'id', files: 'id', chunks: '++id,docId,[docId+chunkIndex]' });
  const source = readFileSync(new URL('../src/db/documents.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, Date, require: name => {
    if (name === '@/db') return { db };
    if (name === 'dexie') return Dexie;
    if (name === 'nanoid') return { nanoid: () => crypto.randomUUID() };
    return {};
  } });
  const date = new Date('2026-11-01');
  try {
    await db.documents.add({ id: 'original', title: '회의록', kind: 'markdown', isChunked: true, chunkCount: 2,
      content: 'stale initial source', tags: ['saved'], folderId: 'folder', isFavorite: true, isPinned: true, updatedAt: date });
    await db.chunks.bulkAdd([
      { docId: 'original', chunkIndex: 1, markdown: '새 문장\n', htmlContent: '<p>새 문장</p>', updatedAt: date },
      { docId: 'original', chunkIndex: 0, markdown: '## 원문\n\n', htmlContent: '', updatedAt: date },
    ]);
    await run({ db, copy: exports.duplicateSavedPages });
  } finally {
    await db.delete();
  }
}

const pages = (db, id) => db.chunks.where('docId').equals(id).sortBy('chunkIndex');

test('copies each saved page verbatim in order, without mutating the original or reusing page IDs', () => withDatabase(async ({ db, copy }) => {
  const initial = await db.documents.get('original');
  const originalPages = await pages(db, 'original');
  const id = await copy('original');
  const snapshot = await db.documents.get(id);
  const copiedPages = await pages(db, id);
  assert.equal(snapshot.title, '회의록 (복사본)');
  assert.equal(snapshot.isChunked, true);
  assert.equal(snapshot.chunkCount, 2);
  assert.equal(snapshot.folderId, initial.folderId);
  assert.deepEqual(snapshot.tags, initial.tags);
  assert.equal(snapshot.isFavorite, false);
  assert.equal(snapshot.isPinned, false);
  for (const [index, row] of copiedPages.entries()) {
    const original = originalPages[index];
    assert.notEqual(row.id, original.id);
    assert.equal(row.docId, id);
    assert.equal(row.chunkIndex, index);
    assert.equal(row.markdown, original.markdown);
    assert.equal(row.htmlContent, original.htmlContent);
  }
  assert.deepEqual(await db.documents.get('original'), initial);
  assert.deepEqual(await pages(db, 'original'), originalPages);
}));

test('an insertion failure leaves neither a copy nor partial pages and allows retry', () => withDatabase(async ({ db, copy }) => {
  const initial = await pages(db, 'original');
  const fail = (_key, row) => { if (row.chunkIndex === 1) throw new Error('injected page insertion failure'); };
  db.chunks.hook('creating', fail);
  await assert.rejects(copy('original'), /injected page insertion failure/);
  assert.equal(await db.documents.count(), 1);
  assert.equal(await db.chunks.count(), 2);
  assert.deepEqual(await pages(db, 'original'), initial);
  db.chunks.hook('creating').unsubscribe(fail);
  const id = await copy('original');
  assert.equal((await pages(db, id)).length, 2);
}));

test('missing, duplicated, nonpaged and PDF records never produce partial copies', () => withDatabase(async ({ db, copy }) => {
  await assert.rejects(copy('missing'), /찾을 수 없습니다/);
  await db.documents.update('original', { kind: 'pdf' });
  await assert.rejects(copy('original'), /찾을 수 없습니다/);
  await db.documents.update('original', { kind: 'markdown', isChunked: false });
  await assert.rejects(copy('original'), /찾을 수 없습니다/);
  await db.documents.update('original', { isChunked: true, chunkCount: 3 });
  await assert.rejects(copy('original'), /누락/);
  await db.chunks.add({ docId: 'original', chunkIndex: 1, markdown: 'duplicate index' });
  await assert.rejects(copy('original'), /누락/);
  assert.equal(await db.documents.count(), 1);
  assert.equal(await db.chunks.count(), 3);
}));
