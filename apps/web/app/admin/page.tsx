'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/admin-layout';
import { fetchAdminStats, type AdminStats } from '../../lib/admin-client';
import { useLanguage } from '../../components/language-provider';
import { useToast } from '../../components/toast-provider';

export default function AdminDashboardPage() {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === 'ar';
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminStats().then(setStats).catch((err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : 'Error';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    });
  }, []);

  return (
    <main className="page-shell auth-background-page admin-background-page">
      <AdminLayout>
        <div className="admin-page-header">
          <h1>{isArabic ? 'نظرة عامة' : 'Overview'}</h1>
        </div>

        {error && <p className="auth-feedback auth-feedback-error">{error}</p>}

        {stats && (
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="admin-stat-value">{stats.totalEntities}</span>
              <span className="admin-stat-label">{isArabic ? 'المنشآت' : 'Entities'}</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-value">{stats.totalUsers}</span>
              <span className="admin-stat-label">{isArabic ? 'المستخدمون' : 'Users'}</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-value">{stats.submittedAssessments} / {stats.totalAssessments}</span>
              <span className="admin-stat-label">{isArabic ? 'التقييمات المكتملة' : 'Completed Assessments'}</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-value">{stats.averageScore?.toFixed(1) ?? '—'}</span>
              <span className="admin-stat-label">{isArabic ? 'متوسط الدرجات' : 'Average Score'}</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-value">{stats.averageMaturity?.toFixed(2) ?? '—'}</span>
              <span className="admin-stat-label">{isArabic ? 'متوسط النضج' : 'Average Maturity'}</span>
            </div>
          </div>
        )}

        {stats && stats.bySector.length > 0 && (
          <div className="admin-sector-section">
            <h2 className="admin-section-title">{isArabic ? 'حسب القطاع' : 'By Sector'}</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{isArabic ? 'القطاع' : 'Sector'}</th>
                    <th>{isArabic ? 'المنشآت' : 'Entities'}</th>
                    <th>{isArabic ? 'تقييمات مكتملة' : 'Completed'}</th>
                    <th>{isArabic ? 'متوسط النضج' : 'Avg Maturity'}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.bySector.map((s) => (
                    <tr key={s.sector}>
                      <td>{s.sector}</td>
                      <td>{s.entityCount}</td>
                      <td>{s.completed}</td>
                      <td>{s.averageMaturity?.toFixed(2) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="admin-page-sub" style={{ marginTop: 16 }}>
          {isArabic ? 'ملاحظة: تتبّع تنزيلات التقارير غير مُفعّل بعد.' : 'Note: report-download tracking is not enabled yet.'}
        </p>
      </AdminLayout>
    </main>
  );
}
