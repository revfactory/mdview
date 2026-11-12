'use client';

import { useCallback, useEffect, useRef } from 'react';

interface UsePdfExportOptions {
  documentTitle: string;
}

export function usePdfExport({ documentTitle }: UsePdfExportOptions) {
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const exportPdf = useCallback(() => {
    // Retire an unfinished previous print session before capturing the title.
    cleanupRef.current?.();
    const originalTitle = document.title;
    document.title = documentTitle || '문서';
    const titleEl = document.createElement('div');
    titleEl.id = 'print-document-title';
    titleEl.textContent = documentTitle || '문서';
    titleEl.style.cssText =
      'display:none;font-size:1.5em;font-weight:700;margin-bottom:1em;font-family:var(--font-sans);';
    document.body.prepend(titleEl);

    let fallback: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      window.removeEventListener('afterprint', cleanup);
      if (fallback) clearTimeout(fallback);
      document.title = originalTitle;
      titleEl.remove();
      if (cleanupRef.current === cleanup) cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;
    // Some browsers dispatch afterprint before the blocking print() returns.
    window.addEventListener('afterprint', cleanup, { once: true });
    try {
      window.print();
      if (!('onafterprint' in window)) fallback = setTimeout(cleanup, 1000);
    } catch (error) {
      cleanup();
      throw error;
    }
  }, [documentTitle]);

  return { exportPdf };
}
