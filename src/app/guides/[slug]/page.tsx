import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGuide, guideActionHref, guides, GUIDE_SITE_URL } from '@/lib/guides';
interface GuidePageProps { params: Promise<{ slug: string }> }
export const dynamicParams = false;
export function generateStaticParams() { return guides.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  const title = `${guide.title} | MDView`;
  const url = `${GUIDE_SITE_URL}/guides/${guide.slug}`;
  return {
    title, description: guide.description, alternates: { canonical: url },
    openGraph: { title, description: guide.description, url, type: 'article', locale: 'ko_KR', siteName: 'MDView', images: ['/banner.png'] },
    twitter: { card: 'summary_large_image', title, description: guide.description, images: ['/banner.png'] },
  };
}
export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  const breadcrumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'MDView', item: GUIDE_SITE_URL },
      { '@type': 'ListItem', position: 2, name: '사용 가이드', item: `${GUIDE_SITE_URL}/guides` },
      { '@type': 'ListItem', position: 3, name: guide.title, item: `${GUIDE_SITE_URL}/guides/${guide.slug}` },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, '\\u003c') }} />
      <nav aria-label="현재 위치" className="guide-breadcrumb"><Link href="/guides">사용 가이드</Link><span aria-hidden="true">/</span><span>{guide.title}</span></nav>
      <article>
        <header className="guide-hero guide-article-hero"><p className="guide-eyebrow">{guide.eyebrow}</p><h1>{guide.title}</h1><p className="guide-lead">{guide.summary}</p><p className="guide-outcome">{guide.outcome}</p><Link className="guide-button" href={guideActionHref(guide)}>{guide.actionLabel}<span aria-hidden="true">↗</span></Link></header>
        <div className="guide-article-layout">
          <nav className="guide-toc" aria-label="이 가이드의 목차"><p>이 가이드에서</p><a href="#steps">작업 순서</a>{guide.sections.map((section, index) => <a key={section.title} href={`#${section.id ?? `section-${index}`}`}>{section.title}</a>)}<a href="#questions">자주 묻는 질문</a></nav>
          <div className="guide-body">
            <section id="steps" className="guide-section"><h2>작업 순서</h2><ol className="guide-steps">{guide.steps.map((step, index) => <li key={step.title}><span className="guide-step-number" aria-hidden="true">{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol></section>
            {guide.sections.map((section, index) => <section key={section.title} id={section.id ?? `section-${index}`} className="guide-section"><h2>{section.title}</h2>{section.code && <pre className="guide-code" role="region" tabIndex={0} aria-label={section.title}><code>{section.code}</code></pre>}{section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.links && <ul className="guide-bullets">{section.links.map((link) => <li key={link.href}><a href={link.href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline underline-offset-4">{link.label} (새 탭)</a></li>)}</ul>}{section.bullets && <ul className="guide-bullets">{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}
            <section id="questions" className="guide-section"><h2>자주 묻는 질문</h2>{guide.questions.map((item) => <div key={item.question} className="guide-question"><h3>{item.question}</h3><p>{item.answer}</p></div>)}</section>
            <aside className="guide-note"><h2>브라우저에서 처리하고, 중요한 문서는 따로 백업하세요</h2><p>MDView의 HWP·HWPX 변환은 브라우저에서 실행되고, 편집 문서는 브라우저의 로컬 저장소에 저장됩니다. 외부 이미지 주소를 포함하면 해당 서버로 이미지 요청이 발생할 수 있고, 사이트는 외부 글꼴과 방문 통계 서비스를 사용합니다. 로컬 저장은 클라우드 백업을 의미하지 않으므로 중요한 문서는 파일로 내려받아 보관하세요.</p></aside>
            <div className="guide-bottom-cta"><h2>이제 문서로 직접 해보세요</h2><Link className="guide-button" href={guideActionHref(guide)}>{guide.actionLabel}<span aria-hidden="true">↗</span></Link></div>
          </div>
        </div>
      </article>
      <section className="guide-related" aria-labelledby="related-guides"><h2 id="related-guides">이어서 보면 좋은 가이드</h2><div className="guide-grid">{guide.related.map(getGuide).filter((related) => related !== undefined).map((related) => <Link key={related.slug} href={`/guides/${related.slug}`} className="guide-card"><h3>{related.title}</h3><p>{related.description}</p><span className="guide-card-action">가이드 읽기 ↗</span></Link>)}</div></section>
    </>
  );
}
