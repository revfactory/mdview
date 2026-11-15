'use client';

/** Recovery is explicit: never reload or discard a conflicting local draft. */
export function SaveConflictNotice({ markdown }: { markdown: string }) {
  return (
    <section role="alert" className="m-4 rounded border border-[var(--color-border)] p-4">
      <p>다른 탭의 저장 내용과 충돌하여 자동 저장과 이동을 중단했습니다.</p>
      <p className="mt-2 text-sm">아래 원문은 변환이 끝난 입력입니다. 마지막 입력이 모두 포함됐는지 확인하고 복사해 별도로 보관한 뒤 오래된 탭을 닫고 새로고침하세요. 새로고침하면 저장하지 못한 편집은 사라집니다. 페이지 문서는 현재 페이지의 원문입니다.</p>
      <textarea aria-label="저장 충돌 복구 원문" readOnly value={markdown} onFocus={event => event.currentTarget.select()}
        className="mt-3 h-32 w-full resize-y rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono text-sm" />
    </section>
  );
}
