import type { Metadata } from 'next';
import { LanguageProvider } from '../components/language-provider';
import { Navbar } from '../components/navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'الأداة الوطنية',
  description: 'منصة وطنية لتقييم الامتثال البيئي بهوية عربية واتجاه كتابة من اليمين إلى اليسار.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html dir="rtl" lang="ar">
      <body>
        <LanguageProvider>
          <Navbar />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
