'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  FileText,
  Clock,
  FolderPlus,
  Plus,
  Import,
  Info,
  Sun,
  Moon,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder as FolderIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileCode,
} from 'lucide-react';
import { SearchInput } from '../ui/search-input';
import { Tooltip } from '../ui/tooltip';
import { DocumentList } from '@/components/features/document/document-list';
import {
  useDocuments,
  useRecentDocuments,
} from '@/hooks/use-documents';
import { useFolderTree, type FolderTreeNode } from '@/hooks/use-folders';
import { useUIStore } from '@/stores/ui-store';
import { createFolder, updateFolder, deleteFolder } from '@/db/folders';
import { updateDocument, createDocument } from '@/db/documents';
import { markdownToHtml } from '@/lib/markdown';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { PromptDialog, ConfirmDialog, AlertDialog } from '@/components/ui/dialog';
import { analytics } from '@/lib/analytics';

type ViewId = 'all' | 'recent';

export interface SidebarProps {
  activeDocumentId: string | null;
  onNewDocument?: () => void;
  onSelectDocument?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onDeleteDocument?: (id: string) => void;
  onDuplicateDocument?: (id: string) => void;
  onImport?: () => void;
  onSettings?: () => void;
}

function FolderTreeItem({
  node,
  activeDocumentId,
  onSelectDocument,
  onToggleFavorite,
  onDeleteDocument,
  onDuplicateDocument,
  onDropDocument,
  onRenameFolder,
  onDeleteFolder,
  depth = 0,
}: {
  node: FolderTreeNode;
  activeDocumentId: string | null;
  onSelectDocument?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onDeleteDocument?: (id: string) => void;
  onDuplicateDocument?: (id: string) => void;
  onDropDocument?: (docId: string, folderId: string) => void;
  onRenameFolder?: (id: string, currentName: string) => void;
  onDeleteFolder?: (id: string, name: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(node.isExpanded);
  const [dragOver, setDragOver] = useState(false);

  const folderMenuItems = useMemo<DropdownMenuItem[]>(() => [
    {
      label: '이름 변경',
      icon: Pencil,
      onClick: () => onRenameFolder?.(node.id, node.name),
    },
    {
      label: '',
      onClick: () => {},
      divider: true,
    },
    {
      label: '삭제',
      icon: Trash2,
      onClick: () => onDeleteFolder?.(node.id, node.name),
      danger: true,
    },
  ], [node.id, node.name, onRenameFolder, onDeleteFolder]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-doc-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const docId = e.dataTransfer.getData('application/x-doc-id');
      if (docId && onDropDocument) {
        onDropDocument(docId, node.id);
      }
    },
    [node.id, onDropDocument]
  );

  return (
    <div className="group/folder">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex items-center gap-1.5 w-full px-2 py-1 rounded-md text-sm
          transition-colors
          ${
            dragOver
              ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }
        `}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0" />
          )}
          {expanded ? (
            <FolderOpen className="w-4 h-4 shrink-0" style={{ color: dragOver ? undefined : node.color }} />
          ) : (
            <FolderIcon className="w-4 h-4 shrink-0" style={{ color: dragOver ? undefined : node.color }} />
          )}
          <span className="truncate flex-1 text-left">{node.name}</span>
          {node.documents.length > 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {node.documents.length}
            </span>
          )}
        </button>
        <div className="shrink-0 opacity-0 group-hover/folder:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu
            trigger={
              <button
                aria-label="폴더 메뉴"
                className="flex items-center justify-center w-5 h-5 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            }
            items={folderMenuItems}
            align="end"
          />
        </div>
      </div>
      {expanded && (
        <div>
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              activeDocumentId={activeDocumentId}
              onSelectDocument={onSelectDocument}
              onToggleFavorite={onToggleFavorite}
              onDeleteDocument={onDeleteDocument}
              onDuplicateDocument={onDuplicateDocument}
              onDropDocument={onDropDocument}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              depth={depth + 1}
            />
          ))}
          {node.documents.length > 0 && (
            <div style={{ paddingLeft: `${depth * 16}px` }}>
              <DocumentList
                documents={node.documents}
                activeDocumentId={activeDocumentId}
                onSelect={onSelectDocument ?? (() => {})}
                onToggleFavorite={onToggleFavorite}
                onDelete={onDeleteDocument}
                onDuplicate={onDuplicateDocument}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  activeDocumentId,
  onNewDocument,
  onSelectDocument,
  onToggleFavorite,
  onDeleteDocument,
  onDuplicateDocument,
  onImport,
  onSettings,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<ViewId>('all');
  const [folderPromptOpen, setFolderPromptOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const theme = useUIStore((s) => s.theme);
  const { setTheme } = useUIStore((s) => s.actions);

  const allDocuments = useDocuments();
  const recentDocs = useRecentDocuments(20);
  const folderTree = useFolderTree();

  const isDark = theme === 'dark';

  const hasFolders = folderTree && folderTree.length > 0;

  const toggleTheme = useCallback(() => {
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    analytics.themeToggle(newTheme);
  }, [isDark, setTheme]);

  const handleImportMarkdown = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const title = file.name.replace(/\.(md|markdown|txt)$/i, '');
      const htmlContent = markdownToHtml(text);
      const id = await createDocument({ title, content: text, htmlContent });
      onSelectDocument?.(id);
      analytics.importMarkdown();
    };
    input.click();
  }, [onSelectDocument]);

  const handleAddFolder = useCallback(() => {
    setFolderPromptOpen(true);
  }, []);

  const handleFolderCreate = useCallback(async (name: string) => {
    await createFolder({ name });
    analytics.folderCreate();
  }, []);

  const handleRenameFolder = useCallback((id: string, currentName: string) => {
    setRenameTarget({ id, name: currentName });
  }, []);

  const handleRenameFolderConfirm = useCallback(async (newName: string) => {
    if (renameTarget) {
      await updateFolder(renameTarget.id, { name: newName });
    }
  }, [renameTarget]);

  const handleDeleteFolder = useCallback((id: string, name: string) => {
    setDeleteTarget({ id, name });
  }, []);

  const handleDeleteFolderConfirm = useCallback(async () => {
    if (deleteTarget) {
      await deleteFolder(deleteTarget.id);
      analytics.folderDelete();
    }
  }, [deleteTarget]);

  const handleDropToFolder = useCallback(async (docId: string, folderId: string) => {
    await updateDocument(docId, { folderId });
  }, []);

  const handleDropToRoot = useCallback(
    async (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes('application/x-doc-id')) return;
      e.preventDefault();
      const docId = e.dataTransfer.getData('application/x-doc-id');
      if (docId) {
        await updateDocument(docId, { folderId: null });
      }
    },
    []
  );

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-doc-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  }, []);

  // Determine which documents to display based on active view
  const displayDocuments = useMemo(() => {
    let docs: typeof allDocuments;
    switch (activeView) {
      case 'recent':
        docs = recentDocs;
        break;
      default:
        docs = allDocuments;
    }

    if (!docs) return [];

    // Filter out documents that belong to a folder (show only root docs)
    let filtered = hasFolders
      ? docs.filter((d) => !d.folderId)
      : docs;

    // Apply search filter - search across ALL docs including folder docs
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      // When searching, show all matching docs regardless of folder
      filtered = (docs).filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.excerpt.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [activeView, allDocuments, recentDocs, searchQuery, hasFolders]);

  const smartViews = [
    { icon: FileText, label: '모든 문서', count: allDocuments?.length ?? 0, id: 'all' as ViewId },
    { icon: Clock, label: '최근', count: recentDocs?.length ?? 0, id: 'recent' as ViewId },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--color-sidebar)] select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 shrink-0">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="MDView" className="w-6 h-6 rounded-md" />
          <span className="font-semibold text-sm text-[var(--color-text)]">MDView</span>
        </div>
        <Tooltip content="새 문서" side="bottom">
          <button
            onClick={onNewDocument}
            aria-label="새 문서"
            className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-all duration-150 cursor-pointer active:scale-90"
          >
            <Plus className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* Import Buttons */}
      <div className="px-3 mb-2 flex gap-2">
        <button
          onClick={handleImportMarkdown}
          className="flex items-center justify-center gap-1.5 flex-1 h-8 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer text-xs font-medium"
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Markdown</span>
        </button>
        <button
          onClick={onImport}
          className="flex items-center justify-center gap-1.5 flex-1 h-8 rounded-lg bg-[var(--color-accent-light)] text-[var(--color-accent)] hover:opacity-80 transition-opacity cursor-pointer text-xs font-medium"
        >
          <Import className="w-3.5 h-3.5" />
          <span>HWP</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 mb-2">
        <SearchInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="검색..."
        />
      </div>

      {/* Smart Views */}
      <nav className="px-3 mb-1 flex flex-col gap-0.5">
        {smartViews.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`
                flex items-center gap-2.5 w-full px-3 py-2
                rounded-lg text-[13px] transition-all duration-150 cursor-pointer
                active:scale-[0.98]
                ${
                  isActive
                    ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)] font-medium'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }
              `}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {typeof item.count === 'number' && (
                <span className="text-xs text-[var(--color-text-muted)]">{item.count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 my-2 h-px bg-[var(--color-border)]" />

      {/* Document List / Folder Tree */}
      <div className="flex-1 overflow-y-auto px-3">
        {/* Folder Section - only show if folders exist */}
        {hasFolders && (
          <>
            <div className="flex items-center justify-between px-2.5 py-1">
              <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                폴더
              </span>
              <Tooltip content="새 폴더" side="bottom">
                <button
                  onClick={handleAddFolder}
                  aria-label="새 폴더"
                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] transition-colors cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </div>
            {folderTree!.map((node) => (
              <FolderTreeItem
                key={node.id}
                node={node}
                activeDocumentId={activeDocumentId}
                onSelectDocument={onSelectDocument}
                onToggleFavorite={onToggleFavorite}
                onDeleteDocument={onDeleteDocument}
                onDuplicateDocument={onDuplicateDocument}
                onDropDocument={handleDropToFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
              />
            ))}
            <div className="mx-1 my-1.5 h-px bg-[var(--color-border)]" />
          </>
        )}

        {/* Document List (root - no folder) */}
        <div
          onDragOver={handleRootDragOver}
          onDrop={handleDropToRoot}
          className="flex-1 min-h-[200px]"
        >
          <DocumentList
            documents={displayDocuments}
            activeDocumentId={activeDocumentId}
            onSelect={onSelectDocument ?? (() => {})}
            onToggleFavorite={onToggleFavorite}
            onDelete={onDeleteDocument}
            onDuplicate={onDuplicateDocument}
          />
        </div>

        {/* Add folder button when no folders exist */}
        {!hasFolders && (
          <button
            onClick={handleAddFolder}
            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 mt-1 rounded-lg text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>폴더 추가</span>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--color-border)] px-2 py-2 flex items-center gap-1">
        <Tooltip content="정보" side="top">
          <button
            onClick={() => setInfoOpen(true)}
            aria-label="정보"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-all duration-150 cursor-pointer active:scale-90"
          >
            <Info className="w-4 h-4" />
          </button>
        </Tooltip>
        <div className="flex-1" />
        <Tooltip content={isDark ? '라이트 모드' : '다크 모드'} side="top">
          <button
            onClick={toggleTheme}
            aria-label={isDark ? '라이트 모드' : '다크 모드'}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-all duration-150 cursor-pointer active:scale-90"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </Tooltip>
      </div>

      <PromptDialog
        open={folderPromptOpen}
        onClose={() => setFolderPromptOpen(false)}
        onConfirm={handleFolderCreate}
        title="새 폴더"
        placeholder="폴더 이름을 입력하세요"
        confirmLabel="만들기"
      />

      <PromptDialog
        open={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        onConfirm={handleRenameFolderConfirm}
        title="폴더 이름 변경"
        placeholder="새 이름을 입력하세요"
        defaultValue={renameTarget?.name ?? ''}
        confirmLabel="변경"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteFolderConfirm}
        title="폴더 삭제"
        message={`"${deleteTarget?.name ?? ''}" 폴더를 삭제하시겠습니까? 폴더 안의 문서는 루트로 이동됩니다.`}
        confirmLabel="삭제"
        danger
      />

      <AlertDialog open={infoOpen} onClose={() => setInfoOpen(false)} title="MDView">
        <div className="flex flex-col gap-4">
          {/* App info */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="MDView" className="w-10 h-10 rounded-xl shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">마크다운 에디터</p>
              <p className="text-xs text-[var(--color-text-muted)]">v0.1.0 (Beta)</p>
            </div>
          </div>

          {/* Privacy notice */}
          <div className="rounded-lg bg-[var(--color-surface)] px-3 py-2.5">
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              🔒 모든 문서는 서버에 전송되지 않으며, 개인 브라우저(IndexedDB)에만 저장됩니다.
            </p>
          </div>

          {/* Author */}
          <div className="rounded-lg border border-[var(--color-border)] px-3 py-3">
            <p className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">제작자</p>
            <p className="text-sm font-medium text-[var(--color-text)] mb-2">황민호</p>
            <div className="flex flex-col gap-1.5 text-xs">
              <a href="mailto:revfactory@gmail.com" className="text-[var(--color-accent)] hover:underline">revfactory@gmail.com</a>
              <div className="flex gap-3">
                <a href="https://www.facebook.com/rev.minho/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">Facebook</a>
                <a href="https://www.linkedin.com/in/hwang-minho/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">LinkedIn</a>
              </div>
            </div>
          </div>
        </div>
      </AlertDialog>
    </div>
  );
}
