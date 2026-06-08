'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '../../../components/admin-layout';
import { fetchAdminAssessments, downloadAdminReport, type AdminAssessment } from '../../../lib/admin-client';
import { useLanguage } from '../../../components/language-provider';

const MATURITY_LABELS: Record<number, { ar: string; en: string }> = {
  1: { ar: 'مبتدئ', en: 'Beginning' },
  2: { ar: 'أساسي', en: 'Basic' },
  3: { ar: 'متوسط', en: 'Intermediate' },
  4: { ar: 'متقدم', en: 'Advanced' },
  5: { ar: 'رائد', en: 'Leading' },
};

const MATURITY_COLORS: Record<number, string> = {
  1: '#E24B4A', 2: '#EF9F27', 3: '#ADD378', 4: '#5DCAA5', 5: '#0FE656',
};

export default function AdminAssessmentsPage() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [assessments, setAssessments] = useState<AdminAssessment[]>([]);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminAssessments().then(setAssessments).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error'));
  }, []);

  async function handleDownload(id: string) {
    setDownloading(id);
    try {
      await downloadAdminReport(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <main className="page-shell auth-background-page admin-background-page">
      <AdminLayout>
        <div className="admin-page-header">
          <h1>{isArabic ? 'التقييمات' : 'Assessments'}</h1>
          <p>{isArabic ? `${assessments.length} تقييم` : `${assessments.length} assessments`}</p>
        </div>

        {error && <p className="auth-feedback auth-feedback-error">{error}</p>}

        <div className="admin-table-list">
          {assessments.map((a) => {
            const levelLabel = MATURITY_LABELS[a.maturityLevel ?? 0];
            const levelColor = MATURITY_COLORS[a.maturityLevel ?? 0];
            return (
              <div key={a.id} className="admin-table-row">
                <div className="admin-table-cell admin-table-cell-main">
                  <strong>{isArabic ? a.entityNameAr : (a.entityNameEn || a.entityNameAr)}</strong>
                  <span>{a.userFullName}</span>
                </div>
                <div className="admin-table-cell">
                  <span className="admin-table-cell-label">{isArabic ? 'الحالة' : 'Status'}</span>
                  <span className={`admin-status-badge admin-status-${a.status}`}>
                    {a.status === 'submitted' ? (isArabic ? 'مكتمل' : 'Submitted') : (isArabic ? 'مسودة' : 'Draft')}
                  </span>
                </div>
                <div className="admin-table-cell">
                  <span className="admin-table-cell-label">{isArabic ? 'الدرجة' : 'Score'}</span>
                  <span>{a.totalScore != null ? a.totalScore.toFixed(1) : '—'}</span>
                </div>
                <div className="admin-table-cell">
                  <span className="admin-table-cell-label">{isArabic ? 'المستوى' : 'Level'}</span>
                  {levelLabel ? (
                    <span style={{ color: levelColor, fontWeight: 600 }}>
                      {a.maturityLevel} — {isArabic ? levelLabel.ar : levelLabel.en}
                    </span>
                  ) : <span>—</span>}
                </div>
                <div className="admin-table-cell">
                  <span className="admin-table-cell-label">{isArabic ? 'التاريخ' : 'Date'}</span>
                  <span>{new Date(a.submittedAt || a.createdAt).toLocaleDateString(isArabic ? 'ar-SA' : 'en-US')}</span>
                </div>
                <div className="admin-table-cell admin-table-cell-actions">
                  {a.status === 'submitted' && (
                    <>
                      <a href={`/assessment/${a.id}/results`} className="admin-action-link">
                        {isArabic ? 'النتائج' : 'Results'}
                      </a>
                      <button
                        className="admin-action-link"
                        onClick={() => handleDownload(a.id)}
                        disabled={downloading === a.id}
                        type="button"
                      >
                        {downloading === a.id ? '...' : (isArabic ? 'PDF' : 'PDF')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {assessments.length === 0 && !error && (
            <p style={{ color: 'rgba(245,240,230,0.5)', textAlign: 'center', padding: '24px' }}>
              {isArabic ? 'لا توجد تقييمات بعد' : 'No assessments yet'}
            </p>
          )}
        </div>
      </AdminLayout>
    </main>
  );
}
