// Arabic labels for profiling taxonomy + effort, used by the PDF report.
// DRAFT — mirror the web labels; update when the client confirms terminology.

export const SECTOR_AR: Record<string, string> = {
  industrial: 'صناعي',
  oil_and_gas: 'نفط وغاز',
  manufacturing: 'تصنيع',
  construction: 'إنشاءات',
  mining: 'تعدين',
  services: 'خدمات',
  government: 'حكومي',
  healthcare: 'رعاية صحية',
  education: 'تعليم',
  other: 'أخرى',
};

export const ENTITY_TYPE_AR: Record<string, string> = {
  government: 'جهة حكومية',
  semi_government: 'جهة شبه حكومية',
  private_company: 'شركة قطاع خاص',
  sme: 'منشأة صغيرة ومتوسطة',
  non_profit: 'منظمة غير ربحية',
  education_research: 'مؤسسة تعليمية أو بحثية',
};

export const EXPOSURE_AR: Record<string, string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'مرتفع',
};

export const EFFORT_AR: Record<string, string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'مرتفع',
};

export const MATURITY_AR: Record<number, string> = {
  1: 'مبتدئ',
  2: 'أساسي',
  3: 'متوسط',
  4: 'متقدم',
  5: 'رائد',
};

export function arLabel(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return 'غير محدد';
  return map[key] ?? key;
}
