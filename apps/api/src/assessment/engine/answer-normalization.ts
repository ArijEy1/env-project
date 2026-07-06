// SEMS v0.4 answer normalization (Phase 3). Converts a raw client answer into a
// canonical token + a normalized 0–100 score (or null for no-score questions),
// server-side only. Clients never see the mapping — they submit their selection
// or number and the engine derives everything. See docs (sheets 06/07/08).

import {
  AnswerOption,
  Canonical,
  canonicalOf,
  familyOf,
} from './answer-types';

/** Raw answer as submitted by the client. */
export interface RawAnswer {
  optionValue?: string | null; // chosen option's `value`
  optionIndex?: number | null; // or its index
  number?: number | null; // for numeric / percentage
  attribution?: string | null; // ATR category id / note for outcome/trend claims
  evidenceLevel?: string | null; // E1..E5 the entity can provide
}

export interface NormalizeInput {
  answerType: string | null;
  scoringTreatment: string | null;
  options: AnswerOption[];
  attributionRequired: boolean;
  minEvidenceLevel: string | null;
  redFlagLogic: string | null;
  raw: RawAnswer;
}

export interface NormalizedAnswer {
  canonical: Canonical;
  score: number | null; // 0–100, or null when the question carries no score
  noScore: boolean;
  redFlag: boolean;
  needsAttribution: boolean; // outcome/trend improvement claimed without attribution
  confidence: number; // 0–100
  evidenceLevel: string | null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const EV_ORDER = ['E1', 'E2', 'E3', 'E4', 'E5'];

function pickOption(
  options: AnswerOption[],
  raw: RawAnswer,
): AnswerOption | null {
  if (raw.optionValue != null) {
    const byVal = options.find((o) => o.value === raw.optionValue);
    if (byVal) return byVal;
  }
  if (raw.optionIndex != null && options[raw.optionIndex]) {
    return options[raw.optionIndex];
  }
  return null;
}

function isNoScoreTreatment(t: string | null): boolean {
  const s = (t ?? '').toLowerCase();
  return s.startsWith('no score') || s.includes('trigger') || s.includes('profile');
}

function evidenceConfidence(
  minLevel: string | null,
  provided: string | null,
  base: number,
): number {
  if (!minLevel) return base;
  const need = EV_ORDER.indexOf(minLevel);
  const have = provided ? EV_ORDER.indexOf(provided) : -1;
  if (need >= 0 && have >= 0 && have < need) return clamp(base - 25);
  if (need >= 0 && have < 0) return clamp(base - 10); // no evidence declared
  return base;
}

export function normalizeAnswer(input: NormalizeInput): NormalizedAnswer {
  const { answerType, scoringTreatment, options, raw } = input;
  const family = familyOf(answerType);
  const opt = pickOption(options, raw);
  const canonical = canonicalOf(opt?.labelAr ?? opt?.labelEn ?? null);

  const redFlagActive =
    !!input.redFlagLogic &&
    input.redFlagLogic.toLowerCase() !== 'none' &&
    (canonical === 'no' || canonical === 'declined');

  const noScore = isNoScoreTreatment(scoringTreatment);
  let score: number | null = null;
  let needsAttribution = false;
  let confidence = 100;

  if (!noScore) {
    switch (family) {
      case 'presence': {
        if (canonical === 'yes') score = 100;
        else if (canonical === 'partial') score = 50;
        else if (canonical === 'no') score = 0;
        else if (canonical === 'na') score = null;
        else if (canonical === 'unknown') {
          score = 0;
          confidence = 40;
        } else score = 0;
        break;
      }
      case 'maturity': {
        const level = opt?.level ?? parseLeadingInt(opt?.labelAr);
        score = level == null ? null : clamp(level * 25);
        break;
      }
      case 'percentage': {
        const pct = raw.number;
        score = pct == null ? null : clamp(pct);
        break;
      }
      case 'trend': {
        if (canonical === 'improved') {
          const attributed = !!raw.attribution;
          if (input.attributionRequired && !attributed) {
            // Not proven improvement without attribution: don't credit fully.
            score = 50;
            needsAttribution = true;
            confidence = 60;
          } else {
            score = 100;
          }
        } else if (canonical === 'stable') score = 50;
        else if (canonical === 'declined') score = 0;
        else if (canonical === 'no_baseline') {
          score = null;
          confidence = 50;
        } else score = null;
        break;
      }
      case 'numeric': {
        // A bare number carries no intrinsic 0–100 without a baseline/threshold;
        // it is captured as data. Outcome scoring for numerics is handled by the
        // scoring layer via the outcome-threshold library when a baseline exists.
        score = null;
        break;
      }
      case 'select':
      case 'date':
      default:
        score = null;
    }
  }

  if (canonical === 'unknown') confidence = Math.min(confidence, 40);
  confidence = evidenceConfidence(input.minEvidenceLevel, raw.evidenceLevel ?? null, confidence);

  return {
    canonical,
    score,
    noScore,
    redFlag: redFlagActive,
    needsAttribution,
    confidence,
    evidenceLevel: raw.evidenceLevel ?? null,
  };
}

function parseLeadingInt(label: string | null | undefined): number | null {
  if (!label) return null;
  const m = /^(\d+)/.exec(String(label).trim());
  return m ? Number(m[1]) : null;
}
