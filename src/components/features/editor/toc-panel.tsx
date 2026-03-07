'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import type { Editor as TipTapEditor } from '@tiptap/react';

interface HeadingItem {
  level: number;
  text: string;
  id: string;
  pos: number;
}

interface TocPanelProps {
  editor: TipTapEditor | null;
}

export function TocPanel({ editor }: TocPanelProps) {
  const tocOpen = useUIStore((s) => s.tocOpen);
  const { toggleToc } = useUIStore((s) => s.actions);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activePos, setActivePos] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Extract headings from editor
  const extractHeadings = useCallback(() => {
    if (!editor) {
      setHeadings([]);
      return;
    }
    const items: HeadingItem[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        items.push({
          level: node.attrs.level,
          text: node.textContent,
          id: node.attrs.id || '',
          pos,
        });
      }
    });
    setHeadings(items);
  }, [editor]);

  // Re-extract on editor updates
  useEffect(() => {
    if (!editor) return;
    extractHeadings();

    const updateHandler = () => extractHeadings();
    editor.on('update', updateHandler);
    return () => {
      editor.off('update', updateHandler);
    };
  }, [editor, extractHeadings]);

  // Track which heading is currently visible via IntersectionObserver on scroll position
  useEffect(() => {
    if (!editor || !tocOpen || headings.length === 0) return;

    const editorElement = editor.view.dom;
    const scrollParent = editorElement.closest('.overflow-y-auto');
    scrollContainerRef.current = scrollParent as HTMLElement | null;

    if (!scrollParent) return;

    const handleScroll = () => {
      const containerRect = scrollParent.getBoundingClientRect();
      const viewportTop = containerRect.top;

      let closestHeading: HeadingItem | null = null;
      let closestDistance = Infinity;

      for (const heading of headings) {
        // Find DOM node for this position
        try {
          const domNode = editor.view.nodeDOM(heading.pos);
          if (domNode && domNode instanceof HTMLElement) {
            const rect = domNode.getBoundingClientRect();
            const distance = Math.abs(rect.top - viewportTop);
            // Prefer headings that are at or above viewport top
            const adjustedDistance = rect.top <= viewportTop + 100 ? -rect.top : distance + 10000;
            if (adjustedDistance < closestDistance) {
              closestDistance = adjustedDistance;
              closestHeading = heading;
            }
          }
        } catch {
          // pos might be invalid
        }
      }

      if (closestHeading) {
        setActivePos(closestHeading.pos);
      }
    };

    handleScroll();
    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollParent.removeEventListener('scroll', handleScroll);
    };
  }, [editor, tocOpen, headings]);

  const handleClickHeading = useCallback(
    (heading: HeadingItem) => {
      if (!editor) return;
      try {
        const domNode = editor.view.nodeDOM(heading.pos);
        if (domNode && domNode instanceof HTMLElement) {
          domNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Also move cursor there
        editor.chain().focus().setTextSelection(heading.pos + 1).run();
      } catch {
        // fallback: just set selection
        editor.chain().focus().setTextSelection(heading.pos + 1).run();
      }
    },
    [editor]
  );

  const paddingByLevel: Record<number, string> = {
    1: 'pl-3',
    2: 'pl-6',
    3: 'pl-9',
    4: 'pl-12',
    5: 'pl-14',
    6: 'pl-16',
  };

  return (
    <div
      className="h-full border-l border-[var(--color-border)] bg-[var(--color-sidebar)] shrink-0 overflow-hidden"
      style={{
        width: tocOpen ? 240 : 0,
        minWidth: tocOpen ? 240 : 0,
        transition: 'width 200ms ease-in-out, min-width 200ms ease-in-out',
      }}
    >
      <div className="flex flex-col h-full w-[240px]">
        {/* Header */}
        <div className="flex items-center justify-between h-11 px-3 border-b border-[var(--color-border)] shrink-0">
          <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            목차
          </span>
          <button
            onClick={toggleToc}
            className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
            aria-label="목차 닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Heading List */}
        <div className="flex-1 overflow-y-auto py-2">
          {headings.length === 0 ? (
            <div className="px-3 py-4 text-xs text-[var(--color-text-muted)]">
              제목(H1~H3)을 추가하면 목차가 표시됩니다.
            </div>
          ) : (
            <nav className="flex flex-col gap-0.5">
              {headings.map((heading, idx) => {
                const isActive = activePos === heading.pos;
                return (
                  <button
                    key={`${heading.pos}-${idx}`}
                    onClick={() => handleClickHeading(heading)}
                    className={`
                      text-left w-full py-1.5 pr-3 rounded-md transition-all duration-150 cursor-pointer
                      ${heading.level === 1 ? 'text-[13px] font-medium' : 'text-[12px]'}
                      ${paddingByLevel[heading.level] || 'pl-3'}
                      ${
                        isActive
                          ? 'text-[var(--color-accent)] font-medium bg-[var(--color-accent-light)]'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                      }
                    `}
                    title={heading.text}
                  >
                    <span className="block truncate">
                      {heading.text || '(빈 제목)'}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
