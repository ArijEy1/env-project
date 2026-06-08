'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/admin-layout';
import { fetchAdminStats, type AdminStats } from '../../lib/admin-client';
import { useLanguage } from '../../components/language-provider';

export default function AdminDashboardPage() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminStats().then(setStats).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error'));
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
          </div>
        )}
      </AdminLayout>
    </main>
  );
}
