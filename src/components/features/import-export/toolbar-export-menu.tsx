'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download } from 'lucide-react';

interface ToolbarExportMenuProps {
  disabled: boolean;
  onMarkdown: () => void;
  onHwpx?: () => void;
  onPdf: () => void;
  pdfDisabledReason?: string;
}

export function ToolbarExportMenu({ disabled, onMarkdown, onHwpx, onPdf, pdfDisabledReason }: ToolbarExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const visible = open && !disabled;

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!visible) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const dismiss = (event: Event) => {
      if (event.type === 'scroll' && menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [visible]);

  const items = [
    { label: '마크다운 (.md)', action: onMarkdown, reason: undefined },
    { label: '한글 (.hwpx)', action: onHwpx, reason: !onHwpx ? '문서를 연 후 사용할 수 있습니다.' : undefined },
    { label: 'PDF (인쇄)', action: onPdf, reason: pdfDisabledReason },
  ];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="내보내기"
        title="내보내기"
        aria-haspopup="menu"
        aria-expanded={visible}
        aria-controls={visible ? id : undefined}
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!visible) triggerRef.current?.click();
          }
        }}
        onClick={() => {
          if (visible) { close(true); return; }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setPosition({
            left: Math.max(8, Math.min(rect.right - 264, window.innerWidth - 272)),
            top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 232)),
          });
          setOpen(true);
        }}
        className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <Download className="w-4 h-4" />
      </button>
      {visible && createPortal(
        <div
          id={id}
          ref={menuRef}
          role="menu"
          aria-label="내보내기 형식"
          className="fixed z-[9999] w-[264px] max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] overflow-y-auto p-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg print:hidden"
          style={position}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== triggerRef.current) close();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); close(true); }
            if (event.key === 'Tab') close(true);
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
              const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
              buttons[next]?.focus();
            }
          }}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={!!item.reason}
              aria-describedby={item.reason ? `${id}-${index}` : undefined}
              onClick={() => {
                if (item.reason) return;
                close(true);
                item.action?.();
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] focus-visible:bg-[var(--color-surface-hover)] aria-disabled:text-[var(--color-text-muted)] cursor-pointer aria-disabled:cursor-not-allowed"
            >
              <span>{item.label}</span>
              {item.reason && <span id={`${id}-${index}`} className="block mt-1 text-xs leading-relaxed">{item.reason}</span>}
            </button>
          ))}
        </div>, document.body
      )}
    </>
  );
}
