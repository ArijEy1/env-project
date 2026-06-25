'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '../../../components/admin-layout';
import { fetchAdminRegulatoryMappings, type AdminRegMapping } from '../../../lib/admin-client';
import { useLanguage } from '../../../components/language-provider';

export default function AdminRegulatoryPage() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [mappings, setMappings] = useState<AdminRegMapping[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminRegulatoryMappings().then(setMappings).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : 'Error'),
    );
  }, []);

  return (
    <main className="page-shell auth-background-page admin-background-page">
      <AdminLayout>
        <div className="admin-page-header">
          <h1>{isArabic ? 'الربط التنظيمي' : 'Regulatory Mappings'}</h1>
          <p className="admin-page-sub">{isArabic ? 'ربط الأسئلة بالأنظمة والبنود' : 'Question-to-clause mappings'}</p>
        </div>
        {error && <p className="auth-feedback auth-feedback-error">{error}</p>}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{isArabic ? 'السؤال' : 'Question'}</th>
                <th>{isArabic ? 'الجهة' : 'Authority'}</th>
                <th>{isArabic ? 'النظام' : 'Regulation'}</th>
                <th>{isArabic ? 'البند' : 'Clause'}</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id}>
                  <td><code>{m.bankQuestionId}</code><div className="admin-cell-sub">{m.questionTextEn ?? ''}</div></td>
                  <td>{m.authority ?? '—'}</td>
                  <td>{m.regulation}</td>
                  <td>{m.clause ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminLayout>
    </main>
  );
}
