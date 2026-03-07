'use client';

import type { Editor } from '@tiptap/react';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  Code,
  Table,
  ImageIcon,
  Sigma,
  GitBranch,
} from 'lucide-react';
import type { SlashCommandItem } from '@/types/editor';
import { executeSlashCommand } from '@/extensions/slash-command';
import type { SlashCommandStorage } from '@/extensions/slash-command';

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  Code,
  Table,
  Image: ImageIcon,
  Sigma,
  GitBranch,
};

interface SlashCommandMenuProps {
  editor: Editor;
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [active, setActive] = useState(false);
  const [items, setItems] = useState<SlashCommandItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  const updateState = useCallback(() => {
    const storage = (editor as any).extensionStorage.slashCommand as SlashCommandStorage | undefined;
    if (!storage) return;

    setActive(storage.active);
    setItems(storage.filteredItems);
    setSelectedIndex(storage.selectedIndex);
    setPosition(storage.decorationPosition);
  }, [editor]);

  useEffect(() => {
    editor.on('transaction', updateState);
    return () => {
      editor.off('transaction', updateState);
    };
  }, [editor, updateState]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (item: SlashCommandItem) => {
      const storage = (editor as any).extensionStorage.slashCommand as SlashCommandStorage | undefined;
      if (!storage?.range) return;

      executeSlashCommand(
        editor as Parameters<typeof executeSlashCommand>[0],
        item.command,
        storage.range
      );

      // Reset storage
      storage.active = false;
      storage.query = '';
      storage.range = null;
      storage.decorationPosition = null;
      storage.selectedIndex = 0;
    },
    [editor]
  );

  if (!active || !position || items.length === 0) {
    return null;
  }

  // Group items by group
  const grouped = items.reduce<Record<string, SlashCommandItem[]>>(
    (acc, item) => {
      const group = item.group || '기타';
      if (!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
    },
    {}
  );

  let globalIndex = 0;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-80 overflow-hidden rounded-xl border shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        maxHeight: 360,
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
        {Object.entries(grouped).map(([groupName, groupItems]) => (
          <div key={groupName}>
            <div
              className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {groupName}
            </div>
            {groupItems.map((item) => {
              const currentIndex = globalIndex++;
              const isSelected = currentIndex === selectedIndex;
              const Icon = iconMap[item.icon];

              return (
                <button
                  key={item.command}
                  ref={isSelected ? selectedItemRef : null}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer"
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--color-surface-hover)'
                      : 'transparent',
                  }}
                  onMouseEnter={() => {
                    const storage = (editor as any).extensionStorage.slashCommand as SlashCommandStorage;
                    storage.selectedIndex = currentIndex;
                    setSelectedIndex(currentIndex);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(item);
                  }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                    }}
                  >
                    {Icon && <Icon size={20} />}
                  </div>
                  <div className="flex flex-col">
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {item.label}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {item.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
