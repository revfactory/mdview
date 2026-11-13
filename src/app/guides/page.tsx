import type { Metadata } from 'next';
import Link from 'next/link';
import { guides, GUIDE_SITE_URL } from '@/lib/guides';
const title = '마크다운·HWP 변환 사용 가이드 | MDView';
const description = 'HWP를 마크다운으로, 마크다운을 HWPX와 PDF로. MDView의 실제 사용 순서, 형식별 차이와 변환 후 검토할 항목을 살펴보세요.';
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: `${GUIDE_SITE_URL}/guides` },
  openGraph: { title, description, url: `${GUIDE_SITE_URL}/guides`, type: 'website', locale: 'ko_KR', siteName: 'MDView', images: ['/banner.png'] },
  twitter: { card: 'summary_large_image', title, description, images: ['/banner.png'] },
};
export default function GuidesPage() {
  return (
    <>
      <section className="guide-hero"><p className="guide-eyebrow">MDView 사용 가이드</p><h1>문서 형식은 바꾸고,<br />중요한 내용은 이어가세요.</h1><p className="guide-lead">처음 쓰는 마크다운부터 한글 문서 변환, PDF 저장까지. 작업에 맞는 순서와 놓치기 쉬운 제한을 함께 안내합니다.</p></section>
      <section aria-labelledby="choose-guide"><h2 id="choose-guide" className="guide-index-heading">어떤 작업을 하시나요?</h2><div className="guide-grid">
        {guides.map((guide, index) => <Link key={guide.slug} href={`/guides/${guide.slug}`} className="guide-card"><span className="guide-card-number">0{index + 1} / {guide.eyebrow}</span><h3>{guide.title}</h3><p>{guide.description}</p><span className="guide-card-action">사용 방법 보기 <span aria-hidden="true">↗</span></span></Link>)}
      </div></section>
      <section className="guide-note guide-index-note"><h2>내용을 옮길 때와 모양을 보존할 때</h2><p>마크다운은 내용과 구조를 정리하기 좋고, HWPX는 한글 프로그램에서 편집하기 좋습니다. PDF는 배포용 결과물에 적합합니다. 어떤 형식이든 변환 후 표, 그림, 마지막 문단을 확인하고 원본을 별도로 보관하세요.</p></section>
    </>
  );
}
