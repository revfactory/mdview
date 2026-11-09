import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/hooks/use-pdf.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText.replaceAll('import.meta.url', JSON.stringify(import.meta.url));
function setup({ constructorError, postError, timer } = {}) {
  const values = [], workers = [];
  let unmount;
  class Worker {
    constructor() { if (constructorError) throw constructorError; workers.push(this); this.messages = []; }
    terminate() { this.terminated = true; }
    postMessage(message) { if (postError) throw postError; this.messages.push(message); }
  }
  const react = {
    useState(initial) { const index = values.length; values.push(initial); return [initial, value => { values[index] = value; }]; },
    useCallback: callback => callback,
    useRef: current => ({ current }),
    useEffect: callback => { unmount = callback(); },
  };
  const exports = {};
  vm.runInNewContext(js, { exports, require: name => name === 'react' ? react : { PDF_MAX_FILE_BYTES: 25 * 1024 * 1024 }, Worker, URL, Error, console, setTimeout: timer ?? setTimeout, clearTimeout });
  const hook = exports.usePdfImport();
  return { hook, values, workers, unmount: () => unmount() };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const file = { arrayBuffer: async () => new ArrayBuffer(2) };

test('read rejection settles import and clears busy state', async () => {
  const { hook, values, workers } = setup();
  await assert.rejects(hook.importFile({ arrayBuffer: async () => { throw new Error('파일 읽기 실패'); } }), /파일 읽기 실패/);
  assert.equal(values[2], false); assert.equal(values[3], '파일 읽기 실패'); assert.equal(workers[0].terminated, true);
});

test('worker construction and postMessage failures settle import', async () => {
  for (const config of [{ constructorError: new Error('worker unavailable') }, { postError: new Error('message failed') }]) {
    const { hook, values } = setup(config);
    await assert.rejects(hook.importFile(file)); assert.equal(values[2], false); assert.ok(values[3]);
  }
});

test('reset cancels pending read and ignores late data', async () => {
  const { hook, values, workers } = setup();
  let resolveRead;
  const result = hook.importFile({ arrayBuffer: () => new Promise(resolve => { resolveRead = resolve; }) });
  const rejection = assert.rejects(result, /취소/);
  hook.reset(); await rejection;
  resolveRead(new ArrayBuffer(2)); await flush();
  assert.equal(workers[0].messages.length, 0); assert.equal(workers[0].terminated, true);
  assert.equal(values[2], false); assert.equal(values[3], null);
});

test('replacement import rejects old promise and ignores its late worker messages', async () => {
  const { hook, values, workers } = setup();
  const first = hook.importFile(file); const rejection = assert.rejects(first, /취소/);
  const second = hook.importFile(file); await rejection; await flush();
  workers[0].onmessage({ data: { type: 'complete', result: { markdown: '오래된 내용' } } });
  assert.equal(values[2], true);
  workers[1].onmessage({ data: { type: 'complete', result: { markdown: '최신 내용' } } });
  assert.equal((await second).markdown, '최신 내용'); assert.equal(values[2], false);
  assert.ok(workers.every(worker => worker.terminated));
});

test('unmount cancels pending promise without late UI updates', async () => {
  const { hook, values, workers, unmount } = setup();
  const result = hook.importFile(file); const rejection = assert.rejects(result, /취소/);
  const previous = [...values]; unmount(); await rejection; await flush();
  workers[0].onerror({ message: 'late failure' });
  assert.deepEqual(values, previous); assert.equal(workers[0].terminated, true);
});

test('oversized PDF is rejected before file reading or worker creation', async () => {
  const { hook, values, workers } = setup();
  await assert.rejects(hook.importFile({ size: 26 * 1024 * 1024, arrayBuffer() { throw new Error('must not read'); } }), /25MB/);
  assert.equal(values[2], false); assert.equal(workers.length, 0);
});

test('timeout settles import, terminates worker and allows retry', async () => {
  let expire;
  const { hook, values, workers } = setup({ timer: callback => { expire = callback; return undefined; } });
  const pending = hook.importFile(file); const rejection = assert.rejects(pending, /시간이 초과/);
  expire(); await rejection; assert.equal(values[2], false); assert.equal(workers[0].terminated, true);
  const retry = hook.importFile(file); await flush();
  workers[1].onmessage({ data: { type: 'complete', result: { markdown: '재시도' } } });
  assert.equal((await retry).markdown, '재시도'); assert.equal(values[3], null);
});
