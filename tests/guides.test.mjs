import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
async function loadModule(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const { guides, getGuide, guideActionHref, guidePasteHref } = await loadModule('../src/lib/guides.ts');
const { readEntryAction } = await loadModule('../src/lib/entry-actions.ts');
test('every guide has a distinct URL, title and description', () => {
  assert.equal(guides.length, 6);
  for (const field of ['slug', 'title', 'description']) assert.equal(new Set(guides.map((guide) => guide[field])).size, guides.length);
  for (const guide of guides) assert.match(guide.slug, /^[a-z]+(?:-[a-z]+)*$/);
});
test('guide links stay on the current origin and resolve to real actions', () => {
  for (const guide of guides) {
    const href = guideActionHref(guide); assert.match(href, /^\/\?/);
    const url = new URL(href, 'https://mdview.kr'); assert.equal(url.origin, 'https://mdview.kr');
    assert.deepEqual(readEntryAction(url.searchParams), { action: guide.action, source: guide.slug });
  }
});
test('related links resolve and every guide has substantive task steps', () => {
  for (const guide of guides) {
    assert.equal(getGuide(guide.slug), guide); assert.ok(guide.steps.length >= 4); assert.ok(guide.sections.length >= 3); assert.ok(guide.questions.length >= 2);
    for (const slug of guide.related) { assert.ok(getGuide(slug)); assert.notEqual(slug, guide.slug); }
  }
  assert.equal(getGuide('missing'), undefined);
});

for (const file of ['README.md', 'README.en.md']) {
  const readme = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const links = [...readme.matchAll(/\[[^\]]+\]\((https:\/\/(?:www\.)?mdview\.kr\/guides\/[^)\s]+)\)/g)]
    .map(([, href]) => new URL(href));

  test(`${file} directly links to every published guide`, () => {
    for (const { slug } of guides) {
      assert.ok(links.some(url => url.pathname === `/guides/${slug}` && !url.hash), `missing guide: ${slug}`);
    }
  });

  test(`${file} guide links resolve to current pages and sections`, () => {
    for (const url of links) {
      assert.equal(url.search, '', 'guide links must not carry tracking or document data');
      const guide = getGuide(url.pathname.slice('/guides/'.length));
      assert.ok(guide, `unknown guide: ${url.pathname}`);
      if (url.hash) {
        const ids = ['steps', 'questions', ...guide.sections.map((section, index) => section.id ?? `section-${index}`)];
        assert.ok(ids.includes(url.hash.slice(1)), `unknown section: ${url.href}`);
      }
    }
  });
}

test('PDF guide opens the PDF importer with an allowlisted source', () => {
 const guide=getGuide('pdf-to-markdown'); assert.equal(guide.action,'import-pdf');
 assert.equal(guideActionHref(guide),'/?action=import-pdf&source=pdf-to-markdown');
 assert.match(JSON.stringify(guide), /OCR/); assert.match(JSON.stringify(guide), /100MB/);
});

test('the canonical HWP guide exposes HWPX support and opens the same browser importer', () => {
  const guide = getGuide('hwp-to-markdown');
  assert.match(guide.title, /HWP·HWPX/);
  assert.match(guide.description, /\.hwpx/);
  assert.match(guide.actionLabel, /HWP·HWPX/);
  assert.equal(guideActionHref(guide), '/?action=import-hwp&source=hwp-to-markdown');
});

test('the HWPX and editor guides allow paste without replacing their original actions', () => {
  for (const [slug, original] of [['markdown-to-hwpx', 'import-markdown'], ['markdown-editor', 'new']]) {
    const guide = getGuide(slug);
    assert.equal(guide.action, original);
    const href = guidePasteHref(guide);
    assert.match(href, /^\/\?/);
    assert.deepEqual(readEntryAction(new URL(href, 'https://www.mdview.kr').searchParams), { action: 'paste-markdown', source: slug });
  }
  assert.equal(guidePasteHref(getGuide('hwp-to-markdown')), undefined);
  assert.match(getGuide('markdown-to-hwpx').description, /ChatGPT/);
  assert.ok(getGuide('markdown-to-hwpx').sections.some(section => section.id === 'chatgpt-to-hwpx' && section.code.includes('| 할 일 |')));
});
