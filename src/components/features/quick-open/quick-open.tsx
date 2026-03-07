'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, FileText, Clock } from 'lucide-react';
import { useDocuments } from '@/hooks/use-documents';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface QuickOpenProps {
  open: boolean;
  onClose: () => void;
  onSelectDocument: (id: string) => void;
}

export function QuickOpen({ open, onClose, onSelectDocument }: QuickOpenProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const documents = useDocuments();

  const filtered = (documents ?? []).filter((doc) =>
    doc.title.toLowerCase().includes(query.toLowerCase())
  );

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after render
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-quick-open-item]');
    items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelectDocument(id);
      onClose();
    },
    [onSelectDocument, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[selectedIndex]) {
            handleSelect(filtered[selectedIndex].id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered, selectedIndex, handleSelect, onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fade-in_150ms_ease-out]"
        onClick={onClose}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-lg mx-4 bg-[var(--color-bg)] rounded-xl shadow-2xl border border-[var(--color-border)] overflow-hidden will-change-transform animate-[scale-in_150ms_cubic-bezier(0.16,1,0.3,1)]"
        role="dialog"
        aria-modal="true"
        aria-label="빠른 문서 열기"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <Search className="w-5 h-5 text-[var(--color-text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="문서 이름으로 검색..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-placeholder)] outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)] bg-[var(--color-surface)] rounded border border-[var(--color-border)]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[320px] overflow-y-auto py-1"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
              {query ? '검색 결과가 없습니다' : '문서가 없습니다'}
            </div>
          ) : (
            filtered.map((doc, index) => (
              <button
                key={doc.id}
                data-quick-open-item
                onClick={() => handleSelect(doc.id)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-100 cursor-pointer
                  ${index === selectedIndex ? 'bg-[var(--color-accent-light)]' : 'hover:bg-[var(--color-surface-hover)]'}
                `}
              >
                <FileText className={`w-4 h-4 shrink-0 ${index === selectedIndex ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${index === selectedIndex ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-text)]'}`}>
                    {doc.title || '제목 없음'}
                  </div>
                  {doc.excerpt && (
                    <div className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                      {doc.excerpt}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>
                    {formatDistanceToNow(doc.updatedAt, {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
            <span><kbd className="px-1 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)]">↑↓</kbd> 탐색</span>
            <span><kbd className="px-1 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)]">Enter</kbd> 열기</span>
          </div>
        )}
      </div>
    </div>
  );
}
