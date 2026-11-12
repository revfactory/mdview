export const UI_STORAGE_KEY = 'mdview-ui';
export const DARK_MODE_QUERY = '(prefers-color-scheme: dark)';

export type Theme = 'light' | 'dark' | 'system';

export function isDarkTheme(theme: unknown, systemDark: boolean): boolean {
  return theme === 'dark' || (theme !== 'light' && systemDark);
}

export function getSystemTheme(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_MODE_QUERY).matches
    : false;
}

export function subscribeSystemTheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(DARK_MODE_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

// Read the same version-0 Zustand envelope as the UI store, before the first paint.
// Never write storage here: a blocked/corrupt store must still use the system theme.
export const THEME_BOOTSTRAP_SCRIPT = `
(function() {
  var theme = 'system';
  try {
    var saved = JSON.parse(localStorage.getItem('${UI_STORAGE_KEY}') || 'null');
    if (saved && (typeof saved.version !== 'number' || saved.version === 0)) {
      var value = saved.state && saved.state.theme;
      if (value === 'light' || value === 'dark') theme = value;
    }
  } catch(e) {}
  var systemDark = typeof window.matchMedia === 'function' && window.matchMedia('${DARK_MODE_QUERY}').matches;
  document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && systemDark));
})();
`;

// Subscribe to the current store rather than a render snapshot, so hydration and
// later preference changes cannot leave the document class behind the saved UI.
export function syncTheme(
  store: { getState: () => { theme: unknown }; subscribe: (listener: () => void) => () => void },
  root: Pick<HTMLElement, 'classList'>,
): () => void {
  const apply = () => root.classList.toggle('dark', isDarkTheme(store.getState().theme, getSystemTheme()));
  const unsubscribeStore = store.subscribe(apply);
  const unsubscribeSystem = subscribeSystemTheme(apply);
  apply();
  return () => {
    unsubscribeStore();
    unsubscribeSystem();
  };
}
