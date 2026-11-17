'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { validatePdfFileMeta, hasPdfHeader, pdfTitleFromFileName, PDF_HEADER_SEARCH_BYTES, PDF_MAX_FILE_SIZE, formatFileSize } from '@/lib/pdf-file';

export interface PdfImportResult {
  file: File;
  title: string;
  pageCount: number;
  excerpt: string;
}

interface PdfImportProps {
  open: boolean;
  onClose: () => void;
  /** 저장까지 끝나면 resolve. 실패하면 메시지를 대화상자에 보여 준다. */
  onImportComplete: (result: PdfImportResult) => Promise<void>;
}

export function PdfImport({ open, onClose, onImportComplete }: PdfImportProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 처리 중에 닫거나 다른 파일을 고르면 이전 결과를 버린다.
  const runRef = useRef(0);

  const cancelTaskRef = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    runRef.current++;
    cancelTaskRef.current?.();
    cancelTaskRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    runRef.current++;
    cancelTaskRef.current?.();
    cancelTaskRef.current = null;
    setSelectedFile(null);
    setIsProcessing(false);
    setIsDragOver(false);
    setError(null);
    onClose();
  }, [onClose]);

  const processFile = useCallback(async (file: File) => {
    const run = ++runRef.current;
    cancelTaskRef.current?.();
    cancelTaskRef.current = null;
    const metaError = validatePdfFileMeta(file);
    if (metaError) {
      setSelectedFile(null);
      setError(metaError);
      return;
    }
    setSelectedFile(file);
    setError(null);
    setIsProcessing(true);

    let task: import('@/lib/pdfjs').PDFDocumentLoadingTask | null = null;
    let destroyed = false;
    const destroyTask = () => {
      if (!task || destroyed) return;
      destroyed = true;
      // Cancellation is best-effort cleanup; a rejected destroy must not become
      // an unhandled rejection or replace the original import error.
      try { void Promise.resolve(task.destroy()).catch(() => {}); } catch {}
    };
    cancelTaskRef.current = destroyTask;
    try {
      const head = new Uint8Array(await file.slice(0, PDF_HEADER_SEARCH_BYTES).arrayBuffer());
      if (run !== runRef.current) return;
      if (!hasPdfHeader(head)) throw new Error('PDF 형식이 아닌 파일입니다. 확장자만 .pdf로 바뀐 파일인지 확인해 주세요.');

      const { openPdfDocument, readPdfExcerpt } = await import('@/lib/pdfjs');
      if (run !== runRef.current) return;
      const data = new Uint8Array(await file.arrayBuffer());
      if (run !== runRef.current) return;
      task = await openPdfDocument(data);
      if (run !== runRef.current) return;
      const doc = await task.promise;
      if (run !== runRef.current) return;
      const excerpt = await readPdfExcerpt(doc).catch(() => '');
      if (run !== runRef.current) return;

      await onImportComplete({ file, title: pdfTitleFromFileName(file.name), pageCount: doc.numPages, excerpt });
      if (run !== runRef.current) return;
      handleClose();
    } catch (err) {
      if (run !== runRef.current) return;
      const { describePdfError } = await import('@/lib/pdfjs');
      if (run !== runRef.current) return;
      const quota = err instanceof Error && err.name === 'QuotaExceededError';
      setError(quota ? '브라우저 저장 공간이 부족해 PDF를 보관하지 못했습니다. 사용하지 않는 문서를 지운 뒤 다시 시도해 주세요.' : describePdfError(err));
      setIsProcessing(false);
    } finally {
      if (cancelTaskRef.current === destroyTask) cancelTaskRef.current = null;
      destroyTask();
    }
  }, [onImportComplete, handleClose]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 실패한 파일을 다시 고를 수 있도록 선택값을 비운다.
    e.target.value = '';
    if (file) void processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  return (
    <Modal open={open} onClose={handleClose} title="PDF 열기" size="md">
      <div className="flex flex-col gap-4">
        {!isProcessing && (
          <div
            role="button"
            tabIndex={0}
            aria-label="PDF 파일 선택"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`
              flex flex-col items-center justify-center gap-3
              h-[200px] rounded-xl border-2 border-dashed
              transition-colors duration-200 cursor-pointer
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]
              ${
                isDragOver
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                  : error
                  ? 'border-[var(--color-danger)]/50 bg-[var(--color-danger)]/5'
                  : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)] bg-[var(--color-surface)]/50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {error ? (
              <>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-danger)]/10">
                  <X className="w-6 h-6 text-[var(--color-danger)]" />
                </div>
                <p className="text-sm font-medium text-[var(--color-danger)]">PDF를 열지 못했습니다</p>
                <p className="text-xs text-[var(--color-danger)]/80 text-center max-w-[320px]">{error}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">다른 파일을 선택해주세요</p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-surface)]">
                  <Upload className="w-6 h-6 text-[var(--color-text-muted)]" />
                </div>
                <p className="text-sm font-medium text-[var(--color-text)]">PDF 파일을 끌어다 놓으세요</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  또는 클릭하여 파일 선택 · 최대 {formatFileSize(PDF_MAX_FILE_SIZE)}
                </p>
              </>
            )}
          </div>
        )}

        {isProcessing && selectedFile && (
          <div role="status" className="flex flex-col gap-3 p-4 rounded-xl bg-[var(--color-surface)]">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)] truncate">{selectedFile.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">PDF를 확인하고 브라우저에 보관하는 중...</p>
              </div>
              <span className="text-xs font-mono text-[var(--color-text-muted)]">{formatFileSize(selectedFile.size)}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--color-accent)] animate-pulse w-full" />
            </div>
          </div>
        )}

        <p className="text-xs leading-5 text-[var(--color-text-muted)]">
          PDF는 원본 그대로 읽기 전용으로 열립니다. 편집하려면 문서를 연 뒤 &lsquo;마크다운으로 변환&rsquo;을 누르세요. 파일은 서버로 전송되지 않고 이 브라우저에만 저장됩니다.
        </p>
      </div>
    </Modal>
  );
}
