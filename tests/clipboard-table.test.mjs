import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { marked } from 'marked';

const require = createRequire(import.meta.url);
// Use Turndown's existing server-side DOM dependency. The real Chrome
// interaction is checked separately; no new shipped DOM runtime is needed.
const { createDocument } = createRequire(require.resolve('turndown'))('@mixmark-io/domino');
const source = readFileSync(new URL('../src/lib/clipboard-table.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
const exports = {};
vm.runInNewContext(js, { exports, require });
const { clipboardTableToMarkdown, isLiteralMarkdownTable } = exports;
const table = '<table><thead><tr><th>항목</th><th>기한</th></tr></thead><tbody><tr><td>초안</td><td>금요일</td></tr></tbody></table>';
const convert = html => clipboardTableToMarkdown(html, createDocument());

test('rendered Korean heading, paragraph and simple table become editable Markdown', () => {
  const markdown = convert('<h1>회의록</h1><p>앞 문장</p>' + table + '<p>끝 문장</p>');
  assert.match(markdown, /^# 회의록\b|^# 회의록\n/);
  assert.match(markdown, /앞 문장\n\n\| 항목 \| 기한 \|\n\| --- \| --- \|\n\| 초안 \| 금요일 \|\n\n끝 문장/);
  assert.match(marked.parse(markdown), /<table>[\s\S]*?<td>초안<\/td>[\s\S]*?<td>금요일<\/td>/);
});

test('cell separators and literal pipes stay inside the selected table cell', () => {
  const markdown = convert(table.replace('초안', '초안 | 검토<br>다음'));
  assert.match(markdown, /\| 초안 \\\| 검토 다음 \| 금요일 \|/);
  assert.match(marked.parse(markdown), /<td>초안 \| 검토 다음<\/td>/);
});

test('rich copy does not carry active elements, attributes, links or image URLs', () => {
  const markdown = convert('<section style="color:red"><script>bad()</script><img src="/remote.png"><a href="/some-page">참고</a></section>' + table.replace('초안', '&lt;tag&gt;'));
  assert.match(markdown, /참고/);
  assert.match(markdown, /&lt;tag&gt;/);
  assert.doesNotMatch(markdown, /bad|remote\.png|some-page|color:red|<tag>/);
});

test('merged, nested, non-rectangular, headerless or oversized tables and unsupported fragments keep plain paste', () => {
  for (const html of [table.replace('<th>', '<th colspan="2">'), table.replace('<th>', '<th rowspan="0">'), table.replace('초안', table),
    table.replace('<td>금요일</td>', ''), table.replace(/<(\/?)(th)>/g, '<$1td>'), table + ' '.repeat(500_001), '<h1>문장</h1>',
    '<p>&lt;untrusted&gt;</p>' + table]) {
    assert.equal(convert(html), null);
  }
});

test('fixed Markdown table delimiters are recognized without treating plain pipes as a table', () => {
  assert.equal(isLiteralMarkdownTable('| 작업 | 담당 |\n| :--- | ---: |\n| 원문 | 유지 |'), true);
  assert.equal(isLiteralMarkdownTable('결정 | 기한'), false);
  assert.equal(isLiteralMarkdownTable(' '.repeat(299_999) + '|'), false);
});
