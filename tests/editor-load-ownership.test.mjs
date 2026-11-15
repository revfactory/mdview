import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function harness() {
  class Conflict extends Error {}
  const source = readFileSync(new URL('../src/hooks/use-editor.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const slots = [], effects = [], layouts = [], chunkWrites = [], active = [], writes = [];
  let cursor = 0;
  const effect = queue => (fn, deps) => {
    const i = cursor++, old = slots[i];
    if (!old || old.dep !== deps[0]) queue.push(() => { old?.cleanup?.(); slots[i] = { dep: deps[0], cleanup: fn() }; });
  };
  const actions = { setActiveDocument: id => active.push(id), setSaveStatus() {} };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback: fn => fn, useEffect: effect(effects), useLayoutEffect: effect(layouts),
  };
  const exports = {};
  vm.runInNewContext(js, { exports, console: { error() {} }, require(name) {
    if (name === 'react') return react;
    if (name === '@/stores/editor-store') return { useEditorStore: () => ({ actions }) };
    if (name === '@/lib/content-save-session') return { createContentSaveSession: () => ({ hasConflict: () => false }) };
    if (name === '@/db/content-cas') return { plainBaselineFromDocument: doc => doc };
    if (name === '@/hooks/use-autosave') return { useAutosave: id => async md => { writes.push({id,md}); } };
    if (name === '@/lib/document-save-queue') return { awaitDocumentSaves: async () => {} };
    if (name === '@/db/documents') return { getDocument: async id => ({ content: id === 'A' ? 'a'.repeat(300001) : 'B raw', htmlContent: '<p>B preview</p>' }), updateDocument: async () => {} };
    if (name === '@/db/chunks') return { AutoChunkConflictError: Conflict, autoChunkDocument: () => new Promise((resolve, reject) => chunkWrites.push({resolve,reject})) };
    if (name === '@/lib/markdown') return { markdownToHtml: raw => `<p>${raw}</p>` };
    if (name === '@/lib/chunk-document') return { chunkDocument: raw => [{index:0, markdown:raw}] };
    return {};
  }});
  return { conflict: () => new Conflict("changed"), chunkWrites, active, writes, render(id) { cursor = 0; const result = exports.useEditorManager(id); layouts.splice(0).forEach(fn => fn()); effects.splice(0).forEach(fn => fn()); return result; } };
}
const settle = async () => { for(let i=0;i<12;i++) await Promise.resolve(); };

test('cancelled auto-chunk failure cannot replace the newly loaded document state or save owner', async () => {
  const h = harness(); h.render('A'); await settle();
  assert.equal(h.chunkWrites.length, 1);
  h.render('B'); await settle();
  assert.equal(h.render('B').htmlContent, '<p>B preview</p>');
  h.chunkWrites[0].reject(Error('quota')); await settle();
  const editor = h.render('B');
  assert.equal(editor.htmlContent, '<p>B preview</p>');
  assert.equal(editor.isLargeDocument, false);
  assert.equal(editor.canSave, true);
  assert.equal(h.active.at(-1), 'B');
  editor.onSourceChange('B new');
  assert.equal(h.writes.at(-1)?.md, 'B new');
  await settle();
});

test('source fallback flag does not leak from a failed large load into a normal document', async () => {
  const h = harness(); h.render('A'); await settle();
  h.chunkWrites[0].reject(Error('quota')); await settle();
  assert.equal(h.render('A').isLargeDocument, true);
  h.render('B'); await settle();
  assert.equal(h.render('B').isLargeDocument, false);
});

test('clearing selection resets the fallback flag and cancels a pending large load', async () => {
  const h = harness(); h.render('A'); await settle();
  h.chunkWrites[0].reject(Error('quota')); await settle();
  assert.equal(h.render('A').isLargeDocument, true);
  h.render(null); await settle();
  assert.equal(h.render(null).isLargeDocument, false);
  h.render('A'); await settle();
  h.render(null); await settle();
  h.chunkWrites[1].reject(Error('late quota')); await settle();
  const editor = h.render(null);
  assert.equal(editor.content, '');
  assert.equal(editor.htmlContent, '');
  assert.equal(editor.isLargeDocument, false);
  assert.equal(h.active.at(-1), 'A'); // no stale selection publication after clearing
});

test('automatic pagination conflict is not an editable stale source fallback',async()=>{
 const h=harness();h.render('A');await settle();h.chunkWrites[0].reject(h.conflict());await settle();
 const editor=h.render('A');assert.equal(editor.canSave,false);assert.ok(editor.loadError);assert.equal(editor.isLargeDocument,false);
 editor.onSourceChange('must not overwrite peer');await settle();assert.deepEqual(h.writes,[]);
});
