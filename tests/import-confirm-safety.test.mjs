import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {test} from 'node:test';
import React,{act} from 'react';
import domino from '@mixmark-io/domino';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject};};
async function mounted(kind,strict,run,text='KEEP ME'){
 const window=domino.createWindow('<html><body><div id="root"></div></body></html>');
 const previous=new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const[k,v]of Object.entries({window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,k,{configurable:true,value:v});
 const load=(path,overrides={})=>{const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const c={exports:{},require:n=>n in overrides?overrides[n]:require(n),document:window.document,window};vm.runInNewContext(code,c);return c.exports;};
 const overrides={'@/components/ui/modal':load('../src/components/ui/modal.tsx'),'@/components/ui/button':load('../src/components/ui/button.tsx'),'@/hooks/use-hwp':{useHwpImport:()=>({isImporting:false,reset(){},importFile:async()=>({content:text,warnings:[]})})}};
 const Component=load(`../src/components/features/import-export/${kind}-import.tsx`,overrides)[kind==='hwp'?'HwpImport':'MarkdownImport'];
 const root=require('react-dom/client').createRoot(window.document.getElementById('root')),container=window.document.getElementById('root');
 let open=true,closes=0,calls=0,unmounted=false;const save=deferred(),written=[];
 const render=()=>root.render(React.createElement(strict?React.StrictMode:React.Fragment,null,React.createElement(Component,{open,onClose(){closes++;open=false;render();},onImportComplete:(content,title)=>{calls++;written.push({content,title});return save.promise;}})));
 const button=text=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent===text);
 try{
  await act(async()=>render());
  const input=container.querySelector('input');Object.defineProperty(input,'files',{configurable:true,value:[{name:`example.${kind==='hwp'?'hwpx':'md'}`,size:10,text:async()=>text}]});
  await act(async()=>input.dispatchEvent(new window.Event('change',{bubbles:true})));
  await run({container,written,button,reopen:async()=>act(async()=>{open=true;render();}),counts:()=>({calls,closes}),start:async()=>act(async()=>{button('확인').click();button('확인').click();}),close:async()=>act(async()=>container.querySelector('[aria-label="닫기"]').click()),escape:async()=>act(async()=>{const e=new window.Event('keydown',{bubbles:true});Object.defineProperty(e,'key',{value:'Escape'});window.document.dispatchEvent(e);}),finish:async(fail)=>act(async()=>{if(fail)save.reject(new Error('synthetic failure after parent creation'));else save.resolve();}),unmount:async()=>{await act(async()=>root.unmount());unmounted=true;}});
 }finally{if(!unmounted)await act(async()=>root.unmount());for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}
}
for(const kind of ['markdown','hwp'])for(const strict of [false,true]){
 test(`${kind} confirmation preserves preview and blocks duplicate/close/uncertain retry (StrictMode=${strict})`,async()=>mounted(kind,strict,async h=>{
  await h.start();assert.deepEqual(h.counts(),{calls:1,closes:0});assert.ok(h.button('확인').disabled);assert.ok(h.container.querySelector('[role="status"]'));
  await h.close();await h.escape();assert.equal(h.counts().closes,0);
  await h.finish(true);assert.ok(h.container.querySelector('[role="dialog"]'));assert.match(h.container.querySelector('[role="alert"]').textContent,/일부 문서.*재시도는 막았습니다/);assert.equal(h.container.querySelector('[aria-label="저장 실패 복구 원문"]').value,'KEEP ME');
  assert.ok(h.button('확인').disabled);await act(async()=>h.button('확인').click());assert.equal(h.counts().calls,1);assert.equal(h.written.length,1);
  await h.close();assert.equal(h.counts().closes,1);await h.reopen();assert.equal(h.counts().calls,1);assert.ok(h.container.querySelector('input'));assert.ok(!h.container.querySelector('[role="alert"]'));
 }));
 test(`${kind} closes only after successful persistence (StrictMode=${strict})`,async()=>mounted(kind,strict,async h=>{await h.start();assert.equal(h.counts().closes,0);await h.finish(false);assert.equal(h.counts().closes,1);assert.ok(!h.container.querySelector('[role="dialog"]'));}));
 test(`${kind} unmount consumes late failure without closing a later screen (StrictMode=${strict})`,async()=>mounted(kind,strict,async h=>{await h.start();await h.unmount();await h.finish(true);assert.deepEqual(h.counts(),{calls:1,closes:0});}));
}

for(const kind of ['markdown','hwp'])test(`${kind} preserves full recovery text beyond the preview limit`,async()=>{
 const text='한글 & <원문>\n'.repeat(200);
 await mounted(kind,false,async h=>{await h.start();await h.finish(true);assert.equal(h.container.querySelector('[aria-label="저장 실패 복구 원문"]').value,text);assert.equal(h.written[0].content,text);},text);
});
