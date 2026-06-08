import { DOMAINS, QUESTIONS } from './questions';

export interface ScoreInput {
  questionId: string;
  score: number;
}

export interface ScoreResult {
  totalScore: number;
  governanceScore: number;
  complianceScore: number;
  maturityLevel: number;
}

export function calculateScore(answers: ScoreInput[]): ScoreResult {
  const answerMap = new Map<string, number>();
  for (const a of answers) {
    answerMap.set(a.questionId, a.score);
  }

  const domainScores: Record<string, number> = {};

  for (const domain of DOMAINS) {
    const domainQuestions = QUESTIONS.filter((q) => q.domain === domain.id);
    let sum = 0;
    for (const q of domainQuestions) {
      sum += answerMap.get(q.id) ?? 0;
    }
    domainScores[domain.id] = domainQuestions.length > 0 ? sum / domainQuestions.length : 0;
  }

  const governanceScore = round2(domainScores['governance'] ?? 0);
  const complianceScore = round2(domainScores['compliance'] ?? 0);

  const governanceWeight = DOMAINS.find((d) => d.id === 'governance')!.weight;
  const complianceWeight = DOMAINS.find((d) => d.id === 'compliance')!.weight;

  const totalScore = round2(governanceScore * governanceWeight + complianceScore * complianceWeight);
  const maturityLevel = getMaturityLevel(totalScore);

  return { totalScore, governanceScore, complianceScore, maturityLevel };
}

function getMaturityLevel(score: number): number {
  if (score <= 0) return 1;
  const level = Math.ceil(score / 20);
  return Math.min(level, 5);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
