import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {test} from 'node:test';
import React,{act} from 'react';
import domino from '@mixmark-io/domino';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const dialog='[role="dialog"][aria-label="PDF 열기"]';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
async function mounted(check) {
  const window=domino.createWindow('<html><body><div id="root"></div></body></html>');
  const restore=new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  for(const [k,v] of Object.entries({window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true})) Object.defineProperty(globalThis,k,{configurable:true,value:v});
  const load=(path,overrides={})=>{
    const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    const context={exports:{},require: name=>name in overrides?overrides[name]:require(name),document:window.document,window};
    vm.runInNewContext(code,context);return context.exports;
  };
  const checkHeader=deferred(), saves=[]; let destroyed=0;
  const {PdfImport}=load('../src/components/features/import-export/pdf-import.tsx',{
    '@/components/ui/modal':load('../src/components/ui/modal.tsx'),
    '@/lib/pdf-file':{validatePdfFileMeta:()=>null,hasPdfHeader:()=>true,pdfTitleFromFileName:()=> 'sample',PDF_HEADER_SEARCH_BYTES:1024,PDF_MAX_FILE_SIZE:2048,formatFileSize:(n)=>String(n)},
    '@/lib/pdfjs':{openPdfDocument:async()=>({promise:Promise.resolve({numPages:1}),destroy(){destroyed++;}}),readPdfExcerpt:async()=> 'synthetic',describePdfError:()=> 'bad PDF'},
  });
  const container=window.document.getElementById('root'),root=require('react-dom/client').createRoot(container);
  let open=true,closes=0;
  const onClose=()=>{closes++;open=false;render();};
  const onImportComplete=()=>{const save=deferred();saves.push(save);return save.promise;};
  const render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(PdfImport,{open,onClose,onImportComplete})));
  const choose=async(header=Promise.resolve(new ArrayBuffer(10)))=>{
    const input=container.querySelector('input');
    Object.defineProperty(input,'files',{configurable:true,value:[{name:'sample.pdf',size:10,slice(){return {arrayBuffer:()=>header};},arrayBuffer:async()=>new ArrayBuffer(10)}]});
    await act(async()=>input.dispatchEvent(new window.Event('change',{bubbles:true})));
  };
  const closeButton=()=>container.querySelector('button[aria-label="닫기"]');
  const escape=async()=>act(async()=>{const e=new window.Event('keydown',{bubbles:true});Object.defineProperty(e,'key',{value:'Escape'});window.document.dispatchEvent(e);});
  const clickBackdrop=async()=>act(async()=>container.querySelector(dialog).previousElementSibling.click());
  try {
    await act(async()=>render());
    await check({container,choose,closeButton,escape,clickBackdrop,saves,closes:()=>closes,checkHeader,destroyed:()=>destroyed});
  } finally {
    await act(async()=>root.unmount());
    for(const [k,d] of restore) {
      if(d) Object.defineProperty(globalThis,k,d);
      else delete globalThis[k];
    }
  }
}

test('PDF parsing can still be dismissed and a late header read starts no save',async()=>mounted(async h=>{
  await h.choose(h.checkHeader.promise);
  assert.equal(h.closeButton().disabled,false);
  assert.match(h.container.querySelector('[role="status"]').textContent,/확인하는 중/);
  await h.escape();
  await act(async()=>h.checkHeader.resolve(new ArrayBuffer(10)));
  assert.equal(h.closes(),1);assert.equal(h.saves.length,0);assert.equal(h.destroyed(),0);
}));

test('PDF commit disables all dismissal, a failed write announces recovery and same file can be retried',async()=>mounted(async h=>{
  await h.choose();
  assert.equal(h.saves.length,1);assert.equal(h.closeButton().disabled,true);
  assert.match(h.container.querySelector('[role="status"]').textContent,/저장하는 중/);
  await h.escape();await h.clickBackdrop();await act(async()=>h.closeButton().click());
  assert.equal(h.closes(),0);assert.equal(h.saves.length,1);
  await act(async()=>h.saves[0].reject(new Error('synthetic transaction failure')));
  assert.equal(h.closeButton().disabled,false);
  assert.match(h.container.querySelector('[role="alert"]').textContent,/같은 파일을 다시 선택/);
  assert.equal(h.destroyed(),1);
  await h.choose();
  assert.equal(h.saves.length,2);assert.equal(h.closes(),0);
  await act(async()=>h.saves[1].resolve());
  assert.equal(h.closes(),1);assert.equal(h.destroyed(),2);assert.ok(!h.container.querySelector(dialog));
}));
