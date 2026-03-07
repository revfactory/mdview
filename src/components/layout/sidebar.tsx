'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  FileText,
  Star,
  Clock,
  FolderPlus,
  Plus,
  Import,
  Settings,
  Sun,
  Moon,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder as FolderIcon,
} from 'lucide-react';
import { SearchInput } from '../ui/search-input';
import { Tooltip } from '../ui/tooltip';
import { DocumentList } from '@/components/features/document/document-list';
import {
  useDocuments,
  useFavorites,
  useRecentDocuments,
} from '@/hooks/use-documents';
import { useFolderTree, type FolderTreeNode } from '@/hooks/use-folders';
import { useUIStore } from '@/stores/ui-store';
import { createFolder } from '@/db/folders';

type ViewId = 'all' | 'favorites' | 'recent';

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
  depth = 0,
}: {
  node: FolderTreeNode;
  activeDocumentId: string | null;
  onSelectDocument?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onDeleteDocument?: (id: string) => void;
  onDuplicateDocument?: (id: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(node.isExpanded);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full px-2 py-1 rounded-md text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0" />
        )}
        {expanded ? (
          <FolderOpen className="w-4 h-4 shrink-0" style={{ color: node.color }} />
        ) : (
          <FolderIcon className="w-4 h-4 shrink-0" style={{ color: node.color }} />
        )}
        <span className="truncate flex-1 text-left">{node.name}</span>
        {node.documents.length > 0 && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {node.documents.length}
          </span>
        )}
      </button>
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

  const theme = useUIStore((s) => s.theme);
  const { setTheme } = useUIStore((s) => s.actions);

  const allDocuments = useDocuments();
  const favorites = useFavorites();
  const recentDocs = useRecentDocuments(20);
  const folderTree = useFolderTree();

  const isDark = theme === 'dark';

  const toggleTheme = useCallback(() => {
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark, setTheme]);

  const handleAddFolder = useCallback(async () => {
    const name = window.prompt('폴더 이름을 입력하세요:');
    if (name && name.trim()) {
      await createFolder({ name: name.trim() });
    }
  }, []);

  // Determine which documents to display based on active view
  const displayDocuments = useMemo(() => {
    let docs: typeof allDocuments;
    switch (activeView) {
      case 'favorites':
        docs = favorites;
        break;
      case 'recent':
        docs = recentDocs;
        break;
      default:
        docs = allDocuments;
    }

    if (!docs) return [];

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.excerpt.toLowerCase().includes(q)
      );
    }

    return docs;
  }, [activeView, allDocuments, favorites, recentDocs, searchQuery]);

  const smartViews = [
    { icon: FileText, label: '모든 문서', count: allDocuments?.length ?? 0, id: 'all' as ViewId },
    { icon: Star, label: '즐겨찾기', count: favorites?.length ?? 0, id: 'favorites' as ViewId },
    { icon: Clock, label: '최근', count: recentDocs?.length ?? 0, id: 'recent' as ViewId },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--color-sidebar)] select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[var(--color-accent)] flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm text-[var(--color-text)]">MDView</span>
        </div>
        <Tooltip content="새 문서" side="bottom">
          <button
            onClick={onNewDocument}
            className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* Search */}
      <div className="px-3 mb-2">
        <SearchInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="문서 검색... (Cmd+K)"
        />
      </div>

      {/* Smart Views */}
      <nav className="px-2 mb-1">
        {smartViews.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`
                flex items-center gap-2.5 w-full px-2.5 py-1.5
                rounded-lg text-sm transition-colors duration-100 cursor-pointer
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
      <div className="flex-1 overflow-y-auto px-2">
        {/* Folder Section */}
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            폴더
          </span>
          <Tooltip content="새 폴더" side="right">
            <button
              onClick={handleAddFolder}
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>

        {folderTree && folderTree.length > 0 ? (
          folderTree.map((node) => (
            <FolderTreeItem
              key={node.id}
              node={node}
              activeDocumentId={activeDocumentId}
              onSelectDocument={onSelectDocument}
              onToggleFavorite={onToggleFavorite}
              onDeleteDocument={onDeleteDocument}
              onDuplicateDocument={onDuplicateDocument}
            />
          ))
        ) : (
          <div className="px-2.5 py-2 text-xs text-[var(--color-text-muted)] text-center">
            아직 폴더가 없습니다
          </div>
        )}

        {/* Divider */}
        <div className="mx-1 my-2 h-px bg-[var(--color-border)]" />

        {/* Document List */}
        <div className="px-0.5 mb-2">
          <span className="px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            {activeView === 'all'
              ? '모든 문서'
              : activeView === 'favorites'
              ? '즐겨찾기'
              : '최근'}
          </span>
        </div>
        <DocumentList
          documents={displayDocuments}
          activeDocumentId={activeDocumentId}
          onSelect={onSelectDocument ?? (() => {})}
          onToggleFavorite={onToggleFavorite}
          onDelete={onDeleteDocument}
          onDuplicate={onDuplicateDocument}
        />
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--color-border)] px-2 py-2 flex items-center gap-1">
        <Tooltip content="임포트" side="top">
          <button
            onClick={onImport}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          >
            <Import className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="설정" side="top">
          <button
            onClick={onSettings}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </Tooltip>
        <div className="flex-1" />
        <Tooltip content={isDark ? '라이트 모드' : '다크 모드'} side="top">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
