import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/content-save-session.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createContentSaveSession,ContentConflictError}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const tick=()=>new Promise(r=>setImmediate(r));
test('queued local edits compare against the last acknowledged baseline',async()=>{
 let stored='base';const seen=[];
 const session=createContentSaveSession(stored,async(expected,snapshot)=>{seen.push(expected);assert.equal(expected,stored);stored=snapshot;return snapshot;});
 await Promise.all(['one','two','three'].map(x=>session.save(x)));
 assert.deepEqual(seen,['base','one','two']);assert.equal(stored,'three');assert.equal(session.getPendingSnapshot(),undefined);
});
test('quota failure preserves latest raw and retries without accepting a peer baseline',async()=>{
 let fail=true;const seen=[];const session=createContentSaveSession('base',async(expected,snapshot)=>{seen.push(expected);if(fail)throw Error('quota');return snapshot;});
 await assert.rejects(session.save('raw one'));await assert.rejects(session.save('raw latest'));
 assert.equal(session.getPendingSnapshot(),'raw latest');fail=false;await session.retry();
 assert.deepEqual(seen,['base','base','base']);assert.equal(session.getPendingSnapshot(),undefined);
});
test('peer conflict freezes queued writes and retry while retaining newest local raw',async()=>{
 let calls=0;const session=createContentSaveSession('base',async()=>{calls++;throw new ContentConflictError();});
 const results=await Promise.allSettled([session.save('one'),session.save('newest')]);
 assert.ok(results.every(x=>x.status==='rejected'));assert.equal(calls,1);assert.equal(session.getPendingSnapshot(),'newest');
 await assert.rejects(session.retry(),ContentConflictError);assert.equal(calls,1);assert.equal(session.hasConflict(),true);
});
test('old success cannot clear a newer pending recovery snapshot',async()=>{
 let release;const session=createContentSaveSession('base',async(_expected,snapshot)=>{if(snapshot==='one')await new Promise(r=>release=r);else throw Error('quota');return snapshot;});
 const first=session.save('one');await tick();const second=session.save('newer');release();await first;await assert.rejects(second);
 assert.equal(session.getPendingSnapshot(),'newer');
});
test('raw-state CAS detects old-version writes even if timestamps are unchanged',async()=>{
 let stored={raw:'base',time:1};const session=createContentSaveSession('base',async(expected,snapshot)=>{if(stored.raw!==expected)throw new ContentConflictError();stored={raw:snapshot,time:1};return snapshot;});
 stored={raw:'peer edit',time:1};await assert.rejects(session.save('local edit'),ContentConflictError);
 assert.equal(stored.raw,'peer edit');assert.equal(session.getPendingSnapshot(),'local edit');
});
