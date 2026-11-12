import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/entry-actions.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { readEntryAction, ENTRY_ACTIONS, ENTRY_SOURCES } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('accepts only product actions and known acquisition sources', () => {
  for (const action of ENTRY_ACTIONS) for (const source of ENTRY_SOURCES) assert.deepEqual(readEntryAction(new URLSearchParams({ action, source })), { action, source });
});
test('does not act on arbitrary URLs or query content', () => {
  for (const action of ['', 'delete', 'EXPORT', 'javascript:alert(1)']) assert.equal(readEntryAction(new URLSearchParams({ action, source: 'home' })), null);
  assert.equal(readEntryAction(new URLSearchParams('utm_source=newsletter')), null);
});
test('never forwards arbitrary source strings to analytics', () => {
  for (const source of ['', 'private-document-title', 'https://example.com/private', '<script>']) assert.deepEqual(readEntryAction(new URLSearchParams({ action: 'new', source })), { action: 'new', source: 'direct' });
});
