import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../src/components/features/editor/paginated-split-view.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('split.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function callback(name){let found;function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)===name&&n.arguments.length&&ts.isArrowFunction(n.arguments[0]))found=n.arguments[0].getText(ast);ts.forEachChild(n,visit);}visit(ast);assert.ok(found);return found;}
function run(js,context={}){const exports={};vm.runInNewContext(ts.transpileModule(js,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,...context});return exports;}
for(const name of ['onFlushReady','onLeaveReady']) {
 test(`${name}: already persisted raw source must not overwrite another tab's later edit`,async()=>{
  let stored='peer newer',writes=0;
  const flush=run('exports.fn='+callback(name),{loadError:null,isPageLoading:false,pageChanging:false,hasFailedPageSave:()=>true,sourceRevision:{current:1},sourceDirty:{current:true},textareaRef:{current:{value:'local already saved'}},getCurrentChunkId:()=>101,documentId:'A',currentPage:0,awaitDocumentSaves:async()=>{},enqueueDocumentOperation:async(_id,fn)=>fn(),handleSourceInput:async(raw)=>{writes++;stored=raw;}}).fn;
  await flush(); assert.equal(writes,0);assert.equal(stored,'peer newer');
 });
 test(`${name}: failed raw source retries exact text and continued failure rejects`,async()=>{
  let stored='old',fail=true,failed=true;
  const flush=run('exports.fn='+callback(name),{loadError:null,isPageLoading:false,pageChanging:false,hasFailedPageSave:()=>true,sourceRevision:{current:1},sourceDirty:{current:true},textareaRef:{current:{value:'latest **raw**'}},getCurrentChunkId:()=>101,documentId:'A',currentPage:0,awaitDocumentSaves:async()=>{if(failed)throw Error('failed write');},enqueueDocumentOperation:async(_id,fn)=>fn(),handleSourceInput:async(raw)=>{if(fail)throw Error('quota');stored=raw;failed=false;}}).fn;
  await assert.rejects(flush(),/quota/);assert.equal(stored,'old');fail=false;await flush();assert.equal(stored,'latest **raw**');
 });
}

test('a newer source revision during failed barrier is not overwritten by captured raw',async()=>{
 let reject;let writes=0;const revision={current:1};
 const flush=run('exports.fn='+callback('onFlushReady'),{loadError:null,isPageLoading:false,pageChanging:false,hasFailedPageSave:()=>true,sourceRevision:revision,sourceDirty:{current:true},textareaRef:{current:{value:'old captured'}},getCurrentChunkId:()=>101,documentId:'A',currentPage:0,awaitDocumentSaves:()=>new Promise((_,r)=>reject=r),enqueueDocumentOperation:async()=>{writes++;}}).fn;
 const pending=flush();revision.current++;reject(Error('failed'));await assert.rejects(pending);assert.equal(writes,0);
});

test('an unrelated page failure must not replay already saved source over a peer edit',async()=>{
 let stored='peer newer';let writes=0;
 const flush=run('exports.fn='+callback('onLeaveReady'),{hasFailedPageSave:()=>false,sourceRevision:{current:1},sourceDirty:{current:true},textareaRef:{current:{value:'local already saved'}},getCurrentChunkId:()=>101,documentId:'A',currentPage:0,awaitDocumentSaves:async()=>{throw Error('page 1 failed');},enqueueDocumentOperation:async(_id,fn)=>fn(),handleSourceInput:async(raw)=>{writes++;stored=raw;}}).fn;
 await assert.rejects(flush(),/page 1 failed/);assert.equal(writes,0);assert.equal(stored,'peer newer');
});
