# PDF import revival (#5)

This work preserves PR #16's text-and-basic-structure contribution. The five original commits were cherry-picked with author attribution and `-x` source references:

- db1e65b: specification/dependency
- 1d287bc: types/converter/worker
- 431ed9f: hook/dialog
- 6105b29: sidebar/page integration
- 06cb297: changelog

The original PR and its branch are unchanged. Scope remains text, headings, paragraphs and lists, not OCR, tables or image extraction.

## Release gates

- Use exactly pdfjs-dist 6.2.108 and audit the final lockfile before publication.
- PDF.js requires Node >=22.13.0 or >=24. CI and package engines are aligned to Node24, matching the current Vercel project runtime. Browser text extraction uses the legacy compatibility build, not the Node runtime.
- The application worker bundles the same-version PDF.js handler explicitly. No CDN worker/font service is configured. Browser production-bundle execution must pass, not just `next build`.
- Limits: 25MiB, 200 pages, 2 million extracted characters, 50,000 text items/page, 60 seconds. Oversized documents fail rather than silently returning a partial document.
- Cancel/reset/replacement/unmount settle the outstanding promise and stop the worker. File read, constructor and postMessage failures restore the UI. Same-file retry is supported.
- PDF text is escaped as literal text, including Markdown/HTML, GFM bare links and the app's math/footnote extensions.
- Document creation is awaited. Saving prevents duplicate confirmation; failures retain the conversion result for retry. Chunked PDF document metadata/chunks are saved in one transaction.

## Known limitations

Text extraction is heuristic and must be compared against the source. Columns, tables, headers and hyphenation are not reconstructed. Scanned/image-only PDFs require OCR, which is not provided. Password-protected documents have no password-entry flow. External CMaps and standard fonts are not downloaded, so PDFs without sufficient embedded character mappings may omit characters. The synthetic Korean test covers an embedded Unicode mapping, not all Korean PDFs.

## Automated coverage

`npm test` includes converter tests through marked + app extensions, worker payload/resource/cleanup tests and a real PDF.js parse of a generated synthetic PDF (title, paragraph, list, Korean), hook read/worker/cancel/replacement/unmount/timeout tests, and dialog cancel/reselect/stale-result/save-retry tests. No user documents are fixtures.

Browser QA, audit and aggregate build/lint/typecheck results for the final integrated commit must be recorded by the release owner. Do not treat unit mocks or a historical PR deployment as browser execution evidence.

## Security integration (2026-11-09)

Merged security commit `620e3abdadc6c54def08f912cc9295ae3bd80bc2` with its history intact: TipTap 3.33, nanoid 5.1.16, KaTeX 0.18.2. PDF.js remains 6.2.108 and Node remains 24.x. A fresh `npm ci` accepted the merged lockfile. Production audit reports **0 vulnerabilities**. Full audit reports **13 development-tool findings (4 high, 9 moderate)**, primarily the ESLint dependency tree; this is not an all-dependencies clean audit. Do not use the suggested eslint-config-next downgrade to 15.x against Next16 merely to silence audit. Full tests after integration: **62 passed**; typecheck and lint passed (10 existing warnings). Browser bundle execution remains a preview release gate because the cloud browser cannot reach the executor's localhost server.
