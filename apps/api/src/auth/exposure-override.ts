import { EXPOSURE_LEVELS, ExposureLevel } from './profile-options';

// DRAFT override rules (Section 2). These promote the user-submitted exposure
// based on sector/size risk. Replace with the client's official rules later.
const HIGH_EXPOSURE_SECTORS = ['oil_and_gas', 'industrial', 'manufacturing', 'mining'];
const MIN_MEDIUM_SECTORS = ['construction'];
const LARGE_SIZE_BRACKET = '1000+';

function rank(level: ExposureLevel): number {
  return EXPOSURE_LEVELS.indexOf(level);
}

function atLeast(level: ExposureLevel, floor: ExposureLevel): ExposureLevel {
  return rank(level) >= rank(floor) ? level : floor;
}

export interface ExposureOverrideResult {
  effective: ExposureLevel;
  submitted: ExposureLevel;
  overridden: boolean;
}

/**
 * Applies the exposure override rules to a user-submitted exposure value.
 * Pure function so it's trivially testable and reusable on register + update.
 */
export function applyExposureOverride(
  sector: string,
  sizeBracket: string | null | undefined,
  submitted: ExposureLevel,
): ExposureOverrideResult {
  let effective: ExposureLevel = submitted;

  if (HIGH_EXPOSURE_SECTORS.includes(sector)) {
    effective = 'high';
  } else if (MIN_MEDIUM_SECTORS.includes(sector)) {
    effective = atLeast(effective, 'medium');
  }

  // Large organisations get bumped up one level (capped at high).
  if (sizeBracket === LARGE_SIZE_BRACKET) {
    const next = EXPOSURE_LEVELS[Math.min(EXPOSURE_LEVELS.length - 1, rank(effective) + 1)];
    effective = next;
  }

  return { effective, submitted, overridden: effective !== submitted };
}
