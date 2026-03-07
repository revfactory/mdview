'use client';

import React, { useState, useRef, useEffect, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface DropdownMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: 'start' | 'end';
}

export function DropdownMenu({ trigger, items, align = 'start' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="relative inline-flex">
      <div ref={triggerRef} onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>

      {open && (
        <div
          ref={menuRef}
          className={`
            absolute top-full mt-1 z-50
            min-w-[180px] p-1
            bg-[var(--color-bg)] border border-[var(--color-border)]
            rounded-xl shadow-lg
            animate-[scale-in_150ms_ease-out]
            origin-top
            ${align === 'end' ? 'right-0' : 'left-0'}
          `}
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
                  flex w-full items-center gap-2.5 px-3 py-2
                  rounded-lg text-sm font-normal
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
        </div>
      )}
    </div>
  );
}
