'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '../../../components/admin-layout';
import {
  createGlossaryTerm,
  deleteGlossaryTerm,
  fetchGlossary,
  updateGlossaryTerm,
  type AdminGlossaryTerm,
} from '../../../lib/admin-client';
import { useLanguage } from '../../../components/language-provider';
import { useToast } from '../../../components/toast-provider';

const EMPTY = { termAr: '', termEn: '', definitionAr: '', definitionEn: '', category: '' };

export default function AdminGlossaryPage() {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === 'ar';
  const [terms, setTerms] = useState<AdminGlossaryTerm[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchGlossary()
      .then(setTerms)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error'));
  }, []);

  function setField<K extends keyof AdminGlossaryTerm>(id: string, field: K, value: AdminGlossaryTerm[K]) {
    setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  }

  async function save(t: AdminGlossaryTerm) {
    setSaving(t.id);
    try {
      const updated = await updateGlossaryTerm(t.id, {
        termAr: t.termAr,
        termEn: t.termEn,
        definitionAr: t.definitionAr,
        definitionEn: t.definitionEn,
        category: t.category,
        active: t.active,
      });
      setTerms((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
      showToast(isArabic ? 'تم الحفظ' : 'Saved', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setSaving(null);
    }
  }

  async function remove(id: string) {
    setSaving(id);
    try {
      await deleteGlossaryTerm(id);
      setTerms((prev) => prev.filter((x) => x.id !== id));
      showToast(isArabic ? 'تم الحذف' : 'Deleted', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setSaving(null);
    }
  }

  async function add() {
    if (!draft.termAr.trim() || !draft.definitionAr.trim()) {
      showToast(isArabic ? 'المصطلح والتعريف بالعربية مطلوبان' : 'Arabic term and definition are required', 'error');
      return;
    }
    setAdding(true);
    try {
      const created = await createGlossaryTerm(draft);
      setTerms((prev) => [...prev, created].sort((a, b) => a.termAr.localeCompare(b.termAr, 'ar')));
      setDraft({ ...EMPTY });
      showToast(isArabic ? 'تمت الإضافة' : 'Added', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setAdding(false);
    }
  }

  return (
    <main className="page-shell auth-background-page admin-background-page">
      <AdminLayout>
        <div className="admin-page-header">
          <h1>{isArabic ? 'مسرد المصطلحات' : 'Terminology Glossary'}</h1>
          <p className="admin-page-sub">
            {terms.length} {isArabic ? 'مصطلح' : 'terms'} ·{' '}
            {isArabic
              ? 'مصطلحات مبدئية — استبدلها بقائمة الأكاديمية المعتمدة'
              : 'placeholder terms — replace with the Academy’s approved list'}
          </p>
        </div>
        {error && <p className="auth-feedback auth-feedback-error">{error}</p>}

        <div className="admin-edit-card">
          <div className="admin-edit-head">
            <span>{isArabic ? 'إضافة مصطلح جديد' : 'Add a new term'}</span>
          </div>
          <div className="admin-edit-grid">
            <label>{isArabic ? 'المصطلح (ع)' : 'Term (AR)'}<input value={draft.termAr} onChange={(e) => setDraft({ ...draft, termAr: e.target.value })} /></label>
            <label>{isArabic ? 'المصطلح (إن)' : 'Term (EN)'}<input value={draft.termEn} onChange={(e) => setDraft({ ...draft, termEn: e.target.value })} /></label>
            <label>{isArabic ? 'التعريف (ع)' : 'Definition (AR)'}<textarea value={draft.definitionAr} onChange={(e) => setDraft({ ...draft, definitionAr: e.target.value })} /></label>
            <label>{isArabic ? 'التعريف (إن)' : 'Definition (EN)'}<textarea value={draft.definitionEn} onChange={(e) => setDraft({ ...draft, definitionEn: e.target.value })} /></label>
            <label>{isArabic ? 'التصنيف' : 'Category'}<input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></label>
          </div>
          <div className="admin-edit-actions">
            <button type="button" className="primary-btn" disabled={adding} onClick={add}>
              {adding ? (isArabic ? 'جاري الإضافة...' : 'Adding...') : (isArabic ? 'إضافة' : 'Add')}
            </button>
          </div>
        </div>

        {terms.map((t) => (
          <div key={t.id} className="admin-edit-card">
            <div className="admin-edit-head">
              <span>{t.category ?? '—'}</span>
              <label className="admin-inline-check">
                <input type="checkbox" checked={t.active} onChange={(e) => setField(t.id, 'active', e.target.checked)} />
                {isArabic ? 'مفعّل' : 'Active'}
              </label>
            </div>
            <div className="admin-edit-grid">
              <label>{isArabic ? 'المصطلح (ع)' : 'Term (AR)'}<input value={t.termAr} onChange={(e) => setField(t.id, 'termAr', e.target.value)} /></label>
              <label>{isArabic ? 'المصطلح (إن)' : 'Term (EN)'}<input value={t.termEn ?? ''} onChange={(e) => setField(t.id, 'termEn', e.target.value)} /></label>
              <label>{isArabic ? 'التعريف (ع)' : 'Definition (AR)'}<textarea value={t.definitionAr} onChange={(e) => setField(t.id, 'definitionAr', e.target.value)} /></label>
              <label>{isArabic ? 'التعريف (إن)' : 'Definition (EN)'}<textarea value={t.definitionEn ?? ''} onChange={(e) => setField(t.id, 'definitionEn', e.target.value)} /></label>
              <label>{isArabic ? 'التصنيف' : 'Category'}<input value={t.category ?? ''} onChange={(e) => setField(t.id, 'category', e.target.value)} /></label>
            </div>
            <div className="admin-edit-actions">
              <button type="button" className="primary-btn" disabled={saving === t.id} onClick={() => save(t)}>
                {saving === t.id ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'حفظ' : 'Save')}
              </button>
              <button type="button" className="secondary-btn" disabled={saving === t.id} onClick={() => remove(t.id)}>
                {isArabic ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </AdminLayout>
    </main>
  );
}
