import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function harness(onWrite = () => {}) {
  const source = readFileSync(new URL('../src/hooks/use-editor.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const slots = [], writes = [], conversions = [], layouts = [];
  let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback: fn => fn,
    useEffect() {},
    useLayoutEffect(fn, deps) { const i = cursor++; const old = slots[i]; if (!old || old.dep !== deps[0]) { layouts.push(() => { old?.cleanup?.(); slots[i] = { dep: deps[0], cleanup: fn() }; }); } },
  };
  const exports = {};
  vm.runInNewContext(js, { exports, console, require(name) {
    if (name === 'react') return react;
    if (name === '@/stores/editor-store') return { useEditorStore: () => ({ actions: {} }) };
    if (name === '@/hooks/use-autosave') return { useAutosave: id => async (md, html) => { writes.push({id, md, html}); try { await onWrite(md, html); } catch { /* Autosave reports errors without rejecting its caller. */ } } };
    if (name === '@/lib/markdown') return {
      markdownToHtml: md => `<p>${md}</p>`,
      markdownToHtmlAsync: md => new Promise((resolve, reject) => conversions.push({md, resolve, reject})),
    };
    return {};
  } });
  return { writes, conversions, render(id) { cursor = 0; const result = exports.useEditorManager(id); layouts.splice(0).forEach(fn => fn()); return result; } };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test('source writes start before preview conversion and remain available during view changes', async () => {
  const h = harness(); let editor = h.render('A');
  const md = 'x'.repeat(50001);
  editor.onSourceChange(md);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].md, md);
  assert.equal(h.writes[0].html, '');
  editor = h.render('A'); // same manager survives switching views
  assert.equal(editor.content, md);
  assert.equal(editor.sourcePending, true);
  editor.onChange('stale visual editor', '<p>stale</p>');
  assert.equal(h.writes.length, 1);
  h.conversions[0].resolve('<p>ready</p>'); await settle();
  editor = h.render('A');
  assert.equal(editor.sourcePending, false);
  assert.equal(editor.htmlContent, '<p>ready</p>');
  assert.equal(h.writes.length, 1);
});

test('document switch and stale callbacks cannot move source or late preview into another document', async () => {
  const h = harness(); const old = h.render('A');
  old.onSourceChange('a'.repeat(50001));
  h.render('B');
  old.onChange('wrong', '<p>wrong</p>');
  old.onSourceChange('wrong');
  h.conversions[0].resolve('<p>old</p>'); await settle();
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].id, 'A');
});

test('newest source wins when previews complete out of order', async () => {
  const h = harness(); const editor = h.render('A');
  editor.onSourceChange('a'.repeat(50001));
  editor.onSourceChange('b'.repeat(50001));
  h.conversions[1].resolve('<p>new</p>'); await settle();
  h.conversions[0].resolve('<p>old</p>'); await settle();
  assert.equal(h.writes.length, 2);
  assert.equal(h.writes[1].md, 'b'.repeat(50001));
  assert.equal(h.render('A').htmlContent, '<p>new</p>');
});

test('loading and document-selection renders do not autosave stale state', () => {
  const h = harness(); h.render('A'); h.render('B'); h.render(null);
  assert.equal(h.writes.length, 0);
});

test('force save is unavailable before a selected document finishes loading', async () => {
  const h = harness(); const old = h.render('A');
  old.onSourceChange('raw');
  const selected = h.render('B');
  assert.equal(selected.canSave, false);
  await selected.saveCurrent();
  assert.equal(h.writes.length, 1);
  await settle();
});


test('late derived preview must not overwrite a newer stored raw edit',async()=>{
 let stored='initial';const h=harness(md=>{stored=md;});
 h.render('A').onSourceChange('local raw'.repeat(7000));
 assert.equal(h.writes.length,1);
 stored='newer external raw';
 h.conversions[0].resolve('<p>old local preview</p>');await settle();
 assert.equal(stored,'newer external raw');assert.equal(h.writes.length,1);
 assert.equal(h.render('A').htmlContent,'<p>old local preview</p>');
});


test('successful preview does not hide a failed raw save or retry it incidentally',async()=>{
 const queueSource=readFileSync(new URL('../src/lib/document-save-queue.ts',import.meta.url),'utf8').replace("import { updateContent } from '@/db/documents';",'const updateContent=async()=>{};');
 const exports={};vm.runInNewContext(ts.transpileModule(queueSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
 let fail=true;let writes=0;
 const queue=exports.createDocumentSaveQueue(async()=>{writes++;if(fail)throw Error('quota');});
 const h=harness((md,html)=>queue.enqueueDocumentSave('A',md,html));
 h.render('A').onSourceChange('x'.repeat(50001));await settle();
 await assert.rejects(queue.awaitDocumentSaves('A'),/quota/);fail=false;
 h.conversions[0].resolve('<p>preview succeeds</p>');await settle();
 assert.equal(h.render('A').sourcePending,false);assert.equal(writes,1);
 await assert.rejects(queue.awaitDocumentSaves('A'),/quota/);
});
