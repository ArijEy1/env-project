'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { authStorage } from '../lib/auth-client';
import { useLanguage } from './language-provider';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigationId = useId();

  const isArabic = language === 'ar';
  const isAuthenticated = hasSession === true;

  const links = [
    { href: '/', label: isArabic ? 'الرئيسية' : 'Home' },
    { href: '/#why-platform', label: isArabic ? 'لماذا الأداة؟' : 'Why It Works' },
    { href: '/#domains', label: isArabic ? 'مجالات التقييم' : 'Domains' },
    { href: '/#reports', label: isArabic ? 'التقارير' : 'Reports' },
    ...(isAuthenticated
      ? [
          { href: '/assessment/new', label: isArabic ? 'بدء التقييم' : 'Start Assessment' },
          { href: '/account', label: isArabic ? 'حسابي' : 'My Account' },
          ...(userRole === 'superadmin'
            ? [{ href: '/admin', label: isArabic ? 'لوحة التحكم' : 'Admin Panel' }]
            : []),
        ]
      : [{ href: '/login', label: isArabic ? 'تسجيل الدخول' : 'Login' }]),
  ];

  useEffect(() => {
    function syncSessionState() {
      const storedToken = localStorage.getItem(authStorage.tokenKey) ?? sessionStorage.getItem(authStorage.tokenKey);
      setHasSession(Boolean(storedToken));
      try {
        const userData = localStorage.getItem(authStorage.userKey);
        if (userData) {
          const parsed = JSON.parse(userData) as { role?: string };
          setUserRole(parsed.role ?? null);
        } else {
          setUserRole(null);
        }
      } catch {
        setUserRole(null);
      }
    }

    syncSessionState();
    setIsMenuOpen(false);

    window.addEventListener('storage', syncSessionState);

    return () => {
      window.removeEventListener('storage', syncSessionState);
    };
  }, [pathname]);

  function handleLogout() {
    localStorage.removeItem(authStorage.tokenKey);
    localStorage.removeItem(authStorage.userKey);
    localStorage.removeItem(authStorage.refreshedAtKey);
    sessionStorage.removeItem(authStorage.tokenKey);
    sessionStorage.removeItem(authStorage.userKey);
    setHasSession(false);
    setUserRole(null);
    setIsMenuOpen(false);
    router.push('/login');
    router.refresh();
  }

  function closeMenu() {
    setIsMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className={`site-header-inner${isMenuOpen ? ' is-menu-open' : ''}`}>
        <Link className="site-brand" href="/">
          <span className="site-brand-mark">NE</span>
          <span className="site-brand-copy">
            <strong>{isArabic ? 'الأداة الوطنية' : 'National Tool'}</strong>
            <small>{isArabic ? 'منصة تقييم الامتثال البيئي' : 'Environmental compliance platform'}</small>
          </span>
        </Link>

        <button
          aria-controls={navigationId}
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? (isArabic ? 'إغلاق القائمة' : 'Close menu') : isArabic ? 'فتح القائمة' : 'Open menu'}
          className={`site-header-menu-toggle${isMenuOpen ? ' is-open' : ''}`}
          onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>

        <nav aria-label={isArabic ? 'التنقل الرئيسي' : 'Primary navigation'} className="site-nav" id={navigationId}>
          {links.map((link) => {
            const isActive =
              link.href === '/'
                ? pathname === '/'
                : link.href.startsWith('/#')
                  ? pathname === '/'
                  : pathname === link.href;

            return (
              <Link
                key={link.href}
                className={`site-nav-link${isActive ? ' is-active' : ''}`}
                href={link.href}
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="site-header-actions">
          <div className="language-switcher" role="group" aria-label={isArabic ? 'تبديل اللغة' : 'Language switch'}>
            <button
              className={`language-switcher-button${language === 'ar' ? ' is-active' : ''}`}
              onClick={() => {
                setLanguage('ar');
                closeMenu();
              }}
              type="button"
            >
              AR
            </button>
            <button
              className={`language-switcher-button${language === 'en' ? ' is-active' : ''}`}
              onClick={() => {
                setLanguage('en');
                closeMenu();
              }}
              type="button"
            >
              EN
            </button>
          </div>
          <span className={`session-badge${hasSession ? ' is-online' : ''}`}>
            {isAuthenticated ? (isArabic ? 'جلسة نشطة' : 'Active session') : isArabic ? 'زائر' : 'Guest'}
          </span>
          {isAuthenticated ? (
            <button className="secondary-btn site-header-button" onClick={handleLogout} type="button">
              {isArabic ? 'تسجيل الخروج' : 'Logout'}
            </button>
          ) : (
            <Link className="primary-btn site-header-button" href="/register" onClick={closeMenu}>
              {isArabic ? 'ابدأ الآن' : 'Start now'}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}