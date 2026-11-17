import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

// Execute the real React callbacks. A synthetic event is not an OS IME test.
function harness(path, extra = {}, globals = {}) {
  const slots = [], listeners = new Map();
  let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback: fn => fn,
    useEffect(fn) { fn(); },
    useLayoutEffect() {},
  };
  const eventTarget = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener() {}, body: { style: {} } };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-dom': { createPortal: node => node },
    'lucide-react': {},
    'date-fns': { formatDistanceToNow: () => '지금' },
    'date-fns/locale': {},
    ...extra,
  };
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports, console, document: eventTarget, window: eventTarget,
    setTimeout() {}, clearTimeout() {}, requestAnimationFrame() {}, cancelAnimationFrame() {},
    ...globals,
    require(name) { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; },
  });
  return {
    exports, listeners,
    render(name, props, unwrap = false) { cursor = 0; const node = exports[name](props); return unwrap ? node.type(node.props) : node; },
  };
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
}

function key(key, native = {}, modifiers = {}) {
  const event = { key, isComposing: false, keyCode: key === 'Enter' ? 13 : 0, ...native, ...modifiers, prevented: false, preventDefault() { this.prevented = true; } };
  event.nativeEvent = event;
  return event;
}
const compositionStates = [{ isComposing: true }, { isComposing: false, keyCode: 229 }];

for (const state of compositionStates) {
  const label = state.isComposing ? 'standard composing flag' : 'Safari 229 fallback';

  test(`document title keeps focus for IME confirmation (${label})`, () => {
    let focused = 0;
    const h = harness('components/features/editor/document-title.tsx', {
      '@/db/documents': { getDocument: async () => ({ title: '한글' }) },
      '@/stores/toast-store': {},
    }, { document: { querySelector: () => ({ focus() { focused++; } }) } });
    const input = h.render('DocumentTitle', { documentId: 'A' });
    const composing = key('Enter', state);
    input.props.onKeyDown(composing);
    assert.equal(focused, 0); assert.equal(composing.prevented, false);
    input.props.onKeyDown(key('Enter'));
    assert.equal(focused, 1);
  });

  test(`folder prompt does not submit a composing name (${label})`, () => {
    const confirmed = []; let closed = 0;
    const h = harness('components/ui/dialog.tsx');
    const props = { open: true, title: '새 폴더', defaultValue: '한', onConfirm: value => confirmed.push(value), onClose: () => closed++ };
    let tree = h.render('PromptDialog', props, true);
    let input = find(tree, n => n.type === 'input');
    const composing = key('Enter', state); input.props.onKeyDown(composing);
    assert.deepEqual(confirmed, []); assert.equal(closed, 0); assert.equal(composing.prevented, false);
    input.props.onChange({ target: { value: '한글 폴더' } });
    tree = h.render('PromptDialog', props, true); input = find(tree, n => n.type === 'input');
    input.props.onKeyDown(key('Enter'));
    assert.deepEqual(confirmed, ['한글 폴더']); assert.equal(closed, 1);
  });

  test(`quick open leaves candidate navigation and confirmation to the IME (${label})`, () => {
    const selected = []; let closed = 0;
    const documents = ['한글 A', '한글 B'].map((title, i) => ({ id: String(i), title, updatedAt: new Date() }));
    const h = harness('components/features/quick-open/quick-open.tsx', { '@/hooks/use-documents': { useDocuments: () => documents } });
    const props = { open: true, onSelectDocument: id => selected.push(id), onClose: () => closed++ };
    const render = () => find(h.render('QuickOpen', props, true), n => n.props?.role === 'dialog');
    // Inspect after each arrow so accidental down/up changes cannot cancel out.
    const selectedButton = () => find(render(), n => n.type === 'button' && /\sbg-\[var\(--color-accent-light\)\]/.test(n.props.className));
    const first = selectedButton();
    for (const name of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) {
      const event = key(name, state); render().props.onKeyDown(event); assert.equal(event.prevented, false);
      assert.deepEqual(selectedButton().props.children, first.props.children);
    }
    assert.deepEqual(selected, []); assert.equal(closed, 0);
    render().props.onKeyDown(key('Enter')); assert.deepEqual(selected, ['0']);
    render().props.onKeyDown(key('ArrowDown'));
    render().props.onKeyDown(key('ArrowUp', state));
    render().props.onKeyDown(key('Enter')); assert.deepEqual(selected, ['0', '1']);
    render().props.onKeyDown(key('Escape')); assert.equal(closed, 3);
    assert.equal(h.render('QuickOpen', { ...props, open: false }), null);
  });

  test(`link editor waits for composition to finish (${label})`, () => {
    const links = []; const chain = { focus() { return this; }, setLink(link) { links.push(link.href); return this; }, run() {} };
    const editor = { isActive: () => false, chain: () => chain };
    const h = harness('components/features/editor/bubble-menu.tsx', { '@tiptap/react/menus': { BubbleMenu: 'BubbleMenu' } });
    let tree = h.render('EditorBubbleMenu', { editor });
    find(tree, n => n.props?.title === '링크 (Cmd+K)').props.onClick();
    tree = h.render('EditorBubbleMenu', { editor });
    find(tree, n => n.type === 'input').props.onChange({ target: { value: 'https://example.com/한글' } });
    tree = h.render('EditorBubbleMenu', { editor });
    const input = find(tree, n => n.type === 'input');
    for (const name of ['Enter', 'Escape']) { const event = key(name, state); input.props.onKeyDown(event); assert.equal(event.prevented, false); }
    assert.deepEqual(links, []);
    assert.ok(find(h.render('EditorBubbleMenu', { editor }), n => n.type === 'input'));
    input.props.onKeyDown(key('Enter')); assert.deepEqual(links, ['https://example.com/한글']);
    assert.equal(find(h.render('EditorBubbleMenu', { editor }), n => n.type === 'input'), undefined);
  });

  test(`modal and prompt Escape listeners do not cancel composition (${label})`, () => {
    for (const path of ['components/ui/modal.tsx', 'components/ui/dialog.tsx']) {
      let closed = 0;
      const h = harness(path);
      if (path.endsWith('modal.tsx')) h.render('Modal', { open: true, onClose: () => closed++, children: null });
      else { const shell = h.render('ConfirmDialog', { open: true, title: '삭제', onClose: () => closed++, onConfirm() {} }); shell.type(shell.props); }
      h.listeners.get('keydown')(key('Escape', state)); assert.equal(closed, 0);
      h.listeners.get('keydown')(key('Escape')); assert.equal(closed, 1);
    }
  });

  test(`global shortcuts do not replace an active IME interaction (${label})`, () => {
    const actionsTaken = [];
    const actions = Object.fromEntries(['toggleSidebar', 'setViewMode', 'toggleFocusMode'].map(name => [name, () => actionsTaken.push(name)]));
    const useUIStore = Object.assign(() => ({ actions }), { getState: () => ({ focusMode: true, viewMode: 'wysiwyg' }) });
    const h = harness('hooks/use-keyboard-shortcuts.ts', { '@/stores/ui-store': { useUIStore } });
    h.exports.useKeyboardShortcuts({ onNewDocument: () => actionsTaken.push('new'), onQuickOpen: () => actionsTaken.push('quick'), onForceSave: () => actionsTaken.push('save'), onSearchFocus: () => actionsTaken.push('search') });
    const shortcuts = [['Escape', {}], ['n', { ctrlKey: true }], ['p', { metaKey: true }], ['\\', { ctrlKey: true }], ['E', { metaKey: true, shiftKey: true }], ['s', { ctrlKey: true }], ['k', { metaKey: true }], ['F', { ctrlKey: true, shiftKey: true }]];
    for (const [name, modifiers] of shortcuts) {
      const event = key(name, state, modifiers); h.listeners.get('keydown')(event); assert.equal(event.prevented, false);
    }
    assert.deepEqual(actionsTaken, []);
    for (const [name, modifiers] of shortcuts) h.listeners.get('keydown')(key(name, {}, modifiers));
    assert.deepEqual(actionsTaken, ['toggleFocusMode', 'new', 'quick', 'toggleSidebar', 'setViewMode', 'save', 'search', 'toggleFocusMode']);
  });
}
