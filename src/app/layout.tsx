import type { Metadata } from 'next';
import Script from 'next/script';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import './globals.css';
import '@/styles/editor.css';

const GA_ID = 'G-DC9P5XSZXR';

export const metadata: Metadata = {
  title: 'MDView - 무료 온라인 마크다운 에디터 | HWP 변환 지원',
  description:
    '무료 온라인 마크다운 에디터. HWP/HWPX 변환, WYSIWYG 편집, 실시간 미리보기를 지원합니다. 문서는 서버에 전송되지 않으며 브라우저에만 안전하게 저장됩니다.',
  metadataBase: new URL('https://www.mdview.kr'),
  keywords: [
    '마크다운 에디터',
    'markdown editor',
    '온라인 에디터',
    'HWP 변환',
    'HWPX',
    '한글 변환',
    '문서 편집기',
    'WYSIWYG',
    '무료 에디터',
    '마크다운 뷰어',
  ],
  alternates: {
    canonical: 'https://www.mdview.kr',
  },
  openGraph: {
    title: 'MDView - 무료 온라인 마크다운 에디터',
    description:
      'HWP 변환 지원 마크다운 에디터. WYSIWYG 편집, 실시간 미리보기. 브라우저에서 안전하게 문서를 작성하세요.',
    url: 'https://www.mdview.kr',
    siteName: 'MDView',
    images: [
      {
        url: '/banner.png',
        width: 1200,
        height: 670,
        alt: 'MDView - 무료 온라인 마크다운 에디터',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MDView - 무료 온라인 마크다운 에디터',
    description:
      'HWP 변환 지원 마크다운 에디터. WYSIWYG 편집, 실시간 미리보기. 브라우저에서 안전하게 문서를 작성하세요.',
    images: ['/banner.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  applicationName: 'MDView',
  category: 'productivity',
  classification: 'Markdown Editor',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MDView',
  url: 'https://www.mdview.kr',
  description:
    '무료 온라인 마크다운 에디터. HWP/HWPX 변환, WYSIWYG 편집, 실시간 미리보기를 지원합니다.',
  applicationCategory: 'ProductivityApplication',
  operatingSystem: 'Web',
  browserRequirements: 'Requires JavaScript. Requires HTML5.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'KRW',
  },
  featureList: [
    '마크다운 WYSIWYG 편집',
    'HWP/HWPX 파일 변환',
    '실시간 미리보기',
    '오프라인 저장 (브라우저)',
    '다크 모드',
    '문서 내보내기',
  ],
  inLanguage: 'ko',
  isAccessibleForFree: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="google-adsense-account" content="ca-pub-5006269656255106" />
        <link rel="manifest" href="/manifest.json" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="font-sans antialiased">
        <ErrorBoundary>
        {children}
        </ErrorBoundary>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              fontFamily: 'var(--font-sans)',
            },
          }}
        />
        <ThemeScript />
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}

function ThemeScript() {
  const script = `
    (function() {
      try {
        var theme = localStorage.getItem('mdview-theme');
        if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
        }
      } catch(e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
