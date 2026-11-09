import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dependencies = {};
for (const name of ['pdf-converter', 'pdf-limits']) {
  const exports = {};
  vm.runInNewContext(compile(`../src/lib/${name}.ts`), { exports });
  dependencies[`@/lib/${name}`] = exports;
}
const source = compile('../src/workers/pdf-parser.worker.ts');
async function run(data, pdfjs) {
  const messages = [];
  const self = { postMessage: message => messages.push(message) };
  vm.runInNewContext(source, {
    exports: {}, self, ArrayBuffer, Uint8Array, Error, console,
    require: name => dependencies[name] ?? (name === 'pdfjs-dist/legacy/build/pdf.mjs' && pdfjs ? pdfjs : require(name)),
  });
  await self.onmessage({ data });
  return messages;
}
const bytes = text => Uint8Array.from(Buffer.from(text)).buffer;
const request = file => ({ type: 'parse', file });
function stub({ pages = 1, items = [], failure } = {}) {
  const state = { destroyed: 0, pageCleaned: 0, pagesRead: 0 };
  return {
    state,
    getDocument() {
      return {
        destroy: async () => { state.destroyed++; },
        promise: Promise.resolve({
          numPages: pages,
          getMetadata: async () => ({ info: {} }),
          getPage: async () => {
            state.pagesRead++;
            return {
              getTextContent: async () => { if (failure) throw new Error(failure); return { items }; },
              cleanup: () => { state.pageCleaned++; },
            };
          },
        }),
      };
    },
  };
}

test('reject malformed payload, oversized files and invalid page limits before parsing', async () => {
  for (const data of [request({}), request(new ArrayBuffer(25 * 1024 * 1024 + 1)), request(bytes('not-pdf')), { ...request(bytes('%PDF-1.7')), options: { maxPages: 0 } }]) {
    assert.equal((await run(data)).at(-1).type, 'error');
  }
});

test('page limit fails before extraction and destroys document, never truncates', async () => {
  const pdfjs = stub({ pages: 201 });
  const messages = await run(request(bytes('%PDF-1.7')), pdfjs);
  assert.match(messages.at(-1).error, /200페이지/);
  assert.equal(pdfjs.state.pagesRead, 0);
  assert.equal(pdfjs.state.destroyed, 1);
});

test('item/text bounds and page errors clean resources and never return partial success', async () => {
  const item = { str: '본문', transform: [1, 0, 0, 12, 10, 100] };
  for (const spec of [{ items: Array(50_001).fill(item) }, { items: [{ ...item, str: '가'.repeat(2_000_001) }] }, { failure: 'corrupt page' }]) {
    const pdfjs = stub(spec);
    const messages = await run(request(bytes('%PDF-1.7')), pdfjs);
    assert.equal(messages.at(-1).type, 'error');
    assert.equal(messages.some(message => message.type === 'complete'), false);
    assert.equal(pdfjs.state.destroyed, 1);
    assert.equal(pdfjs.state.pageCleaned, 1);
  }
});

// Construct all fixture bytes here; no user documents or downloaded fixtures.
function syntheticPdf() {
  const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Synthetic def /CMapType 2 def
1 begincodespacerange <0000> <FFFF> endcodespacerange
2 beginbfchar <0001> <D55C> <0002> <AE00> endbfchar
endcmap CMapName currentdict /CMap defineresource pop end end`;
  const encoding = '/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> def /CMapName /SyntheticEncoding def /CMapType 1 def 1 begincodespacerange <0000> <FFFF> endcodespacerange 1 begincidrange <0000> <FFFF> 0 endcidrange endcmap CMapName currentdict /CMap defineresource pop end end';
  const stream = 'BT /F1 24 Tf 50 750 Td (Synthetic heading) Tj /F1 12 Tf 0 -35 Td (Paragraph text) Tj 0 -25 Td (- List item) Tj /F2 12 Tf 0 -25 Td <00010002> Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type0 /BaseFont /Synthetic /Encoding 9 0 R /DescendantFonts [7 0 R] /ToUnicode 8 0 R >>',
    '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Synthetic /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 1000 /FontDescriptor 10 0 R /CIDToGIDMap /Identity >>',
    `<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`,
    `<< /Length ${encoding.length} >>\nstream\n${encoding}\nendstream`,
    '<< /Type /FontDescriptor /FontName /Synthetic /Flags 4 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 900 /Descent -200 /CapHeight 700 /StemV 80 >>',
  ];
  let pdf = '%PDF-1.7\n';
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return bytes(pdf);
}

test('actual PDF.js handler extracts locally generated heading, paragraph, list and Korean text', async () => {
  // Modern pdfjs references DOMMatrix at module load; no rendering APIs are used
  // here. This Node-only stub is not a browser/bundle compatibility assertion.
  const previous = globalThis.DOMMatrix;
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('Network forbidden for local fixture'); };
  globalThis.DOMMatrix ??= class {};
  try {
    const messages = await run(request(syntheticPdf()));
    assert.equal(messages.find(message => message.type === 'error'), undefined, JSON.stringify(messages));
    const result = messages.find(message => message.type === 'complete').result;
    for (const text of ['Synthetic heading', 'Paragraph text', 'List item', '한글']) assert.ok(result.markdown.includes(text), result.markdown);
    assert.equal(result.metadata.pageCount, 1);
    assert.equal(result.metadata.parsedPageCount, 1);
    assert.equal(requests, 0, 'local PDF must not fetch external resources');
  } finally {
    globalThis.fetch = previousFetch;
    if (previous === undefined) delete globalThis.DOMMatrix;
    else globalThis.DOMMatrix = previous;
  }
});
