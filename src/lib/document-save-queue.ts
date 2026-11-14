import { updateContent } from '@/db/documents';

type OperationScope = { scope: 'page'; page: number } | { scope: 'document' };

type DocumentWriter = (id: string, markdown: string, html: string) => Promise<void>;

/** Serialize writes per document; partial success cannot hide unrelated failures. */
export function createDocumentSaveQueue(write: DocumentWriter) {
  const tails = new Map<string, Promise<void>>();
  const failures = new Map<string, Map<string | symbol, unknown>>();

  function enqueueDocumentSave(id: string, markdown: string, html: string): Promise<void> {
    return enqueueDocumentOperation(id, () => write(id, markdown, html), { scope: 'document' });
  }

  function enqueueDocumentOperation(id: string, invoke: () => Promise<void>, scope?: OperationScope): Promise<void> {
    // Unscoped operations cannot establish which earlier partial failure they
    // replace. Keep each failure until an explicit whole-document replacement.
    const key = scope?.scope === 'page' ? `page:${scope.page}`
      : scope?.scope === 'document' ? 'document' : Symbol('partial');
    const previous = tails.get(id);
    let save: Promise<void>;
    if (previous) {
      // A failed snapshot must not poison subsequent saves.
      save = previous.catch(() => {}).then(invoke);
    } else {
      // Start the first IndexedDB write in the input event, not an idle timer.
      try { save = Promise.resolve(invoke()); }
      catch (error) { save = Promise.reject(error); }
    }
    // Record outcomes before the serialized tail settles. A queued retry then
    // sees a complete failure ledger, even when writers settle synchronously.
    save = save.then(() => {
      if (scope?.scope === 'document') failures.delete(id);
      else if (scope?.scope === 'page') {
        const pending = failures.get(id);
        pending?.delete(key);
        if (pending?.size === 0) failures.delete(id);
      }
    }, error => {
      let pending = failures.get(id);
      if (!pending) failures.set(id, pending = new Map());
      pending.set(key, error);
      throw error;
    });
    tails.set(id, save);
    // Observe ignored rejections without changing the caller's rejecting promise.
    void save.then(() => {
      if (tails.get(id) === save) tails.delete(id);
    }, () => {
      if (tails.get(id) === save) tails.delete(id);
    });
    return save;
  }

  async function awaitDocumentSaves(id: string): Promise<void> {
    // Follow newly appended work before judging unresolved failures. Matching
    // retries may recover a page; successful unrelated operations may not.
    for (;;) {
      const tail = tails.get(id);
      if (!tail) {
        const pending = failures.get(id);
        if (pending?.size) throw pending.values().next().value;
        return;
      }
      try { await tail; } catch { /* Consult the scoped ledger after draining. */ }
    }
  }

  return { enqueueDocumentSave, enqueueDocumentOperation, awaitDocumentSaves };
}

export const { enqueueDocumentSave, enqueueDocumentOperation, awaitDocumentSaves } = createDocumentSaveQueue(updateContent);
