// Phase D scoring engine. Pure functions (server-side only) — the client never
// sees weights or formula logic, only the resulting scores. See
// docs/assessment-engine-design.md §6.

export interface ScoredQuestion {
  questionId: string;
  domainId: string;
  effectiveWeight: number;
}

export interface EngineScoreResult {
  domainScores: Record<string, number>; // 0-100 per domain
  totalScore: number; // 0-100
  maturityLevel: number; // 1-5
  calculationAudit: CalculationAudit;
}

export interface CalculationAudit {
  generatedAt: string;
  scoringConfigId: string | null;
  domainWeights: Record<string, number>;
  perQuestion: Array<{
    questionId: string;
    domainId: string;
    answer: number;
    effectiveWeight: number;
    weightedValue: number;
    maxWeightedValue: number;
  }>;
  perDomain: Record<
    string,
    { numerator: number; denominator: number; score: number; weight: number }
  >;
  totalScore: number;
  maturityLevel: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function maturityFromTotal(total: number): number {
  if (total <= 0) return 1;
  return Math.min(5, Math.ceil(total / 20));
}

/**
 * Normalised domain score = sum(answer * weight) / sum(100 * weight) * 100.
 * Total = sum(domain_score * domain_weight), normalised over the domains that
 * actually have questions so a missing domain doesn't deflate the total.
 */
export function computeEngineScore(
  questions: ScoredQuestion[],
  answers: Map<string, number>,
  domainWeights: Record<string, number>,
  scoringConfigId: string | null,
  timestamp: string,
): EngineScoreResult {
  const perQuestion: CalculationAudit['perQuestion'] = [];
  const domainAgg = new Map<string, { num: number; den: number }>();

  for (const q of questions) {
    const answer = answers.get(q.questionId) ?? 0;
    const weighted = answer * q.effectiveWeight;
    const maxWeighted = 100 * q.effectiveWeight;

    perQuestion.push({
      questionId: q.questionId,
      domainId: q.domainId,
      answer,
      effectiveWeight: q.effectiveWeight,
      weightedValue: round2(weighted),
      maxWeightedValue: round2(maxWeighted),
    });

    const agg = domainAgg.get(q.domainId) ?? { num: 0, den: 0 };
    agg.num += weighted;
    agg.den += maxWeighted;
    domainAgg.set(q.domainId, agg);
  }

  const domainScores: Record<string, number> = {};
  const perDomain: CalculationAudit['perDomain'] = {};
  let weightedTotal = 0;
  let weightSum = 0;

  for (const [domainId, agg] of domainAgg) {
    const score = agg.den > 0 ? (agg.num / agg.den) * 100 : 0;
    const weight = domainWeights[domainId] ?? 0;
    domainScores[domainId] = round2(score);
    perDomain[domainId] = {
      numerator: round2(agg.num),
      denominator: round2(agg.den),
      score: round2(score),
      weight,
    };
    weightedTotal += score * weight;
    weightSum += weight;
  }

  const totalScore = weightSum > 0 ? round2(weightedTotal / weightSum) : 0;
  const maturityLevel = maturityFromTotal(totalScore);

  return {
    domainScores,
    totalScore,
    maturityLevel,
    calculationAudit: {
      generatedAt: timestamp,
      scoringConfigId,
      domainWeights,
      perQuestion,
      perDomain,
      totalScore,
      maturityLevel,
    },
  };
}
