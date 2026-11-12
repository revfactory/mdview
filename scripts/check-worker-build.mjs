import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(join(dir, entry.name)) : join(dir, entry.name)))).flat();
}

const artifacts = await files('.next/static');
const rawWorkers = artifacts.filter(path => /worker[^/]*\.tsx?$/.test(path));
if (rawWorkers.length) throw new Error(`Uncompiled Worker source emitted: ${rawWorkers.join(', ')}`);
const javascript = await Promise.all(artifacts.filter(path => path.endsWith('.js')).map(path => readFile(path, 'utf8')));
if (!javascript.some(source => /new Worker\(/.test(source))) {
  throw new Error('Expected bundled Worker entry points were not found');
}
if (!javascript.some(source => source.includes('PDF 라이브러리 로드 중'))) {
  throw new Error('Compiled PDF Worker is missing from production JavaScript assets');
}
console.log('Worker build check passed: JavaScript entry points, compiled PDF Worker, no raw TypeScript Workers');
