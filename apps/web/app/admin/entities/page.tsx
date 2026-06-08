'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '../../../components/admin-layout';
import { fetchAdminEntities, type AdminEntity } from '../../../lib/admin-client';
import { useLanguage } from '../../../components/language-provider';

const SECTOR_LABELS: Record<string, { ar: string; en: string }> = {
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

export default function AdminEntitiesPage() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [entities, setEntities] = useState<AdminEntity[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminEntities().then(setEntities).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error'));
  }, []);

  return (
    <main className="page-shell auth-background-page admin-background-page">
      <AdminLayout>
        <div className="admin-page-header">
          <h1>{isArabic ? 'المنشآت' : 'Entities'}</h1>
          <p>{isArabic ? `${entities.length} منشأة مسجلة` : `${entities.length} registered entities`}</p>
        </div>

        {error && <p className="auth-feedback auth-feedback-error">{error}</p>}

        <div className="admin-table-list">
          {entities.map((e) => {
            const sector = SECTOR_LABELS[e.sector] ?? { ar: e.sector, en: e.sector };
            return (
              <div key={e.id} className="admin-table-row">
                <div className="admin-table-cell admin-table-cell-main">
                  <strong>{isArabic ? e.nameAr : (e.nameEn || e.nameAr)}</strong>
                  <span>{e.crNumber}</span>
                </div>
                <div className="admin-table-cell">
                  <span className="admin-table-cell-label">{isArabic ? 'القطاع' : 'Sector'}</span>
                  <span>{isArabic ? sector.ar : sector.en}</span>
                </div>
                <div className="admin-table-cell">
                  <span className="admin-table-cell-label">{isArabic ? 'المدينة' : 'City'}</span>
                  <span>{e.city}</span>
                </div>
                <div className="admin-table-cell">
                  <span className="admin-table-cell-label">{isArabic ? 'المستخدمون' : 'Users'}</span>
                  <span>{e.userCount}</span>
                </div>
                <div className="admin-table-cell">
                  <span className="admin-table-cell-label">{isArabic ? 'التقييمات' : 'Assessments'}</span>
                  <span>{e.assessmentCount}</span>
                </div>
                <div className="admin-table-cell">
                  <span className="admin-table-cell-label">{isArabic ? 'التسجيل' : 'Registered'}</span>
                  <span>{new Date(e.createdAt).toLocaleDateString(isArabic ? 'ar-SA' : 'en-US')}</span>
                </div>
              </div>
            );
          })}
          {entities.length === 0 && !error && (
            <p style={{ color: 'rgba(245,240,230,0.5)', textAlign: 'center', padding: '24px' }}>
              {isArabic ? 'لا توجد منشآت مسجلة بعد' : 'No entities registered yet'}
            </p>
          )}
        </div>
      </AdminLayout>
    </main>
  );
}
