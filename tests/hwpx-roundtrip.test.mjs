import { requireWithEmbeddedRaster } from './load-embedded-raster.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import JSZip from 'jszip';

const require = createRequire(import.meta.url);
const options = { paperSize: 'A4', orientation: 'portrait', marginTop: 20, marginBottom: 20, marginLeft: 20, marginRight: 20, fontSize: 10, fontFamily: '맑은 고딕', lineHeight: 1.6 };
async function runWorker(name, data) {
  const source = readFileSync(new URL(`../src/workers/${name}.worker.ts`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  const messages = [];
  const self = { postMessage(message) { messages.push(message); } };
  vm.runInNewContext(js, { exports: {}, require: name => requireWithEmbeddedRaster(require, name), self, console, TextEncoder, TextDecoder, ArrayBuffer, Uint8Array, Blob, atob, btoa, setTimeout, clearTimeout });
  await self.onmessage({ data });
  assert.equal(messages.find(message => message.type === 'error'), undefined, JSON.stringify(messages));
  const result = messages.find(message => message.type === 'complete');
  assert.ok(result, 'worker must finish');
  return result;
}
const generate = async markdown => (await runWorker('hwp-generator', { type: 'generate', markdown, options })).buffer;
const parse = async file => (await runWorker('hwp-parser', { type: 'parse', file })).content;

test('synthetic Korean heading, paragraphs, list and table survive generator/parser roundtrip', async () => {
  const content = await parse(await generate('# 합성 회의록\n\n첫 문단입니다.\n\n- 첫 항목\n- 다음 항목\n\n| 작업 | 담당 |\n| --- | --- |\n| 검토 | 작성자 |\n\n마지막 문단입니다.'));
  for (const text of ['합성 회의록', '첫 문단입니다.', '첫 항목', '다음 항목', '| 작업 | 담당 |', '| 검토 | 작성자 |', '마지막 문단입니다.']) assert.ok(content.includes(text), `${text}: ${content}`);
  assert.ok(content.indexOf('첫 문단') < content.indexOf('마지막 문단'));
});

test('HWPX sections remain in numeric document order beyond section9', async () => {
  const zip = await JSZip.loadAsync(await generate('# 합성 제목\n\n섹션본문'));
  const xml = await zip.file('Contents/section0.xml').async('text');
  for (let i = 0; i < 12; i++) zip.file(`Contents/section${i}.xml`, xml.replace('섹션본문', `섹션본문${i}끝`));
  const content = await parse(await zip.generateAsync({ type: 'arraybuffer' }));
  const indices = Array.from({ length: 12 }, (_, i) => content.indexOf(`섹션본문${i}끝`));
  assert.ok(indices.every((value, i) => value >= 0 && (i === 0 || value > indices[i - 1])), content);
});

test('merged table XML entities are decoded once before safe HTML output', async () => {
  const content = await parse(await generate('<table><tr><td colspan="2">연구 &amp; 개발</td></tr><tr><td>가</td><td>나</td></tr></table>'));
  assert.match(content, /<td colspan="2">연구 &amp; 개발<\/td>/);
  assert.doesNotMatch(content, /&amp;amp;/);
});

test('merged cells decode numeric XML entities once and keep markup inert', async () => {
  const zip = await JSZip.loadAsync(await generate('<table><tr><td colspan="2">합성셀</td></tr></table>'));
  const section = await zip.file('Contents/section0.xml').async('text');
  zip.file('Contents/section0.xml', section.replace('합성셀', '&#xD55C;&#44544; &lt;b&gt;텍스트&lt;/b&gt; &amp;lt; &#x110000;'));
  const content = await parse(await zip.generateAsync({ type: 'arraybuffer' }));
  assert.match(content, /한글 &lt;b&gt;텍스트&lt;\/b&gt; &amp;lt; &amp;#x110000;/);
  assert.doesNotMatch(content, /<b>/);
});

test('exported image package returns its original embedded bytes and following paragraph on import', async () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==';
  const content = await parse(await generate(`앞 문장\n\n![사각형](data:image/png;base64,${png})\n\n뒤 문장`));
  const expected = `data:image/png;base64,${png}`;
  assert.ok(content.includes(expected));
  assert.ok(content.indexOf('앞 문장') < content.indexOf(expected) && content.indexOf(expected) < content.indexOf('뒤 문장'));
});

const cellPng = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==';
const imageData = `data:image/png;base64,${cellPng}`;

async function pictureTable(markdown, injected, withFiles = () => {}) {
  const zip = await JSZip.loadAsync(await generate(markdown));
  const path = 'Contents/section0.xml';
  const xml = await zip.file(path).async('text');
  assert.ok(xml.includes('<hp:t>그림자리</hp:t>'));
  zip.file(path, xml.replace('<hp:t>그림자리</hp:t>', injected));
  zip.file('BinData/image1.png', Buffer.from(cellPng, 'base64'));
  withFiles(zip);
  return runWorker('hwp-parser', { type: 'parse', file: await zip.generateAsync({ type: 'arraybuffer' }) });
}

const imageTag = '<hc:img binaryItemIDRef="image1"/>';

test('keeps a small HWPX cell picture between its captions in a simple table', async () => {
  const { content } = await pictureTable('| 머리 | 열 |\n| --- | --- |\n| 그림자리 | 이웃 |\n\n표 다음',
    `<hp:t>그림 &amp; 설명</hp:t>${imageTag}<hp:t>아래 설명</hp:t>`);
  assert.ok(content.includes(`<td><p>그림 &amp; 설명</p><img src="${imageData}" alt="이미지"><p>아래 설명</p></td>`), content);
  assert.match(content, /<td>이웃<\/td>/);
  assert.ok(content.indexOf('</table>') < content.indexOf('표 다음'));
});

test('keeps HWPX cell image bytes in a merged cell and leaves a text-only neighbor intact', async () => {
  const { content } = await pictureTable('<table><tr><td colspan="2">그림자리</td></tr><tr><td>하나</td><td>둘</td></tr></table>',
    `${imageTag}<hp:t>&lt;b&gt;테스트&lt;/b&gt;</hp:t>`);
  assert.ok(content.includes(`<td colspan="2"><img src="${imageData}" alt="이미지"><p>&lt;b&gt;테스트&lt;/b&gt;</p></td>`), content);
  assert.match(content, /<td>하나<\/td>\s*<td>둘<\/td>/);
});

test('keeps captions when an HWPX cell picture exceeds the import size limit', async () => {
  const { content, warnings } = await pictureTable('| 머리 | 열 |\n| --- | --- |\n| 그림자리 | 이웃 |',
    '<hp:t>설명</hp:t><hc:img binaryItemIDRef="large"/>', zip => {
      zip.file('BinData/large.png', Buffer.alloc(200 * 1024 + 1));
    });
  assert.match(content, /\| 설명 \| 이웃 \|/);
  assert.doesNotMatch(content, /<img|data:image/);
  assert.ok(warnings.some(warning => warning.includes('제외되었습니다')));
});

test('applies the aggregate output limit to resolved cell images without losing the caption', async () => {
  const { content, warnings } = await pictureTable('| 머리 | 열 |\n| --- | --- |\n| 그림자리 | 이웃 |',
    `<hp:t>유지</hp:t>${'<hc:img binaryItemIDRef="reused"/>'.repeat(9)}`, zip => {
      const png = Buffer.alloc(195 * 1024);
      Buffer.from(cellPng, 'base64').copy(png);
      zip.file('BinData/reused.png', png);
    });
  assert.doesNotMatch(content, /data:image/);
  assert.match(content, /<p>유지<\/p><p>이미지 제외됨<\/p>/);
  assert.ok(warnings.some(warning => warning.includes('문서가 매우 커서')));
});
