import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function harness(initialId = 101) {
  const source = readFileSync(new URL('../src/hooks/use-paginated-chunks.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const slots = [], writes = [], reads = [];
  let cursor = 0, fail = false, failure = null, effects = [], recordId = initialId;
  function effect(fn, deps) { const i=cursor++, old=slots[i]; if(!old || deps.some((v,j)=>v!==old.deps[j])) effects.push(()=>{old?.cleanup?.(); slots[i]={deps,cleanup:fn()};}); }
  const exports = {};
  vm.runInNewContext(js, { exports, console: { error() {} }, window: { addEventListener() {}, removeEventListener() {} },
    require(name) {
      if (name === 'react') return {
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => { slots[i] = v; }]; },
        useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
        useCallback(fn, deps) { const i=cursor++, old=slots[i]; if(!old || deps.some((v,j)=>v!==old.deps[j])) slots[i]={deps,fn}; return slots[i].fn; },
        useEffect: effect, useLayoutEffect: effect,
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
        async updateChunk(id, page, markdown, html, expectedChunkId) { assert.equal(expectedChunkId, page + 101); writes.push({ id, page, markdown, html, expectedChunkId }); if (fail) throw Error('quota'); if (expectedChunkId !== recordId + page) throw Error('stale chunk'); },
        async getChunk(id, page) { reads.push(page); return { id: recordId == null ? undefined : recordId + page, markdown: 'page ' + page, htmlContent: '<p>page ' + page + '</p>' }; },
      };
      if (name === '@/lib/markdown') return { htmlToMarkdown: value => value, markdownToHtml: value => value };
      throw Error(name);
    },
  });
  return {
    writes, reads, replacePageSet() { recordId = 201; },
    setFail(value) { fail = value; },
    render() { cursor = 0; effects=[]; const result=exports.usePaginatedChunks('doc', 2); effects.forEach(fn=>fn()); return result; },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('failed published page edit survives dirty-marker reset and failed navigation until successful retry', async () => {
  const h = harness(); h.render(); await tick(); let hook = h.render(); h.reads.length = 0;
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
  const h = harness(); h.render(); await tick(); let hook = h.render(); h.reads.length = 0; h.setFail(true);
  hook.handleChange('older', '<p>older</p>'); await tick();
  hook = h.render(); hook.handleChange('newer', '<p>newer</p>'); await tick();
  hook = h.render(); h.setFail(false);
  await hook.handlePageChange(1);
  assert.equal(h.writes.at(-1).markdown, 'newer');
  assert.equal(h.render().currentPage, 1);
});


test('same-index replacement cannot make a retained edit adopt a new chunk ID', async () => {
  const h = harness(); h.render(); await tick(); let hook = h.render(); h.reads.length = 0;
  h.replacePageSet();
  hook.handleChange('stale original edit', '<p>stale</p>'); await tick();
  hook = h.render(); await hook.handlePageChange(1);
  assert.equal(h.render().currentPage, 0);
  assert.deepEqual(h.reads, []);
  assert.equal(h.writes.length, 2);
  assert.ok(h.writes.every(write => write.expectedChunkId === 101));
});

test('missing loaded chunk ID keeps initial editing and navigation blocked', async () => {
  const h = harness(null); h.render(); await tick(); const hook = h.render();
  assert.equal(hook.isPageLoading, false);
  assert.ok(hook.loadError);
  assert.throws(() => hook.getCurrentChunkId(), /식별자/);
  await hook.handlePageChange(1);
  assert.equal(h.render().currentPage, 0);
  assert.deepEqual(h.writes, []);
});
