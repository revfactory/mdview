'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button, type ButtonVariant } from './button';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: EmptyStateAction[];
}

export function EmptyState({ icon: Icon, title, subtitle, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-surface)] mb-6">
        <Icon className="w-8 h-8 text-[var(--color-text-muted)]" />
      </div>

      <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1.5">
        {title}
      </h3>

      {subtitle && (
        <p className="text-sm text-[var(--color-text-secondary)] max-w-xs mb-6">
          {subtitle}
        </p>
      )}

      {actions && actions.length > 0 && (
        <div className="flex items-center gap-3">
          {actions.map((action, idx) => (
            <Button
              key={idx}
              variant={action.variant ?? 'primary'}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
