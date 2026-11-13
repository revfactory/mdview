import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
function load(file,mocks){
 const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(js,{exports,Date,require:n=>mocks[n]??{}});return exports;
}
async function setup(){
 const db=new Dexie('import-'+crypto.randomUUID(),{indexedDB,IDBKeyRange});
 db.version(3).stores({documents:'id',chunks:'++id,docId,[docId+chunkIndex]',files:'id'});
 await db.open();
 const docs=load('db/documents.ts',{'@/db':{db},nanoid:{nanoid:()=>crypto.randomUUID()},'@/lib/utils':{calculateWordCount:()=>1,extractExcerpt:()=>''}});
 const chunks=load('db/chunks.ts',{'./index':{db}});
 const imports=load('lib/import-document.ts',{'@/db':{db},'@/db/documents':docs,'@/db/chunks':chunks,'@/lib/chunk-document':{chunkDocument:()=>[{index:0,markdown:'one'},{index:1,markdown:'two'}]}});
 return {db,...imports};
}
async function withDb(fn){const h=await setup();try{await fn(h);}finally{await h.db.delete();}}
const source='x'.repeat(300001);
test('successful large import commits parent, chunks and pagination metadata together',()=>withDb(async h=>{
 const result=await h.createImportedDocument(source,'converted PDF',{folderId:'f'});
 const doc=await h.db.documents.get(result.id);
 assert.equal(doc.content,source);assert.equal(doc.folderId,'f');assert.equal(doc.isChunked,true);
 assert.equal(doc.chunkCount,2);assert.equal(result.chunkCount,2);
 assert.equal(await h.db.chunks.where('docId').equals(result.id).count(),2);
}));
test('chunk insertion failure leaves no incomplete parent and preserves existing data',()=>withDb(async h=>{
 await h.db.documents.add({id:'existing',content:'keep'});
 await h.db.files.add({id:'pdf-original',blob:new Blob(['keep'])});
 const fail=()=>{throw new Error('quota');};h.db.chunks.hook('creating',fail);
 await assert.rejects(h.createImportedDocument(source,'failed'),/quota/);
 h.db.chunks.hook('creating').unsubscribe(fail);
 assert.equal(await h.db.documents.count(),1);assert.equal((await h.db.documents.get('existing')).content,'keep');
 assert.equal(await h.db.chunks.count(),0);assert.equal(await h.db.files.count(),1);
 assert.equal(await (await h.db.files.get('pdf-original')).blob.text(),'keep');
 const retry=await h.createImportedDocument(source,'retry');assert.equal((await h.db.documents.get(retry.id)).isChunked,true);
}));
test('pagination metadata failure rolls back both parent and newly written chunks',()=>withDb(async h=>{
 const fail=()=>{throw new Error('metadata unavailable');};h.db.documents.hook('updating',fail);
 await assert.rejects(h.createImportedDocument(source,'failed'),/metadata unavailable/);
 assert.equal(await h.db.documents.count(),0);assert.equal(await h.db.chunks.count(),0);
}));
