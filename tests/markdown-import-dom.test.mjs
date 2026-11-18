import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {test} from 'node:test';
import React,{act} from 'react';
import domino from '@mixmark-io/domino';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const js=ts.transpileModule(readFileSync(new URL('../src/components/features/import-export/markdown-import.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject};};
async function mounted(strict,run){
 const window=domino.createWindow('<html><body><div id="root"></div></body></html>');
 const previous=new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const[k,v]of Object.entries({window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,k,{configurable:true,value:v});
 let open=true;const imported=[];
 const context={exports:{},require:name=>{
  if(name==='@/components/ui/modal')return{Modal:({open,onClose,children})=>open?React.createElement('div',{role:'dialog'},React.createElement('button',{'data-close':true,onClick:onClose},'닫기'),children):null};
  if(name==='@/components/ui/button')return{Button:({children,onClick})=>React.createElement('button',{onClick},children)};
  return require(name);
 }};vm.runInNewContext(js,context);
 const container=window.document.getElementById('root'),root=require('react-dom/client').createRoot(container);
 const render=()=>root.render(React.createElement(strict?React.StrictMode:React.Fragment,null,React.createElement(context.exports.MarkdownImport,{open,onClose:()=>{open=false;render();},onImportComplete:(...args)=>imported.push(args)})));
 try{
  await act(async()=>render());
  await run({container,imported,select:async(name,d)=>{
   const input=container.querySelector('input');assert.ok(input);
   Object.defineProperty(input,'files',{configurable:true,value:[{name,size:10,text:()=>d.promise}]});
   await act(async()=>input.dispatchEvent(new window.Event('change',{bubbles:true})));
  },close:async()=>act(async()=>container.querySelector('[data-close]').click()),reopen:async()=>act(async()=>{open=true;render();}),settle:async(d,value,reject=false)=>act(async()=>{if(reject)d.reject(new Error(value));else d.resolve(value);}),confirm:async()=>act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='확인').click())});
 }finally{await act(async()=>root.unmount());for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}
}
for(const strict of [false,true]){
 test(`mounted Markdown close/reopen preserves newer filename and content (StrictMode=${strict})`,async()=>mounted(strict,async h=>{
  const old=deferred(),current=deferred();await h.select('old.md',old);await h.close();await h.reopen();await h.select('current.md',current);await h.settle(current,'CURRENT');await h.settle(old,'OBSOLETE');
  assert.equal(h.container.querySelector('pre').textContent,'CURRENT');assert.doesNotMatch(h.container.textContent,/OBSOLETE/);assert.equal(h.imported.length,0);
  await h.confirm();assert.deepEqual(h.imported,[['CURRENT','current']]);assert.ok(!h.container.querySelector('[role="dialog"]'));
 }));
 test(`mounted Markdown stale failure cannot interrupt new pending read (StrictMode=${strict})`,async()=>mounted(strict,async h=>{
  const old=deferred(),current=deferred();await h.select('old.md',old);await h.close();await h.reopen();await h.select('current.md',current);await h.settle(old,'stale failure',true);
  assert.match(h.container.textContent,/파일을 읽는 중/);assert.doesNotMatch(h.container.textContent,/파일을 읽는 중 오류/);
  await h.settle(current,'RECOVERED');assert.equal(h.container.querySelector('pre').textContent,'RECOVERED');assert.equal(h.imported.length,0);
 }));
}
