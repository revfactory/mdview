import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function harness() {
  const source = readFileSync(new URL('../src/hooks/use-paginated-chunks.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const slots = [], writes = [], reads = [];
  let cursor = 0, fail = false, failure = null, deferredRead = null, barrier = null, effects = [];
  const exports = {};
  vm.runInNewContext(js, { exports, console: { error() {} }, window: { addEventListener() {}, removeEventListener() {} },
    require(name) {
      if (name === 'react') return {
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => { slots[i] = v; }]; },
        useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
        useCallback(fn, deps) { const i=cursor++, old=slots[i]; if(!old || deps.some((v,j)=>v!==old.deps[j])) slots[i]={deps,fn}; return slots[i].fn; }, useEffect(fn, deps) {
 const i=cursor++, old=slots[i];
 if(!old || deps.some((v,j)=>v!==old.deps[j])) effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});
},useLayoutEffect(fn, deps) {
 const i=cursor++, old=slots[i];
 if(!old || deps.some((v,j)=>v!==old.deps[j])) effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});
},
      };
      if (name === '@/lib/editor-dirty-snapshot') return { getDirtyEditorSnapshot: () => null };
      if (name === '@/lib/document-save-queue') return {
        async enqueueDocumentOperation(id, operation, options) {
          assert.equal(options.scope, 'page');
          try { await operation(); failure = null; } catch (error) { failure = error; throw error; }
        },
        async awaitDocumentSaves() { if (barrier) await barrier; if (failure) throw failure; },
      };
      if (name === '@/db/chunks') return {
        async updateChunk(id, page, markdown, html) { writes.push({ id, page, markdown, html }); if (fail) throw Error('quota'); },
        async getChunk(id, page) { reads.push(page); if (page === 1 && deferredRead) return deferredRead; return { markdown: 'page ' + page, htmlContent: '<p>page ' + page + '</p>' }; },
      };
      if (name === '@/lib/markdown') return { htmlToMarkdown: value => value, markdownToHtml: value => value };
      throw Error(name);
    },
  });
  return {
    writes, reads, delaySave(promise) { barrier=promise; }, unmount() { for(const slot of slots) slot?.cleanup?.(); }, delayPageOne(promise) { deferredRead=promise; },
    setFail(value) { fail = value; },
    render(id='doc') { cursor = 0; effects=[]; const result=exports.usePaginatedChunks(id, 2); for(const effect of effects) effect(); return result; },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));


test('a late page load from document A must not replace the selected document B', async () => {
 const h=harness(); let resolve;
 h.render('A'); await tick();
 const wait=new Promise(r=>resolve=r);h.delayPageOne(wait);
 const switching=h.render('A').handlePageChange(1); await tick();
 h.render('B'); await tick();
 resolve({markdown:'A page one private text',htmlContent:'<p>A page one private text</p>'});
 await switching;
 const selected=h.render('B');
 assert.notEqual(selected.chunkMarkdown,'A page one private text');
 assert.equal(selected.currentPage,0);
});

test('returning to the same document does not revive its previous page request', async () => {
 const h=harness(); let resolve;
 h.render('A'); await tick();
 h.delayPageOne(new Promise(r=>resolve=r));
 const switching=h.render('A').handlePageChange(1); await tick();
 h.render('B'); await tick(); h.render('A'); await tick();
 resolve({markdown:'obsolete A result',htmlContent:'<p>obsolete</p>'});
 await switching;
 assert.equal(h.render('A').currentPage,0);
 assert.notEqual(h.render('A').chunkMarkdown,'obsolete A result');
});

test('old completion does not unlock a new document page transition', async () => {
 const h=harness(); let resolveA,resolveB;
 h.render('A'); await tick();
 h.delayPageOne(new Promise(r=>resolveA=r));
 const a=h.render('A').handlePageChange(1); await tick();
 h.render('B'); await tick();
 h.delayPageOne(new Promise(r=>resolveB=r));
 const b=h.render('B').handlePageChange(1); await tick();
 resolveA({markdown:'A result',htmlContent:'<p>A</p>'}); await a;
 assert.equal(h.render('B').pageChanging,true);
 resolveB({markdown:'B result',htmlContent:'<p>B</p>'}); await b;
 const result=h.render('B');
 assert.equal(result.pageChanging,false);
 assert.equal(result.chunkMarkdown,'B result');
 assert.equal(result.currentPage,1);
});

test('switching while save barrier waits does not start an obsolete page load', async () => {
 const h=harness();let resolve;
 h.render('A');await tick();
 h.delaySave(new Promise(r=>resolve=r));
 const switching=h.render('A').handlePageChange(1);await tick();
 h.render('B');await tick();
 resolve();await switching;
 assert.equal(h.reads.includes(1),false);
 assert.equal(h.render('B').currentPage,0);
});
test('unmount invalidates an in-flight page load', async () => {
 const h=harness();let resolve;
 h.render('A');await tick();
 h.delayPageOne(new Promise(r=>resolve=r));
 const switching=h.render('A').handlePageChange(1);await tick();h.unmount();
 resolve({markdown:'unmounted result',htmlContent:'<p>unmounted</p>'});await switching;
 assert.notEqual(h.render('A').chunkMarkdown,'unmounted result');
});
