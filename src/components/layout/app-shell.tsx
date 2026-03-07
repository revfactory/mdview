'use client';

import React, { type ReactNode } from 'react';
import { useUIStore } from '@/stores/ui-store';

export interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  focusMode?: boolean;
}

export function AppShell({ sidebar, children, focusMode = false }: AppShellProps) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);

  const showSidebar = sidebarOpen && !focusMode;
  const clampedWidth = Math.min(Math.max(sidebarWidth, 220), 360);

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
