import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/check-worker-build.mjs', import.meta.url));
const compiled = 'new Worker("worker.js"); console.log("PDF 라이브러리 로드 중");';

function check(artifacts) {
  const cwd = mkdtempSync(join(tmpdir(), 'mdview-worker-check-'));
  try {
    mkdirSync(join(cwd, '.next/static'), { recursive: true });
    for (const [name, source] of Object.entries(artifacts)) {
      const path = join(cwd, '.next/static', name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, source);
    }
    try {
      return { ok: true, output: execFileSync(process.execPath, [script], { cwd, encoding: 'utf8', stdio: 'pipe' }) };
    } catch (error) {
      return { ok: false, output: String(error.stderr) };
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('worker build check accepts compiled entries and PDF worker across chunks', () => {
  const result = check({ 'chunks/app.js': 'new Worker("pdf.js");', 'chunks/pdf.js': 'console.log("PDF 라이브러리 로드 중");' });
  assert.equal(result.ok, true, result.output);
});

test('worker build check rejects missing entry points even when the PDF marker exists', () => {
  const result = check({ 'chunks/pdf.js': 'console.log("PDF 라이브러리 로드 중");' });
  assert.equal(result.ok, false);
  assert.match(result.output, /Expected bundled Worker entry points/);
});

test('worker build check rejects missing PDF worker even when another Worker exists', () => {
  const result = check({ 'chunks/app.js': 'new Worker("search.js");' });
  assert.equal(result.ok, false);
  assert.match(result.output, /Compiled PDF Worker is missing/);
});

for (const name of ['media/pdf-parser.worker.abcd.ts', 'media/search-worker.abcd.tsx']) {
  test(`worker build check rejects raw TypeScript: ${name}`, () => {
    const result = check({ 'chunks/app.js': compiled, [name]: 'const value: string = "raw";' });
    assert.equal(result.ok, false);
    assert.match(result.output, /Uncompiled Worker source emitted/);
  });
}
