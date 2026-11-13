import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import domino from '@mixmark-io/domino';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
function loadSource(source, overrides = {}) {
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const context = { exports: {}, require: name => name in overrides ? overrides[name] : require(name) };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
const guideModule = loadSource(read('../src/lib/guides.ts'));
const guide = guideModule.getGuide('markdown-cheatsheet');
const extensions = loadSource(read('../src/lib/marked-extensions.ts'));
const { Marked } = require('marked');
const mainParser = new Marked();
const workerParser = new Marked();
// Run the real synchronous parser and the real worker message handler with
// separate parser instances, as in the browser. These checks cover Markdown-to-
// HTML, not browser editing or export round trips.
const markdown = loadSource(read('../src/lib/markdown.ts').split('// Worker-based async API')[0], {
  './marked-extensions': extensions, marked: { marked: mainParser },
});
let workerResult;
const self = { postMessage(message) { workerResult = message; } };
const worker = ts.transpileModule(read('../src/workers/markdown.worker.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(worker, { self, exports: {}, require: name => {
  if (name === '@/lib/marked-extensions') return extensions;
  if (name === 'marked') return { marked: workerParser };
  return require(name);
} });
const { default: GuidePage } = loadSource(read('../src/app/guides/[slug]/page.tsx'), {
  '@/lib/guides': guideModule, 'next/link': 'a',
  'next/navigation': { notFound() { throw new Error('unexpected missing guide'); } },
});
const renderGuide = async slug => renderToStaticMarkup(await GuidePage({ params: Promise.resolve({ slug }) }));

const expectations = [
  ['제목과 문단', doc => {
    assert.equal(doc.querySelector('h1').textContent, '문서 제목');
    assert.equal(doc.querySelector('h2').textContent, '큰 주제');
    assert.equal(doc.querySelector('h3').textContent, '세부 주제');
    assert.equal(doc.querySelectorAll('p').length, 2);
  }],
  ['굵게·기울임·취소선', doc => {
    for (const tag of ['strong', 'em', 'del']) assert.equal(doc.querySelectorAll(tag).length, 1);
  }],
  ['목록과 체크리스트', doc => {
    assert.equal(doc.querySelectorAll('ul').length, 2);
    assert.equal(doc.querySelectorAll('ol > li').length, 2);
    assert.equal(doc.querySelectorAll('input[type=checkbox]').length, 2);
    assert.equal(doc.querySelectorAll('input[checked]').length, 1);
  }],
  ['링크', doc => {
    assert.equal(doc.querySelector('a').getAttribute('href'), '/guides');
    assert.equal(doc.querySelector('a').textContent, 'MDView 사용 가이드');
  }],
  ['인용문과 구분선', doc => {
    assert.equal(doc.querySelectorAll('blockquote').length, 1);
    assert.equal(doc.querySelectorAll('hr').length, 1);
    assert.equal(doc.querySelectorAll('h1,h2').length, 0);
  }],
  ['인라인 코드와 코드 블록', doc => {
    assert.equal(doc.querySelector('p > code').textContent, 'npm test');
    assert.equal(doc.querySelector('pre > code').className, 'language-javascript');
    assert.ok(doc.querySelector('pre > code').textContent.includes('console.log(message);'));
  }],
  ['표와 세로줄', doc => {
    assert.equal(doc.querySelectorAll('thead th').length, 2);
    assert.equal(doc.querySelectorAll('tbody tr').length, 3);
    assert.equal(doc.querySelectorAll('tbody td').length, 6);
    assert.equal(doc.querySelectorAll('tbody td')[5].textContent, 'A | B');
  }],
  ['기호를 문자 그대로 쓰기', doc => {
    assert.equal(doc.querySelectorAll('h1,em,strong,ol,ul').length, 0);
    for (const value of ['# 제목이 아닌 문장', '*별표를 그대로 표시*', '1. 목록이 아닌 번호']) assert.ok(doc.body.textContent.includes(value));
  }],
];
for (const [title, verify] of expectations) {
  test(`cheatsheet example produces its described Markdown structure: ${title}`, () => {
    const section = guide.sections.find(section => section.title === title);
    assert.ok(section?.code);
    const html = markdown.markdownToHtml(section.code);
    self.onmessage({ data: { type: 'toHtml', id: 1, markdown: section.code } });
    assert.equal(workerResult.type, 'result');
    assert.equal(workerResult.result, html);
    const doc = domino.createWindow(html).document;
    verify(doc);
    assert.equal(doc.querySelectorAll('script,iframe,img').length, 0);
  });
}

test('guide renders all eight examples verbatim as labelled keyboard-reachable code, not live markup', async () => {
  const doc = domino.createWindow(await renderGuide(guide.slug)).document;
  const examples = Array.from(doc.querySelectorAll('pre'));
  assert.equal(examples.length, expectations.length);
  for (const [index, node] of examples.entries()) {
    assert.equal(node.textContent, guide.sections[index].code);
    assert.equal(node.getAttribute('tabindex'), '0');
    assert.equal(node.getAttribute('aria-label'), guide.sections[index].title);
    assert.equal(node.querySelectorAll('code').length, 1);
    assert.equal(node.querySelectorAll('a,table,input,script').length, 0);
  }
  assert.equal(doc.querySelectorAll('h1').length, 1);
});

test('getting-started guide links to the reference and retains a descriptive label for its old example', async () => {
  const doc = domino.createWindow(await renderGuide('markdown-editor')).document;
  assert.ok(doc.querySelector('a[href="/guides/markdown-cheatsheet"]'));
  assert.equal(doc.querySelector('pre').getAttribute('aria-label'), '복사해서 써 보는 회의록 예제');
});

test('source newline behavior matches the documented MDView-specific caveat', () => {
  const html = markdown.markdownToHtml('첫 줄\n둘째 줄');
  self.onmessage({ data: { type: 'toHtml', id: 2, markdown: '첫 줄\n둘째 줄' } });
  assert.equal(workerResult.result, html);
  const doc = domino.createWindow(html).document;
  assert.equal(doc.querySelectorAll('p').length, 1);
  assert.equal(doc.querySelectorAll('br').length, 1);
  assert.ok(guide.sections[0].paragraphs.some(value => value.includes('다른 마크다운 도구')));
});
