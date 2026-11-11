'use client';

import Link from 'next/link';
import { ArrowRight, FilePlus2, FileText, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EntryAction } from '@/lib/entry-actions';

interface WelcomePanelProps { onStart: (action: EntryAction) => void; }
const guides = [
  { href: '/guides/hwp-to-markdown', title: 'HWP·HWPX → 마크다운', description: '한글 파일을 열고, 편집 가능한 문서로 정리하기' },
  { href: '/guides/markdown-to-hwpx', title: '마크다운 → 한글 HWPX', description: '작성한 글을 한글에서 열 수 있는 파일로 내보내기' },
  { href: '/guides/markdown-to-pdf', title: '마크다운 → PDF', description: '미리보기를 확인하고 브라우저에서 PDF로 저장하기' },
  { href: '/guides/markdown-editor', title: '마크다운 에디터 사용법', description: '문법을 몰라도 시작하는 편집과 자동저장 안내' },
];
export function WelcomePanel({ onStart }: WelcomePanelProps) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col px-5 py-8 sm:px-10 sm:py-12" aria-labelledby="welcome-title">
      <p className="mb-3 text-sm font-medium text-[var(--color-accent)]">MDView · 무료 온라인 마크다운 에디터</p>
      <h1 id="welcome-title" className="text-2xl font-bold leading-tight tracking-tight sm:text-4xl">한글 파일부터 마크다운까지,<br className="hidden sm:block" /> 바로 열고 편집하세요.</h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">HWP·HWPX와 .md 파일을 가져오거나 새 글을 시작하세요. 설치나 회원가입 없이 문서를 편집하고 마크다운 또는 HWPX로 내보낼 수 있습니다.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button icon={FolderOpen} onClick={() => onStart('import-hwp')}>HWP·HWPX 열기</Button>
        <Button variant="secondary" icon={FileText} onClick={() => onStart('import-markdown')}>마크다운 열기</Button>
        <Button variant="secondary" icon={FilePlus2} onClick={() => onStart('new')}>새 문서 만들기</Button>
      </div>
      <button className="mt-4 w-fit cursor-pointer text-sm text-[var(--color-accent)] underline underline-offset-4" onClick={() => onStart('sample')}>파일 없이 샘플 문서로 체험하기</button>
      <div className="mt-7 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs leading-6 text-[var(--color-text-secondary)]">문서는 현재 브라우저에 자동저장됩니다. 브라우저 데이터 삭제나 다른 기기·주소로 이동하기 전에 파일로 내보내세요. 복잡한 표와 서식은 변환 후 확인이 필요합니다.</div>
      <div className="mt-10 flex items-center justify-between gap-3"><h2 className="text-base font-semibold">하려는 작업에 맞춰 시작하기</h2><Link href="/guides" className="text-xs text-[var(--color-accent)] underline underline-offset-4">전체 사용법</Link></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{guides.map((guide) => (
        <Link key={guide.href} href={guide.href} className="group rounded-xl border border-[var(--color-border)] p-4 transition-colors hover:bg-[var(--color-surface)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"><h3 className="flex items-center justify-between gap-2 text-sm font-medium">{guide.title}<ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" /></h3><p className="mt-2 text-xs leading-6 text-[var(--color-text-secondary)]">{guide.description}</p></Link>
      ))}</div>
    </section>
  );
}
