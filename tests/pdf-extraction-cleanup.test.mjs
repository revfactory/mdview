import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/pdfjs.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(js, { exports, DOMException, Error, require: name => {
  assert.equal(name, './pdf-to-markdown');
  return { pdfPagesToMarkdown: pages => pages.map(page => page.items.map(item => item.str).join('')).join('\n') };
}});
const { readPdfExcerpt, extractPdfMarkdown } = exports;
function page(read = async () => ({ items: [{ str: 'hello', transform: [1, 0, 0, 10, 0, 0], width: 20, hasEOL: true }] })) {
  let cleaned = 0;
  return { getTextContent: read, cleanup() { cleaned++; }, cleaned: () => cleaned };
}
for (const [name, run] of [['excerpt', readPdfExcerpt], ['markdown', extractPdfMarkdown]]) {
  test(`${name}: text failure cleans the acquired page and preserves the error`, async () => {
    const error = new Error('synthetic text failure');
    const p = page(async () => { throw error; });
    await assert.rejects(run({ numPages: 1, getPage: async () => p }), e => e === error);
    assert.equal(p.cleaned(), 1);
  });
  test(`${name}: success cleans the page once and preserves output`, async () => {
    const p = page();
    assert.equal(await run({ numPages: 1, getPage: async () => p }), 'hello');
    assert.equal(p.cleaned(), 1);
  });
}
test('markdown: abort during last-page extraction cleans up without progress or output', async () => {
  const controller = new AbortController();
  const progress = [];
  const p = page(async () => { controller.abort(); return { items: [] }; });
  await assert.rejects(extractPdfMarkdown({ numPages: 1, getPage: async () => p }, { signal: controller.signal, onProgress: (...args) => progress.push(args) }), { name: 'AbortError' });
  assert.equal(p.cleaned(), 1);
  assert.deepEqual(progress, []);
});
test('markdown: abort during getPage skips text work and cleans the acquired page', async () => {
  const controller = new AbortController();
  let reads = 0;
  const p = page(async () => { reads++; return { items: [] }; });
  await assert.rejects(extractPdfMarkdown({ numPages: 1, getPage: async () => { controller.abort(); return p; } }, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(reads, 0);
  assert.equal(p.cleaned(), 1);
});
test('markdown: pre-aborted signal never acquires a page', async () => {
  const controller = new AbortController(); controller.abort();
  let acquired = 0;
  await assert.rejects(extractPdfMarkdown({ numPages: 1, getPage: async () => { acquired++; return page(); } }, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(acquired, 0);
});
test('markdown: failure stops before later pages and reports only completed pages', async () => {
  const error = new Error('second page failed');
  const first = page(), second = page(async () => { throw error; });
  const acquired = [], progress = [];
  await assert.rejects(extractPdfMarkdown({ numPages: 3, getPage: async n => { acquired.push(n); return n === 1 ? first : second; } }, { onProgress: (n, total) => progress.push([n, total]) }), e => e === error);
  assert.deepEqual(acquired, [1, 2]);
  assert.deepEqual(progress, [[1, 3]]);
  assert.equal(first.cleaned(), 1);
  assert.equal(second.cleaned(), 1);
});
