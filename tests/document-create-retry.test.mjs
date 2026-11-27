import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the page callback with controllable storage completions.
const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'handleCreateDocument') {
    callback = node.initializer.arguments[0].getText(parsed);
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(callback);
const compiled = ts.transpileModule(`const run = ${callback};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;

function setup({ isMobile } = {}) {
  const calls = [];
  const requests = [];
  function create(kind) {
    const request = Promise.withResolvers();
    requests.push({ kind, ...request });
    return request.promise;
  }
  const run = vm.runInNewContext(`${compiled}\nrun`, {
    creatingDocument: { current: false },
    createDocument: () => create('blank'),
    createSampleDocument: () => create('sample'),
    actions: { setActiveDocument: id => calls.push(['active', id]) },
    analytics: { documentCreate: () => calls.push(['create']) },
    useUIStore: { getState: () => ({
      isMobile,
      actions: { setViewMode: mode => calls.push(['view', mode]), closeSidebar: () => calls.push(['sidebar']) },
    }) },
    useToastStore: { getState: () => ({ actions: { addToast: (...args) => calls.push(['toast', ...args]) } }) },
    console: { error: () => {} },
  });
  return { run, calls, requests };
}

test('a failed first creation stays in place, reports failure and can be retried', async () => {
  const { run, calls, requests } = setup({ isMobile: true });
  const first = run('sample', true);
  assert.deepEqual(calls, []);
  requests[0].reject(new Error('storage did not commit'));
  await first;
  assert.deepEqual(calls, [['toast', '샘플 문서를 저장하지 못했습니다. 다시 시도해 주세요.', 'error']]);
  const retry = run('sample', true);
  assert.deepEqual(requests.map(r => r.kind), ['sample', 'sample']);
  requests[1].resolve('sample-id');
  await retry;
  assert.deepEqual(calls.slice(1), [['view', 'wysiwyg'], ['active', 'sample-id'], ['create'], ['sidebar']]);
});

test('overlapping blank and sample requests create only one document until the first finishes', async () => {
  const { run, calls, requests } = setup();
  const first = run('blank');
  await run('sample', true);
  assert.deepEqual(requests.map(r => r.kind), ['blank']);
  assert.deepEqual(calls, []);
  requests[0].resolve('blank-id');
  await first;
  assert.deepEqual(calls, [['active', 'blank-id'], ['create']]);
  const next = run('blank');
  requests[1].reject(new Error('storage did not commit'));
  await next;
  assert.deepEqual(calls[2], ['toast', '새 문서를 저장하지 못했습니다. 다시 시도해 주세요.', 'error']);
});
