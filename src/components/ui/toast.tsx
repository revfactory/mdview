'use client';

import React from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useToastStore } from '@/stores/toast-store';

const iconMap = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const colorMap = {
  success: 'var(--color-success)',
  error: 'var(--color-danger)',
  info: 'var(--color-info)',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const { actions } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border border-[var(--color-border)] bg-[var(--color-bg)] min-w-[280px] max-w-[400px]"
            style={{
              animation: 'toast-in 300ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <Icon
              className="w-5 h-5 shrink-0"
              style={{ color: colorMap[toast.type] }}
            />
            <span className="flex-1 text-sm text-[var(--color-text)]">
              {toast.message}
            </span>
            <button
              onClick={() => actions.removeToast(toast.id)}
              className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all duration-150 cursor-pointer active:scale-90"
              aria-label="닫기"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
