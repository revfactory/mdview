import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function harness(mode) {
  let source = readFileSync(new URL('../src/lib/markdown.ts', import.meta.url), 'utf8');
  source = source.slice(source.indexOf('let mdWorker:')).replace('import.meta.url', "'https://example.test/markdown.js'");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}, workers = [], timers = new Set();
  class Worker {
    constructor() { if (mode === 'construct') throw Error('blocked'); workers.push(this); }
    postMessage(message) { this.message = message; if (mode === 'post') throw Error('clone failed'); }
    terminate() { this.terminated = true; }
  }
  vm.runInNewContext(js, { exports, Worker, URL, Error,
    markdownToHtml: md => `fallback:${md}`,
    htmlToMarkdown: html => html,
    setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn),
  });
  return { api: exports.markdownToHtmlAsync, workers, timers };
}

for (const mode of ['construct', 'post', 'error', 'messageerror', 'timeout', 'reported']) {
  test(`Markdown conversion settles with source intact after ${mode} failure`, async () => {
    const h = harness(mode);
    const source = '한글 $x^2$\n'.repeat(6000);
    const promise = h.api(source);
    const worker = h.workers[0];
    if (mode === 'error') worker.onerror({});
    if (mode === 'messageerror') worker.onmessageerror({});
    if (mode === 'timeout') [...h.timers][0]();
    if (mode === 'reported') worker.onmessage({ data: { id: worker.message.id, type: 'error', error: 'parse' } });
    assert.equal(await promise, `fallback:${source}`);
    assert.equal(h.timers.size, 0);
  });
}

test('Worker crash settles all queued conversions and a new worker can retry', async () => {
  const h = harness('normal');
  const one = h.api('one'), two = h.api('two');
  h.workers[0].onerror({});
  assert.deepEqual(await Promise.all([one, two]), ['fallback:one', 'fallback:two']);
  const three = h.api('three');
  const worker = h.workers[1];
  worker.onmessage({data: {id: worker.message.id, type: 'result', result: '<p>three</p>'}});
  assert.equal(await three, '<p>three</p>');
  assert.equal(h.timers.size, 0);
});

test('production build explicitly bundles workers and runs the artifact guard', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.match(pkg.scripts.build, /next build --webpack/);
  assert.match(pkg.scripts.build, /check-worker-build\.mjs/);
});
