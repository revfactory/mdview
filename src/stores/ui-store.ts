'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  viewMode: 'wysiwyg' | 'split' | 'source';
  tocOpen: boolean;
  focusMode: boolean;
  theme: 'light' | 'dark' | 'system';
}

interface UIActions {
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setViewMode: (mode: 'wysiwyg' | 'split' | 'source') => void;
  toggleToc: () => void;
  toggleFocusMode: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export type UIStore = UIState & { actions: UIActions };

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarWidth: 280,
      viewMode: 'wysiwyg',
      tocOpen: false,
      focusMode: false,
      theme: 'system',
      actions: {
        toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
        setSidebarWidth: (width) => set({ sidebarWidth: width }),
        setViewMode: (mode) => set({ viewMode: mode }),
        toggleToc: () => set((s) => ({ tocOpen: !s.tocOpen })),
        toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
        setTheme: (theme) => set({ theme }),
      },
    }),
    {
      name: 'mdview-ui',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        viewMode: state.viewMode,
        tocOpen: state.tocOpen,
        focusMode: state.focusMode,
        theme: state.theme,
      }),
    },
  ),
);
