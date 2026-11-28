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
 const loadUI = path => {
  const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const ui={exports:{},require,document:window.document,window};vm.runInNewContext(code,ui);return ui.exports;
 };
 const modal=loadUI('../src/components/ui/modal.tsx'),button=loadUI('../src/components/ui/button.tsx');
 const context={exports:{},require:name=>{
  if(name==='@/components/ui/modal')return modal;
  if(name==='@/components/ui/button')return button;
  return require(name);
 }};vm.runInNewContext(js,context);
 const container=window.document.getElementById('root'),root=require('react-dom/client').createRoot(container);
 const render=()=>root.render(React.createElement(strict?React.StrictMode:React.Fragment,null,React.createElement(context.exports.MarkdownImport,{open,onClose:()=>{open=false;render();},onImportComplete:(...args)=>imported.push(args)})));
 try{
  await act(async()=>render());
  await run({container,imported,body:window.document.body,key:async(props={})=>act(async()=>{const e=new window.Event('keydown',{bubbles:true});for(const[k,v]of Object.entries({key:'Escape',...props}))Object.defineProperty(e,k,{value:v});window.document.dispatchEvent(e);}),select:async(name,d)=>{
   const input=container.querySelector('input');assert.ok(input);
   Object.defineProperty(input,'files',{configurable:true,value:[{name,size:10,text:()=>d.promise}]});
   await act(async()=>input.dispatchEvent(new window.Event('change',{bubbles:true})));
  },keyboardPick:async(key)=>act(async()=>{
   const zone=container.querySelector('[aria-label="마크다운 파일 선택"]'), input=container.querySelector('input');
   assert.ok(zone); assert.equal(zone.getAttribute('role'),'button'); assert.equal(zone.getAttribute('tabindex'),'0');
   assert.ok(input); let clicks=0;
   const click=()=>clicks++;
   input.addEventListener('click',click);
   const e=new window.Event('keydown',{bubbles:true,cancelable:true});Object.defineProperty(e,'key',{value:key});
   zone.dispatchEvent(e);
   input.removeEventListener('click',click);
   assert.equal(clicks,1); assert.equal(e.defaultPrevented,true);
  }),close:async()=>act(async()=>container.querySelector('[aria-label="닫기"]').click()),reopen:async()=>act(async()=>{open=true;render();}),settle:async(d,value,reject=false)=>act(async()=>{if(reject)d.reject(new Error(value));else d.resolve(value);}),confirm:async()=>act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='확인').click())});
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

for(const strict of [false,true]){
 test(`real Modal Escape respects IME, cancels reading, and releases scroll lock (StrictMode=${strict})`,async()=>mounted(strict,async h=>{
  const old=deferred();await h.select('old.md',old);assert.equal(h.body.style.overflow,'hidden');
  await h.key({isComposing:true});assert.ok(h.container.querySelector('[role="dialog"]'));
  await h.key({keyCode:229});assert.ok(h.container.querySelector('[role="dialog"]'));
  await h.key();assert.ok(!h.container.querySelector('[role="dialog"]'));assert.equal(h.body.style.overflow,'');
  await h.settle(old,'OBSOLETE');await h.reopen();assert.ok(h.container.querySelector('input'));assert.ok(!h.container.querySelector('pre'));assert.equal(h.imported.length,0);
 }));
}
test('empty-file feedback remains recoverable in the real dialog',async()=>mounted(false,async h=>{
 const empty=deferred();await h.select('empty.md',empty);await h.settle(empty,'');assert.match(h.container.textContent,/텍스트 내용이 없습니다/);assert.ok(h.container.querySelector('input'));assert.ok(!h.container.querySelector('pre'));assert.equal(h.imported.length,0);
 const retry=deferred();await h.select('empty.md',retry);await h.settle(retry,'RECOVERED');assert.equal(h.container.querySelector('pre').textContent,'RECOVERED');await h.confirm();assert.deepEqual(h.imported,[['RECOVERED','empty']]);
}));

test('Markdown chooser activates once with either Enter or Space',async()=>mounted(false,async h=>{
 await h.keyboardPick('Enter'); await h.keyboardPick(' ');
}));
