import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
import { Marked } from 'marked';

const extensionSource = readFileSync(new URL('../src/lib/marked-extensions.ts', import.meta.url), 'utf8');
const extensionJs = ts.transpileModule(extensionSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
const extensions = {};
vm.runInNewContext(extensionJs, { exports: extensions, require: createRequire(import.meta.url) });
const marked = new Marked(extensions.markedMathExtension(), extensions.markedFootnoteExtension());

const source = readFileSync(new URL('../src/lib/pdf-converter.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exports = {};
vm.runInNewContext(js, { exports });
const { blocksToMarkdown, convertPagesToBlocks } = exports;
const render = text => marked.parse(blocksToMarkdown([{ type: 'paragraph', text, page: 1 }]));
const visibleText = html => html.replace(/<[^>]*>/g, '').trim()
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

for (const text of [
  '![보고서](https://example.invalid/pixel)',
  '[링크](javascript:alert(1))',
  '<img src="https://example.invalid/pixel">',
  '<script>alert("문자열")</script>',
  '<https://example.invalid> https://example.invalid www.example.invalid user@example.invalid',
  'C:\\문서\\파일 \\`내용` **강조** _밑줄_ ~~삭제~~',
  '연구 & 개발 &lt;문자&gt; &#60;div&#62; &amp;',
  '| 항목 | 값 | --- | # 제목 > 인용 ! [ ] ( ) { }',
  '$가격$ $$수식처럼 보이는 문자$$ [^각주] [^각주]: 설명',
  '---', '===', '1. 문단', '[x] 완료', '    들여쓴 본문\n다음 줄',
]) {
  test(`PDF text remains literal: ${text}`, () => {
    const html = render(text);
    assert.doesNotMatch(html, /<(?:img|a|script|iframe|strong|em|del|code|table|blockquote|h[1-6]|hr|ul|ol|input)\b/i);
    assert.doesNotMatch(html, /class="(?:math|footnote)/);
    assert.equal(visibleText(html), text.replace(/\s+/g, ' ').trim());
  });
}

test('Korean heading, paragraphs and detected lists retain intentional structure', () => {
  const blocks = convertPagesToBlocks([{ pageNumber: 1, lines: [
    { text: '합성 제목', fontSize: 24 },
    { text: '일반 한글 문단입니다. 충분한 길이로 제목보다 작은 글자 크기를 사용합니다.', fontSize: 12 },
    { text: '• 첫 항목 **일반 문자**', fontSize: 12 },
    { text: '• 다음 항목', fontSize: 12 },
    { text: '1. 순서 항목', fontSize: 12 },
    { text: '2. 순서 다음', fontSize: 12 },
  ] }]);
  const html = marked.parse(blocksToMarkdown(blocks));
  assert.match(html, /<h1>합성 제목<\/h1>/);
  assert.match(html, /<p>일반 한글 문단입니다\./);
  assert.match(html, /<ul>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<li>첫 항목 \*\*일반 문자\*\*<\/li>/);
  assert.doesNotMatch(html, /<strong>/);
});

test('heading/list text cannot introduce active links or HTML', () => {
  const html = marked.parse(blocksToMarkdown([
    { type: 'heading', headingLevel: 2, text: '<img src=x>', page: 1 },
    { type: 'list-item', ordered: false, text: '![x](https://example.invalid)', page: 1 },
    { type: 'list-item', ordered: true, text: 'https://example.invalid', page: 2 },
  ]));
  assert.match(html, /<h2>/);
  assert.match(html, /<li>/);
  assert.doesNotMatch(html, /<(?:img|a)\b/i);
});
