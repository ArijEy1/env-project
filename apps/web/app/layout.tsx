import type { Metadata } from 'next';
import { Noto_Sans_Arabic } from 'next/font/google';
import { LanguageProvider } from '../components/language-provider';
import { Navbar } from '../components/navbar';
import { ToastProvider } from '../components/toast-provider';
import './globals.css';

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-arabic',
});

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
      <body className={notoSansArabic.variable}>
        <LanguageProvider>
          <ToastProvider>
            <Navbar />
            {children}
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
