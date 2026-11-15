import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
async function loadModule(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const { guides, getGuide, guideActionHref } = await loadModule('../src/lib/guides.ts');
const { readEntryAction } = await loadModule('../src/lib/entry-actions.ts');
test('every guide has a distinct URL, title and description', () => {
  assert.equal(guides.length, 5);
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
