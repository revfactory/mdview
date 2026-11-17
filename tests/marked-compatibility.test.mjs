import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { Marked } from 'marked';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/lib/marked-extensions.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const extensions = {};
vm.runInNewContext(js, { exports: extensions, require });

function parser() {
  return new Marked(
    { gfm: true, breaks: true },
    extensions.markedMathExtension(),
    extensions.markedFootnoteExtension(),
  );
}

test('Korean headings and paragraphs remain separated after blank-line trimming', () => {
  assert.equal(parser().parse('# 제목\n\n\n## 다음\n\n문단\n'),
    '<h1>제목</h1>\n<h2>다음</h2>\n<p>문단</p>\n');
});

test('GFM tables retain their following paragraph', () => {
  const html = parser().parse('| 가 | 나 |\n|---|---|\n| 1 | 2 |\n\n\n다음\n');
  assert.match(html, /<th>가<\/th>/);
  assert.match(html, /<td>2<\/td>/);
  assert.match(html, /<\/table>\s*<p>다음<\/p>/);
});

test('reference definitions retain links without swallowing following paragraphs', () => {
  assert.equal(parser().parse('[문서][ref]\n\n[ref]: https://example.com\n\n\n끝\n'),
    '<p><a href="https://example.com">문서</a></p>\n<p>끝</p>\n');
});

test('ordinary task lists keep checkboxes but setext headings do not gain them', () => {
  const html = parser().parse('- [x] 완료\n- [ ] 미완료\n');
  assert.equal((html.match(/type="checkbox"/g) || []).length, 2);
  assert.equal((html.match(/checked/g) || []).length, 1);
  const heading = parser().parse('- [ ] task\n  =====\n');
  assert.match(heading, /<h1>\[ \] task<\/h1>/);
  assert.doesNotMatch(heading, /<input/);
});

test('indented code keeps internal blank lines and following paragraph', () => {
  assert.equal(parser().parse('    a\n    \n    b\n\n끝\n'),
    '<pre><code>a\n\nb\n</code></pre>\n<p>끝</p>\n');
});

test('raw HTML blocks retain the following paragraph after whitespace trimming', () => {
  assert.equal(parser().parse('<div>text</div>\n\n\n끝'), '<div>text</div><p>끝</p>\n');
});

test('footnote definitions remain scoped to one parse and preserve multiple notes', () => {
  const p = parser();
  const html = p.parse('하나[^1] 둘[^2]\n\n[^1]: 첫째\n[^2]: 둘째\n');
  assert.match(html, /id="fn-1"><p>첫째 /);
  assert.match(html, /id="fn-2"><p>둘째 /);
  assert.match(html, /href="#fn-1"/);
  assert.doesNotMatch(p.parse('다음 문서'), /footnotes|첫째|둘째/);
});

test('inline and block math still retain editable source in mixed documents', () => {
  const html = parser().parse('수식 $x^2$\n\n$$\\sum_i i$$\n\n끝');
  assert.match(html, /class="math-inline" data-math="x\^2"/);
  assert.match(html, /class="math-block" data-math="\\sum_i i"/);
  assert.match(html, /<p>끝<\/p>/);
});
