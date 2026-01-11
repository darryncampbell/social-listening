import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Social Listening',
  description: 'Social Listening Application',
};

// Script to prevent flash of wrong theme
const themeScript = `
  (function() {
    try {
      var mode = localStorage.getItem('theme-mode');
      var theme = 'dark';
      
      if (mode === 'light') {
        theme = 'light';
      } else if (mode === 'dark') {
        theme = 'dark';
      } else {
        // Auto mode - check system preference
        if (window.matchMedia('(prefers-color-scheme: light)').matches) {
          theme = 'light';
        }
      }
      
      document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <Header />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
