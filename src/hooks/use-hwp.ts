'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { saveAs } from 'file-saver';
import type { HwpExportOptions } from '@/types/hwp';

// ---------- useHwpImport ----------

export function useHwpImport() {
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const importFile = useCallback(
    async (file: File): Promise<{ content: string; warnings: string[] }> => {
      // Terminate any existing worker
      workerRef.current?.terminate();

      setIsImporting(true);
      setProgress(0);
      setProgressMessage('');
      setError(null);

      return new Promise((resolve, reject) => {
        const worker = new Worker(
          new URL('../workers/hwp-parser.worker.ts', import.meta.url)
        );
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent) => {
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
              resolve({
                content: msg.content || '',
                warnings: msg.warnings || [],
              });
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
          const message = err.message || 'Worker 실행 중 오류가 발생했습니다.';
          setError(message);
          setIsImporting(false);
          worker.terminate();
          workerRef.current = null;
          reject(new Error(message));
        };

        file.arrayBuffer().then((buffer) => {
          worker.postMessage({
            type: 'parse',
            file: buffer,
            options: {
              preserveStyles: true,
              convertTables: true,
              extractImages: false,
              imageFormat: 'base64' as const,
            },
          });
        });
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

// ---------- useHwpExport ----------

const DEFAULT_EXPORT_OPTIONS: HwpExportOptions = {
  paperSize: 'A4',
  orientation: 'portrait',
  marginTop: 20,
  marginBottom: 20,
  marginLeft: 20,
  marginRight: 20,
  fontSize: 10,
  fontFamily: '맑은 고딕',
  lineHeight: 1.6,
};

export function useHwpExport() {
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const exportDocument = useCallback(
    async (
      markdown: string,
      fileName: string = '문서',
      options?: Partial<HwpExportOptions>
    ): Promise<void> => {
      workerRef.current?.terminate();

      setIsExporting(true);
      setProgress(0);
      setProgressMessage('');
      setError(null);

      const mergedOptions: HwpExportOptions = {
        ...DEFAULT_EXPORT_OPTIONS,
        ...options,
      };

      return new Promise((resolve, reject) => {
        const worker = new Worker(
          new URL('../workers/hwp-generator.worker.ts', import.meta.url)
        );
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent) => {
          const msg = e.data;

          switch (msg.type) {
            case 'progress':
              setProgress(msg.percent);
              setProgressMessage(msg.message);
              break;
            case 'complete': {
              setProgress(100);
              setProgressMessage('다운로드 중...');
              setIsExporting(false);
              worker.terminate();
              workerRef.current = null;

              const blob = new Blob([msg.buffer], {
                type: 'application/hwp+zip',
              });
              const safeName = fileName.replace(/[<>:"/\\|?*]/g, '_');
              saveAs(blob, `${safeName}.hwpx`);
              resolve();
              break;
            }
            case 'error':
              setError(msg.error);
              setIsExporting(false);
              worker.terminate();
              workerRef.current = null;
              reject(new Error(msg.error));
              break;
          }
        };

        worker.onerror = (err) => {
          const message = err.message || 'Worker 실행 중 오류가 발생했습니다.';
          setError(message);
          setIsExporting(false);
          worker.terminate();
          workerRef.current = null;
          reject(new Error(message));
        };

        worker.postMessage({
          type: 'generate',
          markdown,
          options: mergedOptions,
        });
      });
    },
    []
  );

  const reset = useCallback(() => {
    setProgress(0);
    setProgressMessage('');
    setIsExporting(false);
    setError(null);
  }, []);

  return {
    exportDocument,
    progress,
    progressMessage,
    isExporting,
    error,
    reset,
  };
}
