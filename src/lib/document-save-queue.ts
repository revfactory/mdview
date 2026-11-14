import { updateContent } from '@/db/documents';

type DocumentWriter = (id: string, markdown: string, html: string) => Promise<void>;

/** Serialize full-document snapshots, independently for each document. */
export function createDocumentSaveQueue(write: DocumentWriter) {
  const tails = new Map<string, Promise<void>>();

  function enqueueDocumentSave(id: string, markdown: string, html: string): Promise<void> {
    return enqueueDocumentOperation(id, () => write(id, markdown, html));
  }

  function enqueueDocumentOperation(id: string, invoke: () => Promise<void>): Promise<void> {
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
    tails.set(id, save);
    // Observe rejection internally, but return the original rejecting promise so
    // callers can report it. Retain the latest failure for load barriers too.
    void save.then(() => {
      if (tails.get(id) === save) tails.delete(id);
    }, () => {});
    return save;
  }

  async function awaitDocumentSaves(id: string): Promise<void> {
    // Include writes appended while the loader was waiting, not only its first
    // snapshot. A newer successful save supersedes an earlier failed snapshot.
    for (;;) {
      const tail = tails.get(id);
      if (!tail) return;
      try { await tail; }
      catch (error) {
        if (tails.get(id) === tail) throw error;
      }
      if (tails.get(id) === tail) return;
    }
  }

  return { enqueueDocumentSave, enqueueDocumentOperation, awaitDocumentSaves };
}

export const { enqueueDocumentSave, enqueueDocumentOperation, awaitDocumentSaves } = createDocumentSaveQueue(updateContent);
