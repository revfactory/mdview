import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import './globals.css';
import '@/styles/editor.css';

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
        width: 3168,
        height: 1344,
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
