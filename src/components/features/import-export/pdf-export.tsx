'use client';

import { useCallback } from 'react';

interface UsePdfExportOptions {
  documentTitle: string;
}

export function usePdfExport({ documentTitle }: UsePdfExportOptions) {
  const exportPdf = useCallback(() => {
    // Set the document title for the print header
    const originalTitle = document.title;
    document.title = documentTitle || '문서';

    // Add a temporary print title element
    const titleEl = document.createElement('div');
    titleEl.id = 'print-document-title';
    titleEl.textContent = documentTitle || '문서';
    titleEl.style.cssText =
      'display:none;font-size:1.5em;font-weight:700;margin-bottom:1em;font-family:var(--font-sans);';
    document.body.prepend(titleEl);

    window.print();

    // Cleanup after print dialog closes
    const cleanup = () => {
      document.title = originalTitle;
      titleEl.remove();
    };

    // Use afterprint event if available, fallback to timeout
    if ('onafterprint' in window) {
      window.addEventListener('afterprint', cleanup, { once: true });
    } else {
      setTimeout(cleanup, 1000);
    }
  }, [documentTitle]);

  return { exportPdf };
}
