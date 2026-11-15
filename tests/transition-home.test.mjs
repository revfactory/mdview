import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function callback(name){let found;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)found=n.initializer.arguments[0].getText(ast);ts.forEachChild(n,visit);}visit(ast);assert.ok(found);return found;}
function run(js,context={}){const exports={};vm.runInNewContext(ts.transpileModule(js,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,console:{error(){}},...context});return exports;}
const gate=run(readFileSync(new URL('../src/lib/editor-transition.ts',import.meta.url),'utf8')).createEditorTransitionGate;
function harness(overrides={}){const events=[];let id='A',mode='wysiwyg',html='<p>latest</p>';
 const context={activeDocumentId:id,viewMode:mode,documentKind:'markdown',isChunked:true,sourcePending:false,canSave:true,ownerGeneration:{current:1},inputRevision:{current:0},rawRecovery:{current:null},transitionGate:{current:gate()},setTransitionPending:b=>events.push('busy:'+b),tiptapEditor:{isDestroyed:false,getHTML:()=>html},leaveRef:{current:async()=>events.push('leave')},awaitDocumentSaves:async()=>events.push('barrier'),getDirtyEditorSnapshot:()=>html,savedHtmlToMarkdown:x=>x,onChange:()=>events.push('normal-write'),saveCurrent:async()=>events.push('raw-write'),useEditorStore:{getState:()=>({activeDocumentId:id})},useUIStore:{getState:()=>({viewMode:mode,isMobile:false})},toastModule:{useToastStore:{getState:()=>({actions:{addToast:()=>events.push('error')}})}},...overrides};
 const transition=run('exports.fn='+callback('runTransition').replace("import('@/stores/toast-store')",'Promise.resolve(toastModule)'),context).fn;
 return {events,context,transition,setHTML:v=>html=v,setId:v=>id=v,commit:async()=>()=>events.push('select:B')};}
test('actual Home page transition flushes then waits before selecting',async()=>{const h=harness();assert.equal(await h.transition(h.commit),'committed');assert.deepEqual(h.events,['busy:true','leave','barrier','select:B','busy:false']);});
test('failed page or failed raw-source queue retains current UI',async()=>{for(const overrides of [{leaveRef:{current:async()=>{throw Error('quota');}}},{viewMode:'source',awaitDocumentSaves:async()=>{throw Error('quota');}}]){const h=harness(overrides);if(overrides.viewMode)h.context.useUIStore.getState=()=>({viewMode:'source'});assert.equal(await h.transition(h.commit),'blocked');assert.ok(!h.events.includes('select:B'));assert.ok(h.events.includes('error'));}});
test('normal visual transition captures pending dirty HTML before unmount',async()=>{const h=harness({isChunked:false});await h.transition(h.commit);assert.deepEqual(h.events,['busy:true','normal-write','barrier','select:B','busy:false']);});
test('normal raw save that swallows errors remains blocked by queue',async()=>{const h=harness({isChunked:false,sourcePending:true,awaitDocumentSaves:async()=>{throw Error('quota');}});assert.equal(await h.transition(h.commit),'blocked');assert.ok(h.events.includes('raw-write'));assert.ok(!h.events.includes('select:B'));});
test('confirmed PDF escapes without invoking hidden editor save',async()=>{const h=harness({documentKind:'pdf'});assert.equal(await h.transition(h.commit),'committed');assert.deepEqual(h.events,['busy:true','select:B','busy:false']);});
test('clean ordinary read failure can leave without blank-content save',async()=>{const h=harness({isChunked:false,canSave:false,tiptapEditor:null});assert.equal(await h.transition(h.commit),'committed');assert.deepEqual(h.events,['busy:true','barrier','select:B','busy:false']);});
test('new input appearing during preparation prevents transition commit',async()=>{let resolve;const h=harness({leaveRef:{current:()=>new Promise(r=>resolve=r)}});const pending=h.transition(h.commit);h.setHTML('<p>newer</p>');resolve();assert.equal(await pending,'superseded');assert.ok(!h.events.includes('select:B'));});
test('all explicit mode controls and paginated prepareLeave callbacks wired',()=>{assert.match(source,/onViewModeChange: handleViewModeChange/);assert.match(source,/onViewModeChange=\{handleViewModeChange\}/);assert.equal((source.match(/onLeaveReady=\{handleLeaveReady\}/g)||[]).length,2);assert.match(source,/inert=\{transitionPending\}/);});
test('immediate visual-to-source preparation publishes current manager content, not only DB',async()=>{let managerRaw='old';const h=harness({isChunked:false,onChange:(markdown)=>{managerRaw=markdown;}});let shown;await h.transition(async()=>()=>{shown=managerRaw;});assert.equal(shown,'<p>latest</p>');});
test('source raw recovery retries exact retained snapshot before leaving',async()=>{let retried=0;const h=harness({viewMode:'source',rawRecovery:{current:{id:'A',markdown:'unsaved',retry:async()=>{retried++;}}}});h.context.useUIStore.getState=()=>({viewMode:'source'});assert.equal(await h.transition(h.commit),'committed');assert.equal(retried,1);});
test('failed raw retry leaves recovery object and active document intact',async()=>{const recovery={id:'A',markdown:'unsaved',retry:async()=>{throw Error('quota');}};const h=harness({viewMode:'source',rawRecovery:{current:recovery}});h.context.useUIStore.getState=()=>({viewMode:'source'});assert.equal(await h.transition(h.commit),'blocked');assert.equal(h.context.rawRecovery.current,recovery);assert.ok(!h.events.includes('select:B'));});
test('raw input revision change during preparation cancels navigation',async()=>{let resolve;const h=harness({tiptapEditor:null,leaveRef:{current:()=>new Promise(r=>resolve=r)}});const pending=h.transition(h.commit);h.context.inputRevision.current++;resolve();assert.equal(await pending,'superseded');assert.ok(!h.events.includes('select:B'));});
function sourceLoader(){let found;function visit(n){if(ts.isArrowFunction(n)&&n.getText(ast).includes('setMergedSourceLoading(true)')&&n.getText(ast).includes('getAllChunksMarkdown(activeDocumentId)'))found=n.getText(ast);ts.forEachChild(n,visit);}visit(ast);return found.replace("import('@/db/chunks')",'Promise.resolve(chunks)');}
test('source entry retains owned failed raw recovery instead of loading older stored text',async()=>{let value='latest raw',error=false,loading;const raw={id:'A',markdown:value};let reads=0;
 run('exports.fn='+sourceLoader(),{isChunked:true,activeDocumentId:'A',viewMode:'source',setMergedSourceLoading:v=>loading=v,setMergedSourceError:v=>error=v,setMergedSourceContent:v=>value=v,awaitDocumentSaves:async()=>{throw Error('quota');},rawRecovery:{current:raw},chunks:{getAllChunksMarkdown:async()=>{reads++;return 'old';}}}).fn();
 await new Promise(r=>setImmediate(r));assert.equal(value,'latest raw');assert.equal(reads,0);assert.equal(error,false);assert.equal(loading,false);
});
test('source read failure without owned recovery hides stale data and ends loading',async()=>{let error=false,loading;const values=[];
 run('exports.fn='+sourceLoader(),{isChunked:true,activeDocumentId:'B',viewMode:'source',setMergedSourceLoading:v=>loading=v,setMergedSourceError:v=>error=v,setMergedSourceContent:v=>values.push(v),awaitDocumentSaves:async()=>{},rawRecovery:{current:{id:'A',markdown:'private A'}},chunks:{getAllChunksMarkdown:async()=>{throw Error('read');}}}).fn();
 await new Promise(r=>setImmediate(r));assert.equal(error,true);assert.equal(loading,false);assert.deepEqual(values,[]);
});

test('clean visual retries the authoritative raw snapshot after autosave failure', async () => {
  const queueSource = readFileSync(new URL('../src/lib/document-save-queue.ts', import.meta.url), 'utf8')
    .replace("import { updateContent } from '@/db/documents';", 'const updateContent = async () => {};');
  let unavailable = true;
  const writes = [];
  const queue = run(queueSource).createDocumentSaveQueue(async (id, markdown, html) => {
    writes.push({ id, markdown, html });
    if (unavailable) throw Error('temporary storage failure');
  });
  await assert.rejects(queue.enqueueDocumentSave('A', 'latest raw', '<p>latest raw</p>'));
  const h = harness({ isChunked: false, getDirtyEditorSnapshot: () => null,
    awaitDocumentSaves: queue.awaitDocumentSaves,
    saveCurrent: () => queue.enqueueDocumentSave('A', 'latest raw', '<p>latest raw</p>').catch(() => {}) });
  assert.equal(await h.transition(h.commit), 'blocked');
  assert.equal(writes.length, 2, 'failed retry keeps the current document');
  assert.ok(!h.events.includes('select:B'));
  unavailable = false;
  assert.equal(await h.transition(h.commit), 'committed');
  assert.equal(writes.at(-1).markdown, 'latest raw');
});

test('clean visual navigation without a failed save does not overwrite a newer stored snapshot',async()=>{
 const queueSource=readFileSync(new URL('../src/lib/document-save-queue.ts',import.meta.url),'utf8').replace("import { updateContent } from '@/db/documents';",'const updateContent=async()=>{};');
 let stored='newer external edit';let writes=0;
 const queue=run(queueSource).createDocumentSaveQueue(async(_id,markdown)=>{writes++;stored=markdown;});
 const h=harness({isChunked:false,getDirtyEditorSnapshot:()=>null,awaitDocumentSaves:queue.awaitDocumentSaves,saveCurrent:()=>queue.enqueueDocumentSave('A','older unchanged view','<p>older unchanged view</p>')});
 assert.equal(await h.transition(h.commit),'committed');assert.equal(stored,'newer external edit');assert.equal(writes,0);
});

test('unchanged normal source navigation does not rewrite storage',async()=>{
 let writes=0;const h=harness({isChunked:false,viewMode:'source',saveCurrent:async()=>{writes++;}});
 h.context.useUIStore.getState=()=>({viewMode:'source'});
 assert.equal(await h.transition(h.commit),'committed');assert.equal(writes,0);
});

test('transition recovery never replays old manager raw after newer input fails',async()=>{
 for(const mode of ['wysiwyg','source']){
  let reject,retries=0;const h=harness({isChunked:false,viewMode:mode,getDirtyEditorSnapshot:()=>null,awaitDocumentSaves:()=>new Promise((_,r)=>reject=r),saveCurrent:async()=>{retries++;}});
  h.context.useUIStore.getState=()=>({viewMode:mode});
  const pending=h.transition(h.commit);h.context.inputRevision.current++;reject(Error('newer save failed'));
  assert.equal(await pending,'blocked');assert.equal(retries,0);assert.ok(!h.events.includes('select:B'));
 }
});
