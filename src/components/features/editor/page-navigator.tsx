'use client';

import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PageNavigatorProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function PageNavigator({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}: PageNavigatorProps) {
  const [jumpInput, setJumpInput] = useState('');
  const [showJump, setShowJump] = useState(false);

  const handlePrev = useCallback(() => {
    if (currentPage > 0) onPageChange(currentPage - 1);
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages - 1) onPageChange(currentPage + 1);
  }, [currentPage, totalPages, onPageChange]);

  const handleJump = useCallback(() => {
    const page = parseInt(jumpInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page - 1);
      setShowJump(false);
      setJumpInput('');
    }
  }, [jumpInput, totalPages, onPageChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleJump();
      if (e.key === 'Escape') {
        setShowJump(false);
        setJumpInput('');
      }
    },
    [handleJump]
  );

  return (
    <div className="page-navigator flex items-center gap-1 px-3 py-1.5 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] select-none">
      <button
        onClick={handlePrev}
        disabled={disabled || currentPage === 0}
        className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="이전 페이지 (Ctrl+PageUp)"
      >
        <ChevronLeft size={16} />
      </button>

      <button
        onClick={() => setShowJump(!showJump)}
        className="px-2 py-0.5 text-xs font-medium rounded hover:bg-[var(--color-bg-tertiary)] transition-colors min-w-[80px] text-center"
        title="페이지 이동"
      >
        {currentPage + 1} / {totalPages} 페이지
      </button>

      <button
        onClick={handleNext}
        disabled={disabled || currentPage >= totalPages - 1}
        className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="다음 페이지 (Ctrl+PageDown)"
      >
        <ChevronRight size={16} />
      </button>

      {showJump && (
        <div className="flex items-center gap-1 ml-2">
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="페이지"
            className="w-16 px-1.5 py-0.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            autoFocus
          />
          <button
            onClick={handleJump}
            className="px-2 py-0.5 text-xs rounded bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
          >
            이동
          </button>
        </div>
      )}
    </div>
  );
}
