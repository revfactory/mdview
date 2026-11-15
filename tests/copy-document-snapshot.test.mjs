import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/copy-document-snapshot.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { copyDocumentSnapshot } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
test('flushes live input and waits queued writes before copying exact requested id', async () => {
 const flush=deferred(), barrier=deferred(), events=[];
 const pending=copyDocumentSnapshot('original', async()=>{events.push('flush'); await flush.promise;}, async id=>{events.push(`wait:${id}`); await barrier.promise;}, async id=>{events.push(`copy:${id}`); return 'new';});
 assert.deepEqual(events,['flush']); flush.resolve(); await new Promise(r=>setImmediate(r));
 assert.deepEqual(events,['flush','wait:original']); barrier.resolve(); assert.equal(await pending,'new');
 assert.deepEqual(events,['flush','wait:original','copy:original']);
});
test('flush or queued-save failure rejects without creating a copy', async()=>{
 for (const stage of ['flush','wait']) {
 let copied=false;
 await assert.rejects(copyDocumentSnapshot('id',async()=>{if(stage==='flush')throw Error('quota');},async()=>{if(stage==='wait')throw Error('quota');},async()=>{copied=true; return 'new';}),/quota/);
 assert.equal(copied,false);
 }
});
test('background document copy still waits its own pending writes',async()=>{
 const events=[];
 await copyDocumentSnapshot('background',undefined,async id=>events.push(id),async id=>{events.push(id); return 'new';});
 assert.deepEqual(events,['background','background']);
});
