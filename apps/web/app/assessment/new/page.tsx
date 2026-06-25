'use client';

import { useEffect, useState } from 'react';
import { createAssessment, listAssessments } from '../../../lib/assessment-client';
import { authStorage, fetchProfile, type AuthUser } from '../../../lib/auth-client';
import {
  ENTITY_TYPE_OPTIONS,
  EXPOSURE_OPTIONS,
  SECTOR_OPTIONS,
  optionLabel,
} from '../../../lib/profile-options';
import { useLanguage } from '../../../components/language-provider';

export default function NewAssessmentPage() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem(authStorage.tokenKey);
      if (!token) {
        window.location.replace('/login');
        return;
      }
      try {
        // Resume an existing draft instead of forcing a new one.
        const list = await listAssessments();
        const draft = list.find((a) => a.status === 'draft');
        if (draft) {
          window.location.replace(`/assessment/${draft.id}`);
          return;
        }
        setProfile(await fetchProfile(token));
      } catch (err) {
        setError(err instanceof Error ? err.message : isArabic ? 'تعذر تحميل البيانات' : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [isArabic]);

  async function handleConfirm() {
    setIsStarting(true);
    setError('');
    try {
      const assessment = await createAssessment();
      window.location.replace(`/assessment/${assessment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : isArabic ? 'تعذر بدء التقييم' : 'Failed to start assessment');
      setIsStarting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="page-shell auth-background-page" style={{ padding: '48px 0' }}>
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(245,240,230,0.8)' }}>{isArabic ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </main>
    );
  }

  const entity = profile?.entity;
  const exposureOverridden =
    !!entity?.submittedExposure &&
    entity.submittedExposure !== entity.environmentalExposure;

  const rows = entity
    ? [
        { label: isArabic ? 'اسم المنشأة' : 'Organization', value: (isArabic ? entity.nameAr : entity.nameEn) || entity.nameAr },
        { label: isArabic ? 'نوع المنشأة' : 'Entity type', value: optionLabel(ENTITY_TYPE_OPTIONS, entity.entityType, isArabic) },
        { label: isArabic ? 'القطاع' : 'Sector', value: optionLabel(SECTOR_OPTIONS, entity.sector, isArabic) },
        { label: isArabic ? 'حجم المنشأة' : 'Size', value: entity.employeeCountBracket || (isArabic ? 'غير محدد' : 'Not set') },
        { label: isArabic ? 'مستوى التعرض البيئي' : 'Environmental exposure', value: optionLabel(EXPOSURE_OPTIONS, entity.environmentalExposure, isArabic) },
      ]
    : [];

  return (
    <main className="page-shell auth-background-page" style={{ padding: '48px 0' }}>
      <section className="register-shell">
        <div className="register-card profile-confirm-card">
          <div className="register-card-header">
            <h1>{isArabic ? 'تأكيد ملف المنشأة' : 'Confirm your profile'}</h1>
            <p>{isArabic ? 'يرجى مراجعة بيانات منشأتك قبل بدء التقييم. لا يمكن تعديل الملف بعد بدء التقييم.' : 'Review your organization profile before starting. The profile cannot be changed once the assessment starts.'}</p>
          </div>

          {error ? <p className="auth-feedback auth-feedback-error register-feedback">{error}</p> : null}

          <div className="profile-confirm-grid">
            {rows.map((r) => (
              <div className="profile-confirm-row" key={r.label}>
                <span>{r.label}</span>
                <strong>{r.value}</strong>
              </div>
            ))}
          </div>

          {exposureOverridden ? (
            <p className="auth-feedback profile-exposure-note">
              {isArabic
                ? `تم تعديل مستوى التعرض البيئي تلقائيًا من «${optionLabel(EXPOSURE_OPTIONS, entity?.submittedExposure, true)}» إلى «${optionLabel(EXPOSURE_OPTIONS, entity?.environmentalExposure, true)}» بناءً على القطاع والحجم.`
                : `Environmental exposure was automatically adjusted from "${optionLabel(EXPOSURE_OPTIONS, entity?.submittedExposure, false)}" to "${optionLabel(EXPOSURE_OPTIONS, entity?.environmentalExposure, false)}" based on your sector and size.`}
            </p>
          ) : null}

          <div className="register-actions">
            <a className="secondary-btn register-cancel-button" href="/account">{isArabic ? 'العودة' : 'Back'}</a>
            <button className="primary-btn register-submit-button" onClick={handleConfirm} disabled={isStarting}>
              {isStarting ? (isArabic ? 'جارٍ البدء...' : 'Starting...') : (isArabic ? 'تأكيد وبدء التقييم' : 'Confirm and start')}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
