import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/app/not-found.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const linkProps = [];
const context = { exports: {}, require: name => name === 'next/link'
  ? props => {
    linkProps.push(props);
    return React.createElement('a', { href: props.href, className: props.className }, props.children);
  } : require(name) };
// No browser, storage, navigation or network APIs: rendering is read-only.
vm.runInNewContext(compiled, context);
const { default: NotFound, metadata } = context.exports;
const html = renderToStaticMarkup(React.createElement(NotFound));

test('missing-page recovery explains the error in Korean with a named landmark', () => {
  assert.match(html, /<main[^>]*aria-labelledby="not-found-title"/);
  assert.match(html, /<h1 id="not-found-title"[^>]*>페이지를 찾을 수 없습니다<\/h1>/);
  assert.match(html, /주소가 변경되었거나 잘못 입력됐을 수 있습니다/);
  assert.match(html, /<nav aria-label="다시 시작하기"/);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
});

test('recovery links stay on either existing origin without starting a document action', () => {
  assert.deepEqual(linkProps.map(link => link.href), ['/guides', '/']);
  for (const origin of ['https://mdview.kr', 'https://www.mdview.kr']) {
    for (const link of linkProps) {
      const url = new URL(link.href, origin);
      assert.equal(url.origin, origin);
      assert.equal(url.search, '');
      assert.equal(url.hash, '');
      assert.equal(link.prefetch, false);
      assert.equal(link.target, undefined);
    }
  }
  assert.match(html, /사용 가이드 보기<\/a>/);
  assert.match(html, /에디터로 돌아가기<\/a>/);
});

test('recovery content is scrollable and both keyboard links have visible focus styles', () => {
  assert.match(html, /<main class="[^"]*h-dvh[^"]*overflow-y-auto/);
  for (const link of linkProps) {
    assert.match(link.className, /min-h-12/);
    assert.match(link.className, /focus-visible:outline-2/);
    assert.match(link.className, /focus-visible:outline-offset-4/);
  }
});

test('missing-page metadata stays excluded from search indexing', () => {
  assert.equal(metadata.title, '페이지를 찾을 수 없습니다 | MDView');
  assert.equal(metadata.robots.index, false);
  assert.equal(metadata.robots.follow, true);
  assert.doesNotMatch(source, /use client|useEffect|useRouter|redirect\(/);
});
