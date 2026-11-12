'use client';

import { useSyncExternalStore } from 'react';
import { getSystemTheme, subscribeSystemTheme } from '@/lib/theme';

const getServerSnapshot = () => false;

export function useSystemTheme(): boolean {
  return useSyncExternalStore(subscribeSystemTheme, getSystemTheme, getServerSnapshot);
}
