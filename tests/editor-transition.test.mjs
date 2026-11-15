import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/editor-transition.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const {createEditorTransitionGate,prepareEditorTransition}=exports;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function setup(){const events=[];let owner='A:visual:1';const gate=createEditorTransitionGate();return {events,gate,setOwner:v=>owner=v,options:{owner,isCurrent:o=>owner===o,setBusy:b=>events.push('busy:'+b),prepare:async()=>events.push('flush'),create:async()=>{events.push('create');return 'B';},commit:r=>events.push('select:'+r)}};}
test('successful preparation precedes creation and synchronous commit',async()=>{const h=setup();assert.equal(await h.gate(h.options),'committed');assert.deepEqual(h.events,['busy:true','flush','create','select:B','busy:false']);});
test('failed write preserves owner and does not create or commit, allows later retry',async()=>{const h=setup();await assert.rejects(h.gate({...h.options,prepare:async()=>{throw Error('quota');}}),/quota/);assert.deepEqual(h.events,['busy:true','busy:false']);assert.equal(await h.gate(h.options),'committed');});
test('concurrent transition is rejected while save is pending',async()=>{const h=setup(),d=deferred();const first=h.gate({...h.options,prepare:()=>d.promise});assert.equal(await h.gate(h.options),'busy');d.resolve();assert.equal(await first,'committed');});
test('owner or edit revision change during save prevents creation',async()=>{const h=setup(),d=deferred();const first=h.gate({...h.options,prepare:()=>d.promise});h.setOwner('A:visual:2');d.resolve();assert.equal(await first,'superseded');assert.deepEqual(h.events,['busy:true','busy:false']);});
test('owner change during asynchronous import prevents selection',async()=>{const h=setup(),d=deferred();const first=h.gate({...h.options,create:()=>d.promise});await Promise.resolve();h.setOwner('C:source:1');d.resolve('imported');assert.equal(await first,'superseded');assert.ok(!h.events.some(x=>x.startsWith('select:')));});
test('read-only PDF and no document can leave without editor flush',async()=>{for(const options of [{id:null,readOnly:false},{id:'pdf',readOnly:true}])await prepareEditorTransition({...options,hasEditableSnapshot:false,flush:async()=>assert.fail(),awaitSaves:async()=>assert.fail()});});
test('clean initial-read error can leave, but prior failed writes still block',async()=>{let waited=0;await prepareEditorTransition({id:'A',readOnly:false,hasEditableSnapshot:false,flush:async()=>assert.fail(),awaitSaves:async()=>{waited++;}});assert.equal(waited,1);await assert.rejects(prepareEditorTransition({id:'A',readOnly:false,hasEditableSnapshot:false,flush:async()=>assert.fail(),awaitSaves:async()=>{throw Error('prior write failed');}}),/prior write failed/);});
test('fulfilled autosave with swallowed failure cannot authorize transition',async()=>{let flushed=false;await assert.rejects(prepareEditorTransition({id:'A',readOnly:false,hasEditableSnapshot:true,flush:async()=>{flushed=true;},awaitSaves:async()=>{throw Error('quota');}}),/quota/);assert.equal(flushed,true);});

test('throwing closing observer cannot turn committed navigation into a failure',async()=>{const h=setup();assert.equal(await h.gate({...h.options,setBusy:b=>{if(!b)throw Error('observer');}}),'committed');assert.ok(h.events.includes('select:B'));assert.equal(await h.gate(h.options),'committed');});
test('throwing closing observer does not mask persistence failure',async()=>{const h=setup();await assert.rejects(h.gate({...h.options,prepare:async()=>{throw Error('quota');},setBusy:b=>{if(!b)throw Error('observer');}}),/quota/);assert.ok(!h.events.some(x=>x.startsWith('select:')));});
test('throwing opening observer aborts before flushing or creating',async()=>{const h=setup();await assert.rejects(h.gate({...h.options,setBusy:()=>{throw Error('cannot freeze');}}),/cannot freeze/);assert.deepEqual(h.events,[]);assert.equal(await h.gate(h.options),'committed');});
