import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const sessionExports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/content-save-session.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: sessionExports });


function harness() {
  const source = readFileSync(new URL('../src/hooks/use-paginated-chunks.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const slots = [], writes = [], reads = [];
  let cursor = 0, fail = false, failure = null, deferredRead = null, initialRead = null, barrier = null, effects = [];
  const exports = {};
  vm.runInNewContext(js, { exports, console: { error() {} }, window: { addEventListener() {}, removeEventListener() {} },
    require(name) {
      if (name === 'react') return {
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
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
      if (name === '@/lib/content-save-session') return sessionExports;
      if (name === '@/db/content-cas') return {
        async savePageBaseline(expected, snapshot) {
          const {docId:id,index:page}=expected;const {markdown,html}=snapshot;
          assert.equal(expected.id,page+101);writes.push({id,page,markdown,html,expectedChunkId:expected.id});
          if(fail) throw Error('quota'); return {...expected,markdown,htmlContent:html};
        },
        async readPageBaseline(docId,index) {
          reads.push(index);
          const result = index===0 && initialRead ? await initialRead() : index===1 && deferredRead ? await deferredRead : {id:index+101,markdown:'page '+index,htmlContent:'<p>page '+index+'</p>'};
          return {...result,docId,index,isChunked:true,chunkCount:2};
        },
      };
      if (name === '@/lib/markdown') return { htmlToMarkdown: value => value, markdownToHtml: value => value };
      throw Error(name);
    },
  });
  return {
    writes, reads, setInitialRead(fn) { initialRead=fn; }, delaySave(promise) { barrier=promise; }, unmount() { for(const slot of slots) slot?.cleanup?.(); }, delayPageOne(promise) { deferredRead=promise; },
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
 resolve({id:102,markdown:'A page one private text',htmlContent:'<p>A page one private text</p>'});
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
 resolve({id:102,markdown:'obsolete A result',htmlContent:'<p>obsolete</p>'});
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
 resolveA({id:102,markdown:'A result',htmlContent:'<p>A</p>'}); await a;
 assert.equal(h.render('B').pageChanging,true);
 resolveB({id:102,markdown:'B result',htmlContent:'<p>B</p>'}); await b;
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
 resolve({id:102,markdown:'unmounted result',htmlContent:'<p>unmounted</p>'});await switching;
 assert.notEqual(h.render('A').chunkMarkdown,'unmounted result');
});


test('initial read failure terminates loading and retry recovers without writes', async () => {
 const h=harness(); h.setInitialRead(async()=>{throw Error('read unavailable');});
 h.render();await tick(); let hook=h.render();
 assert.equal(hook.isPageLoading,false);assert.ok(hook.loadError);
 assert.throws(()=>hook.handleChange('must not save','<p>must not save</p>'));
 await assert.rejects(hook.flush());await hook.handlePageChange(1);
 assert.deepEqual(h.writes,[]);assert.deepEqual(h.reads,[0]);
 h.setInitialRead(null);hook.retryLoad();h.render();await tick();hook=h.render();
 assert.equal(hook.isPageLoading,false);assert.equal(hook.loadError,null);
 assert.equal(hook.getCurrentChunkId(),101);assert.deepEqual(h.writes,[]);
});

test('late failed initial read cannot replace another document successful read', async()=>{
 const h=harness();let reject;
 h.setInitialRead(()=>new Promise((_,r)=>reject=r));h.render('A');
 h.setInitialRead(null);h.render('B');await tick();reject(Error('late A'));await tick();
 const hook=h.render('B');assert.equal(hook.loadError,null);assert.equal(hook.isPageLoading,false);
 assert.equal(hook.getCurrentChunkId(),101);assert.deepEqual(h.writes,[]);
});

test('late retry result does not publish into a newly selected document',async()=>{
 const h=harness();h.setInitialRead(async()=>{throw Error('read unavailable');});
 h.render('A');await tick();let resolve;
 h.setInitialRead(()=>new Promise(r=>resolve=r));h.render('A').retryLoad();h.render('A');
 h.setInitialRead(null);h.render('B');await tick();
 resolve({id:501,markdown:'A retry',htmlContent:'<p>A retry</p>'});await tick();
 const hook=h.render('B');assert.equal(hook.loadError,null);assert.equal(hook.getCurrentChunkId(),101);
 assert.notEqual(hook.chunkMarkdown,'A retry');assert.deepEqual(h.writes,[]);
});
