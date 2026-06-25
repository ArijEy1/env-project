'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '../../../components/admin-layout';
import {
  fetchAdminRecommendations,
  updateAdminRecommendation,
  type AdminRecommendation,
} from '../../../lib/admin-client';
import { useLanguage } from '../../../components/language-provider';
import { useToast } from '../../../components/toast-provider';

export default function AdminRecommendationsPage() {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === 'ar';
  const [recs, setRecs] = useState<AdminRecommendation[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminRecommendations().then(setRecs).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : 'Error'),
    );
  }, []);

  function setField<K extends keyof AdminRecommendation>(id: string, field: K, value: AdminRecommendation[K]) {
    setRecs((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function save(r: AdminRecommendation) {
    setSaving(r.id);
    try {
      const updated = await updateAdminRecommendation(r.id, {
        triggerMaxScore: r.triggerMaxScore,
        immediateActionAr: r.immediateActionAr,
        immediateActionEn: r.immediateActionEn,
        shortTermActionAr: r.shortTermActionAr,
        shortTermActionEn: r.shortTermActionEn,
        mediumTermActionAr: r.mediumTermActionAr,
        mediumTermActionEn: r.mediumTermActionEn,
        costEstimate: r.costEstimate,
        effortLevel: r.effortLevel,
        scoreImpactPoints: r.scoreImpactPoints,
        timelineWeeks: r.timelineWeeks,
        legalReference: r.legalReference,
        active: r.active,
      });
      setRecs((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
      showToast(isArabic ? 'تم الحفظ' : 'Saved', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setSaving(null);
    }
  }

  return (
    <main className="page-shell auth-background-page admin-background-page">
      <AdminLayout>
        <div className="admin-page-header">
          <h1>{isArabic ? 'مكتبة التوصيات' : 'Recommendation Library'}</h1>
          <p className="admin-page-sub">{recs.length} {isArabic ? 'توصية' : 'recommendations'}</p>
        </div>
        {error && <p className="auth-feedback auth-feedback-error">{error}</p>}

        {recs.map((r) => (
          <div key={r.id} className="admin-edit-card">
            <div className="admin-edit-head">
              <span><code>{r.id}</code> · {r.domainId} · {r.materialityTopicId}</span>
              <label className="admin-inline-check">
                <input type="checkbox" checked={r.active} onChange={(e) => setField(r.id, 'active', e.target.checked)} />
                {isArabic ? 'مفعّل' : 'Active'}
              </label>
            </div>

            <div className="admin-edit-grid">
              <label>{isArabic ? 'إجراء فوري (ع)' : 'Immediate (AR)'}<textarea value={r.immediateActionAr} onChange={(e) => setField(r.id, 'immediateActionAr', e.target.value)} /></label>
              <label>{isArabic ? 'إجراء فوري (إن)' : 'Immediate (EN)'}<textarea value={r.immediateActionEn} onChange={(e) => setField(r.id, 'immediateActionEn', e.target.value)} /></label>
              <label>{isArabic ? 'قصير المدى (ع)' : 'Short-term (AR)'}<textarea value={r.shortTermActionAr} onChange={(e) => setField(r.id, 'shortTermActionAr', e.target.value)} /></label>
              <label>{isArabic ? 'قصير المدى (إن)' : 'Short-term (EN)'}<textarea value={r.shortTermActionEn} onChange={(e) => setField(r.id, 'shortTermActionEn', e.target.value)} /></label>
              <label>{isArabic ? 'متوسط المدى (ع)' : 'Medium-term (AR)'}<textarea value={r.mediumTermActionAr} onChange={(e) => setField(r.id, 'mediumTermActionAr', e.target.value)} /></label>
              <label>{isArabic ? 'متوسط المدى (إن)' : 'Medium-term (EN)'}<textarea value={r.mediumTermActionEn} onChange={(e) => setField(r.id, 'mediumTermActionEn', e.target.value)} /></label>
            </div>

            <div className="admin-edit-row">
              <label>{isArabic ? 'التكلفة' : 'Cost'}<input value={r.costEstimate ?? ''} onChange={(e) => setField(r.id, 'costEstimate', e.target.value)} /></label>
              <label>{isArabic ? 'الجهد' : 'Effort'}
                <select value={r.effortLevel} onChange={(e) => setField(r.id, 'effortLevel', e.target.value)}>
                  <option value="low">{isArabic ? 'منخفض' : 'Low'}</option>
                  <option value="medium">{isArabic ? 'متوسط' : 'Medium'}</option>
                  <option value="high">{isArabic ? 'مرتفع' : 'High'}</option>
                </select>
              </label>
              <label>{isArabic ? 'الأثر (نقاط)' : 'Impact (pts)'}<input type="number" value={r.scoreImpactPoints} onChange={(e) => setField(r.id, 'scoreImpactPoints', Number(e.target.value))} /></label>
              <label>{isArabic ? 'المدة (أسابيع)' : 'Timeline (wks)'}<input type="number" value={r.timelineWeeks} onChange={(e) => setField(r.id, 'timelineWeeks', Number(e.target.value))} /></label>
              <label>{isArabic ? 'حد التفعيل' : 'Trigger ≤'}<input type="number" value={r.triggerMaxScore} onChange={(e) => setField(r.id, 'triggerMaxScore', Number(e.target.value))} /></label>
              <label className="admin-edit-wide">{isArabic ? 'المرجع القانوني' : 'Legal reference'}<input value={r.legalReference ?? ''} onChange={(e) => setField(r.id, 'legalReference', e.target.value)} /></label>
            </div>

            <div className="admin-edit-actions">
              <button type="button" className="primary-btn" disabled={saving === r.id} onClick={() => save(r)}>
                {saving === r.id ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'حفظ' : 'Save')}
              </button>
            </div>
          </div>
        ))}
      </AdminLayout>
    </main>
  );
}
