'use client';

import React, { useState, useCallback } from 'react';
import { FilePlus2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Sidebar } from '@/components/layout/sidebar';
import { Toolbar } from '@/components/layout/toolbar';
import { StatusBar } from '@/components/layout/status-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Editor } from '@/components/features/editor/editor';
import { HwpImport } from '@/components/features/import-export/hwp-import';
import { HwpExport } from '@/components/features/import-export/hwp-export';
import { ExportMenu } from '@/components/features/import-export/export-menu';
import { useEditorStore } from '@/stores/editor-store';
import { useEditorManager } from '@/hooks/use-editor';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import {
  createDocument,
  updateDocument,
  deleteDocument,
  updateContent,
} from '@/db/documents';
import type { Editor as TipTapEditor } from '@tiptap/react';

export default function Home() {
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const { actions } = useEditorStore();
  const [tiptapEditor, setTiptapEditor] = useState<TipTapEditor | null>(null);
  const [hwpImportOpen, setHwpImportOpen] = useState(false);
  const [hwpExportOpen, setHwpExportOpen] = useState(false);

  const { content, htmlContent, isLoading, onChange } =
    useEditorManager(activeDocumentId);

  const handleNewDocument = useCallback(async () => {
    const id = await createDocument({ title: '제목 없음' });
    actions.setActiveDocument(id);
  }, [actions]);

  const handleSelectDocument = useCallback(
    (id: string) => {
      actions.setActiveDocument(id);
    },
    [actions]
  );

  const handleToggleFavorite = useCallback(async (id: string) => {
    const { db } = await import('@/db');
    const doc = await db.documents.get(id);
    if (doc) {
      await updateDocument(id, { isFavorite: !doc.isFavorite });
    }
  }, []);

  const handleDeleteDocument = useCallback(
    async (id: string) => {
      await deleteDocument(id);
      if (activeDocumentId === id) {
        actions.setActiveDocument(null);
      }
    },
    [activeDocumentId, actions]
  );

  const handleDuplicateDocument = useCallback(
    async (id: string) => {
      const { db } = await import('@/db');
      const doc = await db.documents.get(id);
      if (doc) {
        const newId = await createDocument({
          title: `${doc.title} (복사본)`,
          content: doc.content,
          htmlContent: doc.htmlContent,
          folderId: doc.folderId,
          tags: [...doc.tags],
        });
        actions.setActiveDocument(newId);
      }
    },
    [actions]
  );

  const handleForceSave = useCallback(async () => {
    if (!activeDocumentId || !tiptapEditor) return;
    actions.setSaveStatus('saving');
    try {
      const html = tiptapEditor.getHTML();
      const { htmlToMarkdown } = await import('@/lib/markdown');
      const md = htmlToMarkdown(html);
      await updateContent(activeDocumentId, md, html);
      actions.setSaveStatus('saved');
    } catch {
      actions.setSaveStatus('error');
    }
  }, [activeDocumentId, tiptapEditor, actions]);

  const handleEditorReady = useCallback((editor: TipTapEditor | null) => {
    setTiptapEditor(editor ?? null);
  }, []);

  const handleImportComplete = useCallback(
    async (importedContent: string, title: string) => {
      const id = await createDocument({ title, content: importedContent });
      actions.setActiveDocument(id);
      setHwpImportOpen(false);
    },
    [actions]
  );

  useKeyboardShortcuts({
    onNewDocument: handleNewDocument,
    onForceSave: handleForceSave,
    onSearchFocus: () => {
      // Focus search input in sidebar - we'll use a DOM query as a simple approach
      const searchInput = document.querySelector(
        '[data-search-input]'
      ) as HTMLInputElement | null;
      searchInput?.focus();
    },
  });

  return (
    <AppShell
      sidebar={
        <Sidebar
          activeDocumentId={activeDocumentId}
          onNewDocument={handleNewDocument}
          onSelectDocument={handleSelectDocument}
          onToggleFavorite={handleToggleFavorite}
          onDeleteDocument={handleDeleteDocument}
          onDuplicateDocument={handleDuplicateDocument}
          onImport={() => setHwpImportOpen(true)}
        />
      }
    >
      <div className="flex flex-col h-screen">
        <div className="flex items-center">
          <Toolbar editor={tiptapEditor} onExport={() => setHwpExportOpen(true)} />
        </div>

        <div className="flex-1 overflow-auto">
          {activeDocumentId ? (
            isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-sm text-[var(--color-text-muted)]">
                  문서 로딩 중...
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto py-8 px-6">
                <Editor
                  content={htmlContent}
                  onChange={onChange}
                  onEditorReady={handleEditorReady}
                />
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                icon={FilePlus2}
                title="새 문서를 만들어보세요"
                subtitle="마크다운 문서를 작성하고 관리할 수 있습니다. 왼쪽 상단의 + 버튼을 눌러 시작하세요."
                actions={[
                  {
                    label: '새 문서 만들기',
                    onClick: handleNewDocument,
                    variant: 'primary',
                  },
                ]}
              />
            </div>
          )}
        </div>

        <StatusBar />
      </div>

      <HwpImport
        open={hwpImportOpen}
        onClose={() => setHwpImportOpen(false)}
        onImportComplete={handleImportComplete}
      />

      <HwpExport
        open={hwpExportOpen}
        onClose={() => setHwpExportOpen(false)}
        markdown={content}
        documentTitle={
          activeDocumentId ? '문서' : 'MDView'
        }
      />
    </AppShell>
  );
}
