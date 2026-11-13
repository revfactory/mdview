import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없습니다 | MDView',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="h-dvh overflow-y-auto bg-[var(--color-bg)] px-6 text-[var(--color-text)]" aria-labelledby="not-found-title">
      <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center py-16">
        <p className="mb-4 text-sm font-semibold text-[var(--color-accent)]">MDView · 404</p>
        <h1 id="not-found-title" className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">페이지를 찾을 수 없습니다</h1>
        <p className="mt-5 text-base leading-8 text-[var(--color-text-secondary)]">주소가 변경되었거나 잘못 입력됐을 수 있습니다. 사용 가이드에서 필요한 작업을 찾거나 에디터로 돌아가세요.</p>
        <nav aria-label="다시 시작하기" className="mt-8 flex flex-wrap gap-3">
          <Link href="/guides" prefetch={false} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-bg)] hover:bg-[var(--color-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent)]">사용 가이드 보기</Link>
          <Link href="/" prefetch={false} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--color-border)] px-5 py-3 text-sm font-semibold hover:bg-[var(--color-surface)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent)]">에디터로 돌아가기</Link>
        </nav>
      </div>
    </main>
  );
}
