import Link from 'next/link';
import './guides.css';
export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="guide-shell">
      <a className="guide-skip" href="#guide-content">본문으로 이동</a>
      <header className="guide-header"><nav className="guide-container guide-navigation" aria-label="주요 메뉴">
        <Link href="/" className="guide-brand">MDView<span>문서 작업 가이드</span></Link>
        <div className="guide-nav-links"><Link href="/guides">가이드 모음</Link><Link href="/" className="guide-editor-link">에디터 열기 ↗</Link></div>
      </nav></header>
      <main id="guide-content" className="guide-container guide-main">{children}</main>
      <footer className="guide-container guide-footer"><p>MDView · 한글 문서와 마크다운 사이를 더 편리하게</p><Link href="/">에디터로 돌아가기</Link></footer>
    </div>
  );
}
