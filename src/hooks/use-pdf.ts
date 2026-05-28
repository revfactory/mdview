'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PdfImportOptions,
  PdfParseResult,
  PdfWorkerResponse,
} from '@/types/pdf';

/**
 * usePdfImport — file → Worker → progress/result/error state.
 *
 * Mirrors the API of `useHwpImport` so callers can drop it into the same
 * import-dialog component layout.
 */
export function usePdfImport() {
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const importFile = useCallback(
    async (
      file: File,
      options?: PdfImportOptions
    ): Promise<PdfParseResult> => {
      // Terminate any in-flight worker
      workerRef.current?.terminate();

      setIsImporting(true);
      setProgress(0);
      setProgressMessage('');
      setError(null);

      const buffer = await file.arrayBuffer();

      return new Promise<PdfParseResult>((resolve, reject) => {
        const worker = new Worker(
          new URL('../workers/pdf-parser.worker.ts', import.meta.url),
          { type: 'module' }
        );
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent<PdfWorkerResponse>) => {
          const msg = e.data;
          switch (msg.type) {
            case 'progress':
              setProgress(msg.percent);
              setProgressMessage(msg.message);
              break;
            case 'complete':
              setProgress(100);
              setProgressMessage('변환 완료');
              setIsImporting(false);
              worker.terminate();
              workerRef.current = null;
              resolve(msg.result);
              break;
            case 'error':
              setError(msg.error);
              setIsImporting(false);
              worker.terminate();
              workerRef.current = null;
              reject(new Error(msg.error));
              break;
          }
        };

        worker.onerror = (err) => {
          const message =
            err.message || 'PDF 변환 워커 실행 중 오류가 발생했습니다.';
          setError(message);
          setIsImporting(false);
          worker.terminate();
          workerRef.current = null;
          reject(new Error(message));
        };

        worker.postMessage(
          {
            type: 'parse',
            file: buffer,
            options,
          },
          // Transfer the buffer to avoid copying — buffer is no longer usable
          // on the main thread after this call, which is fine since we just
          // produced it from File.arrayBuffer().
          [buffer]
        );
      });
    },
    []
  );

  const reset = useCallback(() => {
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
