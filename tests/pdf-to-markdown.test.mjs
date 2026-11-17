import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/pdf-to-markdown.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { pdfPagesToMarkdown, escapeMarkdownInline, escapeMarkdownBlockStart } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

/** 한 줄에 조각 하나씩 놓는 합성 페이지. y는 위에서 아래로 줄어든다. */
function page(lines, { top = 800, lineGap = 14 } = {}) {
  let y = top;
  const items = [];
  for (const line of lines) {
    if (line === null) { y -= lineGap; continue; } // 빈 줄 = 문단 간격
    const { text, size = 10, x = 72 } = typeof line === 'string' ? { text: line } : line;
    items.push({ str: text, x, y, width: text.length * size * 0.5, fontSize: size, hasEOL: true });
    y -= typeof line === 'object' && line.gap ? line.gap : lineGap;
  }
  return { items };
}

test('joins wrapped lines into one paragraph and splits paragraphs on wider gaps', () => {
  const md = pdfPagesToMarkdown([page(['첫 문단의 첫 줄', '첫 문단의 둘째 줄', null, '둘째 문단'])]);
  assert.equal(md, '첫 문단의 첫 줄 첫 문단의 둘째 줄\n\n둘째 문단');
});

test('larger short lines become headings relative to the dominant body size', () => {
  const md = pdfPagesToMarkdown([page([
    { text: '보고서 제목', size: 20, gap: 30 },
    { text: '1. 개요', size: 14, gap: 20 },
    '본문이 가장 많은 글자를 차지합니다. 본문이 가장 많은 글자를 차지합니다.',
    '본문 둘째 줄입니다.',
  ])]);
  assert.equal(md, '# 보고서 제목\n\n## 1. 개요\n\n본문이 가장 많은 글자를 차지합니다. 본문이 가장 많은 글자를 차지합니다. 본문 둘째 줄입니다.');
});

test('bullet glyphs become a tight Markdown list and continuation lines stay in the item', () => {
  const md = pdfPagesToMarkdown([page(['• 첫 항목', '이어지는 줄', '● 둘째 항목', 'ㆍ셋째 항목', null, '목록 뒤 문단'])]);
  assert.equal(md, '- 첫 항목 이어지는 줄\n- 둘째 항목\n- 셋째 항목\n\n목록 뒤 문단');
});

test('items on the same baseline form one line with spaces only across real gaps', () => {
  const items = [
    { str: 'Hello', x: 72, y: 700, width: 25, fontSize: 10, hasEOL: false },
    { str: 'world', x: 100, y: 700, width: 25, fontSize: 10, hasEOL: false },
    { str: '!', x: 125, y: 700, width: 3, fontSize: 10, hasEOL: true },
  ];
  assert.equal(pdfPagesToMarkdown([{ items }]), 'Hello world!');
});

test('removes lone page numbers at the top or bottom of a page but keeps numbers in body text', () => {
  const md = pdfPagesToMarkdown([
    page(['- 1 -', '본문 A', '2024년 매출은 15억 원입니다.', '1 / 2']),
    page(['본문 B', 'Page 2 of 2']),
  ]);
  assert.equal(md, '본문 A 2024년 매출은 15억 원입니다.\n\n본문 B');
});

test('rejoins English words hyphenated across lines', () => {
  assert.equal(pdfPagesToMarkdown([page(['An inter-', 'national standard'])]), 'An international standard');
});

test('escapes source text so it is not reinterpreted as Markdown, math or HTML', () => {
  // 각 줄이 문단 첫머리가 되도록 페이지를 나눈다.
  const md = pdfPagesToMarkdown([
    '# 해시로 시작',
    '2024. 11. 13. 기준',
    '가격은 $5 와 $10 이고 *별표* 와 <b>태그</b> 그리고 [링크](x) snake_case',
    '> 인용처럼 보이는 줄',
  ].map((line) => page([line])));
  assert.equal(md, [
    '\\# 해시로 시작',
    '2024\\. 11. 13. 기준',
    '가격은 \\$5 와 \\$10 이고 \\*별표\\* 와 \\<b\\>태그\\</b\\> 그리고 \\[링크\\](x) snake\\_case',
    '\\> 인용처럼 보이는 줄',
  ].join('\n\n'));
});

test('escape helpers only touch syntax characters', () => {
  assert.equal(escapeMarkdownInline('일반 문장 123.'), '일반 문장 123.');
  assert.equal(escapeMarkdownBlockStart('- 대시'), '\\- 대시');
  assert.equal(escapeMarkdownBlockStart('+ 더하기'), '\\+ 더하기');
  assert.equal(escapeMarkdownBlockStart('3) 항목'), '3\\) 항목');
  assert.equal(escapeMarkdownBlockStart('#해시태그'), '#해시태그');
});

test('scanned or empty pages produce an empty string', () => {
  assert.equal(pdfPagesToMarkdown([]), '');
  assert.equal(pdfPagesToMarkdown([{ items: [] }, { items: [{ str: '  ', x: 0, y: 0, width: 0, fontSize: 10, hasEOL: true }] }]), '');
});

test('pages are separated by a blank line', () => {
  assert.equal(pdfPagesToMarkdown([page(['1쪽 내용']), page(['2쪽 내용'])]), '1쪽 내용\n\n2쪽 내용');
});
