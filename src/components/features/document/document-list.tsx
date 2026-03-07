'use client';

import React from 'react';
import type { Document } from '@/types';
import { DocumentItem } from './document-item';

export interface DocumentListProps {
  documents: Document[];
  activeDocumentId: string | null;
  onSelect: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export function DocumentList({
  documents,
  activeDocumentId,
  onSelect,
  onToggleFavorite,
  onDelete,
  onDuplicate,
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-[var(--color-text-muted)]">
        문서가 없습니다
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {documents.map((doc) => (
        <DocumentItem
          key={doc.id}
          id={doc.id}
          title={doc.title}
          excerpt={doc.excerpt}
          updatedAt={doc.updatedAt}
          isFavorite={doc.isFavorite}
          isActive={activeDocumentId === doc.id}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      ))}
    </div>
  );
}
