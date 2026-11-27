'use client';

import { useEffect, useRef, useState } from 'react';
import { analytics } from '@/lib/analytics';
import type { PDFDocumentLoadingTask } from '@/lib/pdfjs';

const SAMPLE_URL = '/examples/pdf-to-markdown-sample.pdf';

export function PdfGuideExample({ preview }: { preview: string }) {
  const active = useRef<AbortController | null>(null);
  const completed = useRef(false);
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');

  useEffect(() => () => active.current?.abort(), []);

  async function convertExample() {
    if (active.current || completed.current) return;
    const controller = new AbortController();
    const { signal } = controller;
    active.current = controller;
    setStatus('loading');

    let task: PDFDocumentLoadingTask | undefined;
    let closing: Promise<void> | undefined;
    function closePdf() {
      if (task && !closing) {
        try { closing = Promise.resolve(task.destroy()).catch(() => undefined); }
        catch { closing = Promise.resolve(); }
      }
      return closing;
    }
    signal.addEventListener('abort', closePdf, { once: true });
    const timeout = window.setTimeout(() => {
      controller.abort();
      if (active.current === controller) {
        setStatus('error');
        active.current = null;
      }
    }, 12000);
    try {
      const response = await fetch(SAMPLE_URL, { signal });
      if (!response.ok) throw new Error('Example PDF missing');
      const buffer = await response.arrayBuffer();
      const { openPdfDocument, extractPdfMarkdown } = await import('@/lib/pdfjs');
      if (signal.aborted) return;
      task = await openPdfDocument(new Uint8Array(buffer));
      if (signal.aborted) {
        // A late-created task's rejected promise must still be observed.
        void task.promise.catch(() => undefined);
        return;
      }
      const document = await task.promise;
      const markdown = (await extractPdfMarkdown(document, { signal })).trim();
      if (!markdown) throw new Error('Example returned no text');
      if (signal.aborted) return;
      completed.current = true;
      setResult(markdown);
      setStatus('done');
      analytics.pdfExampleComplete();
    } catch {
      if (!signal.aborted) setStatus('error');
    } finally {
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', closePdf);
      await closePdf();
      if (active.current === controller) active.current = null;
    }
  }

  return (
    <figure>
      <figcaption>{result ? '브라우저에서 변환한 마크다운' : '변환 직후 마크다운'}</figcaption>
      <pre><code>{result ?? preview}</code></pre>
      <button type="button" className="guide-example-button" aria-disabled={status === 'loading' || status === 'done'} onClick={convertExample}>
        예제 PDF 변환해 보기
      </button>
      <p className="guide-example-status" role="status">
        {status === 'loading' && '예제 PDF 변환 중…'}
        {status === 'done' && '이 예제만 변환했습니다. 문서 목록에는 저장하지 않았습니다.'}
        {status === 'error' && '예제를 불러오지 못했습니다. 다시 시도하거나 위의 결과를 확인하세요.'}
      </p>
    </figure>
  );
}
