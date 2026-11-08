import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/components/ui/modal.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const context = { exports: {}, require };
vm.runInNewContext(js, context);
const { Modal } = context.exports;

test('long dialogs constrain their panel and scroll the body without hiding the close button', () => {
  const html = renderToStaticMarkup(React.createElement(Modal, { open: true, title: '가져오기', onClose() {} },
    React.createElement('div', null, ...Array.from({ length: 100 }, (_, i) => React.createElement('p', { key: i }, `행 ${i}`)))));
  assert.match(html, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(html, /min-h-0 overflow-y-auto overscroll-contain/);
  assert.match(html, /flex shrink-0 items-center/);
  assert.match(html, /aria-label="닫기"/);
  assert.match(html, /w-11 h-11 shrink-0/);
  assert.match(html, /행 99/);
  assert.equal(renderToStaticMarkup(React.createElement(Modal, { open: false, onClose() {} }, 'hidden')), '');
});

test('mobile toolbar can wrap and its mode tray grows with 44px touch targets', () => {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  const toolbar = readFileSync(new URL('../src/components/layout/toolbar.tsx', import.meta.url), 'utf8');
  const mobile = css.slice(css.indexOf('@media (max-width: 768px)'), css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(toolbar, /data-toolbar className="mdview-toolbar /);
  assert.match(toolbar, /data-view-modes/);
  assert.match(mobile, /\.mdview-toolbar\s*\{[^}]*height: auto;[^}]*flex-wrap: wrap;/);
  assert.match(mobile, /\.mdview-toolbar button\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
  assert.match(mobile, /\.mdview-toolbar \[data-view-modes\]\s*\{[^}]*height: auto;/);
});
