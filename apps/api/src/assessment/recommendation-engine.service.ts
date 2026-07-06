import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

// Effort -> numeric so we can rank by Impact / Effort (high impact + low effort first).
const EFFORT_WEIGHT: Record<string, number> = { low: 1, medium: 2, high: 3 };

export interface EngineRecommendation {
  rank: number;
  recommendationId: string;
  questionId: string;
  domainId: string;
  materialityTopicId: string | null;
  currentScore: number;
  isCompliance: boolean;
  questionTextAr: string;
  questionTextEn: string;
  immediateActionAr: string;
  immediateActionEn: string;
  shortTermActionAr: string;
  shortTermActionEn: string;
  mediumTermActionAr: string;
  mediumTermActionEn: string;
  costEstimate: string | null;
  effortLevel: string;
  scoreImpactPoints: number;
  timelineWeeks: number;
  legalReference: string | null;
}

interface GapRow {
  bank_question_id: string;
  domain_id: string;
  effective_weight: string;
  text_ar: string;
  text_en: string;
  guidance_ar: string | null;
  recommendation_id: string | null;
  scoring_treatment: string | null;
  normalized_score: string | null;
  red_flag: boolean | null;
}

// Generic v0.4 action copy (Arabic) used until the client's official
// recommendation library is imported. See [[question-bank-official-import]].
const SHORT_TERM_AR =
  'وثّق الإجراء وحدد المسؤول والجدول الزمني، وابدأ جمع الأدلة الداعمة.';
const MEDIUM_TERM_AR =
  'طبّق الممارسة بشكل كامل مع مراجعة دورية وتتبع مؤشرات الأداء لإثبات التحسن.';

@Injectable()
export class RecommendationEngineService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * v0.4 gap analysis: surface the active, scored questions that fell at or
   * below the improvement threshold (<= 50), ranked by weighted shortfall.
   * Compliance-domain (REG) gaps and red-flagged questions are prioritised.
   * Action copy is generic until the client's recommendation library lands.
   */
  async build(assessmentId: string): Promise<EngineRecommendation[]> {
    const rows = await this.db.query<GapRow>(
      `SELECT aq.bank_question_id, aq.domain_id, aq.effective_weight, aq.text_ar,
              aq.text_en, aq.guidance_ar, qb.recommendation_id, aq.scoring_treatment,
              aa.normalized_score, aa.red_flag
       FROM assessment_questions aq
       JOIN assessment_answers aa
         ON aa.assessment_id = aq.assessment_id AND aa.question_id = aq.bank_question_id
       LEFT JOIN question_bank qb ON qb.id = aq.bank_question_id
       WHERE aq.assessment_id = $1 AND aq.active = TRUE
         AND aa.normalized_score IS NOT NULL AND aa.normalized_score <= 50`,
      [assessmentId],
    );

    const ranked = rows.rows
      .map((q) => {
        const score = q.normalized_score != null ? Number(q.normalized_score) : 0;
        const gap = (100 - score) * (Number(q.effective_weight) || 1);
        return {
          q,
          score,
          gap,
          isCompliance: q.domain_id === 'REG',
          redFlag: q.red_flag ?? false,
        };
      })
      .sort((a, b) => {
        if (a.redFlag !== b.redFlag) return a.redFlag ? -1 : 1;
        if (a.isCompliance !== b.isCompliance) return a.isCompliance ? -1 : 1;
        return b.gap - a.gap;
      });

    return ranked.map((c, index) => ({
      rank: index + 1,
      recommendationId: c.q.recommendation_id ?? c.q.bank_question_id,
      questionId: c.q.bank_question_id,
      domainId: c.q.domain_id,
      materialityTopicId: null,
      currentScore: c.score,
      isCompliance: c.isCompliance,
      questionTextAr: c.q.text_ar,
      questionTextEn: c.q.text_en,
      immediateActionAr:
        c.q.guidance_ar ?? 'عالج هذه الفجوة ذات الأولوية لرفع مستوى الأداء البيئي.',
      immediateActionEn: '',
      shortTermActionAr: SHORT_TERM_AR,
      shortTermActionEn: '',
      mediumTermActionAr: MEDIUM_TERM_AR,
      mediumTermActionEn: '',
      costEstimate: null,
      effortLevel: c.isCompliance ? 'high' : 'medium',
      scoreImpactPoints: Math.round(100 - c.score),
      timelineWeeks: 0,
      legalReference: null,
    }));
  }
}
