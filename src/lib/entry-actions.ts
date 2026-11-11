/** Only fixed product actions and sources may enter analytics. Never forward query text. */
export const ENTRY_ACTIONS = ['new', 'sample', 'import-hwp', 'import-markdown'] as const;
export type EntryAction = (typeof ENTRY_ACTIONS)[number];
export const ENTRY_SOURCES = ['home', 'direct', 'hwp-to-markdown', 'markdown-to-hwpx', 'markdown-to-pdf', 'markdown-editor'] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];
export function readEntryAction(params: URLSearchParams): { action: EntryAction; source: EntrySource } | null {
  const action = params.get('action');
  if (!ENTRY_ACTIONS.some((value) => value === action)) return null;
  const source = params.get('source');
  return { action: action as EntryAction, source: ENTRY_SOURCES.some((value) => value === source) ? source as EntrySource : 'direct' };
}
