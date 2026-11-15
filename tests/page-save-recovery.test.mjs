import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const sessionExports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/content-save-session.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: sessionExports });


function harness(initialId = 101) {
  const source = readFileSync(new URL('../src/hooks/use-paginated-chunks.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const slots = [], writes = [], reads = [];
  const storage = new Map();
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
      if (name === '@/lib/content-save-session') return sessionExports;
      if (name === '@/db/content-cas') return {
        async savePageBaseline(expected, snapshot) {
          const {docId:id,index:page}=expected; const {markdown,html}=snapshot;
          writes.push({ id, page, markdown, html, expectedChunkId:expected.id });
          if (fail) throw Error('quota');
          const stored = storage.get(page) ?? {markdown:'page '+page,htmlContent:'<p>page '+page+'</p>'};
          if (expected.id !== recordId + page || expected.markdown !== stored.markdown || expected.htmlContent !== stored.htmlContent) throw new sessionExports.ContentConflictError();
          storage.set(page,{markdown,htmlContent:html});
          return {...expected,markdown,htmlContent:html};
        },
        async readPageBaseline(docId, index) {
          reads.push(index); const stored=storage.get(index) ?? {markdown:'page '+index,htmlContent:'<p>page '+index+'</p>'};
          return {docId,index,isChunked:true,chunkCount:2,id:recordId == null ? undefined : recordId+index,...stored};
        },
      };
      if (name === '@/lib/markdown') return { htmlToMarkdown: value => value, markdownToHtml: value => value };
      throw Error(name);
    },
  });
  return {
    writes, reads, peerEdit(markdown) { storage.set(0,{markdown,htmlContent:''}); }, storedPage() {return storage.get(0);}, replacePageSet() { recordId = 201; },
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
  assert.equal(h.writes.length, 1, 'sticky CAS conflict blocks later storage attempts');
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

test('clean initial-read failure permits leaving but does not authorize manual save',async()=>{
 const h=harness(null);h.render();await tick();const hook=h.render();
 await hook.prepareLeave();await assert.rejects(hook.flush());assert.deepEqual(h.writes,[]);
});
test('prepareLeave retains failed editable snapshot instead of escaping',async()=>{
 const h=harness();h.render();await tick();h.setFail(true);h.render().handleChange('unsaved raw','<p>unsaved raw</p>');await tick();
 await assert.rejects(h.render().prepareLeave());assert.equal(h.writes.at(-1).markdown,'unsaved raw');
});

test('source preview publication never persists and failed raw snapshot remains retryable',async()=>{
 const h=harness();h.render();await tick();let hook=h.render();hook.editorRef.current={};h.setFail(true);
 await assert.rejects(hook.handleSourceInput('exact raw **text**'));
 hook=h.render();hook.publishSourcePreview('<p>derived preview</p>');await tick();
 assert.equal(h.writes.length,1);assert.equal(h.render().chunkMarkdown,'exact raw **text**');
 await assert.rejects(h.render().prepareLeave());assert.equal(h.writes.length,2);
 assert.equal(h.writes[1].markdown,'exact raw **text**');assert.equal(h.writes[1].html,'');
 h.setFail(false);await h.render().handleSourceInput('exact raw **text**');
 const count=h.writes.length;await h.render().handlePageChange(1);
 assert.equal(h.writes.length,count,'successful source retry clears pending snapshot');
});

test('new source input supersedes a failed visual snapshot before preview completion',async()=>{
 const h=harness();h.render();await tick();h.render().editorRef.current={};h.setFail(true);
 h.render().handleChange('old visual','<p>old visual</p>');await tick();
 await assert.rejects(h.render().handleSourceInput('new raw'));
 h.setFail(false);await h.render().prepareLeave();
 assert.equal(h.writes.at(-1).markdown,'new raw');assert.equal(h.writes.at(-1).html,'');
});


test('peer content change with same ID remains intact through hook retries and new local input', async () => {
 const h=harness();h.render();await tick();h.render().editorRef.current={};h.peerEdit('peer newer raw');
 h.render().handleChange('local conflict','<p>local</p>');await tick();
 assert.equal(h.writes.length,1);assert.equal(h.storedPage().markdown,'peer newer raw');
 await assert.rejects(h.render().prepareLeave(),e=>e instanceof sessionExports.ContentConflictError);
 await assert.rejects(h.render().handleSourceInput('latest recovery raw'),e=>e instanceof sessionExports.ContentConflictError);
 assert.equal(h.writes.length,1);assert.equal(h.storedPage().markdown,'peer newer raw');
 assert.equal(h.render().chunkMarkdown,'latest recovery raw');
 assert.equal(h.render().currentPage,0);
});
