'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useHwpImport } from '@/hooks/use-hwp';

interface HwpImportProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (content: string, title: string) => void;
}

export function HwpImport({ open, onClose, onImportComplete }: HwpImportProps) {
  const { importFile, progress, progressMessage, isImporting, error, reset } = useHwpImport();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ content: string; warnings: string[] } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    if (isImporting) return;
    setSelectedFile(null);
    setResult(null);
    setIsDragOver(false);
    reset();
    onClose();
  }, [isImporting, reset, onClose]);

  const processFile = useCallback(
    async (file: File) => {
      setSelectedFile(file);
      setResult(null);
      reset();

      try {
        const res = await importFile(file);
        setResult(res);
      } catch {
        // error state is already set in the hook
      }
    },
    [importFile, reset]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
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
    const title = selectedFile.name.replace(/\.(hwp|hwpx)$/i, '');
    onImportComplete(result.content, title);
    handleClose();
  }, [result, selectedFile, onImportComplete, handleClose]);

  const titleFromFile = selectedFile
    ? selectedFile.name.replace(/\.(hwp|hwpx)$/i, '')
    : '';

  return (
    <Modal open={open} onClose={handleClose} title="HWP 가져오기" size="md">
      <div className="flex flex-col gap-4">
        {/* Drop zone - shown when no file is selected or after error */}
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
                  : error
                  ? 'border-[var(--color-danger)]/50 bg-[var(--color-danger)]/5'
                  : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)] bg-[var(--color-surface)]/50'
              }
            `}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".hwp,.hwpx"
              onChange={handleFileChange}
              className="hidden"
            />
            {error ? (
              <>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-danger)]/10">
                  <X className="w-6 h-6 text-[var(--color-danger)]" />
                </div>
                <p className="text-sm font-medium text-[var(--color-danger)]">
                  변환 실패
                </p>
                <p className="text-xs text-[var(--color-danger)]/80 text-center max-w-[320px]">
                  {error}
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
                  HWP/HWPX 파일을 끌어다 놓으세요
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  또는 클릭하여 파일 선택
                </p>
              </>
            )}
          </div>
        )}

        {/* Progress bar - shown during import */}
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

        {/* Result - shown after successful import */}
        {result && selectedFile && (
          <div className="flex flex-col gap-3">
            {/* Success message */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20">
              <CheckCircle className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)]">
                  변환 완료!
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  &ldquo;{titleFromFile}&rdquo; 문서를 열까요?
                </p>
              </div>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-[#F59E0B]/5 border border-[#F59E0B]/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
                  <p className="text-xs font-medium text-[#F59E0B]">
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

            {/* Action buttons */}
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
