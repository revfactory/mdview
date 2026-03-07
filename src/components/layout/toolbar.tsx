'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Table,
  CodeSquare,
  Eye,
  SplitSquareVertical,
  PenLine,
  PanelRight,
  Download,
  ChevronDown,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Quote,
  Menu,
} from 'lucide-react';
import { Tooltip } from '../ui/tooltip';
import { useUIStore } from '@/stores/ui-store';
import { htmlToMarkdown } from '@/lib/markdown';
import type { Editor as TipTapEditor } from '@tiptap/react';
import { analytics } from '@/lib/analytics';

interface ToolbarButtonProps {
  icon: React.ElementType;
  tooltip: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

function ToolbarButton({ icon: Icon, tooltip, active, onClick, disabled }: ToolbarButtonProps) {
  return (
    <Tooltip content={tooltip} side="bottom">
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip}
        className={`
          flex items-center justify-center w-8 h-8
          rounded-md transition-all duration-100 cursor-pointer
          active:scale-95
          disabled:opacity-40 disabled:cursor-not-allowed
          ${
            active
              ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }
        `}
      >
        <Icon className="w-4 h-4" />
      </button>
    </Tooltip>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-[var(--color-border)] mx-1.5" />;
}

function getActiveBlockLabel(editor: TipTapEditor | null): string {
  if (!editor) return '본문';
  if (editor.isActive('heading', { level: 1 })) return '제목 1';
  if (editor.isActive('heading', { level: 2 })) return '제목 2';
  if (editor.isActive('heading', { level: 3 })) return '제목 3';
  return '본문';
}

export interface ToolbarProps {
  editor?: TipTapEditor | null;
  onExport?: () => void;
  onToggleToc?: () => void;
  documentTitle?: string;
}

export function Toolbar({ editor = null, onExport, onToggleToc, documentTitle }: ToolbarProps) {
  const viewMode = useUIStore((s) => s.viewMode);
  const isMobile = useUIStore((s) => s.isMobile);
  const { setViewMode, toggleSidebar } = useUIStore((s) => s.actions);
  const blockLabel = getActiveBlockLabel(editor);
  const noEditor = !editor;

  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const blockTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!blockMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        blockMenuRef.current && !blockMenuRef.current.contains(e.target as Node) &&
        blockTriggerRef.current && !blockTriggerRef.current.contains(e.target as Node)
      ) {
        setBlockMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [blockMenuOpen]);

  const openBlockMenu = useCallback(() => {
    if (blockTriggerRef.current) {
      const rect = blockTriggerRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
    setBlockMenuOpen((v) => !v);
  }, []);

  const blockTypes = [
    { label: '본문', icon: Pilcrow, action: () => editor?.chain().focus().setParagraph().run() },
    { label: '제목 1', icon: Heading1, action: () => editor?.chain().focus().setHeading({ level: 1 }).run() },
    { label: '제목 2', icon: Heading2, action: () => editor?.chain().focus().setHeading({ level: 2 }).run() },
    { label: '제목 3', icon: Heading3, action: () => editor?.chain().focus().setHeading({ level: 3 }).run() },
  ];

  const handleBlockSelect = useCallback((action: () => void) => {
    action();
    setBlockMenuOpen(false);
  }, []);

  const handleExportMarkdown = useCallback(() => {
    if (!editor) return;
    const markdown = htmlToMarkdown(editor.getHTML());
    const safeName = (documentTitle || '문서').replace(/[<>:"/\\|?*]/g, '_');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.md`;
    a.click();
    URL.revokeObjectURL(url);
    analytics.exportMarkdown();
  }, [editor, documentTitle]);

  return (
    <div data-toolbar className="flex items-center h-11 px-2 sm:px-3 gap-0.5 border-b border-[var(--color-border)] bg-[var(--color-bg)] shrink-0 relative z-20">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        aria-label="사이드바 토글"
        className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
      >
        <Menu className="w-4 h-4" />
      </button>
      <Divider />

      {/* Block Type Selector */}
      <div className="relative">
        <button
          ref={blockTriggerRef}
          onMouseDown={(e) => e.preventDefault()}
          onClick={openBlockMenu}
          disabled={noEditor}
          aria-label={`블록 타입: ${blockLabel}`}
          className="flex items-center gap-1 h-8 px-2.5 rounded-md text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Heading className="w-4 h-4" />
          <span className="text-xs">{blockLabel}</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        {blockMenuOpen && createPortal(
          <div
            ref={blockMenuRef}
            className="fixed z-[9999] min-w-[160px] p-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-lg animate-[scale-in_150ms_ease-out] origin-top"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {blockTypes.map((bt) => {
              const BtIcon = bt.icon;
              const isActive = blockLabel === bt.label;
              return (
                <button
                  key={bt.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleBlockSelect(bt.action)}
                  className={`
                    flex w-full items-center gap-2.5 px-3 py-2
                    rounded-lg text-sm font-normal
                    transition-colors duration-100 cursor-pointer
                    ${isActive
                      ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                      : 'text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                    }
                  `}
                >
                  <BtIcon className="w-4 h-4 shrink-0" />
                  <span>{bt.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
      </div>

      <Divider />

      {/* Format Group */}
      <ToolbarButton
        icon={Bold}
        tooltip="굵게 (Cmd+B)"
        active={editor?.isActive('bold')}
        disabled={noEditor}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={Italic}
        tooltip="기울임 (Cmd+I)"
        active={editor?.isActive('italic')}
        disabled={noEditor}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      {!isMobile && (
        <>
          <ToolbarButton
            icon={Underline}
            tooltip="밑줄 (Cmd+U)"
            active={editor?.isActive('underline')}
            disabled={noEditor}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            icon={Strikethrough}
            tooltip="취소선"
            active={editor?.isActive('strike')}
            disabled={noEditor}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          />
          <ToolbarButton
            icon={Code}
            tooltip="인라인 코드"
            active={editor?.isActive('code')}
            disabled={noEditor}
            onClick={() => editor?.chain().focus().toggleCode().run()}
          />
        </>
      )}

      <Divider />

      {/* List Group */}
      <ToolbarButton
        icon={ListOrdered}
        tooltip="순서 목록"
        active={editor?.isActive('orderedList')}
        disabled={noEditor}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={List}
        tooltip="비순서 목록"
        active={editor?.isActive('bulletList')}
        disabled={noEditor}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      />

      {!isMobile && (
        <>
          <Divider />

          {/* Insert Group */}
          <ToolbarButton
            icon={Table}
            tooltip="표 삽입"
            disabled={noEditor}
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          />
          <ToolbarButton
            icon={CodeSquare}
            tooltip="코드 블록"
            active={editor?.isActive('codeBlock')}
            disabled={noEditor}
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          />
          <ToolbarButton
            icon={Quote}
            tooltip="인용"
            active={editor?.isActive('blockquote')}
            disabled={noEditor}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          />
        </>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-0.5 shrink-0">
        <ToolbarButton icon={Download} tooltip="마크다운 내보내기" disabled={noEditor} onClick={handleExportMarkdown} />

        <Divider />

        {/* View Mode - segment control */}
        <div className="flex items-center h-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-0.5 gap-0.5">
          {([
            { mode: 'wysiwyg' as const, icon: PenLine, label: 'WYSIWYG 모드' },
            ...(!isMobile ? [{ mode: 'split' as const, icon: SplitSquareVertical, label: '분할 보기' }] : []),
            { mode: 'source' as const, icon: Eye, label: '소스 보기' },
          ]).map(({ mode, icon: ModeIcon, label }) => (
            <Tooltip content={label} side="bottom" key={mode}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setViewMode(mode); analytics.viewModeChange(mode); }}
                aria-label={label}
                className={`flex items-center justify-center w-8 h-7 rounded-md text-xs transition-all duration-150 cursor-pointer ${
                  viewMode === mode
                    ? 'bg-[var(--color-bg)] text-[var(--color-accent)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                <ModeIcon className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          ))}
        </div>

        {!isMobile && (
          <>
            <Divider />
            <ToolbarButton icon={PanelRight} tooltip="목차" onClick={onToggleToc} />
          </>
        )}
      </div>

    </div>
  );
}
