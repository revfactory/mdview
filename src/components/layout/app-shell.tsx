'use client';

import React, { type ReactNode, useEffect } from 'react';
import { useUIStore } from '@/stores/ui-store';

export interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  focusMode?: boolean;
}

const MOBILE_BREAKPOINT = 768;

export function AppShell({ sidebar, children, focusMode = false }: AppShellProps) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const isMobile = useUIStore((s) => s.isMobile);
  const { setMobile, closeSidebar } = useUIStore((s) => s.actions);

  // Detect mobile viewport
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    setMobile(mq.matches);
    if (mq.matches) closeSidebar();

    const handler = (e: MediaQueryListEvent) => {
      setMobile(e.matches);
      if (e.matches) closeSidebar();
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [setMobile, closeSidebar]);

  const showSidebar = sidebarOpen && !focusMode;
  const clampedWidth = Math.min(Math.max(sidebarWidth, 220), 360);

  // Mobile: overlay sidebar
  if (isMobile) {
    return (
      <div className="h-[100dvh] w-screen overflow-hidden relative">
        {/* Main content - always full width */}
        <main className="h-full w-full min-w-0 overflow-hidden bg-[var(--color-bg)]">
          {children}
        </main>

        {/* Sidebar overlay */}
        {showSidebar && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40 animate-[fade-in_150ms_ease-out]"
              onClick={closeSidebar}
            />
            <aside
              className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-[var(--color-sidebar)] border-r border-[var(--color-border)] shadow-lg animate-[slide-in-left_200ms_ease-out]"
            >
              {sidebar}
            </aside>
          </>
        )}
      </div>
    );
  }

  // Desktop: grid layout
  return (
    <div
      className="h-screen w-screen overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateColumns: showSidebar
          ? `${clampedWidth}px 1fr`
          : '0px 1fr',
        transition: 'grid-template-columns 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <aside
        className="h-screen overflow-hidden border-r border-[var(--color-border)] transition-opacity duration-300 ease-in-out"
        style={{ opacity: focusMode ? 0 : 1 }}
      >
        {sidebar}
      </aside>
      <main className="h-screen min-w-0 overflow-hidden bg-[var(--color-bg)]">
        {children}
      </main>
    </div>
  );
}
