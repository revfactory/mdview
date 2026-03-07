'use client';

import React, { useState, useCallback } from 'react';
import { FileDown, CheckCircle } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useHwpExport } from '@/hooks/use-hwp';
import type { HwpExportOptions } from '@/types/hwp';

interface HwpExportProps {
  open: boolean;
  onClose: () => void;
  markdown: string;
  documentTitle: string;
}

type PaperSize = 'A4' | 'Letter' | 'B5';
type FontFamily = '맑은 고딕' | '바탕' | '돋움';
type MarginPreset = 'default' | 'narrow' | 'wide';

const PAPER_OPTIONS: { label: string; value: PaperSize }[] = [
  { label: 'A4', value: 'A4' },
  { label: 'Letter', value: 'Letter' },
  { label: 'B5', value: 'B5' },
];

const FONT_OPTIONS: { label: string; value: FontFamily }[] = [
  { label: '맑은 고딕', value: '맑은 고딕' },
  { label: '바탕', value: '바탕' },
  { label: '돋움', value: '돋움' },
];

const MARGIN_PRESETS: Record<MarginPreset, { label: string; top: number; bottom: number; left: number; right: number }> = {
  default: { label: '기본', top: 20, bottom: 20, left: 20, right: 20 },
  narrow:  { label: '좁게', top: 12, bottom: 12, left: 12, right: 12 },
  wide:    { label: '넓게', top: 30, bottom: 30, left: 30, right: 30 },
};

export function HwpExport({ open, onClose, markdown, documentTitle }: HwpExportProps) {
  const { exportDocument, progress, progressMessage, isExporting, error, reset } = useHwpExport();

  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [fontFamily, setFontFamily] = useState<FontFamily>('맑은 고딕');
  const [marginPreset, setMarginPreset] = useState<MarginPreset>('default');
  const [done, setDone] = useState(false);

  const handleClose = useCallback(() => {
    if (isExporting) return;
    setDone(false);
    reset();
    onClose();
  }, [isExporting, reset, onClose]);

  const handleExport = useCallback(async () => {
    setDone(false);
    reset();

    const margin = MARGIN_PRESETS[marginPreset];
    const options: Partial<HwpExportOptions> = {
      paperSize,
      fontFamily,
      marginTop: margin.top,
      marginBottom: margin.bottom,
      marginLeft: margin.left,
      marginRight: margin.right,
    };

    try {
      await exportDocument(markdown, documentTitle || '문서', options);
      setDone(true);
    } catch {
      // error is set in the hook
    }
  }, [exportDocument, markdown, documentTitle, paperSize, fontFamily, marginPreset, reset]);

  return (
    <Modal open={open} onClose={handleClose} title="HWP 내보내기" size="md">
      <div className="flex flex-col gap-5">
        {/* Options */}
        {!isExporting && !done && (
          <>
            {/* Paper size */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                용지 크기
              </label>
              <div className="flex gap-2">
                {PAPER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPaperSize(opt.value)}
                    className={`
                      flex-1 h-9 rounded-lg text-sm font-medium
                      border transition-colors cursor-pointer
                      ${
                        paperSize === opt.value
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                      }
                    `}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font family */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                글꼴
              </label>
              <div className="flex gap-2">
                {FONT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFontFamily(opt.value)}
                    className={`
                      flex-1 h-9 rounded-lg text-sm font-medium
                      border transition-colors cursor-pointer
                      ${
                        fontFamily === opt.value
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                      }
                    `}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Margin preset */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                여백
              </label>
              <div className="flex gap-2">
                {(Object.keys(MARGIN_PRESETS) as MarginPreset[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setMarginPreset(key)}
                    className={`
                      flex-1 h-9 rounded-lg text-sm font-medium
                      border transition-colors cursor-pointer
                      ${
                        marginPreset === key
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                      }
                    `}
                  >
                    {MARGIN_PRESETS[key].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-[var(--color-danger)]/5 border border-[var(--color-danger)]/20">
                <p className="text-xs text-[var(--color-danger)]">{error}</p>
              </div>
            )}

            {/* Export button */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={handleClose}>
                취소
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={FileDown}
                onClick={handleExport}
                disabled={!markdown}
              >
                내보내기
              </Button>
            </div>
          </>
        )}

        {/* Progress */}
        {isExporting && (
          <div className="flex flex-col gap-3 p-4 rounded-xl bg-[var(--color-surface)]">
            <div className="flex items-center gap-3">
              <FileDown className="w-5 h-5 text-[var(--color-accent)] shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)]">
                  HWPX 파일 생성 중
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {progressMessage || '준비 중...'}
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

        {/* Done */}
        {done && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20">
              <CheckCircle className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  내보내기 완료!
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  파일이 다운로드되었습니다.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={handleClose}>
                닫기
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
