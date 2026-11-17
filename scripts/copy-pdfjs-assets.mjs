// pdf.js가 런타임에 내려받는 파일(Worker, CMap, 표준 글꼴, 이미지 디코더 wasm, ICC 프로필)을
// node_modules에서 public/pdfjs 로 복사한다. 한글 CID 글꼴을 쓰는 PDF는 CMap이 없으면 글자가 비어 보인다.
// 결과물은 .gitignore 대상이며 dev/build 직전에 매번 다시 만든다.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
const { version } = JSON.parse(await readFile(path.join(pkgDir, 'package.json'), 'utf8'));
const dest = path.resolve('public/pdfjs');

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

// 앱이 쓰는 legacy 빌드와 같은 Worker를 써야 API/Worker 버전 검사를 통과한다.
await cp(path.join(pkgDir, 'legacy/build/pdf.worker.min.mjs'), path.join(dest, 'pdf.worker.min.mjs'));
for (const dir of ['cmaps', 'standard_fonts', 'iccs']) {
  await cp(path.join(pkgDir, dir), path.join(dest, dir), { recursive: true });
}
// quickjs-eval 은 PDF 내장 스크립트 실행용이다. 뷰어는 스크립트를 실행하지 않으므로 복사하지 않는다.
await cp(path.join(pkgDir, 'wasm'), path.join(dest, 'wasm'), {
  recursive: true,
  filter: (source) => !path.basename(source).startsWith('quickjs'),
});
await cp(path.join(pkgDir, 'LICENSE'), path.join(dest, 'LICENSE'));
await writeFile(path.join(dest, 'VERSION'), `${version}\n`);

console.log(`pdf.js ${version} assets copied to public/pdfjs`);
