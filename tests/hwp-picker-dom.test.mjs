import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import React, { act } from 'react';
import domino from '@mixmark-io/domino';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const js = ts.transpileModule(readFileSync(new URL('../src/components/features/import-export/hwp-import.tsx', import.meta.url), 'utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true} }).outputText;
async function mounted(run) {
  const window = domino.createWindow('<html><body><div id="root"></div></body></html>');
  const previous = new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  for(const [k,v] of Object.entries({window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true})) Object.defineProperty(globalThis,k,{configurable:true,value:v});
  let error = null, busy = false, picks = 0;
  const context = {exports:{},require: name => {
    if(name==='@/components/ui/modal') return {Modal: ({children})=>React.createElement('div',{role:'dialog'},children)};
    if(name==='@/components/ui/button') return {Button: ({children,...props})=>React.createElement('button',props,children)};
    if(name==='@/hooks/use-hwp') return {useHwpImport:()=>({error,isImporting:busy,reset(){},importFile:async()=>{}})};
    return require(name);
  }};
  vm.runInNewContext(js,context);
  const {createRoot}=require('react-dom/client');
  const container=window.document.getElementById('root'),root=createRoot(container);
  const render = async () => {
    await act(async()=>root.render(React.createElement(context.exports.HwpImport,{open:true,onClose(){},onImportComplete(){}})));
    const input=container.querySelector('input');
    // Native file choosers and Tab focus movement are not implemented by Domino.
    if(input) Object.defineProperty(input,'click',{configurable:true,value:()=>picks++});
  };
  try {
    await render();
    await run({container,picks:()=>picks,render,error:v=>{error=v;},busy:v=>{busy=v;},key:async(key,props={})=>{
      const event=new window.Event('keydown',{bubbles:true,cancelable:true});
      for(const [k,v] of Object.entries({key,...props})) Object.defineProperty(event,k,{value:v});
      await act(async()=>container.querySelector('[role="button"]').dispatchEvent(event));
      return event.defaultPrevented;
    }});
  } finally {
    await act(async()=>root.unmount());
    for(const [k,d] of previous) {if(d) Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
  }
}
test('mounted HWP picker handles real React keyboard events and keeps ignored keys native',async()=>{
  await mounted(async h=>{
    const picker=h.container.querySelector('[role="button"]');
    assert.equal(picker.getAttribute('tabindex'),'0');
    assert.equal(picker.getAttribute('aria-label'),'HWP/HWPX 파일 선택');
    for(const key of ['Enter',' ']) assert.equal(await h.key(key),true);
    assert.equal(h.picks(),2);
    for(const [key,props] of [['Tab',{}],['Escape',{}],['Enter',{repeat:true}],['Enter',{isComposing:true}],['Enter',{keyCode:229}]]) assert.equal(await h.key(key,props),false);
    assert.equal(h.picks(),2);
  });
});
test('mounted HWP picker remains operable after error and disappears while processing',async()=>{
  await mounted(async h=>{
    h.error('합성 오류');await h.render();
    assert.match(h.container.textContent,/합성 오류/);
    assert.equal(await h.key('Enter'),true);assert.equal(h.picks(),1);
    h.busy(true);await h.render();
    assert.ok(!h.container.querySelector('[role="button"]'));
    h.busy(false);h.error(null);await h.render();
    assert.equal(await h.key(' '),true);assert.equal(h.picks(),2);
  });
});
