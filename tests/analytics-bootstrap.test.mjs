import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/analytics-bootstrap.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(code, { exports });
const script = exports.ANALYTICS_BOOTSTRAP_SCRIPT;
function run(hostname, protocol = 'https:') {
  const appended = [];
  const window = { location: { hostname, protocol } };
  vm.runInNewContext(script, { window, document: {
    createElement: () => ({}), head: { appendChild: node => appended.push(node) },
  } });
  return { window, appended };
}
for (const host of ['localhost', '127.0.0.1', 'mdview.vercel.app', 'mdview-preview-revfactory.vercel.app', 'mdview.kr.example.com', 'example.com', '']) {
  test(`no GA initialization or network script on ${host || 'empty hostname'}`, () => {
    const { window, appended } = run(host);
    assert.equal(appended.length, 0);
    assert.equal(window.gtag, undefined);
    assert.equal(window.dataLayer, undefined);
  });
}
for (const host of ['mdview.kr', 'www.mdview.kr']) {
  test(`preserves config, queued events and script loading on ${host}`, () => {
    const { window, appended } = run(host);
    assert.equal(appended.length, 1);
    assert.equal(appended[0].async, true);
    assert.equal(appended[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-DC9P5XSZXR');
    assert.deepEqual(Array.from(window.dataLayer[1]), ['config', 'G-DC9P5XSZXR']);
    window.gtag('event', 'create', { event_category: 'document' });
    assert.equal(window.dataLayer[2][1], 'create');
  });
  test(`does not initialize on insecure ${host}`, () => assert.equal(run(host, 'http:').appended.length, 0));
}
test('optional bootstrap failure never interrupts the page', () => {
  assert.doesNotThrow(() => vm.runInNewContext(script, { window: {} }));
  assert.doesNotThrow(() => vm.runInNewContext(script, { window: { location: { hostname: 'mdview.kr', protocol: 'https:' } }, document: { createElement() { throw new Error('blocked'); } } }));
});
test('layout has no unconditional external GA script', () => {
  const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
  assert.ok(layout.includes('{ANALYTICS_BOOTSTRAP_SCRIPT}'));
  assert.ok(!layout.includes('googletagmanager.com'));
});
