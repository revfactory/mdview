'use client';

export function PageLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
      <p role="alert" className="text-sm text-[var(--color-text-muted)]">{message}</p>
      <button type="button" onClick={onRetry} className="rounded border border-[var(--color-border)] px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]">
        다시 불러오기
      </button>
      <p className="text-xs text-[var(--color-text-muted)]">계속 실패하면 다른 문서를 선택한 뒤 다시 시도하세요. 브라우저 저장 데이터를 삭제하지 마세요.</p>
    </div>
  );
}
