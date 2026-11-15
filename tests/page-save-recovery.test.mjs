import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function harness() {
  const source = readFileSync(new URL('../src/hooks/use-paginated-chunks.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const slots = [], writes = [], reads = [];
  let cursor = 0, fail = false, failure = null;
  const exports = {};
  vm.runInNewContext(js, { exports, console: { error() {} }, window: { addEventListener() {}, removeEventListener() {} },
    require(name) {
      if (name === 'react') return {
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => { slots[i] = v; }]; },
        useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
        useCallback: fn => fn, useEffect() {}, useLayoutEffect() {},
      };
      if (name === '@/lib/editor-dirty-snapshot') return { getDirtyEditorSnapshot: () => null };
      if (name === '@/lib/document-save-queue') return {
        async enqueueDocumentOperation(id, operation, options) {
          assert.equal(options.scope, 'page');
          try { await operation(); failure = null; } catch (error) { failure = error; throw error; }
        },
        async awaitDocumentSaves() { if (failure) throw failure; },
      };
      if (name === '@/db/chunks') return {
        async updateChunk(id, page, markdown, html) { writes.push({ id, page, markdown, html }); if (fail) throw Error('quota'); },
        async getChunk(id, page) { reads.push(page); return { markdown: 'page ' + page, htmlContent: '<p>page ' + page + '</p>' }; },
      };
      if (name === '@/lib/markdown') return { htmlToMarkdown: value => value, markdownToHtml: value => value };
      throw Error(name);
    },
  });
  return {
    writes, reads,
    setFail(value) { fail = value; },
    render() { cursor = 0; return exports.usePaginatedChunks('doc', 2); },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('failed published page edit survives dirty-marker reset and failed navigation until successful retry', async () => {
  const h = harness(); let hook = h.render();
  h.setFail(true);
  hook.handleChange('latest raw **Markdown**', '<p>latest preview</p>');
  await tick(); hook = h.render();
  await hook.handlePageChange(1); hook = h.render();
  assert.equal(hook.currentPage, 0);
  assert.deepEqual(h.reads, []);
  assert.equal(h.writes.length, 2, 'navigation retries retained snapshot even with clean editor marker');
  assert.equal(h.writes[1].markdown, 'latest raw **Markdown**');
  h.setFail(false);
  await hook.handlePageChange(1); hook = h.render();
  assert.equal(hook.currentPage, 1);
  assert.deepEqual(h.reads, [1]);
  assert.equal(h.writes[2].markdown, 'latest raw **Markdown**');
});

test('newer page edit replaces retained failed snapshot without retrying older contents', async () => {
  const h = harness(); let hook = h.render(); h.setFail(true);
  hook.handleChange('older', '<p>older</p>'); await tick();
  hook = h.render(); hook.handleChange('newer', '<p>newer</p>'); await tick();
  hook = h.render(); h.setFail(false);
  await hook.handlePageChange(1);
  assert.equal(h.writes.at(-1).markdown, 'newer');
  assert.equal(h.render().currentPage, 1);
});
