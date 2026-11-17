'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { syncTheme } from '@/lib/theme';

export function ThemeSync() {
  useEffect(() => syncTheme(useUIStore, document.documentElement), []);
  return null;
}
