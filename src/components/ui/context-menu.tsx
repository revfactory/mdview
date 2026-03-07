'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

export interface ContextMenuProps {
  children: ReactNode;
  items: ContextMenuItem[];
}

export function ContextMenu({ children, items }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const x = e.clientX;
    const y = e.clientY;

    setPosition({ x, y });
    setOpen(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let { x, y } = position;
    if (x + rect.width > vw) x = vw - rect.width - 8;
    if (y + rect.height > vh) y = vh - rect.height - 8;
    if (x < 0) x = 8;
    if (y < 0) y = 8;

    if (x !== position.x || y !== position.y) {
      setPosition({ x, y });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleClose(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    function handleScroll() {
      setOpen(false);
    }

    function handleResize() {
      setOpen(false);
    }

    document.addEventListener('mousedown', handleClose);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open]);

  return (
    <>
      <div onContextMenu={handleContextMenu}>{children}</div>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[160px] p-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-lg animate-[scale-in_100ms_ease-out] origin-top-left"
            style={{ left: position.x, top: position.y }}
          >
            {items.map((item, idx) => {
              if (item.divider) {
                return (
                  <div
                    key={idx}
                    className="my-1 h-px bg-[var(--color-border)]"
                  />
                );
              }

              const Icon = item.icon;

              return (
                <button
                  key={idx}
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                  className={`
                    flex w-full items-center gap-2.5 px-3 py-1.5
                    rounded-lg text-[13px]
                    transition-colors duration-100 cursor-pointer
                    ${
                      item.danger
                        ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
                        : 'text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                    }
                  `}
                >
                  {Icon && <Icon className="w-4 h-4 shrink-0" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
