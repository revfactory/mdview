'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UI_STORAGE_KEY, type Theme } from '@/lib/theme';

interface UIState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  viewMode: 'wysiwyg' | 'split' | 'source';
  tocOpen: boolean;
  focusMode: boolean;
  theme: Theme;
  isMobile: boolean;
}

interface UIActions {
  toggleSidebar: () => void;
  closeSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setViewMode: (mode: 'wysiwyg' | 'split' | 'source') => void;
  toggleToc: () => void;
  toggleFocusMode: () => void;
  setTheme: (theme: Theme) => void;
  setMobile: (isMobile: boolean) => void;
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
      isMobile: false,
      actions: {
        toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
        closeSidebar: () => set({ sidebarOpen: false }),
        setSidebarWidth: (width) => set({ sidebarWidth: width }),
        setViewMode: (mode) => set({ viewMode: mode }),
        toggleToc: () => set((s) => ({ tocOpen: !s.tocOpen })),
        toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
        setTheme: (theme) => set({ theme }),
        setMobile: (isMobile) => set({ isMobile }),
      },
    }),
    {
      name: UI_STORAGE_KEY,
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
