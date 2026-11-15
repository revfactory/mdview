import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
function load(path,modules={}){const exports={};const source=readFileSync(new URL('../src/'+path,import.meta.url),'utf8');vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,console:{error(){}},require:name=>{assert.ok(name in modules,name);return modules[name];}});return exports;}
const {createContentSaveSession,ContentConflictError}=load('lib/content-save-session.ts');
function harness(){
 let active='A',stored='base';const statuses=[],writes=[];
 const session=createContentSaveSession('base',async(expected,snapshot)=>{if(expected!==stored)throw new ContentConflictError();stored=snapshot.markdown;writes.push(stored);return stored;});
 const {createDocumentSaveQueue}=load('lib/document-save-queue.ts',{'@/db/documents':{updateContent:async()=>assert.fail('unguarded writer')}});
 const queue=createDocumentSaveQueue(async()=>assert.fail('unguarded writer'));
 const sessionRef={current:session};
 const {useAutosave: invokeAutosave}=load('hooks/use-autosave.ts',{'react':{useRef:v=>({current:v}),useCallback:fn=>fn},'@/stores/editor-store':{useEditorStore:{getState:()=>({activeDocumentId:active,actions:{setSaveStatus:s=>statuses.push(s)}})}},'@/lib/document-save-queue':queue});
 return {save:invokeAutosave('A',sessionRef),session,sessionRef,queue,statuses,writes,peer:raw=>stored=raw,stored:()=>stored,select:id=>active=id};
}
test('actual autosave uses acknowledged session for three queued local inputs',async()=>{
 const h=harness();await Promise.all(['one','two','three'].map(raw=>h.save(raw,'')));await h.queue.awaitDocumentSaves('A');
 assert.deepEqual(h.writes,['one','two','three']);assert.equal(h.stored(),'three');assert.equal(h.statuses.at(-1),'saved');
});
test('actual autosave conflict retains newest local raw and remains a queue failure',async()=>{
 const h=harness();h.peer('peer');await h.save('local','');await h.save('newest local','');
 await assert.rejects(h.queue.awaitDocumentSaves('A'),ContentConflictError);
 assert.equal(h.stored(),'peer');assert.equal(h.session.getPendingSnapshot().markdown,'newest local');assert.equal(h.statuses.at(-1),'error');assert.deepEqual(h.writes,[]);
});
test('missing baseline fails closed rather than calling an unguarded writer',async()=>{
 const h=harness();h.sessionRef.current=null;await h.save('raw','');await assert.rejects(h.queue.awaitDocumentSaves('A'));
 assert.equal(h.stored(),'base');assert.equal(h.statuses.at(-1),'error');
});
