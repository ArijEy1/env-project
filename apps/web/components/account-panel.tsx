'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authStorage, fetchProfile, type AuthUser } from '../lib/auth-client';
import { useLanguage } from './language-provider';

export function AccountPanel() {
  const { language } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const isArabic = language === 'ar';

  useEffect(() => {
    async function loadProfile() {
      const token = localStorage.getItem(authStorage.tokenKey);
      const fallbackUser = localStorage.getItem(authStorage.userKey);

      if (!token) {
        setError(isArabic ? 'لا توجد جلسة نشطة. يرجى تسجيل الدخول أولاً.' : 'No active session found. Please log in first.');
        setIsLoading(false);
        return;
      }

      if (fallbackUser) {
        try {
          setUser(JSON.parse(fallbackUser) as AuthUser);
        } catch {
          localStorage.removeItem(authStorage.userKey);
        }
      }

      try {
        const profile = await fetchProfile(token);
        setUser(profile);
        localStorage.setItem(authStorage.userKey, JSON.stringify(profile));
      } catch (profileError) {
        setError(
          profileError instanceof Error
            ? profileError.message
            : isArabic
              ? 'تعذر تحميل بيانات المستخدم الحالي.'
              : 'Unable to load the current user.',
        );
        localStorage.removeItem(authStorage.tokenKey);
        localStorage.removeItem(authStorage.userKey);
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [isArabic]);

  function logout() {
    localStorage.removeItem(authStorage.tokenKey);
    localStorage.removeItem(authStorage.userKey);
    setUser(null);
    setError(isArabic ? 'تم إنهاء الجلسة. يمكنك تسجيل الدخول مرة أخرى.' : 'Session cleared. You can log in again.');
  }

  return (
    <section className="auth-page-shell">
      <div className="auth-page-card auth-page-copy">
        <span className="section-label">{isArabic ? 'الحساب' : 'Account'}</span>
        <h1>{isArabic ? 'جلسة المستخدم الحالية' : 'Current user session'}</h1>
        <p>
          {isArabic
            ? 'تقرأ هذه الصفحة رمز JWT من التخزين المحلي ثم تستدعي `GET /api/auth/me` للتحقق من أن الجلسة ما زالت صالحة.'
            : 'This page reads the JWT from local storage and calls `GET /api/auth/me` to confirm the session is still valid.'}
        </p>
        <div className="auth-page-points">
          <div className="auth-page-point">{isArabic ? 'استدعاء محمي للواجهة' : 'Protected API call'}</div>
          <div className="auth-page-point">{isArabic ? 'حفظ الرمز محليًا' : 'Local token persistence'}</div>
          <div className="auth-page-point">{isArabic ? 'تسجيل خروج سريع' : 'Quick logout action'}</div>
        </div>
      </div>

      <div className="auth-page-card auth-form-card">
        {isLoading ? <p className="auth-feedback">{isArabic ? 'جاري تحميل الملف الشخصي...' : 'Loading profile...'}</p> : null}

        {!isLoading && user ? (
          <div className="account-grid">
            <div className="account-item">
              <span>{isArabic ? 'الاسم الكامل' : 'Full name'}</span>
              <strong>{user.fullName}</strong>
            </div>
            <div className="account-item">
              <span>{isArabic ? 'البريد الإلكتروني' : 'Email'}</span>
              <strong>{user.email}</strong>
            </div>
            <div className="account-item">
              <span>{isArabic ? 'معرف المستخدم' : 'User ID'}</span>
              <strong>{user.id}</strong>
            </div>
            <div className="account-item">
              <span>{isArabic ? 'تاريخ الإنشاء' : 'Created at'}</span>
              <strong>{new Date(user.createdAt).toLocaleString(isArabic ? 'ar-SA' : 'en-US')}</strong>
            </div>
            <button className="secondary-btn auth-submit" onClick={logout} type="button">
              {isArabic ? 'تسجيل الخروج' : 'Log out'}
            </button>
          </div>
        ) : null}

        {!isLoading && !user && error ? (
          <>
            <p className="auth-feedback auth-feedback-error">{error}</p>
            <div className="auth-inline-links">
              <Link href="/login">{isArabic ? 'الذهاب إلى تسجيل الدخول' : 'Go to login'}</Link>
              <Link href="/register">{isArabic ? 'إنشاء حساب' : 'Create account'}</Link>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
