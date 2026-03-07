'use client';

import React, { forwardRef, type InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  shortcutHint?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder = '검색...', shortcutHint = '\u2318K', className = '', ...props }, ref) => {
    return (
      <div className={`relative flex items-center w-full ${className}`}>
        <Search className="absolute left-3 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="
            h-9 w-full
            pl-9 pr-12
            rounded-[6px] border border-[var(--color-border)]
            bg-[var(--color-surface)]
            text-sm text-[var(--color-text)]
            placeholder:text-[var(--color-text-placeholder)]
            transition-colors duration-150
            focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:bg-[var(--color-bg)]
          "
          data-search-input=""
          {...props}
        />
        {shortcutHint && (
          <span className="absolute right-3 text-[11px] text-[var(--color-text-muted)] font-medium px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] pointer-events-none">
            {shortcutHint}
          </span>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
