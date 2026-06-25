'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '../../../components/admin-layout';
import { fetchAdminQuestions, updateAdminQuestion, type AdminQuestion } from '../../../lib/admin-client';
import { useLanguage } from '../../../components/language-provider';
import { useToast } from '../../../components/toast-provider';

export default function AdminQuestionsPage() {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === 'ar';
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminQuestions().then(setQuestions).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : 'Error'),
    );
  }, []);

  async function toggle(q: AdminQuestion) {
    setBusy(q.id);
    try {
      await updateAdminQuestion(q.id, { active: !q.active });
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, active: !x.active } : x)));
      showToast(isArabic ? 'تم التحديث' : 'Updated', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function saveWeight(q: AdminQuestion, value: number) {
    if (Number.isNaN(value) || value === q.baseWeight) return;
    try {
      await updateAdminQuestion(q.id, { baseWeight: value });
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, baseWeight: value } : x)));
      showToast(isArabic ? 'تم حفظ الوزن' : 'Weight saved', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  const activeCount = questions.filter((q) => q.active).length;

  return (
    <main className="page-shell auth-background-page admin-background-page">
      <AdminLayout>
        <div className="admin-page-header">
          <h1>{isArabic ? 'بنك الأسئلة' : 'Question Bank'}</h1>
          <p className="admin-page-sub">{activeCount} / {questions.length} {isArabic ? 'مفعّل' : 'active'}</p>
        </div>
        {error && <p className="auth-feedback auth-feedback-error">{error}</p>}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{isArabic ? 'المعرّف' : 'ID'}</th>
                <th>{isArabic ? 'المجال' : 'Domain'}</th>
                <th>{isArabic ? 'السؤال' : 'Question'}</th>
                <th>{isArabic ? 'الموضوع' : 'Topic'}</th>
                <th>{isArabic ? 'الوزن' : 'Weight'}</th>
                <th>{isArabic ? 'حاسبة' : 'Calc'}</th>
                <th>{isArabic ? 'مفعّل' : 'Active'}</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id} className={q.active ? '' : 'admin-row-inactive'}>
                  <td><code>{q.id}</code></td>
                  <td>{q.domainId}</td>
                  <td className="admin-cell-text">{isArabic ? q.textAr : q.textEn}</td>
                  <td>{q.materialityTopicId ?? '—'}</td>
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      defaultValue={q.baseWeight}
                      className="admin-weight-input"
                      onBlur={(e) => saveWeight(q, Number(e.target.value))}
                    />
                  </td>
                  <td>{q.calculatorType ?? '—'}</td>
                  <td>
                    <button
                      type="button"
                      className={`admin-toggle ${q.active ? 'admin-toggle-on' : ''}`}
                      disabled={busy === q.id}
                      onClick={() => toggle(q)}
                    >
                      {q.active ? (isArabic ? 'مفعّل' : 'On') : (isArabic ? 'معطّل' : 'Off')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminLayout>
    </main>
  );
}
