'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { updateDocument } from '@/db/documents';
import { getDocument } from '@/db/documents';

interface DocumentTitleProps {
  documentId: string | null;
}

export function DocumentTitle({ documentId }: DocumentTitleProps) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!documentId) {
      setTitle('');
      return;
    }
    (async () => {
      const doc = await getDocument(documentId);
      if (doc) setTitle(doc.title || '');
    })();
  }, [documentId]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);

      if (!documentId) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        await updateDocument(documentId, { title: newTitle || '제목 없음' });
      }, 400);
    },
    [documentId]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move focus to editor
      const editor = document.querySelector('.tiptap') as HTMLElement;
      editor?.focus();
    }
  }, []);

  if (!documentId) return null;

  return (
    <input
      ref={inputRef}
      type="text"
      value={title}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="제목 없음"
      className="
        w-full text-[28px] font-bold leading-tight tracking-tight
        bg-transparent border-none outline-none
        text-[var(--color-text)]
        placeholder:text-[var(--color-text-placeholder)]
        mb-3
      "
    />
  );
}
