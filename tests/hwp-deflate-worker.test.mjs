import { requireWithEmbeddedRaster } from './load-embedded-raster.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import { deflateRawSync, deflateSync } from 'node:zlib';
import * as CFB from 'cfb';
import * as pako from 'pako';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/workers/hwp-parser.worker.ts', import.meta.url), 'utf8');
const script = new vm.Script(ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022,
} }).outputText);

const sentence = '합성 레거시 한글 문서 1127';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5koAAAAASUVORK5CYII=', 'base64');

function record(tag, level, data) {
  const header = Buffer.alloc(4);
  header.writeUInt32LE(((data.length << 20) | (level << 10) | tag) >>> 0);
  return Buffer.concat([header, data]);
}

function fixture(compress, damaged = false) {
  const header = Buffer.alloc(256);
  header.write('HWP Document File');
  header.writeUInt32LE(0x05000300, 32);
  header.writeUInt32LE(1, 36);
  const paragraph = Buffer.concat([Buffer.from(sentence, 'utf16le'), Buffer.from([11]), Buffer.alloc(15)]);
  const paraHeader = Buffer.alloc(22);
  paraHeader.writeUInt32LE(paragraph.length / 2);
  const control = Buffer.alloc(4);
  control.writeUInt32LE(0x67736f20);
  const picture = Buffer.from([1, 0, 0, 0]);
  const records = Buffer.concat([
    record(66, 0, paraHeader), record(67, 1, paragraph),
    record(71, 1, control), record(79, 2, picture),
  ]);
  const container = CFB.utils.cfb_new();
  CFB.utils.cfb_add(container, 'FileHeader', header);
  CFB.utils.cfb_add(container, 'BodyText/Section0', damaged ? Buffer.from([0xff, 0xff, 0xff]) : compress(records));
  CFB.utils.cfb_add(container, 'BinData/BIN0001.png', compress(png));
  return Uint8Array.from(CFB.write(container, { type: 'buffer' })).buffer;
}

async function parse(file) {
  const messages = [];
  const self = { postMessage: message => messages.push(message) };
  // Preserve the real package's ESM surface; CommonJS interop must not synthesize a default.
  const browserPako = { ...pako, __esModule: true };
  script.runInNewContext({ exports: {}, self, Uint8Array, ArrayBuffer, btoa, Error,
    require: name => name === 'pako' ? browserPako : requireWithEmbeddedRaster(require, name),
  });
  await self.onmessage({ data: { type: 'parse', file } });
  return messages.filter(message => message.type !== 'progress');
}

for (const [name, compress] of [['raw deflate', deflateRawSync], ['zlib', deflateSync]]) {
  test(`HWP worker keeps Korean text and embedded PNG from ${name} streams`, async () => {
    const [result, extra] = await parse(fixture(compress));
    assert.equal(extra, undefined);
    assert.equal(result?.type, 'complete', JSON.stringify(result));
    assert.match(result.content, new RegExp(sentence));
    assert.ok(result.content.includes('data:image/png;base64,' + png.toString('base64')));
    assert.equal(result.warnings.length, 0);
  });
}

test('a broken compressed body reports an error rather than a completed document', async () => {
  const [result, extra] = await parse(fixture(deflateRawSync, true));
  assert.equal(extra, undefined);
  assert.equal(result?.type, 'error');
  assert.match(result.error, /텍스트를 추출할 수 없습니다/);
});
