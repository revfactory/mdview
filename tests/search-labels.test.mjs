import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const exports = {};
  const js = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(js, { exports, require: name => name === '@/hooks/use-documents'
    ? { useDocuments: () => [] } : require(name) });
  return exports;
}
const { SearchInput } = load('../src/components/ui/search-input.tsx');
const { QuickOpen } = load('../src/components/features/quick-open/quick-open.tsx');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const input = html => html.match(/<input\b[^>]*>/)?.[0];

for (const value of ['', '한글 문서']) {
  test(`sidebar search has a persistent accessible name with value ${JSON.stringify(value)}`, () => {
    const html = input(render(SearchInput, { value, onChange() {}, placeholder: '검색...' }));
    assert.match(html, /aria-label="문서 검색"/);
    assert.match(html, /placeholder="검색\.\.\."/);
    assert.match(html, new RegExp(`value="${value}"`));
  });
}

test('shared search input preserves caller-provided accessible names and descriptions', () => {
  const html = input(render(SearchInput, { value: '', onChange() {}, 'aria-label': '폴더 검색', 'aria-describedby': 'help' }));
  assert.match(html, /aria-label="폴더 검색"/);
  assert.match(html, /aria-describedby="help"/);
  assert.equal((html.match(/aria-label=/g) ?? []).length, 1);
});

test('quick open search has its own explicit name inside the named dialog', () => {
  const props = { open: true, onClose() {}, onSelectDocument() {} };
  const html = render(QuickOpen, props);
  assert.match(html, /role="dialog"[^>]*aria-label="빠른 문서 열기"/);
  assert.match(input(html), /aria-label="문서 이름으로 검색"/);
  assert.match(input(html), /placeholder="문서 이름으로 검색\.\.\."/);
  assert.equal(render(QuickOpen, { ...props, open: false }), '');
});
