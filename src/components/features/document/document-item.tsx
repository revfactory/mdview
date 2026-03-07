'use client';

import React, { useCallback } from 'react';
import { Star } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export interface DocumentItemProps {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: Date;
  isFavorite: boolean;
  isActive: boolean;
  onSelect: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export function DocumentItem({
  id,
  title,
  excerpt,
  updatedAt,
  isFavorite,
  isActive,
  onSelect,
  onToggleFavorite,
  onDelete,
  onDuplicate,
}: DocumentItemProps) {
  const handleClick = useCallback(() => {
    onSelect(id);
  }, [id, onSelect]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Simple context menu via prompt-style approach
      // In production, use a proper context menu component
      const action = window.prompt(
        `"${title}" 문서 작업:\n1: 즐겨찾기 토글\n2: 복제\n3: 삭제\n\n번호를 입력하세요:`
      );
      if (action === '1') onToggleFavorite?.(id);
      if (action === '2') onDuplicate?.(id);
      if (action === '3') {
        if (window.confirm(`"${title}" 문서를 삭제하시겠습니까?`)) {
          onDelete?.(id);
        }
      }
    },
    [id, title, onToggleFavorite, onDuplicate, onDelete]
  );

  const handleFavoriteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleFavorite?.(id);
    },
    [id, onToggleFavorite]
  );

  return (
    <div
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={`
        group flex flex-col gap-0.5 px-3 py-2 rounded-lg cursor-pointer
        transition-colors duration-100
        ${
          isActive
            ? 'bg-[var(--color-accent-light)]'
            : 'hover:bg-[var(--color-surface-hover)]'
        }
      `}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`flex-1 text-sm font-medium truncate ${
            isActive
              ? 'text-[var(--color-accent)]'
              : 'text-[var(--color-text)]'
          }`}
          style={{ fontSize: '14px', fontWeight: 500 }}
        >
          {title || '제목 없음'}
        </span>
        <button
          onClick={handleFavoriteClick}
          className={`
            shrink-0 w-5 h-5 flex items-center justify-center rounded
            transition-opacity
            ${
              isFavorite
                ? 'opacity-100 text-yellow-500'
                : 'opacity-0 group-hover:opacity-60 text-[var(--color-text-muted)]'
            }
          `}
        >
          <Star
            className="w-3.5 h-3.5"
            fill={isFavorite ? 'currentColor' : 'none'}
          />
        </button>
      </div>
      {excerpt && (
        <span
          className="text-[var(--color-text-muted)] truncate"
          style={{ fontSize: '13px', lineHeight: '1.3' }}
        >
          {excerpt}
        </span>
      )}
      <span
        className="text-[var(--color-text-muted)]"
        style={{ fontSize: '12px' }}
      >
        {formatDate(updatedAt)}
      </span>
    </div>
  );
}
