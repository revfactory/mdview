/** A copy must never race an already queued write or hide a failed save. */
export async function copyDocumentSnapshot(
  id: string,
  flush: (() => Promise<void>) | undefined,
  waitForSaves: (id: string) => Promise<void>,
  copy: (id: string) => Promise<string>,
): Promise<string> {
  if (flush) await flush();
  await waitForSaves(id);
  return copy(id);
}
