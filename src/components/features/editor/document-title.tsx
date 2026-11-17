'use client';

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { getDocument, updateDocument } from '@/db/documents';
import { useToastStore } from '@/stores/toast-store';

interface DocumentTitleProps {
  documentId: string | null;
}

export function DocumentTitle({ documentId }: DocumentTitleProps) {
  const [loadedTitle, setLoadedTitle] = useState<{ id: string; title: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentDocumentId = useRef(documentId);
  const saveRevision = useRef(0);
  const ready = loadedTitle?.id === documentId;

  useLayoutEffect(() => {
    currentDocumentId.current = documentId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset the externally selected title before paint, including A → B → A while B is still loading.
    setLoadedTitle(null);
    return () => { currentDocumentId.current = null; };
  }, [documentId]);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    (async () => {
      try {
        const doc = await getDocument(documentId);
        if (!cancelled && doc) setLoadedTitle({ id: documentId, title: doc.title || '' });
      } catch (error) {
        console.error('Failed to load document title:', error);
        if (!cancelled) useToastStore.getState().actions.addToast('문서 제목을 불러오지 못했습니다. 문서를 다시 선택해주세요.', 'error');
      }
    })();
    return () => { cancelled = true; };
  }, [documentId]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!documentId || !ready || currentDocumentId.current !== documentId) return;
      const newTitle = e.target.value;
      setLoadedTitle({ id: documentId, title: newTitle });
      const revision = ++saveRevision.current;
      // Start the IndexedDB transaction during input. A component-owned debounce
      // loses the title when switching documents or editor views unmounts it.
      // Title completion must not replace the independent body-save status.
      void updateDocument(documentId, { title: newTitle || '제목 없음' }).catch(error => {
        console.error('Failed to save document title:', error);
        if (revision === saveRevision.current) {
          useToastStore.getState().actions.addToast('문서 제목을 저장하지 못했습니다. 제목을 다시 입력해주세요.', 'error');
        }
      });
    },
    [documentId, ready]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // IME confirmation is text input, including Safari's final keyCode 229 event.
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
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
      value={ready ? loadedTitle.title : ''}
      disabled={!ready}
      aria-label="문서 제목"
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
