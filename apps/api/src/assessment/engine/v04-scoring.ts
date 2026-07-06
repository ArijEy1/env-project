// SEMS v0.4 scoring engine (Phase 4). Aggregates normalized per-question scores
// into domain + total scores, dispatching by scoring treatment, then applies
// regulatory gates, a confidence measure, and red-flag collection.
//
// Pure functions — server-side only. See rule engine (sheet 03), conflict tree
// (05) and outcome thresholds (08).

import { Canonical, activatesGate } from './answer-types';

export interface ScoredAnswer {
  questionId: string;
  domainId: string;
  scoringTreatment: string | null;
  weight: number;
  score: number | null; // normalized 0–100 (null = not counted toward score)
  canonical: Canonical;
  redFlag: boolean;
  confidence: number; // 0–100
}

export type GateStatus = 'none' | 'soft' | 'hard';

export interface V04ScoreResult {
  domainScores: Record<string, number>;
  rawTotalScore: number; // before gates
  totalScore: number; // after gates
  maturityLevel: number; // 1–5
  confidence: number; // 0–100
  gateStatus: GateStatus;
  gateReasons: string[];
  redFlags: string[];
  audit: V04Audit;
}

export interface V04Audit {
  generatedAt: string;
  domainWeights: Record<string, number>;
  perDomain: Record<
    string,
    { numerator: number; denominator: number; score: number; weight: number; counted: number }
  >;
  scoredCount: number;
  gate: { status: GateStatus; reasons: string[]; hardCap: number | null; softCap: number | null };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function maturityFromTotal(total: number): number {
  if (total <= 0) return 1;
  return Math.min(5, Math.ceil(total / 20));
}

/** A treatment contributes to the numeric score unless it's a no-score/profile/
 *  trigger/confidence-only treatment. */
function isScored(treatment: string | null, score: number | null): boolean {
  if (score == null) return false;
  const t = (treatment ?? '').toLowerCase();
  if (t.startsWith('no score') || t.includes('trigger') || t.includes('profile')) return false;
  if (t.includes('confidence')) return false; // confidence adjustment only
  return true;
}

/**
 * Regulatory gates from the rule engine. Hard gate (GATE-REG-001): a required
 * permit is missing (APP-001 yes/unknown & REG-002 = no) caps the whole result.
 * Soft gate (GATE-REG-002): an open violation (REG-004 = yes) caps it lower.
 */
export function evaluateGates(routing: Map<string, Canonical>): {
  status: GateStatus;
  reasons: string[];
  hardCap: number | null;
  softCap: number | null;
} {
  const reasons: string[] = [];
  let hardCap: number | null = null;
  let softCap: number | null = null;

  const permitRequired = activatesGate(routing.get('APP-001') ?? null);
  if (permitRequired && routing.get('REG-002') === 'no') {
    hardCap = 40;
    reasons.push('Required environmental permit is missing (GATE-REG-001).');
  }
  if (routing.get('REG-004') === 'yes') {
    softCap = 60;
    reasons.push('An open regulatory violation was reported (GATE-REG-002).');
  }

  const status: GateStatus = hardCap != null ? 'hard' : softCap != null ? 'soft' : 'none';
  return { status, reasons, hardCap, softCap };
}

export function computeV04Score(
  answers: ScoredAnswer[],
  domainWeights: Record<string, number>,
  routing: Map<string, Canonical>,
  timestamp: string,
): V04ScoreResult {
  const agg = new Map<string, { num: number; den: number; counted: number }>();
  const redFlags: string[] = [];
  let confSum = 0;
  let confCount = 0;

  for (const a of answers) {
    if (a.redFlag) redFlags.push(a.questionId);
    if (!isScored(a.scoringTreatment, a.score)) continue;
    const w = a.weight > 0 ? a.weight : 1;
    const d = agg.get(a.domainId) ?? { num: 0, den: 0, counted: 0 };
    d.num += (a.score as number) * w;
    d.den += 100 * w;
    d.counted += 1;
    agg.set(a.domainId, d);
    confSum += a.confidence;
    confCount += 1;
  }

  const domainScores: Record<string, number> = {};
  const perDomain: V04Audit['perDomain'] = {};
  let weightedTotal = 0;
  let weightSum = 0;

  for (const [domainId, d] of agg) {
    const score = d.den > 0 ? (d.num / d.den) * 100 : 0;
    const weight = domainWeights[domainId] ?? 1;
    domainScores[domainId] = round2(score);
    perDomain[domainId] = {
      numerator: round2(d.num),
      denominator: round2(d.den),
      score: round2(score),
      weight,
      counted: d.counted,
    };
    weightedTotal += score * weight;
    weightSum += weight;
  }

  const rawTotal = weightSum > 0 ? round2(weightedTotal / weightSum) : 0;

  const gate = evaluateGates(routing);
  let total = rawTotal;
  if (gate.hardCap != null) total = Math.min(total, gate.hardCap);
  if (gate.softCap != null) total = Math.min(total, gate.softCap);
  total = round2(total);

  const confidence = confCount > 0 ? round2(confSum / confCount) : 100;

  return {
    domainScores,
    rawTotalScore: rawTotal,
    totalScore: total,
    maturityLevel: maturityFromTotal(total),
    confidence,
    gateStatus: gate.status,
    gateReasons: gate.reasons,
    redFlags,
    audit: {
      generatedAt: timestamp,
      domainWeights,
      perDomain,
      scoredCount: confCount,
      gate: { status: gate.status, reasons: gate.reasons, hardCap: gate.hardCap, softCap: gate.softCap },
    },
  };
}
