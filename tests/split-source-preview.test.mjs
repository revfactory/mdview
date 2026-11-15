import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../src/components/features/editor/paginated-split-view.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('split.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let callback;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='handleSourceChange')callback=n.initializer.arguments[0].getText(ast);ts.forEachChild(n,visit);}visit(ast);
function harness(){let resolve;let stored='initial';const writes=[],previews=[];const exports={};const context={exports,console:{error(){}},pageChanging:false,isPageLoading:false,updatingFromSource:{current:false},sourceDirty:{current:false},sourceRevision:{current:0},getCurrentChunkId:()=>101,documentId:'A',currentPage:0,setSourceText(){},setSourcePending(){},enqueueDocumentOperation:async(_id,fn)=>fn(),updateChunk:async(_id,_p,md)=>{stored=md;writes.push(md);},handleChange:(md)=>{stored=md;writes.push(md);},handleSourceInput:async(md)=>{stored=md;writes.push(md);},publishSourcePreview:html=>previews.push(html),markdownModule:{markdownToHtmlAsync:()=>new Promise(r=>resolve=r)}};
 vm.runInNewContext(ts.transpileModule('exports.fn='+callback.replace("import('@/lib/markdown')",'Promise.resolve(markdownModule)'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {writes,previews,context,run:()=>exports.fn({target:{value:'x'.repeat(50001)}}),setStored:s=>stored=s,getStored:()=>stored,resolve:html=>resolve(html)};}
test('late paginated source preview must not replay old raw over newer stored edit',async()=>{
 const h=harness();const pending=h.run();await Promise.resolve();h.setStored('newer peer raw');h.resolve('<p>local preview</p>');await pending;
 assert.equal(h.getStored(),'newer peer raw');assert.equal(h.writes.length,1);assert.deepEqual(h.previews,['<p>local preview</p>']);
});
test('preview completion after ownership revision changes publishes nothing',async()=>{
 const h=harness();const pending=h.run();await Promise.resolve();h.context.sourceRevision.current++;h.resolve('<p>obsolete</p>');await pending;
 assert.deepEqual(h.previews,[]);assert.equal(h.writes.length,1);
});
