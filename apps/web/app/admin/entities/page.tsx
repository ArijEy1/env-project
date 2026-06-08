'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../../components/admin-layout';
import { fetchAdminEntities, type AdminEntity } from '../../../lib/admin-client';
import { useLanguage } from '../../../components/language-provider';
import { useToast } from '../../../components/toast-provider';

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
  const { showToast } = useToast();
  const isArabic = language === 'ar';
  const [entities, setEntities] = useState<AdminEntity[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  useEffect(() => {
    fetchAdminEntities().then(setEntities).catch((err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : 'Error';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    });
  }, []);

  const cities = useMemo(() => [...new Set(entities.map((e) => e.city))].sort(), [entities]);
  const sectors = useMemo(() => [...new Set(entities.map((e) => e.sector))].sort(), [entities]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entities.filter((e) => {
      if (q && !e.nameAr.toLowerCase().includes(q) && !(e.nameEn ?? '').toLowerCase().includes(q) && !e.crNumber.toLowerCase().includes(q)) {
        return false;
      }
      if (sectorFilter && e.sector !== sectorFilter) return false;
      if (cityFilter && e.city !== cityFilter) return false;
      return true;
    });
  }, [entities, search, sectorFilter, cityFilter]);

  return (
    <main className="page-shell auth-background-page admin-background-page">
      <AdminLayout>
        <div className="admin-page-header">
          <h1>{isArabic ? 'المنشآت' : 'Entities'}</h1>
          <p>{isArabic ? `${filtered.length} من ${entities.length} منشأة` : `${filtered.length} of ${entities.length} entities`}</p>
        </div>

        {error && <p className="auth-feedback auth-feedback-error">{error}</p>}

        <div className="admin-filters">
          <input
            className="admin-search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isArabic ? 'بحث بالاسم أو رقم السجل...' : 'Search by name or CR number...'}
          />
          <select className="admin-filter-select" value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
            <option value="">{isArabic ? 'جميع القطاعات' : 'All sectors'}</option>
            {sectors.map((s) => {
              const label = SECTOR_LABELS[s] ?? { ar: s, en: s };
              return <option key={s} value={s}>{isArabic ? label.ar : label.en}</option>;
            })}
          </select>
          <select className="admin-filter-select" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
            <option value="">{isArabic ? 'جميع المدن' : 'All cities'}</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {(search || sectorFilter || cityFilter) && (
            <button className="admin-filter-clear" onClick={() => { setSearch(''); setSectorFilter(''); setCityFilter(''); }} type="button">
              {isArabic ? 'مسح' : 'Clear'}
            </button>
          )}
        </div>

        <div className="admin-table-list">
          {filtered.map((e) => {
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
          {filtered.length === 0 && !error && (
            <p className="admin-empty-text">
              {search || sectorFilter || cityFilter
                ? (isArabic ? 'لا توجد نتائج مطابقة' : 'No matching results')
                : (isArabic ? 'لا توجد منشآت مسجلة بعد' : 'No entities registered yet')}
            </p>
          )}
        </div>
      </AdminLayout>
    </main>
  );
}
