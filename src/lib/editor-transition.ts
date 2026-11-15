/** User-initiated navigation only; never install this on background store setters. */
export function createEditorTransitionGate() {
  let busy = false;
  return async function transition<Owner, Result>(options: {
    owner: Owner;
    isCurrent: (owner: Owner) => boolean;
    setBusy: (busy: boolean) => void;
    prepare: () => Promise<void>;
    create: () => Promise<Result>;
    commit: (result: Result) => void;
  }): Promise<'committed' | 'busy' | 'superseded'> {
    if (busy) return 'busy';
    busy = true;
    try {
      options.setBusy(true);
      if (!options.isCurrent(options.owner)) return 'superseded';
      await options.prepare();
      if (!options.isCurrent(options.owner)) return 'superseded';
      const result = await options.create();
      if (!options.isCurrent(options.owner)) return 'superseded';
      // Commit must be synchronous: no user input can interleave this check.
      options.commit(result);
      return 'committed';
    } finally {
      busy = false;
      // Cleanup reporting must not turn a committed navigation into a failure
      // or mask the original persistence error. A failed opening notification
      // still aborts before preparation (the UI may not have frozen input).
      try { options.setBusy(false); } catch { /* Internal lock is already released. */ }
    }
  };
}

/** Failure must reject. A save callback resolving is not persistence proof. */
export async function prepareEditorTransition(options: {
  id: string | null;
  readOnly: boolean;
  hasEditableSnapshot: boolean;
  flush: () => Promise<void>;
  awaitSaves: (id: string) => Promise<void>;
}) {
  if (!options.id || options.readOnly) return;
  // Clean initial-read failures have no editor to flush. They can still leave,
  // provided there is no failed/pending write for that same document.
  if (options.hasEditableSnapshot) await options.flush();
  await options.awaitSaves(options.id);
}
