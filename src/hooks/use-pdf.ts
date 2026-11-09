'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PdfParseResult, PdfImportOptions, PdfWorkerResponse } from '@/types/pdf';
import { PDF_MAX_FILE_BYTES } from '@/lib/pdf-limits';

// ---------- usePdfImport ----------

export function usePdfImport() {
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelImportRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cancelImportRef.current?.(), []);

  const importFile = useCallback(
    async (file: File, options?: PdfImportOptions): Promise<PdfParseResult> => {
      cancelImportRef.current?.();
      setIsImporting(true);
      setProgress(0);
      setProgressMessage('');
      setError(null);

      return new Promise((resolve, reject) => {
        let worker: Worker | null = null;
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const cleanup = () => {
          clearTimeout(timeout);
          worker?.terminate();
          if (cancelImportRef.current === cancel) cancelImportRef.current = null;
        };
        const fail = (reason: unknown) => {
          if (settled) return;
          settled = true;
          const message = reason instanceof Error ? reason.message : '파일을 읽거나 변환하지 못했습니다.';
          cleanup();
          setError(message);
          setIsImporting(false);
          reject(new Error(message));
        };
        const cancel = () => {
          if (settled) return;
          settled = true;
          cleanup();
          // Settle callers without updating an unmounted or replacement UI.
          reject(new Error('가져오기가 취소되었습니다.'));
        };
        cancelImportRef.current = cancel;

        try {
          if (file.size > PDF_MAX_FILE_BYTES) throw new Error('PDF는 25MB 이하만 가져올 수 있습니다.');
          worker = new Worker(new URL('../workers/pdf-parser.worker.ts', import.meta.url), { type: 'module' });
          timeout = setTimeout(() => fail(new Error('변환 시간이 초과되었습니다. 더 작은 PDF로 다시 시도해주세요.')), 60_000);
          worker.onmessage = (e: MessageEvent<PdfWorkerResponse>) => {
            if (settled) return;
            const msg = e.data;
            switch (msg.type) {
              case 'progress':
                setProgress(msg.percent);
                setProgressMessage(msg.message);
                break;
              case 'complete':
                settled = true;
                cleanup();
                setProgress(100);
                setProgressMessage('변환 완료');
                setIsImporting(false);
                resolve(msg.result);
                break;
              case 'error':
                fail(new Error(msg.error));
                break;
            }
          };
          worker.onerror = (event) => fail(new Error(event.message || 'Worker 실행 중 오류가 발생했습니다.'));
          file.arrayBuffer().then((buffer) => {
            if (settled) return;
            worker?.postMessage({
              type: 'parse',
              file: buffer,
              options,
            }, [buffer]);
          }).catch(fail);
        } catch (error) {
          fail(error);
        }
      });
    },
    []
  );

  const reset = useCallback(() => {
    cancelImportRef.current?.();
    setProgress(0);
    setProgressMessage('');
    setIsImporting(false);
    setError(null);
  }, []);

  return {
    importFile,
    progress,
    progressMessage,
    isImporting,
    error,
    reset,
  };
}
