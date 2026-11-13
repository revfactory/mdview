import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const script = await readFile(new URL('../scripts/copy-pdfjs-assets.mjs', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const assets = {
  'legacy/build/pdf.worker.min.mjs': '/* legacy worker */',
  'build/pdf.worker.min.mjs': '/* modern worker must not be selected */',
  'cmaps/Adobe-Korea1-UCS2.bcmap': Buffer.from([0, 128, 255, 42]),
  'cmaps/LICENSE': 'CMap license fixture',
  'standard_fonts/FoxitSerif.pfb': Buffer.from([128, 1, 0, 255]),
  'standard_fonts/LICENSE_FOXIT': 'Font license fixture',
  'iccs/CGATS001Compat-v2-micro.icc': Buffer.from([0, 255, 1]),
  'iccs/LICENSE': 'ICC license fixture',
  'wasm/openjpeg.wasm': Buffer.from([0, 97, 115, 109]),
  'wasm/openjpeg.js': '/* decoder helper */',
  'wasm/LICENSE_OPENJPEG': 'Decoder license fixture',
  'wasm/quickjs-eval.js': '/* excluded script runtime */',
  'wasm/quickjs-eval.wasm': Buffer.from([0, 97, 115, 109]),
  'wasm/nested/quickjs-eval.js': '/* excluded nested script runtime */',
  'wasm/quickjs-extra/child.wasm': '/* excluded directory */',
  LICENSE: 'PDF.js license fixture',
};

async function put(root, file, contents) {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mdview-pdfjs-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pkg = path.join(root, 'node_modules/pdfjs-dist');
  await put(root, 'scripts/copy-pdfjs-assets.mjs', script);
  await put(pkg, 'package.json', JSON.stringify({ name: 'pdfjs-dist', version: '6.5.438' }));
  for (const [file, contents] of Object.entries(assets)) await put(pkg, file, contents);
  const dest = path.join(root, 'public/pdfjs');
  const run = () => spawnSync(process.execPath, ['scripts/copy-pdfjs-assets.mjs'], {
    cwd: root, encoding: 'utf8', timeout: 10_000,
  });
  return { root, pkg, dest, run };
}

function success(result) {
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
}

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    const nested = entry.isDirectory() ? await files(path.join(dir, entry.name)) : [''];
    return nested.map(file => path.posix.join(entry.name, file));
  }))).flat();
}

test('PDF asset copy preserves the legacy worker, binary assets, licenses and installed version', async t => {
  const f = await fixture(t);
  success(f.run());
  const expected = {
    'pdf.worker.min.mjs': assets['legacy/build/pdf.worker.min.mjs'],
    ...Object.fromEntries(Object.entries(assets).filter(([file]) =>
      !file.startsWith('build/') && !file.startsWith('legacy/') &&
      !file.split('/').some(part => part.startsWith('quickjs')))),
    VERSION: '6.5.438\n',
  };
  assert.deepEqual((await files(f.dest)).sort(), Object.keys(expected).sort());
  for (const [file, content] of Object.entries(expected)) {
    assert.deepEqual(await readFile(path.join(f.dest, file)), Buffer.from(content), file);
  }
});

test('PDF asset rebuild removes stale files and refreshes the version without touching other public files', async t => {
  const f = await fixture(t);
  success(f.run());
  await put(f.dest, 'obsolete.wasm', 'stale');
  await put(f.dest, 'wasm/quickjs-eval.js', 'stale scripting runtime');
  await put(f.root, 'public/unrelated.txt', 'keep');
  await rm(path.join(f.pkg, 'wasm/openjpeg.js'));
  await put(f.pkg, 'package.json', JSON.stringify({ name: 'pdfjs-dist', version: '6.5.439' }));
  await put(f.pkg, 'legacy/build/pdf.worker.min.mjs', '/* refreshed legacy worker */');
  success(f.run());
  assert.equal(await readFile(path.join(f.dest, 'VERSION'), 'utf8'), '6.5.439\n');
  assert.equal(await readFile(path.join(f.dest, 'pdf.worker.min.mjs'), 'utf8'), '/* refreshed legacy worker */');
  assert.equal(await readFile(path.join(f.root, 'public/unrelated.txt'), 'utf8'), 'keep');
  for (const file of ['obsolete.wasm', 'wasm/quickjs-eval.js', 'wasm/openjpeg.js']) {
    await assert.rejects(readFile(path.join(f.dest, file)), { code: 'ENOENT' });
  }
});

for (const missing of ['legacy/build/pdf.worker.min.mjs', 'cmaps', 'standard_fonts', 'iccs', 'wasm', 'LICENSE']) {
  test(`PDF asset copy fails rather than reporting success when ${missing} is missing`, async t => {
    const f = await fixture(t);
    await rm(path.join(f.pkg, missing), { recursive: true, force: true });
    const result = f.run();
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ENOENT/);
    assert.doesNotMatch(result.stdout, /assets copied/);
    await assert.rejects(readFile(path.join(f.dest, 'VERSION')), { code: 'ENOENT' });
  });
}

test('development and production builds prepare PDF assets before starting Next.js', () => {
  assert.equal(manifest.scripts.predev, 'node scripts/copy-pdfjs-assets.mjs');
  assert.equal(manifest.scripts.prebuild, 'node scripts/copy-pdfjs-assets.mjs');
});
