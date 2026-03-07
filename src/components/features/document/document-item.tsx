'use client';

import React, { useCallback, useMemo } from 'react';
import { Pin, Star, Copy, Trash2, MoreHorizontal } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';

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

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('application/x-doc-id', id);
      e.dataTransfer.effectAllowed = 'move';
    },
    [id]
  );

  const menuItems = useMemo<DropdownMenuItem[]>(() => {
    const items: DropdownMenuItem[] = [];

    if (onToggleFavorite) {
      items.push({
        label: isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가',
        icon: Star,
        onClick: () => onToggleFavorite(id),
      });
    }

    if (onDuplicate) {
      items.push({
        label: '복제',
        icon: Copy,
        onClick: () => onDuplicate(id),
      });
    }

    if (onDelete) {
      items.push({
        label: '',
        onClick: () => {},
        divider: true,
      });
      items.push({
        label: '삭제',
        icon: Trash2,
        onClick: () => onDelete(id),
        danger: true,
      });
    }

    return items;
  }, [id, isFavorite, onToggleFavorite, onDuplicate, onDelete]);

  return (
    <div
      onClick={handleClick}
      draggable
      onDragStart={handleDragStart}
      className={`
        group flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer
        transition-all duration-150 border-l-2
        active:scale-[0.98]
        ${
          isActive
            ? 'bg-[var(--color-accent-light)] border-l-[var(--color-accent)]'
            : 'hover:bg-[var(--color-surface-hover)] border-l-transparent'
        }
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {isFavorite && (
            <Pin className="w-3 h-3 shrink-0 text-[var(--color-accent)] -rotate-45" fill="currentColor" />
          )}
          <span
            className={`flex-1 truncate text-[13px] font-medium ${
              isActive
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-text)]'
            }`}
          >
            {title || '제목 없음'}
          </span>
          <span className="shrink-0 text-[11px] text-[var(--color-text-placeholder)]">
            {formatDate(updatedAt)}
          </span>
        </div>
        {excerpt && (
          <p className="text-[12px] leading-snug text-[var(--color-text-muted)] truncate mt-0.5">
            {excerpt}
          </p>
        )}
      </div>
      <div className="flex items-center shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu
          trigger={
            <button
              aria-label="메뉴"
              className="flex items-center justify-center w-5 h-5 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          }
          items={menuItems}
          align="end"
        />
      </div>
    </div>
  );
}
