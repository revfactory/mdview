'use client';

import React from 'react';
import { Check, Cloud, Loader2, AlertCircle } from 'lucide-react';
import { useEditorStore } from '@/stores/editor-store';
import { useUIStore } from '@/stores/ui-store';

export type SaveStatus = 'saved' | 'saving' | 'idle' | 'error';

const statusConfig: Record<SaveStatus, { icon: React.ElementType; text: string; color: string }> = {
  saved: { icon: Cloud, text: '저장됨', color: 'text-[var(--color-success)]' },
  saving: { icon: Loader2, text: '저장 중...', color: 'text-[var(--color-text-muted)]' },
  idle: { icon: Check, text: '준비', color: 'text-[var(--color-text-muted)]' },
  error: { icon: AlertCircle, text: '저장 오류', color: 'text-[var(--color-danger)]' },
};

export function StatusBar() {
  const charCount = useEditorStore((s) => s.charCount);
  const wordCount = useEditorStore((s) => s.wordCount);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const cursorPosition = useEditorStore((s) => s.cursorPosition);
  const isMobile = useUIStore((s) => s.isMobile);

  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  const status = statusConfig[saveStatus] || statusConfig.idle;
  const StatusIcon = status.icon;

  return (
    <div data-statusbar className="flex items-center justify-between h-7 px-3 sm:px-4 bg-[var(--color-surface)] border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] shrink-0 select-none">
      {/* Left: Stats */}
      <div className="flex items-center gap-2 sm:gap-3">
        <span>{charCount.toLocaleString()} 글자</span>
        {!isMobile && (
          <>
            <span className="w-px h-3 bg-[var(--color-border)]" />
            <span>{wordCount.toLocaleString()} 단어</span>
            <span className="w-px h-3 bg-[var(--color-border)]" />
            <span>{readingTime}분 읽기</span>
          </>
        )}
      </div>

      {/* Right: Save status + Cursor position */}
      <div className="flex items-center gap-2 sm:gap-3">
        <span className={`flex items-center gap-1 ${status.color}`}>
          <StatusIcon className={`w-3 h-3 ${saveStatus === 'saving' ? 'animate-spin' : ''}`} />
          <span>{status.text}</span>
        </span>
        {!isMobile && (
          <>
            <span className="w-px h-3 bg-[var(--color-border)]" />
            <span>
              {cursorPosition.line}:{cursorPosition.col}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
