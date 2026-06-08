'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  authStorage,
  fetchProfile,
  updateEntity,
  updateProfile,
  type AuthUser,
} from '../lib/auth-client';
import { listAssessments, type AssessmentListItem } from '../lib/assessment-client';
import { translateError } from '../lib/error-messages';
import { useLanguage } from './language-provider';

export function AccountPanel() {
  const { language } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingEntity, setEditingEntity] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assessments, setAssessments] = useState<AssessmentListItem[]>([]);
  const isArabic = language === 'ar';

  // Profile edit state
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editJobRole, setEditJobRole] = useState('');

  // Entity edit state
  const [editNameAr, setEditNameAr] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');

  useEffect(() => {
    async function loadProfile() {
      const token = localStorage.getItem(authStorage.tokenKey);

      if (!token) {
        setError(isArabic ? 'لا توجد جلسة نشطة. يرجى تسجيل الدخول أولاً.' : 'No active session. Please log in first.');
        setIsLoading(false);
        return;
      }

      try {
        const profile = await fetchProfile(token);
        setUser(profile);
        localStorage.setItem(authStorage.userKey, JSON.stringify(profile));
        try {
          const assessmentList = await listAssessments();
          setAssessments(assessmentList);
        } catch {
          // Non-critical, don't block account page
        }
      } catch (profileError) {
        setError(
          profileError instanceof Error
            ? translateError(profileError.message, isArabic)
            : isArabic ? 'تعذر تحميل بيانات المستخدم.' : 'Unable to load user data.',
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
    setError(isArabic ? 'تم إنهاء الجلسة.' : 'Session cleared.');
  }

  function startEditProfile() {
    if (!user) return;
    setEditFirstName(user.firstName);
    setEditLastName(user.lastName ?? '');
    setEditPhone(user.phone ?? '');
    setEditJobRole(user.jobRole ?? '');
    setEditingProfile(true);
  }

  function startEditEntity() {
    if (!user) return;
    setEditNameAr(user.entity.nameAr);
    setEditNameEn(user.entity.nameEn ?? '');
    setEditContactEmail(user.entity.contactEmail ?? '');
    setEditContactPhone(user.entity.contactPhone ?? '');
    setEditingEntity(true);
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem(authStorage.tokenKey)!;
      const updated = await updateProfile(token, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim() || undefined,
        phone: editPhone.trim() || undefined,
        jobRole: editJobRole.trim() || undefined,
      });
      setUser(updated);
      localStorage.setItem(authStorage.userKey, JSON.stringify(updated));
      setEditingProfile(false);
    } catch (err) {
      setError(err instanceof Error ? translateError(err.message, isArabic) : isArabic ? 'فشل التحديث.' : 'Update failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEntity(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem(authStorage.tokenKey)!;
      const updatedEntity = await updateEntity(token, {
        nameAr: editNameAr.trim(),
        nameEn: editNameEn.trim() || undefined,
        contactEmail: editContactEmail.trim() || undefined,
        contactPhone: editContactPhone.trim() || undefined,
      });
      setUser((prev) => prev ? { ...prev, entity: updatedEntity } : prev);
      setEditingEntity(false);
    } catch (err) {
      setError(err instanceof Error ? translateError(err.message, isArabic) : isArabic ? 'فشل التحديث.' : 'Update failed.');
    } finally {
      setSaving(false);
    }
  }

  const sectorLabels: Record<string, { ar: string; en: string }> = {
    industrial: { ar: 'صناعي', en: 'Industrial' },
    oil_and_gas: { ar: 'نفط وغاز', en: 'Oil & Gas' },
    manufacturing: { ar: 'تصنيع', en: 'Manufacturing' },
    construction: { ar: 'إنشاءات', en: 'Construction' },
    services: { ar: 'خدمات', en: 'Services' },
    government: { ar: 'حكومي', en: 'Government' },
    healthcare: { ar: 'رعاية صحية', en: 'Healthcare' },
    education: { ar: 'تعليم', en: 'Education' },
    other: { ar: 'أخرى', en: 'Other' },
  };

  if (isLoading) {
    return (
      <section className="auth-page-shell">
        <div className="auth-page-card auth-form-card">
          <p className="auth-feedback">{isArabic ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="auth-page-shell">
        <div className="auth-page-card auth-form-card">
          <p className="auth-feedback auth-feedback-error">{error}</p>
          <div className="auth-inline-links">
            <Link href="/login">{isArabic ? 'تسجيل الدخول' : 'Log in'}</Link>
            <Link href="/register">{isArabic ? 'إنشاء حساب' : 'Create account'}</Link>
          </div>
        </div>
      </section>
    );
  }

  const entity = user.entity;
  const sectorLabel = sectorLabels[entity.sector] ?? { ar: entity.sector, en: entity.sector };

  return (
    <section className="account-page-shell">
      <div className="account-page-header">
        <div>
          <h1>{isArabic ? `مرحبًا، ${user.firstName}` : `Welcome, ${user.firstName}`}</h1>
          <p>{isArabic ? 'إدارة حسابك وبيانات المنشأة' : 'Manage your account and organization details'}</p>
        </div>
      </div>

      {error ? <p className="auth-feedback auth-feedback-error">{error}</p> : null}

      {/* Assessment Card */}
      <div className="account-card account-assessment-card">
        <div className="account-card-header">
          <h2>{isArabic ? 'التقييم البيئي' : 'Environmental Assessment'}</h2>
        </div>
        {(() => {
          const draft = assessments.find((a) => a.status === 'draft');
          const submitted = assessments.filter((a) => a.status === 'submitted');

          return (
            <>
              {draft ? (
                <div className="account-assessment-draft">
                  <p className="account-assessment-draft-label">
                    {isArabic ? 'لديك تقييم غير مكتمل' : 'You have an incomplete assessment'}
                  </p>
                  <div className="account-assessment-progress">
                    <div className="account-assessment-progress-bar">
                      <div className="account-assessment-progress-fill" style={{ width: `${(draft.answeredCount / draft.totalQuestions) * 100}%` }} />
                    </div>
                    <span className="account-assessment-progress-text">
                      {draft.answeredCount} / {draft.totalQuestions}
                    </span>
                  </div>
                  <a href={`/assessment/${draft.id}`} className="primary-btn account-assessment-btn">
                    {isArabic ? 'متابعة التقييم' : 'Continue Assessment'}
                  </a>
                </div>
              ) : (
                <a href="/assessment/new" className="primary-btn account-assessment-btn">
                  {isArabic ? 'بدء تقييم جديد' : 'Start New Assessment'}
                </a>
              )}
              {submitted.length > 0 && (
                <div className="account-assessment-history">
                  <p className="account-assessment-history-label">
                    {isArabic ? 'التقييمات السابقة' : 'Previous assessments'}
                  </p>
                  {submitted.map((a) => (
                    <a key={a.id} href={`/assessment/${a.id}/results`} className="account-assessment-history-item">
                      <span>{new Date(a.submittedAt!).toLocaleDateString(isArabic ? 'ar-SA' : 'en-US')}</span>
                      <span className="account-assessment-history-score">
                        {a.totalScore?.toFixed(1)} / 100
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Entity Card */}
      <div className="account-card">
        <div className="account-card-header">
          <h2><span className="account-card-icon">&#9679;</span>{isArabic ? 'بيانات المنشأة' : 'Organization details'}</h2>
          {user.role === 'admin' && !editingEntity && (
            <button className="secondary-btn account-edit-btn" onClick={startEditEntity} type="button">
              {isArabic ? 'تعديل' : 'Edit'}
            </button>
          )}
        </div>

        {editingEntity ? (
          <form className="account-edit-form" onSubmit={handleSaveEntity}>
            <label className="account-edit-field">
              <span>{isArabic ? 'الاسم (عربي)' : 'Name (Arabic)'}</span>
              <input value={editNameAr} onChange={(e) => setEditNameAr(e.target.value)} required />
            </label>
            <label className="account-edit-field">
              <span>{isArabic ? 'الاسم (إنجليزي)' : 'Name (English)'}</span>
              <input value={editNameEn} onChange={(e) => setEditNameEn(e.target.value)} />
            </label>
            <label className="account-edit-field">
              <span>{isArabic ? 'البريد الإلكتروني' : 'Contact email'}</span>
              <input type="email" value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} />
            </label>
            <label className="account-edit-field">
              <span>{isArabic ? 'الهاتف' : 'Contact phone'}</span>
              <input type="tel" value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} />
            </label>
            <div className="account-edit-actions">
              <button className="secondary-btn" onClick={() => setEditingEntity(false)} type="button">{isArabic ? 'إلغاء' : 'Cancel'}</button>
              <button className="primary-btn" disabled={saving} type="submit">{saving ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'حفظ' : 'Save')}</button>
            </div>
          </form>
        ) : (
          <div className="account-grid">
            <div className="account-item"><span>{isArabic ? 'الاسم (عربي)' : 'Name (Arabic)'}</span><strong>{entity.nameAr}</strong></div>
            {entity.nameEn && <div className="account-item"><span>{isArabic ? 'الاسم (إنجليزي)' : 'Name (English)'}</span><strong>{entity.nameEn}</strong></div>}
            <div className="account-item"><span>{isArabic ? 'السجل التجاري' : 'CR number'}</span><strong>{entity.crNumber}</strong></div>
            <div className="account-item"><span>{isArabic ? 'القطاع' : 'Sector'}</span><strong>{isArabic ? sectorLabel.ar : sectorLabel.en}</strong></div>
            <div className="account-item"><span>{isArabic ? 'المدينة' : 'City'}</span><strong>{entity.city}</strong></div>
            {entity.region && <div className="account-item"><span>{isArabic ? 'المنطقة' : 'Region'}</span><strong>{entity.region}</strong></div>}
            {entity.employeeCountBracket && <div className="account-item"><span>{isArabic ? 'عدد الموظفين' : 'Employees'}</span><strong>{entity.employeeCountBracket}</strong></div>}
            {entity.contactEmail && <div className="account-item"><span>{isArabic ? 'البريد' : 'Email'}</span><strong>{entity.contactEmail}</strong></div>}
            {entity.contactPhone && <div className="account-item"><span>{isArabic ? 'الهاتف' : 'Phone'}</span><strong>{entity.contactPhone}</strong></div>}
            {entity.unifiedNationalNumber && <div className="account-item"><span>{isArabic ? 'الرقم الموحد' : 'Unified number'}</span><strong>{entity.unifiedNationalNumber}</strong></div>}
          </div>
        )}
      </div>

      {/* User Card */}
      <div className="account-card">
        <div className="account-card-header">
          <h2><span className="account-card-icon">&#9734;</span>{isArabic ? 'معلوماتك' : 'Your profile'}</h2>
          {!editingProfile && (
            <button className="secondary-btn account-edit-btn" onClick={startEditProfile} type="button">
              {isArabic ? 'تعديل' : 'Edit'}
            </button>
          )}
        </div>

        {editingProfile ? (
          <form className="account-edit-form" onSubmit={handleSaveProfile}>
            <label className="account-edit-field">
              <span>{isArabic ? 'الاسم الأول' : 'First name'}</span>
              <input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} required />
            </label>
            <label className="account-edit-field">
              <span>{isArabic ? 'الاسم الأخير' : 'Last name'}</span>
              <input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
            </label>
            <label className="account-edit-field">
              <span>{isArabic ? 'الجوال' : 'Phone'}</span>
              <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </label>
            <label className="account-edit-field">
              <span>{isArabic ? 'الدور الوظيفي' : 'Job role'}</span>
              <input value={editJobRole} onChange={(e) => setEditJobRole(e.target.value)} />
            </label>
            <div className="account-edit-actions">
              <button className="secondary-btn" onClick={() => setEditingProfile(false)} type="button">{isArabic ? 'إلغاء' : 'Cancel'}</button>
              <button className="primary-btn" disabled={saving} type="submit">{saving ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'حفظ' : 'Save')}</button>
            </div>
          </form>
        ) : (
          <div className="account-grid">
            <div className="account-item"><span>{isArabic ? 'الاسم الكامل' : 'Full name'}</span><strong>{user.fullName}</strong></div>
            <div className="account-item"><span>{isArabic ? 'البريد الإلكتروني' : 'Email'}</span><strong>{user.email}</strong></div>
            {user.phone && <div className="account-item"><span>{isArabic ? 'الجوال' : 'Phone'}</span><strong>{user.phone}</strong></div>}
            {user.jobRole && <div className="account-item"><span>{isArabic ? 'الدور الوظيفي' : 'Job role'}</span><strong>{user.jobRole}</strong></div>}
            <div className="account-item"><span>{isArabic ? 'الصلاحية' : 'Role'}</span><strong><span className={`account-role-badge ${user.role === 'admin' ? 'account-role-badge-admin' : 'account-role-badge-user'}`}>{user.role === 'admin' ? (isArabic ? 'مسؤول' : 'Admin') : (isArabic ? 'مستخدم' : 'User')}</span></strong></div>
            <div className="account-item"><span>{isArabic ? 'تاريخ الإنشاء' : 'Created'}</span><strong>{new Date(user.createdAt).toLocaleDateString(isArabic ? 'ar-SA' : 'en-US')}</strong></div>
          </div>
        )}
      </div>

      <button className="secondary-btn account-logout-btn" onClick={logout} type="button">
        {isArabic ? 'تسجيل الخروج' : 'Log out'}
      </button>
    </section>
  );
}
