import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

const EXPOSURE_ORDER = ['low', 'medium', 'high'];
// Keep effective weights in a sane band even if materiality multipliers stack.
const MIN_EFFECTIVE_WEIGHT = 0.1;
const MAX_EFFECTIVE_WEIGHT = 10;

export interface AssessmentProfile {
  sector: string;
  entityType: string | null;
  size: string | null; // employee bracket
  exposure: string | null;
}

interface QuestionBankRow {
  id: string;
  domain_id: string;
  text_ar: string;
  text_en: string;
  help_text_ar: string | null;
  help_text_en: string | null;
  materiality_topic_id: string | null;
  base_weight: string; // numeric -> string from pg
  calculator_type: string | null;
  applicability: {
    sectors?: string[];
    entityTypes?: string[];
    exposureMin?: string;
    sizeMin?: string;
  };
  domain_order: number;
}

interface MaterialityWeightRow {
  dimension: string;
  dimension_value: string;
  materiality_topic_id: string;
  multiplier: string;
}

export interface GeneratedQuestion {
  bankQuestionId: string;
  domainId: string;
  materialityTopicId: string | null;
  effectiveWeight: number;
  displayOrder: number;
  textAr: string;
  textEn: string;
  helpTextAr: string | null;
  helpTextEn: string | null;
  calculatorType: string | null;
}

@Injectable()
export class QuestionGenerationService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Selects the applicable active bank questions for a profile, applies
   * materiality multipliers to produce frozen effective weights, and persists
   * the immutable snapshot into assessment_questions. Returns the generated set.
   */
  async generateSnapshot(
    assessmentId: string,
    profile: AssessmentProfile,
  ): Promise<GeneratedQuestion[]> {
    const [questions, weights] = await Promise.all([
      this.loadActiveQuestions(),
      this.loadMaterialityWeights(),
    ]);

    const selected = questions.filter((q) => this.isApplicable(q, profile));

    let order = 0;
    const generated: GeneratedQuestion[] = selected.map((q) => {
      const multiplier = this.materialityMultiplier(
        q.materiality_topic_id,
        profile,
        weights,
      );
      const effective = this.clampWeight(Number(q.base_weight) * multiplier);
      return {
        bankQuestionId: q.id,
        domainId: q.domain_id,
        materialityTopicId: q.materiality_topic_id,
        effectiveWeight: Math.round(effective * 1000) / 1000,
        displayOrder: order++,
        textAr: q.text_ar,
        textEn: q.text_en,
        helpTextAr: q.help_text_ar,
        helpTextEn: q.help_text_en,
        calculatorType: q.calculator_type,
      };
    });

    for (const g of generated) {
      await this.db.query(
        `INSERT INTO assessment_questions (
          id, assessment_id, bank_question_id, domain_id, materiality_topic_id,
          effective_weight, display_order, text_ar, text_en, help_text_ar,
          help_text_en, calculator_type
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (assessment_id, bank_question_id) DO NOTHING`,
        [
          uuidv4(), assessmentId, g.bankQuestionId, g.domainId, g.materialityTopicId,
          g.effectiveWeight, g.displayOrder, g.textAr, g.textEn, g.helpTextAr,
          g.helpTextEn, g.calculatorType,
        ],
      );
    }

    return generated;
  }

  async getActiveScoringConfigId(): Promise<string | null> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM scoring_configurations WHERE active = TRUE ORDER BY version DESC LIMIT 1`,
    );
    return r.rows[0]?.id ?? null;
  }

  private async loadActiveQuestions(): Promise<QuestionBankRow[]> {
    const r = await this.db.query<QuestionBankRow>(
      `SELECT qb.id, qb.domain_id, qb.text_ar, qb.text_en, qb.help_text_ar,
              qb.help_text_en, qb.materiality_topic_id, qb.base_weight,
              qb.calculator_type, qb.applicability, d.display_order AS domain_order
       FROM question_bank qb
       JOIN domains d ON d.id = qb.domain_id
       WHERE qb.active = TRUE AND d.active = TRUE
       ORDER BY d.display_order ASC, qb.id ASC`,
    );
    return r.rows;
  }

  private async loadMaterialityWeights(): Promise<MaterialityWeightRow[]> {
    const r = await this.db.query<MaterialityWeightRow>(
      `SELECT dimension, dimension_value, materiality_topic_id, multiplier
       FROM materiality_weights`,
    );
    return r.rows;
  }

  private isApplicable(q: QuestionBankRow, profile: AssessmentProfile): boolean {
    const a = q.applicability ?? {};

    if (a.sectors && a.sectors.length > 0 && !a.sectors.includes(profile.sector)) {
      return false;
    }
    if (
      a.entityTypes &&
      a.entityTypes.length > 0 &&
      (!profile.entityType || !a.entityTypes.includes(profile.entityType))
    ) {
      return false;
    }
    if (a.exposureMin) {
      const have = EXPOSURE_ORDER.indexOf(profile.exposure ?? 'low');
      const need = EXPOSURE_ORDER.indexOf(a.exposureMin);
      if (need >= 0 && have < need) return false;
    }
    return true;
  }

  private materialityMultiplier(
    topicId: string | null,
    profile: AssessmentProfile,
    weights: MaterialityWeightRow[],
  ): number {
    if (!topicId) return 1;

    const dims: Array<[string, string | null]> = [
      ['sector', profile.sector],
      ['exposure', profile.exposure],
      ['entity_type', profile.entityType],
      ['size', profile.size],
    ];

    let multiplier = 1;
    for (const [dimension, value] of dims) {
      if (!value) continue;
      const match = weights.find(
        (w) =>
          w.dimension === dimension &&
          w.dimension_value === value &&
          w.materiality_topic_id === topicId,
      );
      if (match) multiplier *= Number(match.multiplier);
    }
    return multiplier;
  }

  private clampWeight(value: number): number {
    return Math.min(MAX_EFFECTIVE_WEIGHT, Math.max(MIN_EFFECTIVE_WEIGHT, value));
  }
}
