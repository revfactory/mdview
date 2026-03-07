import type { Metadata } from 'next';
import Script from 'next/script';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import './globals.css';
import '@/styles/editor.css';

const GA_ID = 'G-DC9P5XSZXR';

export const metadata: Metadata = {
  title: 'MDView - Markdown Editor',
  description: '마크다운 에디터. 문서는 서버에 전송되지 않으며 브라우저에만 저장됩니다.',
  metadataBase: new URL('https://www.mdview.kr'),
  openGraph: {
    title: 'MDView - Markdown Editor',
    description: '마크다운 에디터. 문서는 서버에 전송되지 않으며 브라우저에만 저장됩니다.',
    url: 'https://www.mdview.kr',
    siteName: 'MDView',
    images: [
      {
        url: '/banner.png',
        width: 1200,
        height: 509,
        alt: 'MDView - Markdown Editor',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MDView - Markdown Editor',
    description: '마크다운 에디터. 문서는 서버에 전송되지 않으며 브라우저에만 저장됩니다.',
    images: ['/banner.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
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
        <link rel="manifest" href="/manifest.json" />
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
