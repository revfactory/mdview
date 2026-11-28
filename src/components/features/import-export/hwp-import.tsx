'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useHwpImport } from '@/hooks/use-hwp';

interface HwpImportProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (content: string, title: string) => void | Promise<void>;
}

export function HwpImport({ open, onClose, onImportComplete }: HwpImportProps) {
  const { importFile, progress, progressMessage, isImporting, error, reset } = useHwpImport();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ content: string; warnings: string[] } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const attemptedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleClose = useCallback(() => {
    // Closing cannot cancel an already-started write. Keep its result visible.
    if (savingRef.current) return;
    attemptedRef.current = false;
    setIsSaving(false);
    setSaveError(null);
    setSelectedFile(null);
    setResult(null);
    setIsDragOver(false);
    reset();
    onClose();
  }, [reset, onClose]);

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
      // Allow choosing the same file again after failure or cancellation.
      e.target.value = '';
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

  const handleConfirm = useCallback(async () => {
    if (!result || !selectedFile || attemptedRef.current) return;
    // The ref closes the same-tick double-click gap before React rerenders.
    attemptedRef.current = true;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    const title = selectedFile.name.replace(/\.(hwp|hwpx)$/i, '');
    try {
      await onImportComplete(result.content, title);
      savingRef.current = false;
      if (mountedRef.current) handleClose();
    } catch {
      savingRef.current = false;
      if (mountedRef.current) {
        setIsSaving(false);
        setSaveError('저장을 완료하지 못했습니다. 원본 파일을 보관하고 아래 복구 원문을 복사해 두세요. 일부 문서가 이미 생성되었을 수 있어 재시도는 막았습니다. 문서 목록을 확인하기 전 같은 파일을 다시 가져오지 마세요.');
      }
    }
  }, [result, selectedFile, onImportComplete, handleClose]);

  const titleFromFile = selectedFile
    ? selectedFile.name.replace(/\.(hwp|hwpx)$/i, '')
    : '';

  return (
    <Modal open={open} onClose={handleClose} title="HWP 가져오기" size="md">
      <div className="flex flex-col gap-4">
        {isSaving && <p role="status" className="text-sm text-[var(--color-text-muted)]">문서를 저장하는 중입니다. 중복 저장을 막기 위해 확인과 닫기를 잠시 제한합니다.</p>}
        {saveError && <p role="alert" className="text-sm text-[var(--color-danger)]">{saveError}</p>}
        {saveError && result && (
          <textarea aria-label="저장 실패 복구 원문" readOnly value={result.content} className="w-full min-h-32 p-3 rounded border border-[var(--color-border)] text-sm" />
        )}
        {/* Drop zone - shown when no file is selected or after error */}
        {!isImporting && !result && (
          <div
            role="button"
            tabIndex={0}
            data-modal-initial-focus
            aria-label="HWP/HWPX 파일 선택"
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229 || e.repeat) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
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

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={handleClose} disabled={isSaving}>
                취소
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirm} disabled={isSaving || !!saveError}>
                확인
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
