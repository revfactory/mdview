import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function harness() {
  const source = readFileSync(new URL('../src/components/features/editor/document-title.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const slots = [], reads = [], writes = [], statuses = [], toasts = [], timers = new Map();
  let cursor = 0, nextTimer = 0, effects = [], activeId = null, dirty = false;
  const effect = (fn, deps) => {
    const index = cursor++, previous = slots[index];
    if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) {
      effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
    }
  };
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { const next = typeof value === 'function' ? value(slots[index]) : value; dirty ||= !Object.is(slots[index], next); slots[index] = next; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback: fn => fn, useEffect: effect, useLayoutEffect: effect,
  };
  const exports = {};
  vm.runInNewContext(js, {
    exports, console: { error() {} },
    setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
      if (name === '@/db/documents') return {
        getDocument(id) { const request = { id, ...deferred() }; reads.push(request); return request.promise; },
        updateDocument(id, changes) { const request = { id, title: changes.title, ...deferred() }; writes.push(request); return request.promise; },
      };
      if (name === '@/stores/editor-store') return { useEditorStore: { getState: () => ({ activeDocumentId: activeId, actions: { setSaveStatus: status => statuses.push(status) } }) } };
      if (name === '@/stores/toast-store') return { useToastStore: { getState: () => ({ actions: { addToast: (...args) => toasts.push(args) } }) } };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return {
    reads, writes, statuses, toasts, timers,
    render(id) { activeId = id; let result; do { dirty = false; cursor = 0; effects = []; result = exports.DocumentTitle({ documentId: id }); effects.forEach(fn => fn()); } while (dirty); return result; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    flushTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
  };
}

test('title saving starts in the input event and survives immediate view or document teardown', async () => {
  const h = harness(); h.render('A');
  h.reads[0].resolve({ title: 'before' }); await settle();
  h.render('A').props.onChange({ target: { value: '새 제목 😀' } });
  h.unmount(); h.flushTimers();
  assert.equal(h.writes.length, 1, 'unmount must not discard a pending title');
  assert.equal(h.writes[0].id, 'A');
  assert.equal(h.writes[0].title, '새 제목 😀');
  h.writes[0].resolve(); await settle();
});

test('a new document never exposes the previous title or accepts edits before its title loads', async () => {
  const h = harness(); h.render('A');
  h.reads[0].resolve({ title: 'A title' }); await settle();
  const a = h.render('A'); assert.equal(a.props.value, 'A title');
  const b = h.render('B');
  assert.equal(b.props.value, '');
  assert.equal(b.props.disabled, true);
  b.props.onChange({ target: { value: 'before loading' } });
  assert.equal(h.writes.length, 0);
  h.reads[1].resolve({ title: 'B title' }); await settle();
  assert.equal(h.render('B').props.value, 'B title');
  assert.equal(h.render('B').props.disabled, false);
});

test('late document reads cannot replace the current document title', async () => {
  const h = harness(); h.render('A'); h.render('B');
  h.reads[1].resolve({ title: 'B title' }); await settle();
  h.reads[0].resolve({ title: 'A late' }); await settle();
  assert.equal(h.render('B').props.value, 'B title');
});

test('repeated title inputs save every final value including the empty-title default', async () => {
  const h = harness(); h.render('A'); h.reads[0].resolve({ title: 'old' }); await settle();
  for (const value of ['한', '한글', '']) h.render('A').props.onChange({ target: { value } });
  assert.deepEqual(h.writes.map(write => write.title), ['한', '한글', '제목 없음']);
  h.writes.forEach(write => write.resolve()); await settle();
  assert.deepEqual(h.statuses, [], 'title saves must not replace body save status');
});

test('save failure is observed and a later edit can recover without losing the visible title', async () => {
  const h = harness(); h.render('A'); h.reads[0].resolve({ title: 'old' }); await settle();
  h.render('A').props.onChange({ target: { value: 'unsaved' } });
  assert.equal(h.writes.length, 1);
  h.writes[0].reject(new Error('quota')); await settle();
  assert.equal(h.render('A').props.value, 'unsaved');
  assert.equal(h.toasts.length, 1);
  h.render('A').props.onChange({ target: { value: 'recovered' } });
  h.writes[1].resolve(); await settle();
  assert.deepEqual(h.statuses, [], 'title saves must not replace body save status');
});

test('title load failure is observed and cannot permit overwriting an unread title', async () => {
  const h = harness(); h.render('A'); h.reads[0].reject(new Error('read failed')); await settle();
  assert.equal(h.render('A').props.disabled, true);
  assert.equal(h.toasts.length, 1);
  assert.equal(h.writes.length, 0);
});

test('returning to A while B is loading does not reuse a ready but stale title', async () => {
  const h = harness(); h.render('A'); h.reads[0].resolve({ title: 'A old' }); await settle();
  const old = h.render('A');
  h.render('B');
  old.props.onChange({ target: { value: 'stale A callback' } });
  const returning = h.render('A');
  assert.equal(returning.props.disabled, true);
  assert.equal(returning.props.value, '');
  assert.equal(h.writes.length, 0);
  h.reads[1].resolve({ title: 'B late' });
  h.reads[2].resolve({ title: 'A current' }); await settle();
  assert.equal(h.render('A').props.value, 'A current');
});

test('a failed title write still reports after view teardown without changing body status', async () => {
  const h = harness(); h.render('A'); h.reads[0].resolve({ title: 'old' }); await settle();
  h.render('A').props.onChange({ target: { value: 'new' } }); h.unmount();
  h.writes[0].reject(new Error('quota')); await settle();
  assert.equal(h.toasts.length, 1);
  assert.deepEqual(h.statuses, []);
});
