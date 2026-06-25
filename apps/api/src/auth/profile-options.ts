// Profiling taxonomies for Section 2. DRAFT values — to be confirmed with the
// client. Kept here so DTO validation and the entity layer share one source.

export const ENTITY_TYPES = [
  'government',
  'semi_government',
  'private_company',
  'sme',
  'non_profit',
  'education_research',
] as const;

export const EXPOSURE_LEVELS = ['low', 'medium', 'high'] as const;

export type ExposureLevel = (typeof EXPOSURE_LEVELS)[number];
