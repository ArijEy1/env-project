// Shared vocabulary for the SEMS v0.4 answer model. Answers are Arabic-first;
// we derive a canonical token (yes/no/partial/unknown/na) and a maturity level
// from the option label so routing and scoring never string-match Arabic inline.

export type Canonical =
  | 'yes'
  | 'no'
  | 'partial'
  | 'unknown'
  | 'na'
  | 'improved'
  | 'stable'
  | 'declined'
  | 'no_baseline'
  | null;

/** Maps an Arabic (or English) option label to a canonical token. */
export function canonicalOf(label: string | null | undefined): Canonical {
  if (!label) return null;
  const s = String(label).trim();
  const has = (...subs: string[]) => subs.some((x) => s.includes(x));

  // Order matters: check "no baseline" and negations before bare yes/no.
  if (has('لا يوجد خط أساس', 'no baseline', 'No baseline')) return 'no_baseline';
  if (has('غير منطبق', 'Not applicable', 'N/A', 'NA')) return 'na';
  if (has('غير معروف', 'غير متأكد', 'Unknown', 'Not sure')) return 'unknown';
  if (has('جزئي', 'Partial')) return 'partial';
  // Trend vocabulary.
  if (has('انخفاض', 'انخفض', 'تحسن', 'Improved', 'Decrease', 'decreased')) return 'improved';
  if (has('ثابت', 'لا تدهور', 'Stable', 'No change')) return 'stable';
  if (has('ارتفاع', 'ارتفع', 'تراجع', 'تدهور', 'Increased', 'Worsened', 'Declined')) return 'declined';
  // Bare yes/no last.
  if (has('نعم', 'Yes')) return 'yes';
  if (has('لا', 'No')) return 'no';
  return null;
}

/** True when an answer to a routing (APP/PRF) gate should activate dependents. */
export function activatesGate(canonical: Canonical): boolean {
  // Conservative: "unknown" activates deeper questions (better to ask than skip),
  // matching the spec's rule-priority principle that risk/regulatory triggers
  // override an uncertain self-declaration.
  return canonical === 'yes' || canonical === 'unknown';
}

export interface AnswerOption {
  value: string;
  labelAr: string;
  labelEn?: string | null;
  level?: number | null;
}

/** Families of answer type, used to pick a normalization strategy. */
export type AnswerFamily =
  | 'presence' // Yes/Partial/No and variants
  | 'maturity' // Maturity 0-4 scales
  | 'numeric' // raw number (needs a calculator/threshold to score)
  | 'percentage'
  | 'trend'
  | 'select' // Single Select (usually profile / no-score)
  | 'date'
  | 'unknown';

export function familyOf(answerType: string | null | undefined): AnswerFamily {
  const t = (answerType ?? '').toLowerCase();
  if (t.includes('maturity')) return 'maturity';
  if (t.includes('trend')) return 'trend';
  if (t.includes('percentage')) return 'percentage';
  if (t.includes('numeric')) return 'numeric';
  if (t.includes('single select')) return 'select';
  if (t.includes('date') || t.includes('period')) return 'date';
  if (t.includes('frequency')) return 'maturity'; // ordinal frequency ~ maturity ladder
  if (t.includes('yes')) return 'presence';
  return 'unknown';
}
