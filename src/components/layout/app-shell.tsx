'use client';

import React, { type ReactNode } from 'react';
import { useUIStore } from '@/stores/ui-store';

export interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateColumns: sidebarOpen
          ? `${sidebarWidth}px 1fr`
          : '0px 1fr',
        transition: 'grid-template-columns 200ms ease-in-out',
      }}
    >
      <aside className="h-screen overflow-hidden border-r border-[var(--color-border)]">
        {sidebar}
      </aside>
      <main className="h-screen overflow-auto bg-[var(--color-bg)]">
        {children}
      </main>
    </div>
  );
}
