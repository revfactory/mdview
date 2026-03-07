'use client';

import React, { useState, useRef, useCallback, type ReactNode } from 'react';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: string;
  side?: TooltipSide;
  delay?: number;
  children: ReactNode;
}

const positionStyles: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({ content, side = 'top', delay = 300, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div
          className={`
            absolute z-50 pointer-events-none
            whitespace-nowrap
            px-2.5 py-1 rounded-full
            bg-[var(--color-text)] text-[var(--color-bg)]
            text-xs font-medium
            animate-[fade-in_100ms_ease-out]
            ${positionStyles[side]}
          `}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
}
