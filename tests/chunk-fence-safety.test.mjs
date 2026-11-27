import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/chunk-document.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
const {chunkDocument,mergeChunks}=exports;
for(const [opening,falseClose] of [['````','```'],['~~~~','~~~'],['```','```~~~'],['~~~','~~~```']]){
 test(`chunk boundaries do not follow invalid closer ${opening}/${falseClose}`,()=>{
  const source=opening+'\n'+ 'a'.repeat(30000)+'\n'+falseClose+'\n\n'+ 'b'.repeat(30000)+'\n'+opening+'\n\nAFTER';
  const chunks=chunkDocument(source);
  assert.equal(mergeChunks(chunks),source);
  assert.ok(chunks[0].markdown.includes('b'.repeat(30000)),'code block must stay on one page');
 });
}
for(const fence of ['```','~~~~'])test(`valid longer ${fence} closer allows pagination`,()=>{
 const source=fence+'\n'+'a'.repeat(30000)+'\n'+fence+fence[0]+' \t\n\n'+'b'.repeat(30000);
 const chunks=chunkDocument(source);assert.equal(chunks.length,2);assert.equal(mergeChunks(chunks),source);
});
