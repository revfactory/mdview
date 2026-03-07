'use client';

import { create } from 'zustand';
import { nanoid } from 'nanoid';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastStore {
  toasts: Toast[];
  actions: {
    addToast: (message: string, type: Toast['type']) => void;
    removeToast: (id: string) => void;
  };
}

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  actions: {
    addToast: (message, type) => {
      const id = nanoid();
      set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 3000);
    },
    removeToast: (id) => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
  },
}));

export function useToast() {
  const { actions } = useToastStore();
  return {
    success: (message: string) => actions.addToast(message, 'success'),
    error: (message: string) => actions.addToast(message, 'error'),
    info: (message: string) => actions.addToast(message, 'info'),
  };
}
