import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
}
const output = await files('.next/static');
const sources = output.filter(file => /worker[^/]*\.tsx?$/.test(file));
if (sources.length) throw new Error(`Uncompiled Worker source emitted: ${sources.join(', ')}`);
const chunks = output.filter(file => file.endsWith('.js'));
const code = (await Promise.all(chunks.map(file => readFile(file, 'utf8')))).join('\n');
if (!/new Worker\(/.test(code)) throw new Error('Expected bundled Worker entry points were not found');
console.log('Worker output check passed: JavaScript entries, no emitted Worker TypeScript');
