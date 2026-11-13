import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
function load(path, overrides = {}) {
  const compiled = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const context = { exports: {}, URL, require: name => name in overrides ? overrides[name] : require(name) };
  vm.runInNewContext(compiled, context, { filename: path });
  return context.exports;
}

// Execute the real metadata/route functions. Unrelated layout components and
// CSS are inert: these tests do not simulate Next's head rendering or a crawl.
const guideModule = load('../src/lib/guides.ts');
const guideImports = { '@/lib/guides': guideModule, 'next/link': 'a' };
const notFound = new Error('not found');
const detail = load('../src/app/guides/[slug]/page.tsx', {
  ...guideImports, 'next/navigation': { notFound() { throw notFound; } },
});
const index = load('../src/app/guides/page.tsx', guideImports);
const root = load('../src/app/layout.tsx', {
  'next/script': 'script',
  sonner: { Toaster: 'aside' },
  '@/components/ui/error-boundary': { ErrorBoundary: 'div' },
  '@/components/layout/theme-sync': { ThemeSync: 'span' },
  '@/lib/theme': load('../src/lib/theme.ts'),
  './globals.css': {}, '@/styles/editor.css': {}, '@/styles/pdf-viewer.css': {}, 'katex/dist/katex.min.css': {},
});
const sitemap = load('../src/app/sitemap.ts', guideImports).default();
const robots = load('../src/app/robots.ts').default();
const site = 'https://www.mdview.kr';
const params = slug => ({ params: Promise.resolve({ slug }) });
const pages = [
  { path: '/', metadata: root.metadata },
  { path: '/guides', metadata: index.metadata },
  ...await Promise.all(guideModule.guides.map(async guide => ({
    path: `/guides/${guide.slug}`, metadata: await detail.generateMetadata(params(guide.slug)),
  }))),
];
const absolute = value => new URL(value, site).href;
function* elements(node) {
  if (Array.isArray(node)) { for (const child of node) yield* elements(child); }
  else if (node && typeof node === 'object' && node.props) {
    yield node;
    yield* elements(node.props.children);
  }
}
function structuredData(tree) {
  return [...elements(tree)].filter(node => node.type === 'script' && node.props.type === 'application/ld+json')
    .map(node => JSON.parse(node.props.dangerouslySetInnerHTML.__html));
}
function asset(path) {
  assert.match(path, /^\/(?!\/)/, `asset must be site-relative: ${path}`);
  assert.equal(new URL(path, site).search, '');
  assert.equal(new URL(path, site).hash, '');
  return readFileSync(new URL(`../public${path}`, import.meta.url));
}
function pngSize(path) {
  const bytes = asset(path);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${path} must be PNG`);
  assert.equal(bytes.subarray(12, 16).toString(), 'IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('static guide routes, sitemap and canonical URLs cover the same public pages', () => {
  assert.equal(detail.dynamicParams, false);
  assert.deepEqual(Array.from(detail.generateStaticParams(), ({ slug }) => slug).sort(),
    Array.from(guideModule.guides, ({ slug }) => slug).sort());
  const expected = pages.map(page => absolute(page.path)).sort();
  const listed = Array.from(sitemap, entry => absolute(entry.url)).sort();
  assert.equal(new Set(listed).size, listed.length);
  assert.deepEqual(listed, expected);
  assert.deepEqual(pages.map(page => absolute(page.metadata.alternates.canonical)).sort(), expected);
  for (const page of pages) assert.equal(absolute(page.metadata.alternates.canonical), absolute(page.path));
});

test('each public page has distinct search text and matching canonical/Open Graph destinations', () => {
  for (const key of ['title', 'description']) {
    for (const page of pages) assert.ok(typeof page.metadata[key] === 'string' && page.metadata[key].trim(), `${page.path}: ${key}`);
    assert.equal(new Set(pages.map(page => page.metadata[key])).size, pages.length);
  }
  for (const { path, metadata } of pages) {
    assert.equal(absolute(metadata.openGraph.url), absolute(path));
    assert.equal(new URL(metadata.openGraph.url).origin, site);
    assert.equal(metadata.openGraph.locale, 'ko_KR');
    assert.ok(metadata.openGraph.title && metadata.openGraph.description);
    assert.ok(metadata.twitter.title && metadata.twitter.description);
    assert.equal(metadata.twitter.card, 'summary_large_image');
    assert.notEqual(metadata.robots?.index, false);
  }
});

test('social preview images exist and declared PNG dimensions match their bytes', () => {
  for (const { metadata } of pages) {
    assert.ok(metadata.openGraph.images.length > 0, 'Open Graph needs a preview image');
    assert.ok(metadata.twitter.images.length > 0, 'Twitter needs a preview image');
    for (const image of [...metadata.openGraph.images, ...metadata.twitter.images]) {
      const path = typeof image === 'string' ? image : image.url;
      const size = pngSize(path);
      if (typeof image === 'object') {
        if (image.width !== undefined) assert.equal(image.width, size.width);
        if (image.height !== undefined) assert.equal(image.height, size.height);
      }
    }
  }
  assert.ok(asset(root.metadata.icons.icon).length);
  assert.ok(asset(root.metadata.icons.apple).length);
});

test('robots allows public pages and advertises the same canonical sitemap', () => {
  assert.equal(robots.rules.userAgent, '*');
  assert.equal(robots.rules.allow, '/');
  assert.ok(!robots.rules.disallow || robots.rules.disallow.length === 0);
  assert.equal(robots.sitemap, `${site}/sitemap.xml`);
  assert.equal(root.metadata.metadataBase.href, absolute('/'));
});

test('guide breadcrumbs use contiguous positions and the page canonical URL', async () => {
  for (const guide of guideModule.guides) {
    const data = structuredData(await detail.default(params(guide.slug)));
    assert.equal(data.length, 1);
    assert.equal(data[0]['@type'], 'BreadcrumbList');
    assert.deepEqual(data[0].itemListElement.map(item => item.position), [1, 2, 3]);
    assert.deepEqual(data[0].itemListElement.map(item => absolute(item.item)),
      [absolute('/'), absolute('/guides'), absolute(`/guides/${guide.slug}`)]);
    assert.equal(data[0].itemListElement[2].name, guide.title);
  }
});

test('unknown guide URLs reject both content and metadata instead of reusing another guide', async () => {
  for (const slug of ['missing-guide', 'constructor', '']) {
    await assert.rejects(detail.generateMetadata(params(slug)), error => error === notFound);
    await assert.rejects(detail.default(params(slug)), error => error === notFound);
  }
});

test('root structured data identifies the same free web app without requiring a browser', () => {
  const data = structuredData(root.default({ children: null }));
  assert.equal(data.length, 1);
  assert.equal(data[0]['@type'], 'WebApplication');
  assert.equal(absolute(data[0].url), absolute('/'));
  assert.equal(data[0].name, root.metadata.applicationName);
  assert.equal(data[0].isAccessibleForFree, true);
  assert.equal(data[0].offers.price, '0');
});

test('linked web manifest uses existing square icons with accurate declared dimensions', () => {
  const tree = root.default({ children: null });
  const links = [...elements(tree)].filter(node => node.type === 'link' && node.props.rel === 'manifest');
  assert.equal(links.length, 1);
  const manifest = JSON.parse(asset(links[0].props.href));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.name, root.metadata.applicationName);
  assert.ok(manifest.icons.length > 0);
  for (const icon of manifest.icons) {
    const { width, height } = pngSize(icon.src);
    assert.equal(icon.type, 'image/png');
    assert.equal(width, height);
    assert.equal(icon.sizes, `${width}x${height}`, `${icon.src}: inaccurate manifest size`);
  }
});
