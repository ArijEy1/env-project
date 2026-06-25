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

interface SnapshotAnswerRow {
  bank_question_id: string;
  domain_id: string;
  materiality_topic_id: string | null;
  effective_weight: string;
  text_ar: string;
  text_en: string;
  score: number | null;
}

interface RecommendationRow {
  id: string;
  materiality_topic_id: string | null;
  domain_id: string;
  trigger_max_score: number;
  immediate_action_ar: string;
  immediate_action_en: string;
  short_term_action_ar: string;
  short_term_action_en: string;
  medium_term_action_ar: string;
  medium_term_action_en: string;
  cost_estimate: string | null;
  effort_level: string;
  score_impact_points: number;
  timeline_weeks: number;
  legal_reference: string | null;
}

@Injectable()
export class RecommendationEngineService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Rule-based gap analysis (Phase 1): for each snapshot question scoring at or
   * below its matched recommendation's trigger, surface a library recommendation.
   * Gaps are weighted by materiality (shortfall x effective weight). D2 gaps are
   * always prioritised; within that, ranked by Impact / Effort.
   */
  async build(assessmentId: string): Promise<EngineRecommendation[]> {
    const snapshot = await this.db.query<SnapshotAnswerRow>(
      `SELECT aq.bank_question_id, aq.domain_id, aq.materiality_topic_id,
              aq.effective_weight, aq.text_ar, aq.text_en, aa.score
       FROM assessment_questions aq
       LEFT JOIN assessment_answers aa
         ON aa.assessment_id = aq.assessment_id
        AND aa.question_id = aq.bank_question_id
       WHERE aq.assessment_id = $1`,
      [assessmentId],
    );

    const library = await this.db.query<RecommendationRow>(
      `SELECT * FROM recommendation_library WHERE active = TRUE`,
    );
    const libByTopic = new Map<string, RecommendationRow>();
    for (const r of library.rows) {
      if (r.materiality_topic_id && !libByTopic.has(r.materiality_topic_id)) {
        libByTopic.set(r.materiality_topic_id, r);
      }
    }

    // Candidate gaps: a question with a matching recommendation, scoring at or
    // below the trigger. Keep the worst-gap question per recommendation.
    const byRec = new Map<
      string,
      { q: SnapshotAnswerRow; rec: RecommendationRow; answer: number; gap: number }
    >();

    for (const q of snapshot.rows) {
      const topic = q.materiality_topic_id;
      if (!topic) continue;
      const rec = libByTopic.get(topic);
      if (!rec) continue;

      const answer = q.score ?? 0;
      if (answer > rec.trigger_max_score) continue;

      const gap = (100 - answer) * Number(q.effective_weight);
      const existing = byRec.get(rec.id);
      if (!existing || gap > existing.gap) {
        byRec.set(rec.id, { q, rec, answer, gap });
      }
    }

    const ranked = [...byRec.values()]
      .map((c) => ({
        ...c,
        isCompliance: c.q.domain_id === 'D2',
        priority:
          c.rec.score_impact_points / (EFFORT_WEIGHT[c.rec.effort_level] ?? 2),
      }))
      .sort((a, b) => {
        if (a.isCompliance !== b.isCompliance) return a.isCompliance ? -1 : 1;
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.gap - a.gap;
      });

    return ranked.map((c, index) => ({
      rank: index + 1,
      recommendationId: c.rec.id,
      questionId: c.q.bank_question_id,
      domainId: c.q.domain_id,
      materialityTopicId: c.q.materiality_topic_id,
      currentScore: c.answer,
      isCompliance: c.isCompliance,
      questionTextAr: c.q.text_ar,
      questionTextEn: c.q.text_en,
      immediateActionAr: c.rec.immediate_action_ar,
      immediateActionEn: c.rec.immediate_action_en,
      shortTermActionAr: c.rec.short_term_action_ar,
      shortTermActionEn: c.rec.short_term_action_en,
      mediumTermActionAr: c.rec.medium_term_action_ar,
      mediumTermActionEn: c.rec.medium_term_action_en,
      costEstimate: c.rec.cost_estimate,
      effortLevel: c.rec.effort_level,
      scoreImpactPoints: c.rec.score_impact_points,
      timelineWeeks: c.rec.timeline_weeks,
      legalReference: c.rec.legal_reference,
    }));
  }
}
