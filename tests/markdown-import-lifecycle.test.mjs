import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../src/components/features/import-export/markdown-import.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const flush=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject};}
function setup(){
 const states=[],updates=[];let cleanup=()=>{};
 const react={useState:initial=>{const i=states.length;states.push(initial);return[initial,v=>{states[i]=v;updates.push([i,v]);}];},useRef:current=>({current}),useCallback:fn=>fn,useEffect:fn=>{cleanup=fn()??(()=>{});}};
 const jsx=(type,props)=>({type,props}),exports={};
 vm.runInNewContext(js,{exports,require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:{}});
 const root=exports.MarkdownImport({open:true,onClose(){},onImportComplete(){assert.fail('reading alone must never import');}});
 function find(node){if(!node||typeof node!=='object')return;if(Array.isArray(node))return node.map(find).find(Boolean);return node.type==='input'?node:find(node.props?.children);}
 const input=find(root);
 return{states,updates,close:root.props.onClose,unmount:()=>cleanup(),start:(name,read)=>{const target={files:[{name,size:10,text:()=>read.promise}],value:name};input.props.onChange({target});return target;}};
}
test('closed Markdown read cannot repopulate dialog state',async()=>{
 const h=setup(),d=deferred();h.start('old.md',d);h.close();const count=h.updates.length;d.resolve('old text');await flush();assert.equal(h.updates.length,count);assert.equal(h.states[1],null);
});
test('unmounted Markdown read ignores late failure and finalizer',async()=>{
 const h=setup(),d=deferred();h.start('old.md',d);h.unmount();const count=h.updates.length;d.reject(new Error('late'));await flush();assert.equal(h.updates.length,count);
});
test('newer Markdown read keeps its contents when an older read completes',async()=>{
 const h=setup(),a=deferred(),b=deferred();h.start('old.md',a);h.start('new.md',b);b.resolve('new text');await flush();a.resolve('old text');await flush();assert.equal(h.states[0].name,'new.md');assert.equal(h.states[1],'new text');
});
test('invalid replacement cancels pending content and clears reading state',async()=>{
 const h=setup(),a=deferred();h.start('old.md',a);h.start('bad.pdf',deferred());a.resolve('old text');await flush();assert.equal(h.states[0],null);assert.equal(h.states[1],null);assert.equal(h.states[3],false);assert.match(h.states[4],/만 지원/);
});
test('file input resets for same-file retry; current failure and success remain visible',async()=>{
 const h=setup(),a=deferred();assert.equal(h.start('same.md',a).value,'');a.reject(new Error('failed'));await flush();assert.match(h.states[4],/오류/);assert.equal(h.states[3],false);
 const b=deferred();h.start('same.md',b);b.resolve('recovered');await flush();assert.equal(h.states[1],'recovered');assert.equal(h.states[4],null);assert.equal(h.states[3],false);
});
test('stale failure cannot stop a newer pending read or show its error',async()=>{
 const h=setup(),a=deferred(),b=deferred();h.start('old.md',a);h.start('new.md',b);a.reject(new Error('stale'));await flush();assert.equal(h.states[3],true);assert.equal(h.states[4],null);b.resolve('current');await flush();assert.equal(h.states[1],'current');
});
test('empty Markdown read explains why there is no preview and permits retry',async()=>{
 const h=setup(),empty=deferred();h.start('empty.md',empty);empty.resolve('');await flush();assert.equal(h.states[1],null);assert.match(h.states[4],/텍스트 내용이 없습니다/);assert.equal(h.states[3],false);
 const retry=deferred();h.start('empty.md',retry);retry.resolve('now has content');await flush();assert.equal(h.states[4],null);assert.equal(h.states[1],'now has content');
});
test('whitespace-only Markdown remains untouched rather than silently trimmed',async()=>{
 const h=setup(),d=deferred();h.start('spacing.md',d);d.resolve('  \n');await flush();assert.equal(h.states[1],'  \n');assert.equal(h.states[4],null);
});
