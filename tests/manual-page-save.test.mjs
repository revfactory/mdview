import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function harness(options = {}) {
  const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleForceSave') callback = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(callback);
  const events = [];
  const context = {
    ownerGeneration: { current: 1 }, inputRevision: { current: 0 },
    activeDocumentId: 'doc', isLoading: false, canSave: true, isChunked: true, viewMode: 'wysiwyg', sourcePending: false,
    tiptapEditor: { getHTML() { events.push('serialize'); return '<p>one page</p>'; } },
    pageFlushRef: { current: async () => { events.push('flush'); } },
    actions: { setSaveStatus: status => events.push(status) },
    useEditorStore: { getState: () => ({ activeDocumentId: 'doc' }) },
    awaitDocumentSaves: async id => { events.push('wait:' + id); },
    updateContent: async () => events.push('aggregate-write'),
    enqueueDocumentSave: async () => events.push('document-save'),
    getDirtyEditorSnapshot: editor => editor.getHTML(),
    onChange: () => events.push('manager-save'),
    savedHtmlToMarkdown: () => 'one page',
    saveCurrent: async () => events.push('source-save'),
    ...options,
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule('exports.save = ' + callback, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, { ...context, exports });
  return { events, save: exports.save };
}

test('manual page save flushes actual page and waits persistence without replacing aggregate', async () => {
  const h = harness(); await h.save();
  assert.deepEqual(h.events, ['saving', 'flush', 'wait:doc', 'saved']);
});
test('manual full-source save waits raw source queue without serializing a stale hidden editor', async () => {
  const h = harness({ viewMode: 'source' }); await h.save();
  assert.deepEqual(h.events, ['saving', 'wait:doc', 'saved']);
});
test('page flush failure cannot announce saved or write aggregate', async () => {
  const h = harness({ pageFlushRef: { current: async () => { throw Error('quota'); } } }); await h.save();
  assert.deepEqual(h.events, ['saving', 'error']);
});
test('missing page flush and failed queue both leave manual save in error', async () => {
  for (const options of [
    { pageFlushRef: { current: null } },
    { viewMode: 'source', awaitDocumentSaves: async () => { throw Error('quota'); } },
  ]) {
    const h = harness(options); await h.save();
    assert.deepEqual(h.events, ['saving', 'error']);
  }
});
test('ordinary visual and source document saves retain their existing routes', async () => {
  const visual = harness({ isChunked: false }); await visual.save();
  assert.deepEqual(visual.events, ['saving', 'serialize', 'manager-save', 'wait:doc', 'saved']);
  const source = harness({ isChunked: false, viewMode: 'source' }); await source.save();
  assert.deepEqual(source.events, ['source-save']);
});
test('completion for a no-longer-selected document does not overwrite current save status', async () => {
  const h = harness({ useEditorStore: { getState: () => ({ activeDocumentId: 'other' }) } });
  await h.save();
  assert.deepEqual(h.events, ['saving', 'flush', 'wait:doc']);
});

test('unchanged ordinary visual save must not round-trip raw Markdown through preview HTML',async()=>{
 let stored='<!-- keep comment -->\n[link][ref]\n\n[ref]: https://example.com';const original=stored;
 const h=harness({isChunked:false,getDirtyEditorSnapshot:()=>null,enqueueDocumentSave:async(_id,md)=>{stored=md;}});
 await h.save();assert.equal(stored,original);assert.ok(!h.events.includes('serialize'));
});
test('ordinary dirty manual save publishes manager state before immediate source navigation',async()=>{
 let managerRaw='old';const h=harness({isChunked:false,getDirtyEditorSnapshot:()=>'<p>latest</p>',savedHtmlToMarkdown:()=> 'latest',onChange:md=>{managerRaw=md;}});
 await h.save();assert.equal(managerRaw,'latest');
});

test('ordinary dirty save swallowed persistence failure cannot announce saved',async()=>{
 const h=harness({isChunked:false,awaitDocumentSaves:async()=>{throw Error('quota');}});await h.save();
 assert.deepEqual(h.events,['saving','serialize','manager-save','error']);
});
test('ordinary clean failed save retries raw but confirms final barrier',async()=>{
 for(const succeeds of [false,true]){
  let failed=true;let retried=0;const h=harness({isChunked:false,getDirtyEditorSnapshot:()=>null,awaitDocumentSaves:async()=>{if(failed)throw Error('quota');},saveCurrent:async()=>{retried++;failed=!succeeds;}});
  await h.save();assert.equal(retried,1);assert.deepEqual(h.events,['saving',succeeds?'saved':'error']);
 }
});

test('clean manual save never retries a stale closure after input or owner changes',async()=>{
 for(const change of ['input','owner','document']){
  const owner={current:1},revision={current:0};let id='doc',reject,retries=0;
  const h=harness({isChunked:false,getDirtyEditorSnapshot:()=>null,ownerGeneration:owner,inputRevision:revision,useEditorStore:{getState:()=>({activeDocumentId:id})},awaitDocumentSaves:()=>new Promise((_,r)=>reject=r),saveCurrent:async()=>{retries++;}});
  const pending=h.save();
  if(change==='input')revision.current++;else if(change==='owner')owner.current++;else id='other';
  reject(Error('newer raw failed'));await pending;
  assert.equal(retries,0);assert.deepEqual(h.events,['saving']);
 }
});
