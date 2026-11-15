/** A storage writer must throw this only after its transactional CAS fails. */
export class ContentConflictError extends Error {
  constructor() { super('저장된 원문이 변경되었습니다. 현재 편집 내용을 보관한 뒤 충돌을 해결해주세요.'); }
}

/**
 * One editor's acknowledged storage baseline. Callers supply immutable snapshots
 * and a writer that compares the baseline and writes in one transaction.
 * This helper never reads storage to silently accept a peer's changed baseline.
 */
export function createContentSaveSession<Baseline, Snapshot>(
  initialBaseline: Baseline,
  write: (baseline: Baseline, snapshot: Snapshot) => Promise<Baseline>,
) {
  let acknowledged = initialBaseline;
  let pending: { snapshot: Snapshot } | null = null;
  let conflict: ContentConflictError | null = null;
  let tail: Promise<void> = Promise.resolve();

  function save(snapshot: Snapshot): Promise<void> {
    const request = { snapshot };
    pending = request;
    const result = tail.catch(() => {}).then(async () => {
      if (conflict) throw conflict;
      try {
        // Resolve the baseline at execution, not input time: earlier local
        // writes may have acknowledged a newer version while this was queued.
        acknowledged = await write(acknowledged, request.snapshot);
        if (pending === request) pending = null;
      } catch (error) {
        if (error instanceof ContentConflictError) conflict = error;
        throw error;
      }
    });
    tail = result;
    // Observe ignored UI calls without hiding failure from awaiting callers.
    void result.catch(() => {});
    return result;
  }

  return {
    save,
    retry: () => pending ? save(pending.snapshot) : tail,
    getPendingSnapshot: () => pending?.snapshot,
    hasConflict: () => conflict !== null,
  };
}
