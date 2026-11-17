import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

async function withDatabase(run) {
  const db = new Dexie(`delete-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange });
  db.version(3).stores({ documents: 'id', files: 'id', chunks: '++id,docId,[docId+chunkIndex]' });
  const source = readFileSync(new URL('../src/db/documents.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, Date, require: name => name === '@/db' ? { db } : name === 'dexie' ? Dexie : {} });
  try {
    for (const id of ['target', 'unrelated']) {
      await db.documents.add({ id, content: `${id} original`, isChunked: true });
      await db.files.add({ id, blob: new Blob([`${id} PDF bytes`]) });
      await db.chunks.bulkAdd([0, 1].map(chunkIndex => ({ docId: id, chunkIndex, markdown: `${id} latest edit ${chunkIndex}` })));
    }
    await run({ db, deleteDocument: exports.deleteDocument });
  } finally {
    await db.delete();
  }
}

async function assertPreserved(db, id) {
  assert.equal((await db.documents.get(id)).content, `${id} original`);
  assert.equal(await (await db.files.get(id)).blob.text(), `${id} PDF bytes`);
  assert.deepEqual((await db.chunks.where('docId').equals(id).sortBy('chunkIndex')).map(row => row.markdown), [`${id} latest edit 0`, `${id} latest edit 1`]);
}

test('deletion removes only the requested document, original file and chunks', () => withDatabase(async ({ db, deleteDocument }) => {
  await deleteDocument('target');
  assert.equal(await db.documents.get('target'), undefined);
  assert.equal(await db.files.get('target'), undefined);
  assert.equal(await db.chunks.where('docId').equals('target').count(), 0);
  await assertPreserved(db, 'unrelated');
  await deleteDocument('target'); // repeated deletion remains harmless
  await assertPreserved(db, 'unrelated');
}));

for (const table of ['chunks', 'documents', 'files']) {
  test(`${table} deletion failure rolls back every record and allows a later retry`, () => withDatabase(async ({ db, deleteDocument }) => {
    const fail = () => { throw new Error(`injected ${table} failure`); };
    db[table].hook('deleting', fail);
    await assert.rejects(deleteDocument('target'), new RegExp(`injected ${table} failure`));
    await assertPreserved(db, 'target');
    await assertPreserved(db, 'unrelated');
    db[table].hook('deleting').unsubscribe(fail);
    await deleteDocument('target');
    assert.equal(await db.documents.get('target'), undefined);
    assert.equal(await db.files.get('target'), undefined);
    assert.equal(await db.chunks.where('docId').equals('target').count(), 0);
    await assertPreserved(db, 'unrelated');
  }));
}

test('ordinary documents without a file or chunks can still be deleted', () => withDatabase(async ({ db, deleteDocument }) => {
  await db.documents.add({ id: 'plain', content: 'plain text' });
  await deleteDocument('plain');
  assert.equal(await db.documents.get('plain'), undefined);
  await assertPreserved(db, 'target');
}));

test('UI delegates all deletion to the atomic document operation', () => {
  const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const handler = page.slice(page.indexOf('const handleDeleteDocument'), page.indexOf('const handleDuplicateDocument'));
  assert.match(handler, /await deleteDocument\(id\)/);
  assert.doesNotMatch(handler, /deleteChunks/);
});
