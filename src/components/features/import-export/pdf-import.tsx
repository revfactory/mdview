'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  X,
  Info,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { usePdfImport } from '@/hooks/use-pdf';
import type { PdfParseResult } from '@/types/pdf';

interface PdfImportProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (content: string, title: string) => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const LARGE_PAGE_THRESHOLD = 200;

export function PdfImport({ open, onClose, onImportComplete }: PdfImportProps) {
  const { importFile, progress, progressMessage, isImporting, error, reset } =
    usePdfImport();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<PdfParseResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayedError = localError ?? error;

  const handleClose = useCallback(() => {
    if (isImporting) return;
    setSelectedFile(null);
    setResult(null);
    setIsDragOver(false);
    setSizeWarning(null);
    setLocalError(null);
    reset();
    onClose();
  }, [isImporting, reset, onClose]);

  const processFile = useCallback(
    async (file: File) => {
      setLocalError(null);
      reset();

      // Basic extension/mime check — strict to avoid spending time on non-PDF files
      if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
        setSelectedFile(file);
        setResult(null);
        setSizeWarning(null);
        setLocalError('PDF 파일(.pdf)만 지원합니다.');
        return;
      }

      setSelectedFile(file);
      setResult(null);

      // Size warning (non-blocking)
      if (file.size > MAX_FILE_SIZE) {
        setSizeWarning(
          `파일이 매우 큽니다(${(file.size / (1024 * 1024)).toFixed(1)} MB). 변환 시간이 오래 걸릴 수 있습니다.`
        );
      } else {
        setSizeWarning(null);
      }

      try {
        const res = await importFile(file);
        setResult(res);
      } catch (err) {
        // error state is set inside the hook; log details for the user
        console.error('[PDF import] failed:', err);
      }
    },
    [importFile, reset]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void processFile(file);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!result || !selectedFile) return;
    const baseTitle = selectedFile.name.replace(/\.pdf$/i, '');
    const title = result.metadata.title?.trim() || baseTitle || 'PDF 문서';
    onImportComplete(result.markdown, title);
    handleClose();
  }, [result, selectedFile, onImportComplete, handleClose]);

  const titleFromResult =
    result?.metadata.title?.trim() ||
    (selectedFile ? selectedFile.name.replace(/\.pdf$/i, '') : '');

  const showLargePageWarning =
    !!result && result.metadata.parsedPageCount > LARGE_PAGE_THRESHOLD;

  return (
    <Modal open={open} onClose={handleClose} title="PDF 가져오기" size="md">
      <div className="flex flex-col gap-4">
        {/* Scope notice — always visible at the top */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20">
          <Info className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            텍스트와 기본 구조(제목 · 문단 · 목록)만 추출합니다.
            <br />
            표 · 이미지 · OCR(스캔본)은 아직 지원하지 않습니다.
          </p>
        </div>

        {/* Drop zone */}
        {!isImporting && !result && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              flex flex-col items-center justify-center gap-3
              h-[200px] rounded-xl border-2 border-dashed
              transition-colors duration-200 cursor-pointer
              ${
                isDragOver
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                  : displayedError
                  ? 'border-[var(--color-danger)]/50 bg-[var(--color-danger)]/5'
                  : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)] bg-[var(--color-surface)]/50'
              }
            `}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {displayedError ? (
              <>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-danger)]/10">
                  <X className="w-6 h-6 text-[var(--color-danger)]" />
                </div>
                <p className="text-sm font-medium text-[var(--color-danger)]">
                  변환 실패
                </p>
                <p className="text-xs text-[var(--color-danger)]/80 text-center max-w-[320px]">
                  {displayedError}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  다른 파일을 선택해주세요
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-surface)]">
                  <Upload className="w-6 h-6 text-[var(--color-text-muted)]" />
                </div>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  PDF 파일을 끌어다 놓으세요
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  또는 클릭하여 파일 선택
                </p>
              </>
            )}
          </div>
        )}

        {/* File size warning (non-blocking, before import completes) */}
        {sizeWarning && !result && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--color-warning)]/5 border border-[var(--color-warning)]/20">
            <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--color-text-secondary)]">
              {sizeWarning}
            </p>
          </div>
        )}

        {/* Progress bar */}
        {isImporting && selectedFile && (
          <div className="flex flex-col gap-3 p-4 rounded-xl bg-[var(--color-surface)]">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)] truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {progressMessage || '변환 중...'}
                </p>
              </div>
              <span className="text-xs font-mono text-[var(--color-text-muted)]">
                {progress}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Result */}
        {result && selectedFile && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20">
              <CheckCircle className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)]">
                  변환 완료!
                </p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">
                  &ldquo;{titleFromResult}&rdquo; · {result.metadata.parsedPageCount}
                  /{result.metadata.pageCount} 페이지
                </p>
              </div>
            </div>

            {showLargePageWarning && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--color-warning)]/5 border border-[var(--color-warning)]/20">
                <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--color-text-secondary)]">
                  페이지 수가 많아 일부 페이지의 변환 정확도가 떨어질 수 있습니다.
                </p>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-[var(--color-warning)]/5 border border-[var(--color-warning)]/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] shrink-0" />
                  <p className="text-xs font-medium text-[var(--color-warning)]">
                    경고 ({result.warnings.length}건)
                  </p>
                </div>
                <ul className="flex flex-col gap-1 pl-6">
                  {result.warnings.map((warning, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-[var(--color-text-muted)] list-disc"
                    >
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={handleClose}>
                취소
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirm}>
                확인
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
