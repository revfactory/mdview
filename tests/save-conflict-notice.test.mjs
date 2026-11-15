import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
const require=createRequire(import.meta.url);
test('conflict recovery exposes selectable raw without reload or discard side effects',()=>{
 const source=readFileSync(new URL('../src/components/features/editor/save-conflict-notice.tsx',import.meta.url),'utf8');
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require});
 const html=renderToStaticMarkup(createElement(exports.SaveConflictNotice,{markdown:'local <script>raw</script> **draft**'}));
 assert.match(html,/role="alert"/);assert.match(html,/readonly=""/i);assert.match(html,/local &lt;script&gt;raw&lt;\/script&gt; \*\*draft\*\*/);
 assert.match(html,/마지막 입력이 모두 포함/);assert.doesNotMatch(source,/location\.|window\.close|\.reload\(|deleteDocument|localStorage\.clear/);
});
