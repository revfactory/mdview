import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('an open document has a separate sidebar action for pasting as a new document', () => {
  const sidebar = read('components/layout/sidebar.tsx');
  const home = read('app/page.tsx');
  // Unlike choosing a file or editing the selected document, this uses the
  // same explicit new-document action as the existing guide entry.
  assert.match(sidebar, /activeDocumentId && onPasteMarkdown && \([\s\S]*?onClick=\{onPasteMarkdown\}[\s\S]*?붙여넣어 새 마크다운 문서 만들기/);
  assert.match(home, /onPasteMarkdown=\{\(\) => handleStart\('paste-markdown', 'direct'\)\}/);
});

test('the native paste dialog opts out of application-wide document shortcuts', () => {
  const form = read('components/growth/paste-markdown-form.tsx');
  const shortcuts = read('hooks/use-keyboard-shortcuts.ts');
  assert.match(form, /<dialog ref=\{dialogRef\} data-file-modal aria-labelledby=\{titleId\}/);
  assert.match(shortcuts, /closest\?\.\('\[data-file-modal\]'\)\) return;/);
});
