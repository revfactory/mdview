'use client';

import React, { useEffect, useCallback, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  dismissible?: boolean;
  children: ReactNode;
}

const sizeMap: Record<ModalSize, string> = {
  sm: 'max-w-[440px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[720px]',
};

const focusableSelector = 'button, input, select, textarea, a[href], [tabindex]';

function focusableControls(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.tabIndex >= 0 && !element.matches(':disabled') && !!element.getClientRects?.().length,
  );
}

export function Modal({ open, onClose, title, size = 'md', dismissible = true, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (dismissible) onClose();
        return;
      }
      const dialog = dialogRef.current;
      if (!dialog || e.key !== 'Tab') return;
      const controls = focusableControls(dialog);
      const active = dialog.ownerDocument.activeElement;
      const boundary = e.shiftKey ? controls[0] : controls.at(-1);
      if (!controls.length || !controls.some((control) => control === active) || active === boundary) {
        e.preventDefault();
        (e.shiftKey ? controls.at(-1) ?? dialog : controls[0] ?? dialog).focus({ preventScroll: true });
      }
    },
    [dismissible, onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const doc = dialog.ownerDocument;
    const previous = doc.activeElement as HTMLElement | null;
    const overflow = doc.body.style.overflow;
    doc.body.style.overflow = 'hidden';
    function focusInside() {
      if (!dialog) return;
      const controls = focusableControls(dialog);
      (controls.find((element) => element.hasAttribute('data-modal-initial-focus')) ?? controls[0] ?? dialog)
        .focus({ preventScroll: true });
    }
    function keepFocus(event: FocusEvent) {
      if (dialog && !dialog.contains(event.target as Node)) focusInside();
    }
    focusInside();
    doc.addEventListener('focusin', keepFocus);
    return () => {
      doc.removeEventListener('focusin', keepFocus);
      doc.body.style.overflow = overflow;
      if (previous?.isConnected && previous !== doc.body && !dialog.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fade-in_200ms_ease-out]"
        onClick={dismissible ? onClose : undefined}
      />

      {/* Content */}
      <div
        className={`
          relative flex flex-col w-full ${sizeMap[size]} mx-4 max-h-[calc(100dvh-2rem)] overflow-hidden
          bg-[var(--color-bg)] rounded-2xl
          shadow-2xl border border-[var(--color-border)]
          p-4 sm:p-6
          will-change-transform
          animate-[scale-in_200ms_cubic-bezier(0.16,1,0.3,1)]
        `}
        ref={dialogRef}
        tabIndex={-1}
        data-file-modal
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        {title && (
          <div className="flex shrink-0 items-center justify-between gap-3 mb-4">
            <h2 className="min-w-0 text-lg font-semibold text-[var(--color-text)]">{title}</h2>
            <button
              onClick={onClose}
              aria-label="닫기"
              disabled={!dismissible}
              className="flex items-center justify-center w-11 h-11 shrink-0 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition-all duration-150 cursor-pointer active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
