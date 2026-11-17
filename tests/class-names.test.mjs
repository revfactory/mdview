import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as nanoid from 'nanoid';

// Execute the real helper while keeping this test compatible with Node 20.
const source = readFileSync(new URL('../src/lib/utils.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const exports = {};
const require = createRequire(import.meta.url);
vm.runInNewContext(js, {
  exports,
  require: id => {
    if (id === 'nanoid') return nanoid;
    if (id === './constants') return { EXCERPT_MAX_LENGTH: 200 };
    return require(id);
  },
});
const { cn } = exports;

test('cn flattens conditional inputs before resolving conflicting classes', () => {
  assert.equal(cn(), '');
  assert.equal(cn(null, false, undefined, ''), '');
  assert.equal(cn('px-2', ['py-1', [false, 'px-4']], { hidden: false, flex: true }), 'py-1 px-4 flex');
});

test('cn preserves independent spacing, font size, and text color', () => {
  assert.equal(cn('px-2 py-1', 'px-4'), 'py-1 px-4');
  assert.equal(cn('px-2 py-1', 'p-4'), 'p-4');
  assert.equal(cn('p-4', 'px-2'), 'p-4 px-2');
  assert.equal(cn('text-sm text-red-500', 'text-lg'), 'text-red-500 text-lg');
});

test('cn keeps theme and interaction variants distinct from base styles', () => {
  assert.equal(cn('bg-white dark:bg-black', 'bg-gray-100'), 'dark:bg-black bg-gray-100');
  assert.equal(cn('hover:bg-red-500 md:bg-red-500', 'hover:bg-blue-500'), 'md:bg-red-500 hover:bg-blue-500');
  assert.equal(cn('bg-[var(--color-bg)]', 'bg-[var(--color-surface-hover)]'), 'bg-[var(--color-surface-hover)]');
  assert.equal(cn('md:w-1/2', 'w-full'), 'md:w-1/2 w-full');
});

test('cn handles fractional widths and font line-height postfixes', () => {
  assert.equal(cn('w-1/2', 'w-full'), 'w-full');
  assert.equal(cn('text-sm/6', 'text-lg/7'), 'text-lg/7');
  assert.equal(cn('leading-8', 'text-lg/7'), 'text-lg/7');
  assert.equal(cn('text-lg/7', 'leading-8'), 'text-lg/7 leading-8');
});

test('cn distinguishes named container postfixes from ordinary slash modifiers', () => {
  assert.equal(cn('@container', '@container-size/sidebar'), '@container-size/sidebar');
  assert.equal(cn('@container-size/sidebar', '@container'), '@container-size/sidebar @container');
  assert.equal(cn('@container/sidebar', '@container-normal/content', '@container-size'), '@container-normal/content @container-size');
  assert.equal(cn('hover:@container', 'hover:@container-size/sidebar'), 'hover:@container-size/sidebar');
  assert.equal(cn('@container-foo/sidebar', '@container-size/sidebar'), '@container-foo/sidebar @container-size/sidebar');
});
