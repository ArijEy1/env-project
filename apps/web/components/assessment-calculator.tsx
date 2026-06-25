'use client';

import { useState } from 'react';

interface CalcField {
  key: string;
  ar: string;
  en: string;
  type: 'number' | 'checkbox';
}

// The score itself is computed server-side; these are just the raw inputs.
const FIELDS: Record<string, CalcField[]> = {
  scope12: [
    { key: 'scope1', ar: 'انبعاثات النطاق 1 (طن مكافئ CO₂)', en: 'Scope 1 emissions (tCO₂e)', type: 'number' },
    { key: 'scope2', ar: 'انبعاثات النطاق 2 (طن مكافئ CO₂)', en: 'Scope 2 emissions (tCO₂e)', type: 'number' },
    { key: 'baseline', ar: 'إجمالي انبعاثات سنة الأساس (طن مكافئ CO₂)', en: 'Baseline-year total (tCO₂e)', type: 'number' },
    { key: 'hasReductionTarget', ar: 'يوجد هدف معتمد لخفض الانبعاثات', en: 'Has an approved emissions-reduction target', type: 'checkbox' },
  ],
  resource_efficiency: [
    { key: 'energy', ar: 'استهلاك الطاقة السنوي (كيلوواط·ساعة)', en: 'Annual energy use (kWh)', type: 'number' },
    { key: 'water', ar: 'استهلاك المياه السنوي (م³)', en: 'Annual water use (m³)', type: 'number' },
    { key: 'baselineEnergy', ar: 'طاقة سنة الأساس (كيلوواط·ساعة)', en: 'Baseline energy (kWh)', type: 'number' },
    { key: 'baselineWater', ar: 'مياه سنة الأساس (م³)', en: 'Baseline water (m³)', type: 'number' },
    { key: 'hasEfficiencyProgram', ar: 'يوجد برنامج فعّال لكفاءة الموارد', en: 'Has an active resource-efficiency program', type: 'checkbox' },
  ],
};

interface AssessmentCalculatorProps {
  type: string;
  isArabic: boolean;
  initialInputs: Record<string, unknown> | null;
  currentScore?: number;
  saving: boolean;
  onSave: (inputs: Record<string, unknown>) => void;
}

export function AssessmentCalculator({
  type,
  isArabic,
  initialInputs,
  currentScore,
  saving,
  onSave,
}: AssessmentCalculatorProps) {
  const fields = FIELDS[type] ?? [];
  const [inputs, setInputs] = useState<Record<string, unknown>>(initialInputs ?? {});

  function set(key: string, value: unknown) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="calc-card">
      <p className="calc-hint">
        {isArabic
          ? 'أدخل بيانات منشأتك وسيتم احتساب الدرجة تلقائيًا.'
          : 'Enter your figures and the score is calculated automatically.'}
      </p>
      <div className="calc-grid">
        {fields.map((f) =>
          f.type === 'checkbox' ? (
            <label key={f.key} className="calc-check">
              <input
                type="checkbox"
                checked={!!inputs[f.key]}
                onChange={(e) => set(f.key, e.target.checked)}
              />
              <span>{isArabic ? f.ar : f.en}</span>
            </label>
          ) : (
            <label key={f.key} className="calc-field">
              <span>{isArabic ? f.ar : f.en}</span>
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={(inputs[f.key] as number | undefined) ?? ''}
                onChange={(e) => set(f.key, e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="0"
              />
            </label>
          ),
        )}
      </div>
      <div className="calc-actions">
        {currentScore !== undefined ? (
          <span className="calc-score">
            {isArabic ? 'الدرجة المحتسبة' : 'Calculated score'}: <strong>{currentScore}</strong> / 100
          </span>
        ) : (
          <span className="calc-score-empty">{isArabic ? 'لم تُحتسب بعد' : 'Not calculated yet'}</span>
        )}
        <button type="button" className="primary-btn" disabled={saving} onClick={() => onSave(inputs)}>
          {saving ? (isArabic ? 'جارٍ الحساب...' : 'Calculating...') : (isArabic ? 'احسب واحفظ' : 'Calculate & save')}
        </button>
      </div>
    </div>
  );
}
