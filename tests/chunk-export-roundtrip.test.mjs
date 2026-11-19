import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
import Dexie from 'dexie';
import {indexedDB,IDBKeyRange} from 'fake-indexeddb';
function load(file,deps={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Date,require:n=>{if(!(n in deps))throw Error(n);return deps[n];}});
 return exports;
}
async function withDb(run) {
 class TestDexie extends Dexie { constructor(){super('export-'+crypto.randomUUID(),{indexedDB,IDBKeyRange});} }
 const {db}=load('db/index.ts',{dexie:TestDexie});
 const api=load('db/chunks.ts',{'./index':{db}});
 try {await db.open();await db.documents.add({id:'other',content:'KEEP'});await db.files.add({id:'pdf',blob:new Blob(['PDF BYTES'])});await run(db,api);assert.equal((await db.documents.get('other')).content,'KEEP');assert.equal(await (await db.files.get('pdf')).blob.text(),'PDF BYTES');} finally {await db.delete();}
}
const {chunkDocument}=load('lib/chunk-document.ts');
const source=('# 한글\r\n\r\n'+'문단😀 '.repeat(4000)+'\r\n\r\n').repeat(16);
test('untouched split/export/reimport preserves exact Unicode and CRLF source repeatedly',()=>withDb(async(db,api)=>{
 await db.documents.add({id:'target',content:source});let current=source;
 for(let i=0;i<3;i++){await api.saveChunks('target',chunkDocument(current));current=await api.getAllChunksMarkdown('target');assert.equal(current,source);}
 db.close();await db.open();assert.equal(await api.getAllChunksMarkdown('target'),source);
}));
test('HTML cache-only updates preserve exact source export',()=>withDb(async(db,api)=>{
 await db.documents.add({id:'target',content:source});await api.saveChunks('target',chunkDocument(source));const chunk=await api.getChunk('target',0);await api.updateChunk('target',0,chunk.markdown,'<p>cached</p>');assert.equal(await api.getAllChunksMarkdown('target'),source);
}));
test('separately edited neighboring WYSIWYG pages retain legacy separator',()=>withDb(async(db,api)=>{
 await db.documents.add({id:'target',content:'left\n\nright'});await api.saveChunks('target',[{index:0,markdown:'left\n\n'},{index:1,markdown:'right'}]);
 await api.updateChunk('target',0,'EDITED LEFT','<p>EDITED LEFT</p>');await api.updateChunk('target',1,'EDITED RIGHT','<p>EDITED RIGHT</p>');
 assert.equal(await api.getAllChunksMarkdown('target'),'EDITED LEFT\nEDITED RIGHT');
}));
test('legacy records with stale source keep exact existing joining behavior without writes',()=>withDb(async(db,api)=>{
 await db.documents.add({id:'target',content:'old source'});await db.chunks.bulkAdd([{docId:'target',chunkIndex:1,markdown:'right'},{docId:'target',chunkIndex:0,markdown:'left\n\n'}]);const before=await db.chunks.toArray();
 assert.equal(await api.getAllChunksMarkdown('target'),'left\n\n\nright');assert.deepEqual(await db.chunks.toArray(),before);
}));
test('legacy untouched records matching source are preserved without migration',()=>withDb(async(db,api)=>{
 await db.documents.add({id:'target',content:'left\n\nright'});await db.chunks.bulkAdd([{docId:'target',chunkIndex:0,markdown:'left\n\n'},{docId:'target',chunkIndex:1,markdown:'right'}]);const before=await db.chunks.toArray();assert.equal(await api.getAllChunksMarkdown('target'),'left\n\nright');assert.deepEqual(await db.chunks.toArray(),before);
}));
test('missing parent and gapped page records conservatively keep legacy join',()=>withDb(async(db,api)=>{
 await api.saveChunks('missing',[{index:0,markdown:'left'},{index:1,markdown:'right'}]);assert.equal(await api.getAllChunksMarkdown('missing'),'left\nright');
 await db.documents.add({id:'gap',content:'leftright'});await api.saveChunks('gap',[{index:0,markdown:'left'},{index:2,markdown:'right'}]);assert.equal(await api.getAllChunksMarkdown('gap'),'left\nright');
}));
test('empty and single-page exports remain unchanged',()=>withDb(async(db,api)=>{
 assert.equal(await api.getAllChunksMarkdown('absent'),'');await api.saveChunks('single',[{index:0,markdown:' \n한글😀\n'}]);assert.equal(await api.getAllChunksMarkdown('single'),' \n한글😀\n');
}));
test('exact comparison rejects a mere source prefix and preserves legacy fallback',()=>withDb(async(db,api)=>{
 await db.documents.add({id:'target',content:'left right EXTRA'});await api.saveChunks('target',[{index:0,markdown:'left '},{index:1,markdown:'right'}]);assert.equal(await api.getAllChunksMarkdown('target'),'left \nright');
}));
test('exact offsets use UTF-16 units without normalizing stored Unicode',()=>withDb(async(db,api)=>{
 const content='한😀e\u0301끝';await db.documents.add({id:'target',content});await api.saveChunks('target',[{index:0,markdown:'한\ud83d'},{index:1,markdown:'\ude00e\u0301끝'}]);assert.equal(await api.getAllChunksMarkdown('target'),content);
}));
