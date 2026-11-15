import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import domino from '@mixmark-io/domino';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
function loadSource(source, overrides = {}) {
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const context = { exports: {}, require: name => name in overrides ? overrides[name] : require(name) };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
const sourceCounts = loadSource(read('../src/lib/source-counts.ts'));
const source = read('../src/components/layout/status-bar.tsx');
const css = read('../src/app/globals.css');
const themes = Object.fromEntries([':root', '.dark'].map(selector => {
  const block = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
  return [selector, Object.fromEntries([...block.matchAll(/(--color-[\w-]+):\s*(#[0-9a-f]{6});/gi)].map(([, key, value]) => [key, value]))];
}));
const labels = { saved: '저장됨', saving: '저장 중...', idle: '준비', error: '저장 오류' };
function render(status, isMobile, sourceContent) {
  const state = { saveStatus: status, charCount: 275, wordCount: 51, cursorPosition: { line: 4, col: 9 } };
  const { StatusBar } = loadSource(source, {
    '@/lib/source-counts': sourceCounts,
    '@/stores/editor-store': { useEditorStore: selector => selector(state) },
    '@/stores/ui-store': { useUIStore: selector => selector({ isMobile }) },
  });
  return domino.createWindow(renderToStaticMarkup(React.createElement(StatusBar, { sourceContent }))).document;
}
// Resolve the component's explicit Tailwind token classes and inherited color.
// This is a rendered-markup/token contract, not a browser CSS-cascade audit.
function tokenFor(node, property) {
  for (let el = node; el; el = el.parentElement) {
    const match = el.getAttribute('class')?.match(new RegExp(`${property}-\\[var\\((--color-[\\w-]+)\\)\\]`));
    if (match) return match[1];
  }
  assert.fail(`missing ${property} token`);
}
function luminance(hex) {
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

for (const [theme, tokens] of Object.entries(themes)) {
  for (const [status, label] of Object.entries(labels)) {
    test(`${theme} status-bar text reaches 4.5:1 for ${status} on desktop and mobile`, () => {
      for (const isMobile of [false, true]) {
        const doc = render(status, isMobile);
        const bar = doc.querySelector('[data-statusbar]');
        assert.ok(bar.textContent.includes(label));
        const textNodes = Array.from(bar.querySelectorAll('span')).filter(el => !el.children.length && el.textContent.trim());
        assert.ok(textNodes.length >= 2);
        for (const el of textNodes) {
          const fg = tokens[tokenFor(el, 'text')];
          const bg = tokens[tokenFor(el, 'bg')];
          assert.ok(fg && bg);
          const ratio = contrast(fg, bg);
          assert.ok(ratio >= 4.5, `${el.textContent}: ${ratio.toFixed(3)}:1`);
        }
      }
    });
  }
}

test('status presentation retains counts, source convention, labels and decorative state icons', () => {
  for (const [status, label] of Object.entries(labels)) {
    const doc = render(status, false);
    const bar = doc.querySelector('[data-statusbar]');
    for (const text of ['275 글자', '51 단어', '1분 읽기', '4:9', label]) assert.ok(bar.textContent.includes(text));
    const icon = bar.querySelector('svg');
    assert.equal(icon.getAttribute('aria-hidden'), 'true');
    assert.equal(icon.getAttribute('class').includes('animate-spin'), status === 'saving');
    const expected = status === 'saved' ? '--color-success' : status === 'error' ? '--color-danger' : '--color-text-muted';
    assert.equal(tokenFor(icon, 'text'), expected);
  }
  const sourceDoc = render('idle', false, '# 안녕 world');
  assert.ok(sourceDoc.body.textContent.includes('원문'));
  assert.ok(sourceDoc.body.textContent.includes('10 글자'));
  assert.ok(sourceDoc.body.textContent.includes('3 단어'));
  const mobile = render('idle', true).body.textContent;
  assert.ok(mobile.includes('275 글자'));
  assert.ok(!mobile.includes('51 단어'));
  assert.ok(!mobile.includes('4:9'));
});
