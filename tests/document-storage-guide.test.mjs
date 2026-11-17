import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
function loadSource(source, overrides = {}) {
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  // No window, IndexedDB, localStorage, navigation or network APIs are supplied.
  const context = { exports: {}, require: name => name in overrides ? overrides[name] : require(name) };
  vm.runInNewContext(js, context);
  return context.exports;
}
const guideModule = loadSource(read('../src/lib/guides.ts'));
const { default: GuidePage } = loadSource(read('../src/app/guides/[slug]/page.tsx'), {
  '@/lib/guides': guideModule,
  'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  'next/navigation': { notFound() { throw new Error('not found'); } },
});
const renderGuide = async slug => renderToStaticMarkup(await GuidePage({ params: Promise.resolve({ slug }) }));
const anchorTags = html => html.match(/<a\b[^>]*>[^<]*<\/a>/g) ?? [];

test('editor guide exposes a stable storage-help anchor and matching table of contents', async () => {
  const html = await renderGuide('markdown-editor');
  assert.match(html, /<section id="document-storage" class="guide-section">/);
  assert.match(html, /href="#document-storage">저장한 문서가 보이지 않나요\?/);
  assert.equal((html.match(/id="document-storage"/g) ?? []).length, 1);
  for (let i = 0; i < 3; i++) {
    assert.match(html, new RegExp(`id="section-${i}"`));
    assert.match(html, new RegExp(`href="#section-${i}"`));
  }
});

test('both storage origins open only their bare editor URL in protected new tabs', async () => {
  const html = await renderGuide('markdown-editor');
  const links = anchorTags(html).filter(link => /href="https:\/\/(?:www\.)?mdview\.kr\//.test(link));
  assert.equal(links.length, 2);
  for (const origin of ['https://mdview.kr/', 'https://www.mdview.kr/']) {
    const link = links.find(value => value.includes(`href="${origin}"`));
    assert.ok(link, `missing ${origin}`);
    assert.match(link, /target="_blank"/);
    assert.match(link, /rel="noopener noreferrer"/);
    assert.match(link, /\(새 탭\)/);
    assert.doesNotMatch(link, /onClick|download=/i);
  }
});

test('storage guidance distinguishes separate profiles and origins from missing or deleted data', () => {
  const section = guideModule.getGuide('markdown-editor').sections.find(value => value.id === 'document-storage');
  assert.ok(section);
  const text = [...section.paragraphs, ...section.bullets].join('\n');
  for (const expected of ['기기·브라우저 프로필·사이트 주소별', '자동으로 동기화되지 않습니다', '삭제되었다는 뜻은 아닙니다', '사이트 데이터를 지우거나', '시크릿 창', '마크다운 (.md)', '원래 문서도 그대로 보관', '복원되지 않습니다']) {
    assert.ok(text.includes(expected), `missing safeguard: ${expected}`);
  }
});

test('other guides retain their anchors and same-origin editor actions without recovery links', async () => {
  for (const guide of guideModule.guides.filter(value => value.slug !== 'markdown-editor')) {
    const html = await renderGuide(guide.slug);
    assert.doesNotMatch(html, /id="document-storage"|href="https:\/\/(?:www\.)?mdview\.kr\//);
    for (const [index] of guide.sections.entries()) assert.ok(html.includes(`id="section-${index}"`));
    assert.ok(html.includes(`href="/?action=${guide.action}&amp;source=${guide.slug}"`));
  }
});

test('every table-of-contents link targets a unique section', async () => {
  for (const guide of guideModule.guides) {
    const html = await renderGuide(guide.slug);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), `missing ${guide.slug}#${id}`);
  }
});

test('app information links to same-origin storage help without replacing the editor tab', () => {
  const source = read('../src/components/layout/sidebar.tsx');
  const ast = ts.createSourceFile('sidebar.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let link;
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'a'
      && node.openingElement.attributes.properties.some(prop => ts.isJsxAttribute(prop)
        && prop.name.getText(ast) === 'href' && prop.initializer?.text === '/guides/markdown-editor#document-storage')) link = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(link, 'information panel must link to the storage guidance');
  const { HelpLink } = loadSource(`export function HelpLink() { return (${link.getText(ast)}); }`);
  const html = renderToStaticMarkup(React.createElement(HelpLink));
  assert.match(html, /href="\/guides\/markdown-editor#document-storage"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /\(새 탭\)/);
});

test('both READMEs explain separate storage and link to the same recovery section', () => {
  for (const file of ['../README.md', '../README.en.md']) {
    const text = read(file);
    assert.ok(text.includes('https://mdview.kr/guides/markdown-editor#document-storage'));
    assert.ok(text.includes('[mdview.kr](https://mdview.kr/)'));
    assert.ok(text.includes('[www.mdview.kr](https://www.mdview.kr/)'));
  }
});
