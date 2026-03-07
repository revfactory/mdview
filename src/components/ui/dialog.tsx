'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface DialogBaseProps {
  open: boolean;
  onClose: () => void;
  title: string;
}

function DialogShell({ open, onClose, title, children }: DialogBaseProps & { children: React.ReactNode }) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fade-in_150ms_ease-out]"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[400px] mx-4 bg-[var(--color-bg)] rounded-2xl shadow-2xl border border-[var(--color-border)] p-6 will-change-transform animate-[scale-in_150ms_cubic-bezier(0.16,1,0.3,1)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3 className="text-base font-semibold text-[var(--color-text)] mb-3">{title}</h3>
        {children}
      </div>
    </div>,
    document.body
  );
}

const btnBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer';
const btnPrimary = `${btnBase} bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]`;
const btnSecondary = `${btnBase} bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]`;
const btnDanger = `${btnBase} bg-[var(--color-danger)] text-white hover:opacity-90`;

// PromptDialog
export interface PromptDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
}

export function PromptDialog({ open, onClose, onConfirm, title, placeholder, defaultValue = '', confirmLabel = '확인' }: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultValue]);

  const handleSubmit = () => {
    if (value.trim()) {
      onConfirm(value.trim());
      onClose();
    }
  };

  return (
    <DialogShell open={open} onClose={onClose} title={title}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder={placeholder}
        className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 mb-4"
      />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>취소</button>
        <button onClick={handleSubmit} className={btnPrimary}>{confirmLabel}</button>
      </div>
    </DialogShell>
  );
}

// SelectDialog
export interface SelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (value: string | null) => void;
  title: string;
  options: { label: string; value: string | null; icon?: React.ReactNode }[];
  currentValue?: string | null;
}

export function SelectDialog({ open, onClose, onSelect, title, options, currentValue }: SelectDialogProps) {
  const handleSelect = (value: string | null) => {
    onSelect(value);
    onClose();
  };

  return (
    <DialogShell open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto -mx-2 mb-3">
        {options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => handleSelect(opt.value)}
            className={`
              flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm
              transition-colors duration-100 cursor-pointer text-left
              ${
                currentValue === opt.value
                  ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)] font-medium'
                  : 'text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
              }
            `}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span className="flex-1 truncate">{opt.label}</span>
            {currentValue === opt.value && (
              <span className="text-xs text-[var(--color-accent)]">현재</span>
            )}
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={onClose} className={btnSecondary}>취소</button>
      </div>
    </DialogShell>
  );
}

// AlertDialog
export interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
}

export function AlertDialog({ open, onClose, title, children }: AlertDialogProps) {
  return (
    <DialogShell open={open} onClose={onClose} title={title}>
      {children}
      <div className="flex justify-end mt-4">
        <button onClick={onClose} className={btnSecondary}>닫기</button>
      </div>
    </DialogShell>
  );
}

// ConfirmDialog
export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = '확인', danger = false }: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <DialogShell open={open} onClose={onClose} title={title}>
      {message && (
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">{message}</p>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>취소</button>
        <button onClick={handleConfirm} className={danger ? btnDanger : btnPrimary}>{confirmLabel}</button>
      </div>
    </DialogShell>
  );
}
