// Display options for the organisation profile (Section 2). DRAFT — labels can
// change when the client confirms the official taxonomy. Values must match the
// API's profile-options.ts.

export interface ProfileOption {
  value: string;
  ar: string;
  en: string;
}

export const ENTITY_TYPE_OPTIONS: ProfileOption[] = [
  { value: 'government', ar: 'جهة حكومية', en: 'Government' },
  { value: 'semi_government', ar: 'جهة شبه حكومية', en: 'Semi-government' },
  { value: 'private_company', ar: 'شركة قطاع خاص', en: 'Private company' },
  { value: 'sme', ar: 'منشأة صغيرة ومتوسطة', en: 'SME' },
  { value: 'non_profit', ar: 'منظمة غير ربحية', en: 'Non-profit' },
  { value: 'education_research', ar: 'مؤسسة تعليمية/بحثية', en: 'Education / Research' },
];

export const EXPOSURE_OPTIONS: ProfileOption[] = [
  { value: 'low', ar: 'منخفض', en: 'Low' },
  { value: 'medium', ar: 'متوسط', en: 'Medium' },
  { value: 'high', ar: 'مرتفع', en: 'High' },
];

export const SECTOR_OPTIONS: ProfileOption[] = [
  { value: 'industrial', ar: 'صناعي', en: 'Industrial' },
  { value: 'oil_and_gas', ar: 'نفط وغاز', en: 'Oil & Gas' },
  { value: 'manufacturing', ar: 'تصنيع', en: 'Manufacturing' },
  { value: 'construction', ar: 'إنشاءات', en: 'Construction' },
  { value: 'mining', ar: 'تعدين', en: 'Mining' },
  { value: 'services', ar: 'خدمات', en: 'Services' },
  { value: 'government', ar: 'حكومي', en: 'Government' },
  { value: 'healthcare', ar: 'رعاية صحية', en: 'Healthcare' },
  { value: 'education', ar: 'تعليم', en: 'Education' },
  { value: 'other', ar: 'أخرى', en: 'Other' },
];

export function optionLabel(
  options: ProfileOption[],
  value: string | null | undefined,
  isArabic: boolean,
): string {
  if (!value) return isArabic ? 'غير محدد' : 'Not set';
  const match = options.find((o) => o.value === value);
  if (!match) return value;
  return isArabic ? match.ar : match.en;
}
