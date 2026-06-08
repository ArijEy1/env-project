'use client';

import { useEffect, useState } from 'react';
import { createAssessment, listAssessments } from '../../../lib/assessment-client';
import { useLanguage } from '../../../components/language-provider';

export default function NewAssessmentPage() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [error, setError] = useState('');

  useEffect(() => {
    async function start() {
      try {
        const list = await listAssessments();
        const draft = list.find((a) => a.status === 'draft');
        if (draft) {
          window.location.replace(`/assessment/${draft.id}`);
          return;
        }
        const assessment = await createAssessment();
        window.location.replace(`/assessment/${assessment.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : isArabic ? 'فشل في بدء التقييم' : 'Failed to start assessment');
      }
    }
    void start();
  }, [isArabic]);

  if (error) {
    return (
      <main className="page-shell auth-background-page" style={{ padding: '48px 0' }}>
        <div style={{ maxWidth: 500, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <p className="auth-feedback auth-feedback-error">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell auth-background-page" style={{ padding: '48px 0' }}>
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ color: 'rgba(245,240,230,0.8)' }}>{isArabic ? 'جاري تحضير التقييم...' : 'Preparing assessment...'}</p>
      </div>
    </main>
  );
}
