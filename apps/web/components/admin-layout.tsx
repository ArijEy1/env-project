'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from './language-provider';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { language } = useLanguage();
  const pathname = usePathname();
  const isArabic = language === 'ar';

  const navItems = [
    { href: '/admin', label: isArabic ? 'لوحة التحكم' : 'Dashboard', exact: true },
    { href: '/admin/entities', label: isArabic ? 'المنشآت' : 'Entities', exact: false },
    { href: '/admin/assessments', label: isArabic ? 'التقييمات' : 'Assessments', exact: false },
  ];

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2>{isArabic ? 'لوحة التحكم' : 'Admin Panel'}</h2>
          <Link href="/account" className="admin-back-link">
            {isArabic ? '← العودة للمنصة' : '← Back to platform'}
          </Link>
        </div>
        <nav className="admin-nav">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-item ${isActive ? 'admin-nav-item-active' : ''}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
