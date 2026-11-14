import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const code = readFileSync(new URL('../src/lib/editor-dirty-snapshot.ts', import.meta.url),'utf8');
const js = ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {markEditorDirty,resetEditorDirty,getDirtyEditorSnapshot}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('copy never rewrites untouched derived previews or placeholders',()=>{
 const ed={isEditable:true,getHTML(){throw Error('must not serialize');}};
 assert.equal(getDirtyEditorSnapshot(ed),null);
});
test('captures live visual input before debounce, with isolation and retry',()=>{
 let html='latest'; const a={isEditable:true,getHTML:()=>html}, b={isEditable:true,getHTML:()=>'<p>other</p>'};
 markEditorDirty(a); assert.equal(getDirtyEditorSnapshot(a),'latest'); assert.equal(getDirtyEditorSnapshot(b),null);
 html='newer'; assert.equal(getDirtyEditorSnapshot(a),'newer');
 a.isEditable=false; assert.equal(getDirtyEditorSnapshot(a),null);
 a.isEditable=true; assert.equal(getDirtyEditorSnapshot(a),'newer');
 resetEditorDirty(a); assert.equal(getDirtyEditorSnapshot(a),null);
});
