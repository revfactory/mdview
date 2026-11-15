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
  const cas = load('db/content-cas');
  const { createContentSaveSession, ContentConflictError } = load('lib/content-save-session');
  const chunks = load('db/chunks');
  const peer = new Dexie(name, { indexedDB, IDBKeyRange });
  try {
    await db.documents.add({ id: 'plain', content: 'original', htmlContent: '', tags: [], updatedAt: new Date(0) });
    await db.documents.add({ id: 'pages', content: 'stale aggregate', isChunked: true, chunkCount: 2, tags: [] });
    await chunks.saveChunks('pages', [{index:0,markdown:'zero'}, {index:1,markdown:'one'}]);
    await peer.open();
    await run({db, peer, cas, createContentSaveSession, ContentConflictError});
  } finally { peer.close(); await db.delete(); }
}

test('plain legacy peer edit with unchanged timestamp conflicts without overwriting', () => fixture(async ({db,peer,cas,ContentConflictError}) => {
  const baseline = await cas.readPlainBaseline('plain');
  await peer.table('documents').update('plain', {content:'peer',updatedAt:new Date(0)});
  await assert.rejects(cas.savePlainBaseline(baseline,{markdown:'local',html:''}), e=>e instanceof ContentConflictError);
  assert.equal((await db.documents.get('plain')).content,'peer');
}));
test('same-record page edit conflicts even though ID and parent aggregate are unchanged', () => fixture(async ({db,peer,cas,ContentConflictError}) => {
  const baseline = await cas.readPageBaseline('pages',0);
  await peer.table('chunks').update(baseline.id,{markdown:'peer page'});
  await assert.rejects(cas.savePageBaseline(baseline,{markdown:'local',html:''}),e=>e instanceof ContentConflictError);
  assert.equal((await db.chunks.get(baseline.id)).markdown,'peer page');
}));
test('full source CAS checks every page, not stale parent aggregate', () => fixture(async ({db,peer,cas,ContentConflictError}) => {
  const baseline=await cas.readSourceBaseline('pages');
  await peer.table('chunks').update(baseline.pages[1].id,{markdown:'peer other page'});
  await assert.rejects(cas.saveSourceBaseline(baseline,{markdown:'local full source',html:''}),e=>e instanceof ContentConflictError);
  assert.equal((await db.chunks.get(baseline.pages[1].id)).markdown,'peer other page');
  assert.equal(await db.chunks.count(),2);
}));
for (const mode of ['Plain','Page','Source']) {
 test(`${mode} session advances its own baseline for rapid queued edits`,()=>fixture(async({db,cas,createContentSaveSession})=>{
  const baseline = mode==='Plain' ? await cas.readPlainBaseline('plain') : mode==='Page' ? await cas.readPageBaseline('pages',0) : await cas.readSourceBaseline('pages');
  const session=createContentSaveSession(baseline,cas[`save${mode}Baseline`]);
  await Promise.all(['first','second','last'].map(markdown=>session.save({markdown,html:''})));
  const result=mode==='Plain' ? (await db.documents.get('plain')).content : (await cas.readSourceBaseline('pages')).pages[0].markdown;
  assert.equal(result,'last'); assert.equal(session.getPendingSnapshot(),undefined);
 }));
}
test('source metadata failure rolls pages back and session retries against original baseline',()=>fixture(async({db,cas,createContentSaveSession})=>{
 const baseline=await cas.readSourceBaseline('pages');
 const session=createContentSaveSession(baseline,cas.saveSourceBaseline);
 const fail=()=>{throw Error('quota');};db.documents.hook('updating',fail);
 await assert.rejects(session.save({markdown:'replacement',html:''}),/quota/);
 assert.deepEqual(await cas.readSourceBaseline('pages'),baseline);
 assert.equal(session.hasConflict(),false);
 db.documents.hook('updating').unsubscribe(fail);
 await session.retry();assert.equal((await cas.readSourceBaseline('pages')).pages[0].markdown,'replacement');
}));
test('CAS conflict latches session and preserves latest local recovery snapshot',()=>fixture(async({db,peer,cas,createContentSaveSession})=>{
 const session=createContentSaveSession(await cas.readPlainBaseline('plain'),cas.savePlainBaseline);
 await peer.table('documents').update('plain',{content:'peer'});
 const results=await Promise.allSettled(['one','two','three'].map(markdown=>session.save({markdown,html:''})));
 assert.ok(results.every(r=>r.status==='rejected'));assert.equal(session.hasConflict(),true);
 await assert.rejects(session.retry());
 assert.equal(session.getPendingSnapshot().markdown,'three');assert.equal((await db.documents.get('plain')).content,'peer');
}));
test('missing legacy raw fields normalize on read and compare consistently',()=>fixture(async({db,cas})=>{
 await db.documents.add({id:'legacy',tags:[]});
 const baseline=await cas.readPlainBaseline('legacy');assert.equal(baseline.content,'');assert.equal(baseline.htmlContent,'');
 const saved=await cas.savePlainBaseline(baseline,{markdown:'now saved',html:''});assert.equal(saved.content,'now saved');
}));
test('deleted parent or changed mode fails closed before writing',()=>fixture(async({peer,cas,ContentConflictError})=>{
 const plain=await cas.readPlainBaseline('plain');const page=await cas.readPageBaseline('pages',0);const source=await cas.readSourceBaseline('pages');
 await peer.table('documents').delete('plain');await peer.table('documents').update('pages',{kind:'pdf'});
 for(const promise of [cas.savePlainBaseline(plain,{markdown:'x',html:''}),cas.savePageBaseline(page,{markdown:'x',html:''}),cas.saveSourceBaseline(source,{markdown:'x',html:''})]) await assert.rejects(promise,e=>e instanceof ContentConflictError);
}));
