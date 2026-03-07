'use client';

import React, { forwardRef, type InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  shortcutHint?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder = '문서 검색...', shortcutHint = '\u2318K', className = '', ...props }, ref) => {
    return (
      <div className={`relative flex items-center w-full ${className}`}>
        <Search className="absolute left-2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none transition-colors duration-150" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="
            h-7 w-full
            pl-7 pr-10
            text-[12px]
            rounded-md border border-[var(--color-border)]
            bg-[var(--color-surface)]
            text-[var(--color-text)]
            placeholder:text-[var(--color-text-placeholder)]
            transition-colors duration-150
            focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:bg-[var(--color-bg)]
          "
          data-search-input=""
          {...props}
        />
        {shortcutHint && (
          <span className="absolute right-1.5 text-[9px] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] pointer-events-none leading-none font-medium">
            {shortcutHint}
          </span>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
