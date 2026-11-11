import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import JSZip from 'jszip';

const require = createRequire(import.meta.url);
test('HWPX generator preserves Korean heading, table and final paragraph in a valid ZIP', async () => {
  const source = readFileSync(new URL('../src/workers/hwp-generator.worker.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  const messages = [];
  const self = { postMessage(message) { messages.push(message); } };
  vm.runInNewContext(js, { exports: {}, require, self, console, TextEncoder, TextDecoder, ArrayBuffer, Uint8Array, Blob, setTimeout, clearTimeout });
  await self.onmessage({ data: { type: 'generate', markdown: '# 회의록\n\n- 첫 항목\n\n| 작업 | 담당 |\n| --- | --- |\n| 검토 | 사용자 |\n\n마지막 문장.', options: { paperSize: 'A4', orientation: 'portrait', marginTop: 20, marginBottom: 20, marginLeft: 20, marginRight: 20, fontSize: 10, fontFamily: '맑은 고딕', lineHeight: 1.6 } } });
  assert.equal(messages.find((message) => message.type === 'error'), undefined);
  const complete = messages.find((message) => message.type === 'complete'); assert.ok(complete);
  const zip = await JSZip.loadAsync(complete.buffer);
  const section = zip.file('Contents/section0.xml'); assert.ok(section);
  const xml = await section.async('text'); assert.match(xml, /회의록/); assert.match(xml, /검토/); assert.match(xml, /마지막 문장/);
});
