'use client';

import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  ListChecks,
  Table,
  Image,
  CodeSquare,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  SplitSquareVertical,
  PenLine,
  Download,
  PanelRight,
  ChevronDown,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Quote,
} from 'lucide-react';
import { Tooltip } from '../ui/tooltip';
import { useUIStore } from '@/stores/ui-store';
import type { Editor as TipTapEditor } from '@tiptap/react';

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
        onClick={onClick}
        disabled={disabled}
        className={`
          flex items-center justify-center w-8 h-8
          rounded-md transition-colors duration-100 cursor-pointer
          disabled:opacity-40 disabled:cursor-not-allowed
          ${
            active
              ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }
        `}
      >
        <Icon className="w-[18px] h-[18px]" />
      </button>
    </Tooltip>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-[var(--color-border)] mx-0.5" />;
}

function getActiveBlockLabel(editor: TipTapEditor | null): string {
  if (!editor) return '본문';
  if (editor.isActive('heading', { level: 1 })) return '제목 1';
  if (editor.isActive('heading', { level: 2 })) return '제목 2';
  if (editor.isActive('heading', { level: 3 })) return '제목 3';
  if (editor.isActive('blockquote')) return '인용';
  if (editor.isActive('codeBlock')) return '코드';
  return '본문';
}

export interface ToolbarProps {
  editor?: TipTapEditor | null;
  onExport?: () => void;
  onToggleToc?: () => void;
}

export function Toolbar({ editor = null, onExport, onToggleToc }: ToolbarProps) {
  const viewMode = useUIStore((s) => s.viewMode);
  const { setViewMode } = useUIStore((s) => s.actions);

  const blockLabel = getActiveBlockLabel(editor);
  const noEditor = !editor;

  const handleBlockType = () => {
    if (!editor) return;
    // Cycle through block types: paragraph -> h1 -> h2 -> h3 -> blockquote -> paragraph
    if (editor.isActive('paragraph')) {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    } else if (editor.isActive('heading', { level: 1 })) {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    } else if (editor.isActive('heading', { level: 2 })) {
      editor.chain().focus().toggleHeading({ level: 3 }).run();
    } else if (editor.isActive('heading', { level: 3 })) {
      editor.chain().focus().toggleBlockquote().run();
    } else if (editor.isActive('blockquote')) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().setParagraph().run();
    }
  };

  return (
    <div className="flex items-center h-11 px-3 gap-0.5 border-b border-[var(--color-border)] bg-[var(--color-bg)] sticky top-0 z-10 shrink-0">
      {/* Block Type Selector */}
      <button
        onClick={handleBlockType}
        disabled={noEditor}
        className="flex items-center gap-1 h-8 px-2.5 rounded-md text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Heading className="w-4 h-4" />
        <span className="text-xs">{blockLabel}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

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
      <ToolbarButton
        icon={ListChecks}
        tooltip="체크리스트"
        active={editor?.isActive('taskList')}
        disabled={noEditor}
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
      />

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
        icon={Image}
        tooltip="이미지 삽입"
        disabled={noEditor}
        onClick={() => {
          const url = window.prompt('이미지 URL을 입력하세요:');
          if (url) {
            editor?.chain().focus().setImage({ src: url }).run();
          }
        }}
      />
      <ToolbarButton
        icon={CodeSquare}
        tooltip="코드 블록"
        active={editor?.isActive('codeBlock')}
        disabled={noEditor}
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
      />

      <Divider />

      {/* Align Group */}
      <ToolbarButton
        icon={AlignLeft}
        tooltip="왼쪽 정렬"
        active={editor?.isActive({ textAlign: 'left' })}
        disabled={noEditor}
        onClick={() => editor?.chain().focus().setTextAlign('left').run()}
      />
      <ToolbarButton
        icon={AlignCenter}
        tooltip="가운데 정렬"
        active={editor?.isActive({ textAlign: 'center' })}
        disabled={noEditor}
        onClick={() => editor?.chain().focus().setTextAlign('center').run()}
      />
      <ToolbarButton
        icon={AlignRight}
        tooltip="오른쪽 정렬"
        active={editor?.isActive({ textAlign: 'right' })}
        disabled={noEditor}
        onClick={() => editor?.chain().focus().setTextAlign('right').run()}
      />

      <div className="flex-1" />

      {/* View Mode - 3 segment control */}
      <div className="flex items-center h-8 rounded-lg bg-[var(--color-surface)] p-0.5">
        <button
          onClick={() => setViewMode('wysiwyg')}
          className={`flex items-center justify-center w-8 h-7 rounded-md transition-colors cursor-pointer ${
            viewMode === 'wysiwyg'
              ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <PenLine className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode('split')}
          className={`flex items-center justify-center w-8 h-7 rounded-md transition-colors cursor-pointer ${
            viewMode === 'split'
              ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <SplitSquareVertical className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode('source')}
          className={`flex items-center justify-center w-8 h-7 rounded-md transition-colors cursor-pointer ${
            viewMode === 'source'
              ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      <Divider />

      {/* Export */}
      <ToolbarButton icon={Download} tooltip="내보내기" onClick={onExport} />

      {/* TOC */}
      <ToolbarButton icon={PanelRight} tooltip="목차" onClick={onToggleToc} />
    </div>
  );
}
