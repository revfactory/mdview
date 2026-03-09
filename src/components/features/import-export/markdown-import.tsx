'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, CheckCircle, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

interface MarkdownImportProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (content: string, title: string) => void;
}

export function MarkdownImport({ open, onClose, onImportComplete }: MarkdownImportProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setSelectedFile(null);
    setContent(null);
    setIsDragOver(false);
    setIsReading(false);
    setError(null);
    onClose();
  }, [onClose]);

  const processFile = useCallback(async (file: File) => {
    const validExts = /\.(md|markdown|txt|mdx)$/i;
    if (!validExts.test(file.name)) {
      setError('마크다운 파일(.md, .markdown, .txt, .mdx)만 지원합니다.');
      return;
    }

    setSelectedFile(file);
    setContent(null);
    setError(null);
    setIsReading(true);

    try {
      const text = await file.text();
      setContent(text);
    } catch {
      setError('파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      setIsReading(false);
    }
  }, []);

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
    if (!content || !selectedFile) return;
    const title = selectedFile.name.replace(/\.(md|markdown|txt|mdx)$/i, '');
    onImportComplete(content, title);
    handleClose();
  }, [content, selectedFile, onImportComplete, handleClose]);

  const titleFromFile = selectedFile
    ? selectedFile.name.replace(/\.(md|markdown|txt|mdx)$/i, '')
    : '';

  const fileSize = selectedFile
    ? selectedFile.size < 1024
      ? `${selectedFile.size} B`
      : selectedFile.size < 1024 * 1024
      ? `${(selectedFile.size / 1024).toFixed(1)} KB`
      : `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
    : '';

  return (
    <Modal open={open} onClose={handleClose} title="Markdown 가져오기" size="md">
      <div className="flex flex-col gap-4">
        {/* Drop zone */}
        {!isReading && !content && (
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
              accept=".md,.markdown,.txt,.mdx"
              onChange={handleFileChange}
              className="hidden"
            />
            {error ? (
              <>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-danger)]/10">
                  <X className="w-6 h-6 text-[var(--color-danger)]" />
                </div>
                <p className="text-sm font-medium text-[var(--color-danger)]">
                  파일 읽기 실패
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
                  마크다운 파일을 끌어다 놓으세요
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  .md, .markdown, .txt, .mdx 파일 지원
                </p>
              </>
            )}
          </div>
        )}

        {/* Reading indicator */}
        {isReading && selectedFile && (
          <div className="flex flex-col gap-3 p-4 rounded-xl bg-[var(--color-surface)]">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)] truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  파일을 읽는 중...
                </p>
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--color-accent)] animate-pulse w-full" />
            </div>
          </div>
        )}

        {/* Result */}
        {content && selectedFile && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20">
              <CheckCircle className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)]">
                  파일 준비 완료!
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  &ldquo;{titleFromFile}&rdquo; ({fileSize})
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] max-h-[120px] overflow-y-auto">
              <pre className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap break-words font-mono leading-relaxed">
                {content.slice(0, 500)}{content.length > 500 ? '...' : ''}
              </pre>
            </div>

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
